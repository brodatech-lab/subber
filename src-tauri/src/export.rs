use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::Stdio;

use serde::Serialize;
use tauri::ipc::Channel;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

use crate::tools::{TempPath, ffmpeg, hidden_command, log_error, unique_name};

#[derive(Clone, Serialize)]
pub struct ExportProgress {
    percent: f64,
}

/// Lets the webview stream exactly this video through the asset protocol. The static scope is empty,
/// so the page cannot read any other file on disk.
#[tauri::command]
pub fn allow_video(app: AppHandle, path: String) -> Result<(), String> {
    let file = Path::new(&path);
    if !file.is_file() {
        return Err(format!("Nie ma takiego pliku: {path}"));
    }
    app.asset_protocol_scope().allow_file(file).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    // UTF-8 with BOM keeps Polish characters intact in older players reading SRT.
    let mut bytes = vec![0xEF, 0xBB, 0xBF];
    bytes.extend_from_slice(content.as_bytes());
    std::fs::write(&path, bytes).map_err(|e| format!("Nie udało się zapisać {path}: {e}"))
}

/// Copies the bundled subtitle fonts next to the .ass file, so libass renders the same faces as the preview
/// even when they are not installed in Windows.
fn stage_fonts(fonts: &Path, work: &Path) -> Result<(), String> {
    let target = work.join("fonts");
    std::fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    let entries = std::fs::read_dir(fonts).map_err(|e| format!("Brak katalogu czcionek {}: {e}", fonts.display()))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("ttf") || ext.eq_ignore_ascii_case("otf")) {
            std::fs::copy(&path, target.join(entry.file_name())).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn burn(fonts: &Path, input: &str, output: &str, ass: &str, duration: f64, channel: &Channel<ExportProgress>) -> Result<(), String> {
    // The ass filter's path syntax is awkward on Windows (drive colons), so run ffmpeg inside a work dir
    // and reference the subtitle file and fonts by relative names.
    let work = TempPath::new(std::env::temp_dir().join(unique_name("subber-export")));
    std::fs::create_dir_all(work.path()).map_err(|e| e.to_string())?;
    std::fs::write(work.path().join("subs.ass"), ass).map_err(|e| e.to_string())?;
    stage_fonts(fonts, work.path())?;

    let mut child = hidden_command(ffmpeg()?)
        .current_dir(work.path())
        .args(["-y", "-hide_banner", "-nostats", "-progress", "pipe:1", "-i", input])
        .args(["-vf", "ass=subs.ass:fontsdir=fonts"])
        .args(["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p"])
        .args(["-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", output])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Nie udało się uruchomić ffmpeg: {e}"))?;

    let stderr = child.stderr.take();
    let stderr_thread = std::thread::spawn(move || {
        stderr.map(|s| BufReader::new(s).lines().map_while(Result::ok).collect::<Vec<_>>()).unwrap_or_default()
    });

    if let Some(stdout) = child.stdout.take() {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if let Some(us) = line.strip_prefix("out_time_us=").and_then(|v| v.trim().parse::<f64>().ok()) {
                let percent = if duration > 0.0 { (us / 1_000_000.0 / duration * 100.0).clamp(0.0, 99.0) } else { 0.0 };
                let _ = channel.send(ExportProgress { percent });
            }
        }
    }
    let status = child.wait().map_err(|e| e.to_string())?;
    let errors = stderr_thread.join().unwrap_or_default();
    if !status.success() {
        let tail = errors.iter().rev().take(8).rev().cloned().collect::<Vec<_>>().join("\n");
        return Err(format!("Renderowanie wideo nie powiodło się.\n{tail}"));
    }
    let _ = channel.send(ExportProgress { percent: 100.0 });
    Ok(())
}

#[tauri::command]
pub async fn burn_subtitles(
    app: AppHandle,
    input: String,
    output: String,
    ass: String,
    duration: f64,
    on_progress: Channel<ExportProgress>,
) -> Result<(), String> {
    let fonts = app.path().resolve("fonts", BaseDirectory::Resource).map_err(|e| e.to_string())?;
    let result = tauri::async_runtime::spawn_blocking(move || burn(&fonts, &input, &output, &ass, duration, &on_progress))
        .await
        .map_err(|e| e.to_string())
        .and_then(|r| r);
    if let Err(message) = &result {
        log_error(&app, "eksport wideo", message);
    }
    result
}
