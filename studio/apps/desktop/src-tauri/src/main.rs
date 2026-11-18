// nooi Studio desktop: no console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    nooi_studio_lib::run()
}
