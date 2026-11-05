use std::path::{Path, PathBuf};
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Builds a command that never flashes a console window on Windows.
pub fn hidden_command(program: impl AsRef<std::ffi::OsStr>) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

fn exe_name(name: &str) -> String {
    if cfg!(windows) { format!("{name}.exe") } else { name.to_string() }
}

fn find_on_path(name: &str) -> Option<PathBuf> {
    let file = exe_name(name);
    std::env::var_os("PATH").and_then(|paths| {
        std::env::split_paths(&paths)
            .map(|dir| dir.join(&file))
            .find(|candidate| candidate.is_file())
    })
}

/// Places ffmpeg usually lands on Windows. Checked after PATH, because a terminal opened before
/// installing ffmpeg keeps the old PATH and passes it on to the app.
fn well_known_ffmpeg() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(local) = std::env::var_os("LOCALAPPDATA") {
        dirs.push(PathBuf::from(local).join("Microsoft").join("WinGet").join("Links"));
    }
    for var in ["ProgramFiles", "ProgramFiles(x86)"] {
        if let Some(base) = std::env::var_os(var) {
            dirs.push(PathBuf::from(base).join("ffmpeg").join("bin"));
        }
    }
    dirs.push(PathBuf::from(r"C:\ffmpeg\bin"));
    if let Some(profile) = std::env::var_os("USERPROFILE") {
        dirs.push(PathBuf::from(profile).join("scoop").join("shims"));
    }
    dirs.into_iter().map(|dir| dir.join(exe_name("ffmpeg"))).collect()
}

/// In `tauri dev` the sidecar copy used for release builds lives in src-tauri/binaries.
fn dev_sidecar() -> Option<PathBuf> {
    if !cfg!(debug_assertions) {
        return None;
    }
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("binaries").join("ffmpeg-x86_64-pc-windows-msvc.exe");
    path.is_file().then_some(path)
}

/// ffmpeg bundled next to the app executable (Tauri sidecar), then PATH, then the usual install folders.
pub fn ffmpeg() -> Result<PathBuf, String> {
    let bundled = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|dir| dir.join(exe_name("ffmpeg"))))
        .filter(|p| p.is_file());
    bundled
        .or_else(dev_sidecar)
        .or_else(|| find_on_path("ffmpeg"))
        .or_else(|| well_known_ffmpeg().into_iter().find(|p| p.is_file()))
        .ok_or_else(|| {
            "Nie znaleziono ffmpeg. Zainstaluj go (np. `winget install Gyan.FFmpeg`) i uruchom aplikację ponownie.".to_string()
        })
}

/// System Python used to create the engine virtualenv. `SUBBER_PYTHON` overrides it.
pub fn system_python() -> Result<PathBuf, String> {
    if let Some(custom) = std::env::var_os("SUBBER_PYTHON") {
        return Ok(PathBuf::from(custom));
    }
    find_on_path("python")
        .or_else(|| find_on_path("python3"))
        .ok_or_else(|| "Nie znaleziono Pythona 3.10+. Zainstaluj go z python.org i uruchom aplikację ponownie.".to_string())
}

/// Writes the operating system's trusted root certificates to a PEM file.
///
/// Python (pip, requests, huggingface_hub) ships its own CA list and ignores the Windows store, so
/// antivirus HTTPS scanning (Norton, Avast, ESET…) or a corporate proxy breaks every download with
/// CERTIFICATE_VERIFY_FAILED. Pointing Python at the system roots makes it trust what Windows trusts.
pub fn system_ca_bundle(dir: &Path) -> Result<PathBuf, String> {
    use base64::Engine as _;
    let found = rustls_native_certs::load_native_certs();
    if found.certs.is_empty() {
        return Err("Nie udało się odczytać certyfikatów systemowych.".to_string());
    }
    let mut pem = String::new();
    for cert in &found.certs {
        let encoded = base64::engine::general_purpose::STANDARD.encode(cert.as_ref());
        pem.push_str("-----BEGIN CERTIFICATE-----\n");
        for line in encoded.as_bytes().chunks(64) {
            pem.push_str(std::str::from_utf8(line).unwrap_or_default());
            pem.push('\n');
        }
        pem.push_str("-----END CERTIFICATE-----\n");
    }
    let path = dir.join("system-ca.pem");
    std::fs::write(&path, pem).map_err(|e| e.to_string())?;
    Ok(path)
}

/// Environment that makes Python networking trust the system certificate store.
pub fn with_system_ca<'a>(cmd: &'a mut Command, bundle: Option<&Path>) -> &'a mut Command {
    if let Some(bundle) = bundle {
        cmd.env("PIP_CERT", bundle).env("SSL_CERT_FILE", bundle).env("REQUESTS_CA_BUNDLE", bundle);
    }
    cmd
}

/// Appends an error to %APPDATA%\com.subber.app\subber.log, so a failure can be read after the fact.
/// Logging must never break the command itself, so its own failures are ignored.
pub fn log_error(app: &tauri::AppHandle, context: &str, message: &str) {
    use std::io::Write as _;
    use tauri::Manager as _;
    let Ok(dir) = app.path().app_data_dir() else { return };
    let _ = std::fs::create_dir_all(&dir);
    let seconds = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or_default();
    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(dir.join("subber.log")) {
        let _ = writeln!(file, "[{seconds}] {context}: {message}\n");
    }
}

pub fn venv_python(venv: &Path) -> PathBuf {
    if cfg!(windows) { venv.join("Scripts").join("python.exe") } else { venv.join("bin").join("python") }
}
