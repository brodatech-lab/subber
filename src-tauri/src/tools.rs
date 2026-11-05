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

/// ffmpeg bundled next to the app executable (Tauri sidecar), otherwise the one on PATH.
pub fn ffmpeg() -> Result<PathBuf, String> {
    let bundled = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|dir| dir.join(exe_name("ffmpeg"))))
        .filter(|p| p.is_file());
    bundled.or_else(|| find_on_path("ffmpeg")).ok_or_else(|| {
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

pub fn venv_python(venv: &Path) -> PathBuf {
    if cfg!(windows) { venv.join("Scripts").join("python.exe") } else { venv.join("bin").join("python") }
}
