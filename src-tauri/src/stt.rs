use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::Stdio;

use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager};

use crate::secrets;
use crate::tools::{ffmpeg, hidden_command, log_error, system_ca_bundle, system_python, venv_python, with_system_ca};

const WORKER_SOURCE: &str = include_str!("../../engine/stt_worker.py");

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SttConfig {
    engine: String,
    model: String,
    language: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Progress {
    stage: String,
    percent: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Word {
    text: String,
    start: f64,
    end: f64,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum WorkerMessage {
    Progress { stage: String, percent: f64 },
    Result { words: Vec<Word> },
    Error { message: String },
}

fn report(channel: &Channel<Progress>, stage: &str, percent: f64) {
    let _ = channel.send(Progress { stage: stage.to_string(), percent });
}

/// Python packages each engine needs; installed once into the engine virtualenv.
fn packages_for(engine: &str) -> Result<Vec<Vec<&'static str>>, String> {
    match engine {
        "faster-whisper" => Ok(vec![vec!["faster-whisper", "nvidia-cublas-cu12", "nvidia-cudnn-cu12==9.*"]]),
        "whisperx" => Ok(vec![
            vec!["torch", "torchaudio", "--index-url", "https://download.pytorch.org/whl/cu124"],
            vec!["whisperx"],
        ]),
        "openai" | "deepgram" => Ok(vec![vec!["requests"]]),
        other => Err(format!("Nieznany silnik: {other}")),
    }
}

fn run_checked(cmd: &mut std::process::Command, what: &str) -> Result<(), String> {
    let output = cmd.output().map_err(|e| format!("{what}: {e}"))?;
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    let tail: String = stderr.lines().rev().take(8).collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>().join("\n");
    Err(format!("{what} nie powiodło się:\n{tail}"))
}

/// Creates the virtualenv and installs the engine's packages on first use.
fn ensure_engine(engine_dir: &Path, engine: &str, ca: Option<&Path>, channel: &Channel<Progress>) -> Result<PathBuf, String> {
    let venv = engine_dir.join("venv");
    let python = venv_python(&venv);
    if !python.is_file() {
        report(channel, "Tworzenie środowiska silnika (jednorazowo)", 2.0);
        run_checked(hidden_command(system_python()?).args(["-m", "venv"]).arg(&venv), "Tworzenie środowiska Python")?;
        run_checked(
            with_system_ca(&mut hidden_command(&python), ca).args(["-m", "pip", "install", "--upgrade", "pip"]),
            "Aktualizacja pip",
        )?;
    }
    let marker = engine_dir.join(format!("installed-{engine}"));
    if !marker.is_file() {
        let groups = packages_for(engine)?;
        let count = groups.len() as f64;
        for (index, group) in groups.iter().enumerate() {
            report(
                channel,
                "Instalowanie silnika, pierwsze uruchomienie może potrwać kilka minut",
                3.0 + 5.0 * index as f64 / count,
            );
            run_checked(
                with_system_ca(&mut hidden_command(&python), ca)
                    .args(["-m", "pip", "install", "--disable-pip-version-check"])
                    .args(group),
                "Instalacja pakietów silnika",
            )?;
        }
        std::fs::write(&marker, "ok").map_err(|e| e.to_string())?;
    }
    Ok(python)
}

/// Adds the pip-installed CUDA DLL folders so ctranslate2 finds cuBLAS/cuDNN.
fn cuda_path(venv: &Path) -> std::ffi::OsString {
    let nvidia = venv.join("Lib").join("site-packages").join("nvidia");
    let mut dirs: Vec<PathBuf> = ["cublas", "cudnn", "cuda_runtime"]
        .iter()
        .map(|lib| nvidia.join(lib).join("bin"))
        .filter(|p| p.is_dir())
        .collect();
    if let Some(path) = std::env::var_os("PATH") {
        dirs.extend(std::env::split_paths(&path));
    }
    std::env::join_paths(dirs).unwrap_or_default()
}

fn extract_audio(video: &str, wav: &Path) -> Result<(), String> {
    run_checked(
        hidden_command(ffmpeg()?)
            .args(["-y", "-hide_banner", "-loglevel", "error", "-i", video, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le"])
            .arg(wav),
        "Wyciąganie audio (ffmpeg)",
    )
}

fn run_worker(app: &AppHandle, path: &str, config: &SttConfig, channel: &Channel<Progress>) -> Result<Vec<Word>, String> {
    let engine_dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("engine");
    std::fs::create_dir_all(&engine_dir).map_err(|e| e.to_string())?;

    report(channel, "Wyciąganie audio", 1.0);
    let wav = std::env::temp_dir().join(format!("subber-{}.wav", std::process::id()));
    extract_audio(path, &wav)?;

    // Missing system roots is not fatal: Python then falls back to its own CA list.
    let ca = system_ca_bundle(&engine_dir).ok();
    let python = ensure_engine(&engine_dir, &config.engine, ca.as_deref(), channel)?;
    let script = engine_dir.join("stt_worker.py");
    std::fs::write(&script, WORKER_SOURCE).map_err(|e| e.to_string())?;

    let mut cmd = hidden_command(&python);
    with_system_ca(&mut cmd, ca.as_deref());
    cmd.arg(&script)
        .args(["--engine", &config.engine, "--model", &config.model, "--language", &config.language, "--audio"])
        .arg(&wav)
        .env("PYTHONUTF8", "1")
        .env("PYTHONIOENCODING", "utf-8")
        .env("PATH", cuda_path(&engine_dir.join("venv")))
        .env("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    for (provider, var) in [("openai", "SUBBER_OPENAI_KEY"), ("deepgram", "SUBBER_DEEPGRAM_KEY")] {
        if let Ok(Some(key)) = secrets::read(provider) {
            cmd.env(var, key);
        }
    }

    report(channel, "Uruchamianie silnika", 4.0);
    let mut child = cmd.spawn().map_err(|e| format!("Nie udało się uruchomić silnika: {e}"))?;
    let stderr = child.stderr.take();
    let stderr_thread = std::thread::spawn(move || {
        stderr.map(|s| BufReader::new(s).lines().map_while(Result::ok).collect::<Vec<_>>()).unwrap_or_default()
    });

    let mut words = None;
    let mut failure = None;
    if let Some(stdout) = child.stdout.take() {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            match serde_json::from_str::<WorkerMessage>(&line) {
                Ok(WorkerMessage::Progress { stage, percent }) => report(channel, &stage, percent),
                Ok(WorkerMessage::Result { words: w }) => words = Some(w),
                Ok(WorkerMessage::Error { message }) => failure = Some(message),
                Err(_) => {}
            }
        }
    }
    let status = child.wait().map_err(|e| e.to_string())?;
    let stderr_lines = stderr_thread.join().unwrap_or_default();
    let _ = std::fs::remove_file(&wav);

    if let Some(message) = failure {
        return Err(message);
    }
    match words {
        Some(w) if status.success() => Ok(w),
        _ => {
            let tail = stderr_lines.iter().rev().take(10).rev().cloned().collect::<Vec<_>>().join("\n");
            Err(format!("Silnik zakończył się błędem.\n{tail}"))
        }
    }
}

#[tauri::command]
pub async fn transcribe(app: AppHandle, path: String, config: SttConfig, on_progress: Channel<Progress>) -> Result<Vec<Word>, String> {
    let handle = app.clone();
    let engine = config.engine.clone();
    let result = tauri::async_runtime::spawn_blocking(move || run_worker(&app, &path, &config, &on_progress))
        .await
        .map_err(|e| e.to_string())
        .and_then(|r| r);
    if let Err(message) = &result {
        log_error(&handle, &format!("transkrypcja ({engine})"), message);
    }
    result
}
