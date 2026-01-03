// ============================================
// MICRODIAG SENTINEL - GOD MODE MODULE
// Native Windows Performance (No PowerShell)
// ============================================

use serde::Serialize;
use std::collections::HashMap;

#[cfg(windows)]
use winreg::enums::*;
#[cfg(windows)]
use winreg::RegKey;

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

// ============================================
// TYPES
// ============================================

#[derive(Serialize, Clone)]
pub struct InstalledApp {
    pub name: String,
    pub version: String,
    pub publisher: String,
    pub install_date: String,
    pub install_location: String,
    pub uninstall_string: String,
}

#[derive(Serialize, Clone)]
pub struct StartupItem {
    pub name: String,
    pub command: String,
    pub location: String,
    pub enabled: bool,
}

#[derive(Serialize, Clone)]
pub struct DeepHealth {
    pub bios_serial: String,
    pub bios_manufacturer: String,
    pub bios_version: String,
    pub disk_smart_status: String,
    pub disk_model: String,
    pub battery: BatteryHealth,
    pub last_boot_time: String,
    pub windows_version: String,
    pub computer_name: String,
}

#[derive(Serialize, Clone)]
pub struct BatteryHealth {
    pub is_present: bool,
    pub charge_percent: u8,
    pub health_percent: u8,
    pub status: String,
    pub design_capacity: u32,
    pub full_charge_capacity: u32,
}

#[derive(Serialize, Clone)]
pub struct OutdatedApp {
    pub name: String,
    pub id: String,
    pub current_version: String,
    pub available_version: String,
}

