fn main() {
    // Let Tauri handle all Windows resources (no custom manifest/version embedding)
    // Admin elevation for FixWin is handled via PowerShell -Verb RunAs when needed
    tauri_build::build();
}
