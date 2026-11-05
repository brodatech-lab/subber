mod export;
mod secrets;
mod stt;
mod tools;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            stt::transcribe,
            export::write_text_file,
            export::burn_subtitles,
            secrets::set_api_key,
            secrets::has_api_key,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Subber");
}
