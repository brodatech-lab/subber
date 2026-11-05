//! API keys for cloud engines, kept in the Windows Credential Manager — never in project files.
use keyring::Entry;

const SERVICE: &str = "Subber";
const PROVIDERS: [&str; 2] = ["openai", "deepgram"];

fn entry(provider: &str) -> Result<Entry, String> {
    if !PROVIDERS.contains(&provider) {
        return Err(format!("Nieznany dostawca: {provider}"));
    }
    Entry::new(SERVICE, provider).map_err(|e| e.to_string())
}

pub fn read(provider: &str) -> Result<Option<String>, String> {
    match entry(provider)?.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn set_api_key(provider: String, key: String) -> Result<(), String> {
    let entry = entry(&provider)?;
    if key.trim().is_empty() {
        return match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.to_string()),
        };
    }
    entry.set_password(key.trim()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn has_api_key(provider: String) -> Result<bool, String> {
    Ok(read(&provider)?.is_some())
}
