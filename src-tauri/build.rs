fn main() {
    // Embed Windows manifest for admin elevation (no version conflict)
    #[cfg(windows)]
    {
        use embed_manifest::{embed_manifest, new_manifest};
        use embed_manifest::manifest::{ExecutionLevel, SupportedOS};

        embed_manifest(
            new_manifest("Microdiag Sentinel")
                .requested_execution_level(ExecutionLevel::RequireAdministrator)
                .supported_os(SupportedOS::Windows10..)
        ).expect("Failed to embed manifest");
    }

    tauri_build::build();
}
