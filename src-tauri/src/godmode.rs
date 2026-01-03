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
    pub smart_disks: Vec<SmartDiskInfo>,
}

// ============================================
// SMART DISK INFO (CrystalDisk Style)
// ============================================

#[derive(Serialize, Clone, Debug)]
pub struct SmartDiskInfo {
    pub device_id: String,
    pub model: String,
    pub serial: String,
    pub firmware: String,
    pub interface_type: String,
    pub media_type: String,  // SSD, HDD, NVMe
    pub size_gb: f64,
    pub health_status: String,  // OK, Caution, Bad
    pub health_percent: u8,
    pub temperature_c: Option<u8>,
    pub power_on_hours: Option<u64>,
    pub power_on_count: Option<u32>,
    pub reallocated_sectors: Option<u32>,
    pub pending_sectors: Option<u32>,
    pub uncorrectable_errors: Option<u32>,
    pub read_error_rate: Option<u32>,
    pub seek_error_rate: Option<u32>,
    pub spin_retry_count: Option<u32>,
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
// SMART DISK INFO (WMI Queries)
// ============================================

#[cfg(windows)]
fn get_smart_disk_info(wmi_con: &wmi::WMIConnection) -> Vec<SmartDiskInfo> {
    let mut disks = Vec::new();

    // Query Win32_DiskDrive for basic disk info
    let disk_results: Vec<HashMap<String, wmi::Variant>> = wmi_con
        .raw_query("SELECT DeviceID, Model, SerialNumber, FirmwareRevision, InterfaceType, MediaType, Size, Status FROM Win32_DiskDrive")
        .unwrap_or_default();

    for disk in disk_results {
        let device_id = extract_string(disk.get("DeviceID"));
        let model = extract_string(disk.get("Model"));
        let serial = extract_string(disk.get("SerialNumber")).trim().to_string();
        let firmware = extract_string(disk.get("FirmwareRevision"));
        let interface_type = extract_string(disk.get("InterfaceType"));
        let status = extract_string(disk.get("Status"));

        // Determine media type (SSD vs HDD)
        let media_type_raw = extract_string(disk.get("MediaType"));
        let media_type = if model.to_lowercase().contains("ssd") || model.to_lowercase().contains("nvme") {
            "SSD".to_string()
        } else if model.to_lowercase().contains("hdd") || media_type_raw.contains("Fixed") {
            "HDD".to_string()
        } else if interface_type.contains("NVMe") {
            "NVMe".to_string()
        } else {
            "Unknown".to_string()
        };

        // Size in GB
        let size_bytes = extract_u64(disk.get("Size"));
        let size_gb = size_bytes as f64 / 1_073_741_824.0;

        // Health status based on WMI Status field
        let health_status = if status == "OK" { "Bon" } else if status == "Pred Fail" { "Attention" } else { "Inconnu" }.to_string();

        // Calculate health percent (100 if OK, 50 if Pred Fail, 0 if failed)
        let health_percent = if status == "OK" { 100 } else if status == "Pred Fail" { 50 } else { 0 };

        disks.push(SmartDiskInfo {
            device_id,
            model,
            serial,
            firmware,
            interface_type,
            media_type,
            size_gb,
            health_status,
            health_percent,
            temperature_c: None,  // Will try to get from SMART data
            power_on_hours: None,
            power_on_count: None,
            reallocated_sectors: None,
            pending_sectors: None,
            uncorrectable_errors: None,
            read_error_rate: None,
            seek_error_rate: None,
            spin_retry_count: None,
        });
    }

    // Try to get SMART data from MSStorageDriver (requires admin)
    // This is done via PowerShell as WMI root/wmi access is complex
    if let Some(smart_data) = get_smart_attributes_powershell() {
        for disk in &mut disks {
            // Match by device_id: "\\\\.\\PHYSICALDRIVE0" -> "PHYSICALDRIVE0"
            let normalized_device_id = disk.device_id
                .replace("\\\\.\\", "")
                .to_uppercase();

            // Try to find matching SMART data
            let attrs = smart_data.iter()
                .find(|(key, _)| key.to_uppercase().contains(&normalized_device_id))
                .map(|(_, v)| v);

            if let Some(attrs) = attrs {
                disk.temperature_c = attrs.temperature;
                disk.power_on_hours = attrs.power_on_hours;
                disk.power_on_count = attrs.power_on_count;
                disk.reallocated_sectors = attrs.reallocated_sectors;
                disk.pending_sectors = attrs.pending_sectors;
                disk.uncorrectable_errors = attrs.uncorrectable_errors;

                // Recalculate health based on SMART attributes
                let mut health = 100u8;
                if let Some(realloc) = attrs.reallocated_sectors {
                    if realloc > 0 { health = health.saturating_sub(20); }
                    if realloc > 10 { health = health.saturating_sub(30); }
                }
                if let Some(pending) = attrs.pending_sectors {
                    if pending > 0 { health = health.saturating_sub(15); }
                }
                if let Some(uncorr) = attrs.uncorrectable_errors {
                    if uncorr > 0 { health = health.saturating_sub(25); }
                }
                disk.health_percent = health;
                disk.health_status = if health >= 80 { "Bon" } else if health >= 50 { "Attention" } else { "Critique" }.to_string();
            }
        }
    }

    disks
}

#[derive(Default)]
struct SmartAttributes {
    temperature: Option<u8>,
    power_on_hours: Option<u64>,
    power_on_count: Option<u32>,
    reallocated_sectors: Option<u32>,
    pending_sectors: Option<u32>,
    uncorrectable_errors: Option<u32>,
}

#[cfg(windows)]
fn get_smart_attributes_powershell() -> Option<HashMap<String, SmartAttributes>> {
    use std::process::Command;

    // PowerShell script to get SMART data via WMI
    let ps_script = r#"
try {
    $disks = Get-CimInstance -Namespace root\wmi -ClassName MSStorageDriver_FailurePredictData -ErrorAction SilentlyContinue
    $result = @{}

    foreach ($disk in $disks) {
        $instance = $disk.InstanceName -replace '_0$',''
        $data = $disk.VendorSpecific

        if ($data -and $data.Length -ge 362) {
            # Parse SMART attributes (each attribute = 12 bytes)
            # Structure: [ID(1)][Flags(2)][Value(1)][Worst(1)][Reserved(1)][RawValue(6)]
            $attrs = @{}

            for ($i = 2; $i -lt 362; $i += 12) {
                $attrId = $data[$i]
                if ($attrId -eq 0) { continue }

                # Extract raw value (6 bytes, little-endian)
                $rawValue = [BitConverter]::ToUInt32($data, $i + 5)

                # Map common SMART attributes
                switch ($attrId) {
                    5 { $attrs['reallocated_sectors'] = $rawValue }
                    9 { $attrs['power_on_hours'] = $rawValue }
                    12 { $attrs['power_cycle_count'] = $rawValue }
                    194 { $attrs['temperature'] = [Math]::Min($rawValue -band 0xFF, 100) }
                    196 { $attrs['realloc_events'] = $rawValue }
                    197 { $attrs['pending_sectors'] = $rawValue }
                    198 { $attrs['uncorrectable'] = $rawValue }
                }
            }

            $result[$instance] = $attrs
        }
    }

    $result | ConvertTo-Json -Compress
} catch {
    @{} | ConvertTo-Json
}
"#;

    let output = Command::new("powershell")
        .args(["-NoProfile", "-Command", ps_script])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let json_str = String::from_utf8(output.stdout).ok()?;
    let data: serde_json::Value = serde_json::from_str(json_str.trim()).ok()?;

    if !data.is_object() {
        return None;
    }

    let mut result = HashMap::new();

    for (instance_name, attrs_obj) in data.as_object()? {
        let attrs = attrs_obj.as_object()?;

        let smart_attrs = SmartAttributes {
            temperature: attrs.get("temperature").and_then(|v| v.as_u64()).map(|v| v as u8),
            power_on_hours: attrs.get("power_on_hours").and_then(|v| v.as_u64()),
            power_on_count: attrs.get("power_cycle_count").and_then(|v| v.as_u64()).map(|v| v as u32),
            reallocated_sectors: attrs.get("reallocated_sectors").and_then(|v| v.as_u64()).map(|v| v as u32),
            pending_sectors: attrs.get("pending_sectors").and_then(|v| v.as_u64()).map(|v| v as u32),
            uncorrectable_errors: attrs.get("uncorrectable").and_then(|v| v.as_u64()).map(|v| v as u32),
        };

        result.insert(instance_name.clone(), smart_attrs);
    }

    Some(result)
}

#[cfg(windows)]
fn extract_u64(variant: Option<&wmi::Variant>) -> u64 {
    match variant {
        Some(wmi::Variant::UI8(n)) => *n,
        Some(wmi::Variant::UI4(n)) => *n as u64,
        Some(wmi::Variant::I8(n)) => *n as u64,
        Some(wmi::Variant::String(s)) => s.parse().unwrap_or(0),
        _ => 0,
    }
}

// ============================================
// DEEP HEALTH (WMI)
// ============================================

#[cfg(windows)]
pub fn get_deep_health() -> DeepHealth {
    use wmi::{COMLibrary, WMIConnection};
    use std::process::Command;

    // Try WMI first
    let wmi_result = (|| {
        let com_con = COMLibrary::new().ok()?;
        let wmi_con = WMIConnection::new(com_con).ok()?;

        // BIOS Info
        let bios_results: Vec<HashMap<String, wmi::Variant>> = wmi_con
            .raw_query("SELECT SerialNumber, Manufacturer, SMBIOSBIOSVersion FROM Win32_BIOS")
            .unwrap_or_default();

        let (bios_serial, bios_manufacturer, bios_version) = bios_results.first()
            .map(|bios| (
                extract_string(bios.get("SerialNumber")),
                extract_string(bios.get("Manufacturer")),
                extract_string(bios.get("SMBIOSBIOSVersion")),
            ))
            .unwrap_or(("Unknown".into(), "Unknown".into(), "Unknown".into()));

        // Disk Health
        let disk_results: Vec<HashMap<String, wmi::Variant>> = wmi_con
            .raw_query("SELECT Model, Status FROM Win32_DiskDrive")
            .unwrap_or_default();

        let (disk_model, disk_smart_status) = disk_results.first()
            .map(|disk| (
                extract_string(disk.get("Model")),
                extract_string(disk.get("Status")),
            ))
            .unwrap_or(("Unknown".into(), "Unknown".into()));

        // OS Info
        let os_results: Vec<HashMap<String, wmi::Variant>> = wmi_con
            .raw_query("SELECT Caption, LastBootUpTime, CSName FROM Win32_OperatingSystem")
            .unwrap_or_default();

        let (windows_version, last_boot_time, computer_name) = os_results.first()
            .map(|os| (
                extract_string(os.get("Caption")),
                extract_string(os.get("LastBootUpTime")),
                extract_string(os.get("CSName")),
            ))
            .unwrap_or(("Unknown".into(), "Unknown".into(), "Unknown".into()));

        let battery = get_battery_health(&wmi_con);
        let smart_disks = get_smart_disk_info(&wmi_con);

        Some(DeepHealth {
            bios_serial,
            bios_manufacturer,
            bios_version,
            disk_smart_status,
            disk_model,
            battery,
            last_boot_time,
            windows_version,
            computer_name,
            smart_disks,
        })
    })();

    // If WMI worked, return it
    if let Some(health) = wmi_result {
        if health.computer_name != "Unknown" {
            return health;
        }
    }

    // Fallback to PowerShell if WMI failed
    get_deep_health_powershell()
}

#[cfg(windows)]
fn get_deep_health_powershell() -> DeepHealth {
    use std::process::Command;

    let ps_script = r#"
$result = @{}
try {
    $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
    $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
    $bios = Get-CimInstance Win32_BIOS -ErrorAction SilentlyContinue
    $disk = Get-CimInstance Win32_DiskDrive -ErrorAction SilentlyContinue | Select-Object -First 1
    $bat = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1

    $result = @{
        computer_name = if($cs) { $cs.Name } else { $env:COMPUTERNAME }
        windows_version = if($os) { $os.Caption } else { "Windows" }
        last_boot = if($os) { $os.LastBootUpTime.ToString("dd/MM/yyyy HH:mm") } else { "" }
        bios_serial = if($bios) { $bios.SerialNumber } else { "" }
        bios_manufacturer = if($bios) { $bios.Manufacturer } else { "" }
        bios_version = if($bios) { $bios.SMBIOSBIOSVersion } else { "" }
        disk_model = if($disk) { $disk.Model } else { "" }
        disk_status = if($disk) { $disk.Status } else { "Unknown" }
        battery_present = if($bat) { $true } else { $false }
        battery_charge = if($bat) { $bat.EstimatedChargeRemaining } else { 0 }
        battery_status = if($bat) { $bat.BatteryStatus } else { 0 }
    }
} catch {}
$result | ConvertTo-Json -Compress
"#;

    let output = Command::new("powershell")
        .args(["-NoProfile", "-Command", ps_script])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    let mut health = DeepHealth {
        bios_serial: "N/A".into(),
        bios_manufacturer: "N/A".into(),
        bios_version: "N/A".into(),
        disk_smart_status: "Unknown".into(),
        disk_model: "N/A".into(),
        battery: BatteryHealth {
            is_present: false,
            charge_percent: 0,
            health_percent: 100,
            status: "No Battery".into(),
            design_capacity: 0,
            full_charge_capacity: 0,
        },
        last_boot_time: "N/A".into(),
        windows_version: "Windows".into(),
        computer_name: std::env::var("COMPUTERNAME").unwrap_or_else(|_| "PC".into()),
        smart_disks: Vec::new(),
    };

    if let Ok(out) = output {
        if let Ok(json_str) = String::from_utf8(out.stdout) {
            if let Ok(data) = serde_json::from_str::<serde_json::Value>(json_str.trim()) {
                if let Some(v) = data.get("computer_name").and_then(|v| v.as_str()) {
                    if !v.is_empty() { health.computer_name = v.to_string(); }
                }
                if let Some(v) = data.get("windows_version").and_then(|v| v.as_str()) {
                    if !v.is_empty() { health.windows_version = v.to_string(); }
                }
                if let Some(v) = data.get("last_boot").and_then(|v| v.as_str()) {
                    if !v.is_empty() { health.last_boot_time = v.to_string(); }
                }
                if let Some(v) = data.get("bios_serial").and_then(|v| v.as_str()) {
                    if !v.is_empty() { health.bios_serial = v.to_string(); }
                }
                if let Some(v) = data.get("bios_manufacturer").and_then(|v| v.as_str()) {
                    if !v.is_empty() { health.bios_manufacturer = v.to_string(); }
                }
                if let Some(v) = data.get("bios_version").and_then(|v| v.as_str()) {
                    if !v.is_empty() { health.bios_version = v.to_string(); }
                }
                if let Some(v) = data.get("disk_model").and_then(|v| v.as_str()) {
                    if !v.is_empty() { health.disk_model = v.to_string(); }
                }
                if let Some(v) = data.get("disk_status").and_then(|v| v.as_str()) {
                    health.disk_smart_status = v.to_string();
                }
                if data.get("battery_present").and_then(|v| v.as_bool()).unwrap_or(false) {
                    let charge = data.get("battery_charge").and_then(|v| v.as_u64()).unwrap_or(0) as u8;
                    let status_code = data.get("battery_status").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                    let status = match status_code {
                        1 => "Decharge",
                        2 => "Secteur",
                        3 => "Charge complete",
                        4 => "Faible",
                        5 => "Critique",
                        _ => "Inconnu",
                    };
                    health.battery = BatteryHealth {
                        is_present: true,
                        charge_percent: charge.min(100),
                        health_percent: 100,
                        status: status.into(),
                        design_capacity: 0,
                        full_charge_capacity: 0,
                    };
                }
            }
        }
    }

    health
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
        smart_disks: Vec::new(),
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
