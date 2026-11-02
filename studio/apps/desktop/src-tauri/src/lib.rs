// The window shows the studio web app (built into ../dist). Three plugins: the Save dialog, files in the app's cache folder for
// exports, and the FFmpeg sidecar that renders on this computer. Nothing else of the system is reachable from the page.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("nooi Studio could not start");
}
