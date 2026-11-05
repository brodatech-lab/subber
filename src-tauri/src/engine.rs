//! Where the speech-to-text engine lives: the Python environment, downloaded models and temp files.
//! The folder is user-selectable because it takes several GB and the system drive is often full.
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const GB: u64 = 1024 * 1024 * 1024;

#[derive(Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Settings {
    engine_dir: Option<PathBuf>,
}

fn settings_file(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_config_dir().map_err(|e| e.to_string())?.join("settings.json"))
}

fn load_settings(app: &AppHandle) -> Settings {
    settings_file(app)
        .ok()
        .and_then(|file| std::fs::read_to_string(file).ok())
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

fn save_settings(app: &AppHandle, settings: &Settings) -> Result<(), String> {
    let file = settings_file(app)?;
    if let Some(dir) = file.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    std::fs::write(file, text).map_err(|e| e.to_string())
}

/// The chosen engine folder, or the default one in %APPDATA%.
pub fn engine_dir(app: &AppHandle) -> Result<PathBuf, String> {
    match load_settings(app).engine_dir {
        Some(dir) => Ok(dir),
        None => Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join("engine")),
    }
}

/// Temp files of the engine (extracted audio, pip build dirs) stay on the engine's drive too.
pub fn temp_dir(engine_dir: &Path) -> Result<PathBuf, String> {
    let dir = engine_dir.join("tmp");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Points pip's temp files and Hugging Face model downloads at the engine folder instead of drive C:.
pub fn apply_env<'a>(cmd: &'a mut Command, engine_dir: &Path) -> Result<&'a mut Command, String> {
    let tmp = temp_dir(engine_dir)?;
    Ok(cmd
        .env("TMP", &tmp)
        .env("TEMP", &tmp)
        .env("TMPDIR", &tmp)
        .env("HF_HOME", engine_dir.join("models"))
        .env("PIP_NO_CACHE_DIR", "1"))
}

/// Disk space the first run needs: packages plus the default model plus room to unpack.
fn required_bytes(engine: &str) -> u64 {
    match engine {
        "faster-whisper" => 7 * GB,
        "whisperx" => 14 * GB,
        _ => GB,
    }
}

fn free_bytes(dir: &Path) -> Option<u64> {
    // The folder may not exist yet; measure the nearest existing parent on the same drive.
    let existing = dir.ancestors().find(|p| p.exists())?;
    fs2::available_space(existing).ok()
}

fn gb(bytes: u64) -> String {
    format!("{:.1} GB", bytes as f64 / GB as f64)
}

pub fn is_installed(engine_dir: &Path, engine: &str) -> bool {
    engine_dir.join(format!("installed-{engine}")).is_file()
}

/// Fails with a readable message before downloading anything when the drive is too full.
pub fn check_space(engine_dir: &Path, engine: &str) -> Result<(), String> {
    let needed = required_bytes(engine);
    match free_bytes(engine_dir) {
        Some(free) if free < needed => Err(format!(
            "Za mało miejsca na dysku dla silnika: wolne {}, potrzeba około {}.\nFolder: {}\nWybierz inny folder silnika w oknie generowania napisów.",
            gb(free),
            gb(needed),
            engine_dir.display()
        )),
        _ => Ok(()),
    }
}

/// Adds a hint to "disk full" errors coming from pip or the model download.
pub fn explain_disk_full(message: String, engine_dir: &Path) -> String {
    if message.contains("No space left") || message.contains("Errno 28") {
        format!(
            "{message}\n\nNa dysku z folderem silnika ({}) skończyło się miejsce. Wybierz inny folder silnika w oknie generowania napisów.",
            engine_dir.display()
        )
    } else {
        message
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineLocation {
    path: String,
    free_bytes: Option<u64>,
    required_bytes: u64,
    installed: bool,
}

#[tauri::command]
pub fn engine_location(app: AppHandle, engine: String) -> Result<EngineLocation, String> {
    let dir = engine_dir(&app)?;
    Ok(EngineLocation {
        path: dir.display().to_string(),
        free_bytes: free_bytes(&dir),
        required_bytes: required_bytes(&engine),
        installed: is_installed(&dir, &engine),
    })
}

/// Saves a new engine folder. Nothing is moved: the engine installs there on the next transcription.
#[tauri::command]
pub fn set_engine_location(app: AppHandle, path: String) -> Result<(), String> {
    let dir = PathBuf::from(path.trim());
    if !dir.is_absolute() {
        return Err("Podaj pełną ścieżkę do folderu.".to_string());
    }
    std::fs::create_dir_all(&dir).map_err(|e| format!("Nie mogę utworzyć folderu {}: {e}", dir.display()))?;
    let probe = dir.join(".subber-write-test");
    std::fs::write(&probe, b"ok").map_err(|e| format!("Brak prawa zapisu w {}: {e}", dir.display()))?;
    let _ = std::fs::remove_file(probe);
    save_settings(&app, &Settings { engine_dir: Some(dir) })
}