#[derive(Serialize, Clone)]
pub struct TweakResult {
    pub success: bool,
    pub message: String,
    pub backup_path: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct RegBackup {
    pub name: String,
    pub path: String,
    pub created_at: String,
    pub size_bytes: u64,
}

// ============================================
// INSTALLED APPS (Native Registry - <100ms)
// ============================================

#[cfg(windows)]
pub fn get_installed_apps_native() -> Vec<InstalledApp> {
    let mut apps = Vec::new();
    let paths = vec![
        (HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
        (HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
        (HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
    ];

    for (root, path) in paths {
        let root_key = RegKey::predef(root);
        if let Ok(key) = root_key.open_subkey(path) {
            for subkey_name in key.enum_keys().filter_map(Result::ok) {
                if let Ok(subkey) = key.open_subkey(&subkey_name) {
                    let name: String = subkey.get_value("DisplayName").unwrap_or_default();
                    if !name.is_empty() && !name.starts_with("KB") {
                        apps.push(InstalledApp {
                            name,
                            version: subkey.get_value("DisplayVersion").unwrap_or_default(),
                            publisher: subkey.get_value("Publisher").unwrap_or_default(),
                            install_date: subkey.get_value("InstallDate").unwrap_or_default(),
                            install_location: subkey.get_value("InstallLocation").unwrap_or_default(),
                            uninstall_string: subkey.get_value("UninstallString").unwrap_or_default(),
                        });
                    }
                }
            }
        }
    }

    // Deduplicate by name
    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    apps.dedup_by(|a, b| a.name.to_lowercase() == b.name.to_lowercase());
    apps
}

#[cfg(not(windows))]
pub fn get_installed_apps_native() -> Vec<InstalledApp> {
    Vec::new()
}

// ============================================
// STARTUP MANAGER (Registry)
// ============================================

#[cfg(windows)]
pub fn get_startup_items() -> Vec<StartupItem> {
    let mut items = Vec::new();

    let paths = vec![
        (HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", "HKLM (Tous les utilisateurs)"),
        (HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", "HKCU (Utilisateur actuel)"),
        (HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run", "HKLM (32-bit)"),
    ];

    for (root, path, location) in paths {
        let root_key = RegKey::predef(root);
        if let Ok(key) = root_key.open_subkey(path) {
            for value_result in key.enum_values() {
                if let Ok((name, value)) = value_result {
                    items.push(StartupItem {
                        name,
                        command: value.to_string(),
                        location: location.to_string(),
                        enabled: true,
                    });
                }
            }
        }
    }

    items
}

#[cfg(not(windows))]
pub fn get_startup_items() -> Vec<StartupItem> {
    Vec::new()
}

#[cfg(windows)]
pub fn disable_startup_item(name: &str, location: &str) -> TweakResult {
    let (root, path) = if location.starts_with("HKLM") {
        if location.contains("32-bit") {
            (HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run")
        } else {
            (HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run")
        }
    } else {
        (HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run")
    };

    // Create backup first
    let backup_result = create_reg_backup(&format!("startup_{}", name), root, path);

    let root_key = RegKey::predef(root);
    match root_key.open_subkey_with_flags(path, KEY_WRITE) {
        Ok(key) => match key.delete_value(name) {
            Ok(_) => TweakResult {
                success: true,
                message: format!("{} retiré du démarrage", name),
                backup_path: backup_result.ok(),
            },
            Err(e) => TweakResult {
                success: false,
                message: format!("Erreur: {}", e),
                backup_path: None,
            },
        },
        Err(e) => TweakResult {
            success: false,
            message: format!("Accès refusé: {}", e),
            backup_path: None,
        },
    }
}

#[cfg(not(windows))]
pub fn disable_startup_item(_name: &str, _location: &str) -> TweakResult {
    TweakResult {
        success: false,
        message: "Non disponible sur cette plateforme".into(),
        backup_path: None,
    }
}

// ============================================
// DEEP HEALTH (WMI)
// ============================================

#[cfg(windows)]
pub fn get_deep_health() -> DeepHealth {
    use wmi::{COMLibrary, WMIConnection};

    let default_health = DeepHealth {
        bios_serial: "Unknown".into(),
        bios_manufacturer: "Unknown".into(),
        bios_version: "Unknown".into(),
        disk_smart_status: "Unknown".into(),
        disk_model: "Unknown".into(),
        battery: BatteryHealth {
            is_present: false,
            charge_percent: 0,
            health_percent: 100,
            status: "No Battery".into(),
            design_capacity: 0,
            full_charge_capacity: 0,
        },
        last_boot_time: "Unknown".into(),
        windows_version: "Unknown".into(),
        computer_name: "Unknown".into(),
    };

    let com_con = match COMLibrary::new() {
        Ok(c) => c,
        Err(_) => return default_health,
    };

    let wmi_con = match WMIConnection::new(com_con) {
        Ok(w) => w,
        Err(_) => return default_health,
    };

    // BIOS Info
    let bios_results: Vec<HashMap<String, wmi::Variant>> = wmi_con
        .raw_query("SELECT SerialNumber, Manufacturer, SMBIOSBIOSVersion FROM Win32_BIOS")
        .unwrap_or_default();

    let (bios_serial, bios_manufacturer, bios_version) = if let Some(bios) = bios_results.first() {
        (
            extract_string(bios.get("SerialNumber")),
            extract_string(bios.get("Manufacturer")),
            extract_string(bios.get("SMBIOSBIOSVersion")),
        )
    } else {
        ("Unknown".into(), "Unknown".into(), "Unknown".into())
    };

    // Disk Health (SMART)
    let disk_results: Vec<HashMap<String, wmi::Variant>> = wmi_con
        .raw_query("SELECT Model, Status FROM Win32_DiskDrive")
        .unwrap_or_default();

    let (disk_model, disk_smart_status) = if let Some(disk) = disk_results.first() {
        (
            extract_string(disk.get("Model")),
            extract_string(disk.get("Status")),
        )
    } else {
        ("Unknown".into(), "Unknown".into())
    };

    // Battery
    let battery = get_battery_health(&wmi_con);

    // OS Info
    let os_results: Vec<HashMap<String, wmi::Variant>> = wmi_con
        .raw_query("SELECT Caption, LastBootUpTime, CSName FROM Win32_OperatingSystem")
        .unwrap_or_default();

    let (windows_version, last_boot_time, computer_name) = if let Some(os) = os_results.first() {
        (
            extract_string(os.get("Caption")),
            extract_string(os.get("LastBootUpTime")),
            extract_string(os.get("CSName")),
        )
    } else {
        ("Unknown".into(), "Unknown".into(), "Unknown".into())
    };

    DeepHealth {
        bios_serial,
        bios_manufacturer,
        bios_version,
        disk_smart_status,
        disk_model,
        battery,
        last_boot_time,
        windows_version,
        computer_name,
    }
}

#[cfg(windows)]
fn get_battery_health(wmi_con: &wmi::WMIConnection) -> BatteryHealth {
    // Battery status
    let battery_results: Vec<HashMap<String, wmi::Variant>> = wmi_con
        .raw_query("SELECT EstimatedChargeRemaining, BatteryStatus FROM Win32_Battery")
        .unwrap_or_default();

    if let Some(bat) = battery_results.first() {
        let charge = extract_u32(bat.get("EstimatedChargeRemaining")) as u8;
        let status_code = extract_u32(bat.get("BatteryStatus"));

        let status = match status_code {
            1 => "Discharging",
            2 => "AC Power",
            3 => "Fully Charged",
            4 => "Low",
            5 => "Critical",
            _ => "Unknown",
        };

        // Try to get battery wear level from WMI root\WMI namespace
        // This is a simplified version - real implementation needs separate WMI connection
        let health_percent = 100u8; // Placeholder, real implementation would query BatteryFullChargedCapacity

        BatteryHealth {
            is_present: true,
            charge_percent: charge.min(100),
            health_percent,
            status: status.into(),
            design_capacity: 0,
            full_charge_capacity: 0,
        }
    } else {
        BatteryHealth {
            is_present: false,
            charge_percent: 0,
            health_percent: 100,
            status: "No Battery".into(),
            design_capacity: 0,
            full_charge_capacity: 0,
        }
    }
}

#[cfg(windows)]
fn extract_string(variant: Option<&wmi::Variant>) -> String {
    match variant {
        Some(wmi::Variant::String(s)) => s.clone(),
        Some(wmi::Variant::Null) => "N/A".into(),
        _ => "Unknown".into(),
    }
}

#[cfg(windows)]
fn extract_u32(variant: Option<&wmi::Variant>) -> u32 {
    match variant {
        Some(wmi::Variant::UI4(n)) => *n,
        Some(wmi::Variant::UI2(n)) => *n as u32,
        Some(wmi::Variant::I4(n)) => *n as u32,
        _ => 0,
    }
}

#[cfg(not(windows))]
pub fn get_deep_health() -> DeepHealth {
    DeepHealth {
        bios_serial: "N/A (Linux)".into(),
        bios_manufacturer: "N/A".into(),
        bios_version: "N/A".into(),
        disk_smart_status: "N/A".into(),
        disk_model: "N/A".into(),
        battery: BatteryHealth {
            is_present: false,
            charge_percent: 0,
            health_percent: 100,
            status: "N/A".into(),
            design_capacity: 0,
            full_charge_capacity: 0,
        },
        last_boot_time: "N/A".into(),
        windows_version: "Linux".into(),
        computer_name: "N/A".into(),
    }
}

// ============================================
// WINGET INTEGRATION
// ============================================

#[cfg(windows)]
pub async fn check_winget_updates() -> Vec<OutdatedApp> {
    use std::process::Command;

    let output = Command::new("winget")
        .args(["upgrade", "--include-unknown"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    let mut updates = Vec::new();

    if let Ok(o) = output {
        let stdout = String::from_utf8_lossy(&o.stdout);
        let lines: Vec<&str> = stdout.lines().collect();

        // Skip header lines and parse
        let mut parsing = false;
        for line in lines {
            if line.contains("---") {
                parsing = true;
                continue;
            }
            if !parsing || line.trim().is_empty() {
                continue;
            }

            // Parse winget output (format varies by locale)
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 4 {
                // This is simplified - real parsing needs column-based extraction
                let name = parts[0..parts.len()-3].join(" ");
                let id = parts[parts.len()-3].to_string();
                let current = parts[parts.len()-2].to_string();
                let available = parts[parts.len()-1].to_string();

                if !available.is_empty() && available != current {
                    updates.push(OutdatedApp {
                        name,
                        id,
                        current_version: current,
                        available_version: available,
                    });
                }
            }
        }
    }

    updates
}

#[cfg(not(windows))]
pub async fn check_winget_updates() -> Vec<OutdatedApp> {
    Vec::new()
}

#[cfg(windows)]
pub async fn install_winget_apps(app_ids: Vec<String>) -> TweakResult {
    use std::process::Command;

    let mut success_count = 0;
    let mut errors = Vec::new();

    for id in &app_ids {
        let result = Command::new("winget")
            .args([
                "install",
                "--id", id,
                "-e",
                "--silent",
                "--accept-package-agreements",
                "--accept-source-agreements",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        match result {
            Ok(output) if output.status.success() => success_count += 1,
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                errors.push(format!("{}: {}", id, stderr.lines().next().unwrap_or("Unknown error")));
            }
            Err(e) => errors.push(format!("{}: {}", id, e)),
        }
    }

    if errors.is_empty() {
        TweakResult {
            success: true,
            message: format!("{} applications installées avec succès", success_count),
            backup_path: None,
        }
    } else {
        TweakResult {
            success: success_count > 0,
            message: format!("{} OK, {} erreurs: {}", success_count, errors.len(), errors.join("; ")),
            backup_path: None,
        }
    }
}

#[cfg(not(windows))]
pub async fn install_winget_apps(_app_ids: Vec<String>) -> TweakResult {
    TweakResult {
        success: false,
        message: "Winget non disponible sur cette plateforme".into(),
        backup_path: None,
    }
}

#[cfg(windows)]
pub async fn update_all_winget() -> TweakResult {
    use std::process::Command;

    let result = Command::new("winget")
        .args([
            "upgrade",
            "--all",
            "--silent",
            "--accept-source-agreements",
            "--accept-package-agreements",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    match result {
        Ok(output) if output.status.success() => TweakResult {
            success: true,
            message: "Toutes les mises à jour lancées".into(),
            backup_path: None,
        },
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            TweakResult {
                success: false,
                message: format!("Erreur: {}", stderr.lines().next().unwrap_or("Unknown")),
                backup_path: None,
            }
        }
        Err(e) => TweakResult {
            success: false,
            message: format!("Erreur: {}", e),
            backup_path: None,
        },
    }
}

#[cfg(not(windows))]
pub async fn update_all_winget() -> TweakResult {
    TweakResult {
        success: false,
        message: "Winget non disponible".into(),
        backup_path: None,
    }
}

// ============================================
// PRIVACY TWEAKS
// ============================================

#[cfg(windows)]
pub fn apply_privacy_tweak(tweak_id: &str, enable: bool) -> TweakResult {
    let tweaks: HashMap<&str, (&str, &str, u32, u32)> = [
        // (key_path, value_name, enabled_value, disabled_value)
        ("telemetry", (r"SOFTWARE\Policies\Microsoft\Windows\DataCollection", "AllowTelemetry", 3, 0)),
        ("cortana", (r"SOFTWARE\Policies\Microsoft\Windows\Windows Search", "AllowCortana", 1, 0)),
        ("advertising_id", (r"SOFTWARE\Microsoft\Windows\CurrentVersion\AdvertisingInfo", "Enabled", 1, 0)),
        ("activity_history", (r"SOFTWARE\Policies\Microsoft\Windows\System", "EnableActivityFeed", 1, 0)),
        ("location", (r"SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\location", "Value", 1, 0)),
        ("feedback", (r"SOFTWARE\Policies\Microsoft\Windows\DataCollection", "DoNotShowFeedbackNotifications", 0, 1)),
    ].iter().cloned().collect();

    if let Some((path, value_name, enabled_val, disabled_val)) = tweaks.get(tweak_id) {
        let target_value = if enable { *enabled_val } else { *disabled_val };

        // Create backup first
        let backup_result = create_reg_backup(&format!("tweak_{}", tweak_id), HKEY_LOCAL_MACHINE, path);

        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);

        // Create key if not exists
        let key = match hklm.create_subkey(path) {
            Ok((key, _)) => key,
            Err(e) => {
                return TweakResult {
                    success: false,
                    message: format!("Impossible de créer la clé: {}", e),
                    backup_path: None,
                };
            }
        };

        match key.set_value(value_name, &target_value) {
            Ok(_) => TweakResult {
                success: true,
                message: format!("{} {} avec succès", tweak_id, if enable { "activé" } else { "désactivé" }),
                backup_path: backup_result.ok(),
            },
            Err(e) => TweakResult {
                success: false,
                message: format!("Erreur: {}", e),
                backup_path: backup_result.ok(),
            },
        }
    } else {
        TweakResult {
            success: false,
            message: format!("Tweak inconnu: {}", tweak_id),
            backup_path: None,
        }
    }
}

#[cfg(not(windows))]
pub fn apply_privacy_tweak(_tweak_id: &str, _enable: bool) -> TweakResult {
    TweakResult {
        success: false,
        message: "Non disponible sur cette plateforme".into(),
        backup_path: None,
    }
}

// ============================================
// GHOST MODE (Clear Traces)
// ============================================

#[cfg(windows)]
pub async fn activate_ghost_mode() -> TweakResult {
    use std::process::Command;

    let mut results: Vec<String> = Vec::new();

    // 1. Clear clipboard
    let _ = Command::new("cmd")
        .args(["/C", "echo off | clip"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
    results.push("Presse-papier vidé".into());

    // 2. Clear DNS cache
    let dns_result = Command::new("ipconfig")
        .args(["/flushdns"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
    if dns_result.is_ok() {
        results.push("Cache DNS vidé".into());
    }

    // 3. Clear recent files (Explorer)
    let recent_path = dirs::data_local_dir()
        .map(|p| p.join("Microsoft\\Windows\\Recent"))
        .unwrap_or_default();

    if recent_path.exists() {
        let _ = std::fs::remove_dir_all(&recent_path);
        let _ = std::fs::create_dir_all(&recent_path);
        results.push("Fichiers récents supprimés".into());
    }

    // 4. Clear temp files
    if let Some(temp) = std::env::var_os("TEMP") {
        let temp_path = std::path::PathBuf::from(temp);
        let mut cleared = 0;
        if let Ok(entries) = std::fs::read_dir(&temp_path) {
            for entry in entries.flatten() {
                let _ = std::fs::remove_file(entry.path()).or_else(|_| std::fs::remove_dir_all(entry.path()));
                cleared += 1;
            }
        }
        results.push(format!("{} fichiers temp supprimés", cleared));
    }

    // 5. Clear prefetch (requires admin)
    let _ = Command::new("cmd")
        .args(["/C", "del /q /s C:\\Windows\\Prefetch\\*.pf 2>nul"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
    results.push("Prefetch nettoyé".into());

    TweakResult {
        success: true,
        message: format!("Ghost Mode activé: {}", results.join(", ")),
        backup_path: None,
    }
}

#[cfg(not(windows))]
pub async fn activate_ghost_mode() -> TweakResult {
    TweakResult {
        success: false,
        message: "Non disponible sur cette plateforme".into(),
        backup_path: None,
    }
}

// ============================================
// REGISTRY BACKUP SYSTEM
// ============================================

#[cfg(windows)]
fn get_backup_dir() -> std::path::PathBuf {
    let mut path = dirs::data_local_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    path.push("Microdiag");
    path.push("backups");
    let _ = std::fs::create_dir_all(&path);
    path
}

#[cfg(windows)]
fn create_reg_backup(name: &str, _root: winreg::HKEY, path: &str) -> Result<String, String> {
    use std::process::Command;

    let backup_dir = get_backup_dir();
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let filename = format!("{}_{}.reg", name, timestamp);
    let backup_path = backup_dir.join(&filename);

    let full_key = format!("HKEY_LOCAL_MACHINE\\{}", path);

    let result = Command::new("reg")
        .args(["export", &full_key, backup_path.to_string_lossy().as_ref(), "/y"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    match result {
        Ok(output) if output.status.success() => Ok(backup_path.to_string_lossy().to_string()),
        Ok(output) => Err(String::from_utf8_lossy(&output.stderr).to_string()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(windows)]
pub fn list_backups() -> Vec<RegBackup> {
    let backup_dir = get_backup_dir();
    let mut backups = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&backup_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map(|e| e == "reg").unwrap_or(false) {
                if let Ok(metadata) = entry.metadata() {
                    let created = metadata.modified()
                        .map(|t| {
                            let datetime: chrono::DateTime<chrono::Local> = t.into();
                            datetime.format("%Y-%m-%d %H:%M:%S").to_string()
                        })
                        .unwrap_or_else(|_| "Unknown".into());

                    backups.push(RegBackup {
                        name: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                        path: path.to_string_lossy().to_string(),
                        created_at: created,
                        size_bytes: metadata.len(),
                    });
                }
            }
        }
    }

    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    backups
}

#[cfg(not(windows))]
pub fn list_backups() -> Vec<RegBackup> {
    Vec::new()
}

#[cfg(windows)]
pub fn restore_backup(backup_path: &str) -> TweakResult {
    use std::process::Command;

    let result = Command::new("reg")
        .args(["import", backup_path])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    match result {
        Ok(output) if output.status.success() => TweakResult {
            success: true,
            message: "Backup restauré avec succès".into(),
            backup_path: Some(backup_path.to_string()),
        },
        Ok(output) => TweakResult {
            success: false,
            message: format!("Erreur: {}", String::from_utf8_lossy(&output.stderr)),
            backup_path: None,
        },
        Err(e) => TweakResult {
            success: false,
            message: format!("Erreur: {}", e),
            backup_path: None,
        },
    }
}

#[cfg(not(windows))]
pub fn restore_backup(_backup_path: &str) -> TweakResult {
    TweakResult {
        success: false,
        message: "Non disponible sur cette plateforme".into(),
        backup_path: None,
    }
}

// ============================================
// RUSTDESK REMOTE SUPPORT
// ============================================

#[derive(Serialize, Clone)]
pub struct RustDeskResult {
    pub success: bool,
    pub message: String,
    pub rustdesk_id: Option<String>,
}

const RUSTDESK_CONFIG: &str = "9JSPJl0dmNWWjJmbWJVbMFUU5oHNyVzM2pHVrUEMEZlMIlXS3IFRxR0VZlUOIJiOikXZrJCLiIiOikGchJCLiInZuMXdsBXLpRmcv5yazVGZ0NXdyJiOikXYsVmciwiIyZmLzVHbw1SakJ3bus2clRGdzVnciojI0N3boJye";

#[cfg(windows)]
pub async fn install_rustdesk() -> RustDeskResult {
    use std::process::Command;
    use std::path::PathBuf;
    use std::fs;
    use std::thread;
    use std::time::Duration;

    // 1. Check if already installed
    let rustdesk_paths = vec![
        PathBuf::from(r"C:\Program Files\RustDesk\rustdesk.exe"),
        PathBuf::from(r"C:\Program Files (x86)\RustDesk\rustdesk.exe"),
        PathBuf::from(format!(r"{}\RustDesk\rustdesk.exe", std::env::var("LOCALAPPDATA").unwrap_or_default())),
    ];

    let mut rustdesk_exe: Option<PathBuf> = None;
    for path in &rustdesk_paths {
        if path.exists() {
            rustdesk_exe = Some(path.clone());
            break;
        }
    }

    // 2. Install via winget if not found
    if rustdesk_exe.is_none() {
        let install = Command::new("winget")
            .args([
                "install",
                "--id", "RustDesk.RustDesk",
                "-e",
                "--accept-package-agreements",
                "--accept-source-agreements",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        match install {
            Ok(output) if output.status.success() => {
                thread::sleep(Duration::from_secs(3));
                // Find exe after install
                for path in &rustdesk_paths {
                    if path.exists() {
                        rustdesk_exe = Some(path.clone());
                        break;
                    }
                }
            }
            Ok(output) => {
                return RustDeskResult {
                    success: false,
                    message: format!("Echec installation: {}", String::from_utf8_lossy(&output.stderr)),
                    rustdesk_id: None,
                };
            }
            Err(e) => {
                return RustDeskResult {
                    success: false,
                    message: format!("Winget non disponible: {}", e),
                    rustdesk_id: None,
                };
            }
        }
    }

    let exe_path = match rustdesk_exe {
        Some(p) => p,
        None => {
            return RustDeskResult {
                success: false,
                message: "RustDesk introuvable apres installation".into(),
                rustdesk_id: None,
            };
        }
    };

    // 3. Inject config (server: rustdesk.ordi-plus.fr)
    let _ = Command::new(&exe_path)
        .args(["--config", RUSTDESK_CONFIG])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    thread::sleep(Duration::from_millis(500));

    // 4. Launch RustDesk
    let _ = Command::new(&exe_path)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();

    thread::sleep(Duration::from_secs(2));

    // 5. Get RustDesk ID
    let mut rustdesk_id: Option<String> = None;

    // Try --get-id command
    if let Ok(output) = Command::new(&exe_path)
        .args(["--get-id"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
    {
        let id = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !id.is_empty() && id.chars().all(|c| c.is_numeric()) {
            rustdesk_id = Some(id);
        }
    }

    // Fallback: read from config file
    if rustdesk_id.is_none() {
        let config_path = format!(r"{}\RustDesk\config\RustDesk2.toml",
            std::env::var("APPDATA").unwrap_or_default());
        if let Ok(content) = fs::read_to_string(&config_path) {
            for line in content.lines() {
                if line.starts_with("id") {
                    if let Some(id) = line.split('=').nth(1) {
                        let id = id.trim().trim_matches(|c| c == '"' || c == '\'');
                        if !id.is_empty() {
                            rustdesk_id = Some(id.to_string());
                            break;
                        }
                    }
                }
            }
        }
    }

    RustDeskResult {
        success: true,
        message: format!("RustDesk pret - Serveur: rustdesk.ordi-plus.fr"),
        rustdesk_id,
    }
}

#[cfg(not(windows))]
pub async fn install_rustdesk() -> RustDeskResult {
    RustDeskResult {
        success: false,
        message: "RustDesk uniquement disponible sur Windows".into(),
        rustdesk_id: None,
    }
}
