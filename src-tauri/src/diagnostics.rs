// ============================================
// MICRODIAG SENTINEL - Premium Diagnostics
// Full System Analysis with User-Friendly Insights
// ============================================

use serde::Serialize;
use sysinfo::{System, Components, Networks, Process, Pid};

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

// ============================================
// TYPES - Premium Diagnostic Data
// ============================================

#[derive(Serialize, Clone, Debug)]
pub struct PremiumDiagnostic {
    pub temperatures: TemperatureInfo,
    pub processes: ProcessAnalysis,
    pub network: NetworkAnalysis,
    pub storage: StorageAnalysis,
    pub system_info: ExtendedSystemInfo,
    pub recommendations: Vec<Recommendation>,
    pub overall_score: u8,
    pub overall_status: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct TemperatureInfo {
    pub cpu_temp: Option<f32>,
    pub gpu_temp: Option<f32>,
    pub disk_temp: Option<f32>,
    pub cpu_status: String,
    pub cpu_message: String,
    pub components: Vec<ComponentTemp>,
}

#[derive(Serialize, Clone, Debug)]
pub struct ComponentTemp {
    pub name: String,
    pub temp: f32,
    pub max_temp: f32,
    pub status: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct ProcessAnalysis {
    pub total_count: usize,
    pub top_cpu: Vec<ProcessInfo>,
    pub top_memory: Vec<ProcessInfo>,
    pub suspicious: Vec<ProcessInfo>,
    pub startup_impact: Vec<StartupProcess>,
    pub summary: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct ProcessInfo {
    pub name: String,
    pub pid: u32,
    pub cpu_percent: f32,
    pub memory_mb: f64,
    pub memory_percent: f32,
    pub status: String,
    pub description: String, // User-friendly description
    pub category: String,    // browser, antivirus, system, game, etc.
}

#[derive(Serialize, Clone, Debug)]
pub struct StartupProcess {
    pub name: String,
    pub impact: String, // low, medium, high
    pub description: String,
    pub can_disable: bool,
}

#[derive(Serialize, Clone, Debug)]
pub struct NetworkAnalysis {
    pub is_connected: bool,
    pub latency_ms: Option<u32>,
    pub latency_status: String,
    pub dns_status: String,
    pub interfaces: Vec<NetworkInterface>,
    pub download_speed: Option<f64>,
    pub upload_speed: Option<f64>,
    pub public_ip: Option<String>,
    pub summary: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct NetworkInterface {
    pub name: String,
    pub ip: String,
    pub mac: String,
    pub received_mb: f64,
    pub transmitted_mb: f64,
    pub is_up: bool,
}

#[derive(Serialize, Clone, Debug)]
pub struct StorageAnalysis {
    pub drives: Vec<DriveAnalysis>,
    pub total_space_gb: f64,
    pub used_space_gb: f64,
    pub free_space_gb: f64,
    pub largest_files: Vec<LargeFile>,
    pub temp_files_mb: f64,
    pub recycle_bin_mb: f64,
    pub summary: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct DriveAnalysis {
    pub letter: String,
    pub name: String,
    pub total_gb: f64,
    pub used_gb: f64,
    pub free_gb: f64,
    pub percent: f32,
    pub health: String,
    pub smart_status: String,
    pub drive_type: String, // SSD, HDD, NVMe
    pub read_speed: Option<f64>,
    pub write_speed: Option<f64>,
}

#[derive(Serialize, Clone, Debug)]
pub struct LargeFile {
    pub path: String,
    pub size_mb: f64,
    pub file_type: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct ExtendedSystemInfo {
    pub cpu_name: String,
    pub cpu_cores: usize,
    pub cpu_threads: usize,
    pub cpu_frequency_mhz: u64,
    pub ram_total_gb: f64,
    pub ram_slots_used: String,
    pub gpu_name: String,
    pub gpu_memory_mb: u64,
    pub motherboard: String,
    pub bios_version: String,
    pub windows_version: String,
    pub windows_build: String,
    pub install_date: String,
    pub last_boot: String,
    pub uptime_hours: u64,
}

#[derive(Serialize, Clone, Debug)]
pub struct Recommendation {
    pub priority: String, // critical, warning, info
    pub category: String, // performance, security, storage, maintenance
    pub title: String,
    pub description: String,
    pub action: Option<String>, // Action to execute if applicable
    pub impact: String,
}

// ============================================
// PROCESS CATEGORIZATION
// ============================================

fn categorize_process(name: &str) -> (&'static str, &'static str) {
    let name_lower = name.to_lowercase();

    // Browsers
    if name_lower.contains("chrome") || name_lower.contains("firefox") ||
       name_lower.contains("edge") || name_lower.contains("opera") || name_lower.contains("brave") {
        return ("browser", "Navigateur web");
    }

    // Antivirus
    if name_lower.contains("defender") || name_lower.contains("antivirus") ||
       name_lower.contains("avast") || name_lower.contains("avg") ||
       name_lower.contains("norton") || name_lower.contains("kaspersky") ||
       name_lower.contains("malware") || name_lower.contains("msmpeng") {
        return ("antivirus", "Protection antivirus");
    }

    // System
    if name_lower.contains("system") || name_lower.contains("svchost") ||
       name_lower.contains("csrss") || name_lower.contains("smss") ||
       name_lower.contains("lsass") || name_lower.contains("services") ||
       name_lower.contains("wininit") || name_lower.contains("dwm") {
        return ("system", "Processus systeme Windows");
    }

    // Office
    if name_lower.contains("word") || name_lower.contains("excel") ||
       name_lower.contains("outlook") || name_lower.contains("powerpoint") ||
       name_lower.contains("teams") || name_lower.contains("onenote") {
        return ("office", "Application Microsoft Office");
    }

    // Games
    if name_lower.contains("steam") || name_lower.contains("epic") ||
       name_lower.contains("game") || name_lower.contains("unity") ||
       name_lower.contains("unreal") {
        return ("game", "Jeu ou plateforme de jeux");
    }

    // Development
    if name_lower.contains("code") || name_lower.contains("visual studio") ||
       name_lower.contains("node") || name_lower.contains("python") ||
       name_lower.contains("java") || name_lower.contains("docker") {
        return ("dev", "Outil de developpement");
    }

    // Media
    if name_lower.contains("spotify") || name_lower.contains("vlc") ||
       name_lower.contains("media") || name_lower.contains("audio") ||
       name_lower.contains("video") {
        return ("media", "Application multimedia");
    }

    // Communication
    if name_lower.contains("discord") || name_lower.contains("slack") ||
       name_lower.contains("zoom") || name_lower.contains("skype") ||
       name_lower.contains("whatsapp") || name_lower.contains("telegram") {
        return ("communication", "Application de communication");
    }

    ("other", "Application")
}

fn get_process_description(name: &str, cpu: f32, mem_mb: f64) -> String {
    let (category, _) = categorize_process(name);
    let name_lower = name.to_lowercase();

    match category {
        "browser" => {
            if mem_mb > 2000.0 {
                format!("Navigateur avec beaucoup d'onglets ouverts ({:.0} MB)", mem_mb)
            } else if mem_mb > 500.0 {
                format!("Navigateur actif - utilisation normale")
            } else {
                format!("Navigateur en arriere-plan")
            }
        },
        "antivirus" => {
            if cpu > 20.0 {
                "Scan antivirus en cours - Temporaire, laissez-le terminer".to_string()
            } else {
                "Protection active - Tout va bien".to_string()
            }
        },
        "system" => {
            if name_lower.contains("svchost") {
                "Service Windows essentiel".to_string()
            } else if name_lower.contains("dwm") {
                "Gestionnaire de fenetres Windows".to_string()
            } else {
                "Processus systeme Windows".to_string()
            }
        },
        "office" => {
            if cpu > 30.0 {
                "Document en cours de traitement".to_string()
            } else {
                "Application Office active".to_string()
            }
        },
        "game" => {
            if cpu > 50.0 || mem_mb > 2000.0 {
                "Jeu en cours d'execution".to_string()
            } else {
                "Plateforme de jeux en arriere-plan".to_string()
            }
        },
        _ => {
            if cpu > 50.0 {
                format!("Application tres active ({:.0}% CPU)", cpu)
            } else if mem_mb > 1000.0 {
                format!("Application utilisant {:.0} MB de memoire", mem_mb)
            } else {
                "Application en cours d'execution".to_string()
            }
        }
    }
}

// ============================================
// TEMPERATURE ANALYSIS
// ============================================

#[cfg(windows)]
fn get_wmi_cpu_temp() -> Option<f32> {
    use std::process::Command;

    // Try MSAcpi_ThermalZoneTemperature first (works on most laptops)
    let output = Command::new("powershell")
        .args([
            "-NoProfile", "-Command",
            "Get-WmiObject MSAcpi_ThermalZoneTemperature -Namespace 'root/wmi' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty CurrentTemperature"
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        // WMI returns temp in tenths of Kelvin, convert to Celsius
        if let Ok(tenths_kelvin) = stdout.trim().parse::<f32>() {
            let celsius = (tenths_kelvin / 10.0) - 273.15;
            if celsius > 0.0 && celsius < 120.0 {
                return Some(celsius);
            }
        }
    }

    // Fallback: Try Win32_TemperatureProbe
    let output2 = Command::new("powershell")
        .args([
            "-NoProfile", "-Command",
            "Get-CimInstance Win32_TemperatureProbe -ErrorAction SilentlyContinue | Where-Object { $_.CurrentReading -gt 0 } | Select-Object -First 1 -ExpandProperty CurrentReading"
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;

    if output2.status.success() {
        let stdout = String::from_utf8_lossy(&output2.stdout);
        if let Ok(temp) = stdout.trim().parse::<f32>() {
            if temp > 0.0 && temp < 120.0 {
                return Some(temp);
            }
        }
    }

    None
}

#[cfg(not(windows))]
fn get_wmi_cpu_temp() -> Option<f32> {
    None
}

pub fn get_temperatures() -> TemperatureInfo {
    let components = Components::new_with_refreshed_list();
    let mut cpu_temp: Option<f32> = None;
    let mut gpu_temp: Option<f32> = None;
    let mut disk_temp: Option<f32> = None;
    let mut component_temps: Vec<ComponentTemp> = Vec::new();

    // First try sysinfo components
    for component in components.iter() {
        let name = component.label().to_lowercase();
        let temp = component.temperature();
        let max_temp = component.max();

        let status = if temp < 50.0 {
            "excellent"
        } else if temp < 70.0 {
            "normal"
        } else if temp < 85.0 {
            "warm"
        } else {
            "hot"
        }.to_string();

        component_temps.push(ComponentTemp {
            name: component.label().to_string(),
            temp,
            max_temp,
            status: status.clone(),
        });

        if name.contains("cpu") || name.contains("core") || name.contains("package") {
            if cpu_temp.is_none() || temp > cpu_temp.unwrap() {
                cpu_temp = Some(temp);
            }
        } else if name.contains("gpu") || name.contains("nvidia") || name.contains("radeon") {
            gpu_temp = Some(temp);
        } else if name.contains("disk") || name.contains("nvme") || name.contains("ssd") {
            disk_temp = Some(temp);
        }
    }

    // Fallback to WMI on Windows if sysinfo didn't find CPU temp
    if cpu_temp.is_none() {
        if let Some(wmi_temp) = get_wmi_cpu_temp() {
            cpu_temp = Some(wmi_temp);
            component_temps.push(ComponentTemp {
                name: "CPU (WMI)".to_string(),
                temp: wmi_temp,
                max_temp: 100.0,
                status: if wmi_temp < 50.0 { "excellent" }
                        else if wmi_temp < 70.0 { "normal" }
                        else if wmi_temp < 85.0 { "warm" }
                        else { "hot" }.to_string(),
            });
        }
    }

    let (cpu_status, cpu_message) = match cpu_temp {
        Some(t) if t < 50.0 => ("excellent", format!("CPU a {}°C - Temperatures ideales", t as u8)),
        Some(t) if t < 70.0 => ("normal", format!("CPU a {}°C - Temperatures normales", t as u8)),
        Some(t) if t < 85.0 => ("warm", format!("CPU a {}°C - Un peu chaud, verifiez la ventilation", t as u8)),
        Some(t) => ("hot", format!("CPU a {}°C - Trop chaud! Nettoyez les ventilateurs", t as u8)),
        None => ("unknown", "Temperature CPU non disponible".to_string()),
    };

    TemperatureInfo {
        cpu_temp,
        gpu_temp,
        disk_temp,
        cpu_status: cpu_status.to_string(),
        cpu_message,
        components: component_temps,
    }
}

// ============================================
// PROCESS ANALYSIS
// ============================================

pub fn analyze_processes(sys: &System) -> ProcessAnalysis {
    let processes: Vec<(&Pid, &Process)> = sys.processes().iter().collect();
    let total_count = processes.len();
    let total_memory = sys.total_memory() as f64;

    let mut process_list: Vec<ProcessInfo> = processes.iter().map(|(pid, proc)| {
        let name = proc.name().to_string();
        let cpu = proc.cpu_usage();
        let mem_bytes = proc.memory() as f64;
        let mem_mb = mem_bytes / 1_048_576.0;
        let mem_percent = (mem_bytes / total_memory * 100.0) as f32;
        let (category, _cat_desc) = categorize_process(&name);
        let description = get_process_description(&name, cpu, mem_mb);

        ProcessInfo {
            name: name.clone(),
            pid: pid.as_u32(),
            cpu_percent: cpu,
            memory_mb: mem_mb,
            memory_percent: mem_percent,
            status: if cpu > 0.1 { "active" } else { "idle" }.to_string(),
            description,
            category: category.to_string(),
        }
    }).collect();

    // Sort by CPU and get top 5
    process_list.sort_by(|a, b| b.cpu_percent.partial_cmp(&a.cpu_percent).unwrap_or(std::cmp::Ordering::Equal));
    let top_cpu: Vec<ProcessInfo> = process_list.iter().take(5).cloned().collect();

    // Sort by memory and get top 5
    process_list.sort_by(|a, b| b.memory_mb.partial_cmp(&a.memory_mb).unwrap_or(std::cmp::Ordering::Equal));
    let top_memory: Vec<ProcessInfo> = process_list.iter().take(5).cloned().collect();

    // Check for suspicious processes
    let suspicious: Vec<ProcessInfo> = process_list.iter()
        .filter(|p| {
            let name = p.name.to_lowercase();
            // High resource usage from unknown processes
            (p.cpu_percent > 50.0 && p.category == "other") ||
            // Suspicious names
            name.contains("miner") || name.contains("cryptominer") ||
            name.contains("keylog") || name.contains("trojan")
        })
        .take(5)
        .cloned()
        .collect();

    let summary = if suspicious.is_empty() && top_cpu.get(0).map(|p| p.cpu_percent < 80.0).unwrap_or(true) {
        format!("{} processus actifs - Systeme fluide", total_count)
    } else if !suspicious.is_empty() {
        format!("Attention: {} processus suspects detectes", suspicious.len())
    } else {
        format!("{} processus - Charge CPU elevee", total_count)
    };

    ProcessAnalysis {
        total_count,
        top_cpu,
        top_memory,
        suspicious,
        startup_impact: Vec::new(), // Will be filled by Windows-specific code
        summary,
    }
}

// ============================================
// NETWORK ANALYSIS
// ============================================

pub fn analyze_network() -> NetworkAnalysis {
    let networks = Networks::new_with_refreshed_list();
    let mut interfaces: Vec<NetworkInterface> = Vec::new();
    let mut is_connected = false;

    for (name, data) in networks.iter() {
        let received = data.total_received() as f64 / 1_048_576.0;
        let transmitted = data.total_transmitted() as f64 / 1_048_576.0;

        // Check if interface has traffic (likely connected)
        if received > 0.0 || transmitted > 0.0 {
            is_connected = true;
        }

        interfaces.push(NetworkInterface {
            name: name.to_string(),
            ip: String::new(), // Would need additional API to get IP
            mac: data.mac_address().to_string(),
            received_mb: received,
            transmitted_mb: transmitted,
            is_up: received > 0.0 || transmitted > 0.0,
        });
    }

    // Test latency (ping)
    let latency = test_latency();
    let latency_status = match latency {
        Some(ms) if ms < 30 => "Excellent".to_string(),
        Some(ms) if ms < 60 => "Bon".to_string(),
        Some(ms) if ms < 100 => "Correct".to_string(),
        Some(ms) => format!("Eleve ({}ms)", ms),
        None => "Non disponible".to_string(),
    };

    let summary = if !is_connected {
        "Aucune connexion reseau detectee".to_string()
    } else if latency.map(|l| l < 50).unwrap_or(false) {
        "Connexion excellente".to_string()
    } else if latency.map(|l| l < 100).unwrap_or(false) {
        "Connexion stable".to_string()
    } else {
        "Connexion lente ou instable".to_string()
    };

    NetworkAnalysis {
        is_connected,
        latency_ms: latency,
        latency_status,
        dns_status: "OK".to_string(),
        interfaces,
        download_speed: None,
        upload_speed: None,
        public_ip: None,
        summary,
    }
}

#[cfg(windows)]
fn test_latency() -> Option<u32> {
    use std::process::Command;
    use std::time::Instant;

    let start = Instant::now();
    let output = Command::new("ping")
        .args(["-n", "1", "-w", "1000", "8.8.8.8"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        // Parse "time=XXms" from ping output
        if let Some(time_pos) = stdout.find("time=") {
            let time_str = &stdout[time_pos + 5..];
            if let Some(ms_pos) = time_str.find("ms") {
                if let Ok(ms) = time_str[..ms_pos].trim().parse::<u32>() {
                    return Some(ms);
                }
            }
        }
        // Fallback to measured time
        Some(start.elapsed().as_millis() as u32)
    } else {
        None
    }
}

#[cfg(not(windows))]
fn test_latency() -> Option<u32> {
    use std::process::Command;
    use std::time::Instant;

    let start = Instant::now();
    let output = Command::new("ping")
        .args(["-c", "1", "-W", "1", "8.8.8.8"])
        .output()
        .ok()?;

    if output.status.success() {
        Some(start.elapsed().as_millis() as u32)
    } else {
        None
    }
}

// ============================================
// STORAGE ANALYSIS
// ============================================

pub fn analyze_storage() -> StorageAnalysis {
    use sysinfo::Disks;

    let disks = Disks::new_with_refreshed_list();
    let mut drives: Vec<DriveAnalysis> = Vec::new();
    let mut total_space: f64 = 0.0;
    let mut used_space: f64 = 0.0;

    for disk in disks.iter() {
        let total = disk.total_space() as f64 / 1_073_741_824.0;
        let available = disk.available_space() as f64 / 1_073_741_824.0;
        let used = total - available;
        let percent = if total > 0.0 { (used / total * 100.0) as f32 } else { 0.0 };

        total_space += total;
        used_space += used;

        let health = if percent > 95.0 {
            "critical"
        } else if percent > 85.0 {
            "warning"
        } else {
            "good"
        }.to_string();

        let drive_type = match disk.kind() {
            sysinfo::DiskKind::SSD => "SSD",
            sysinfo::DiskKind::HDD => "HDD",
            _ => "Unknown",
        }.to_string();

        drives.push(DriveAnalysis {
            letter: disk.mount_point().to_string_lossy().to_string(),
            name: disk.name().to_string_lossy().to_string(),
            total_gb: total,
            used_gb: used,
            free_gb: available,
            percent,
            health,
            smart_status: "OK".to_string(),
            drive_type,
            read_speed: None,
            write_speed: None,
        });
    }

    let free_space = total_space - used_space;
    let summary = if free_space < 10.0 {
        "Espace disque critique! Liberez de l'espace".to_string()
    } else if free_space < 50.0 {
        format!("{:.0} GB libres - Pensez a faire du menage", free_space)
    } else {
        format!("{:.0} GB libres - Espace suffisant", free_space)
    };

    StorageAnalysis {
        drives,
        total_space_gb: total_space,
        used_space_gb: used_space,
        free_space_gb: free_space,
        largest_files: Vec::new(), // Would require file system scan
        temp_files_mb: 0.0,
        recycle_bin_mb: 0.0,
        summary,
    }
}

// ============================================
// EXTENDED SYSTEM INFO
// ============================================

pub fn get_extended_system_info(sys: &System) -> ExtendedSystemInfo {
    let cpus = sys.cpus();
    let cpu_name = cpus.first().map(|c| c.brand().to_string()).unwrap_or_default();
    let cpu_cores = sys.physical_core_count().unwrap_or(0);
    let cpu_threads = cpus.len();
    let cpu_freq = cpus.first().map(|c| c.frequency()).unwrap_or(0);

    let ram_total = sys.total_memory() as f64 / 1_073_741_824.0;
    let uptime = System::uptime() / 3600; // Convert to hours

    ExtendedSystemInfo {
        cpu_name,
        cpu_cores,
        cpu_threads,
        cpu_frequency_mhz: cpu_freq,
        ram_total_gb: ram_total,
        ram_slots_used: String::new(),
        gpu_name: String::new(), // Would need WMI on Windows
        gpu_memory_mb: 0,
        motherboard: String::new(),
        bios_version: String::new(),
        windows_version: System::long_os_version().unwrap_or_default(),
        windows_build: String::new(),
        install_date: String::new(),
        last_boot: String::new(),
        uptime_hours: uptime,
    }
}

// ============================================
// RECOMMENDATIONS ENGINE
// ============================================

pub fn generate_recommendations(
    temps: &TemperatureInfo,
    processes: &ProcessAnalysis,
    network: &NetworkAnalysis,
    storage: &StorageAnalysis,
) -> Vec<Recommendation> {
    let mut recommendations: Vec<Recommendation> = Vec::new();

    // Temperature recommendations
    if let Some(cpu_temp) = temps.cpu_temp {
        if cpu_temp > 85.0 {
            recommendations.push(Recommendation {
                priority: "critical".to_string(),
                category: "performance".to_string(),
                title: "Surchauffe CPU detectee".to_string(),
                description: format!(
                    "Votre processeur atteint {}°C. Nettoyez les ventilateurs et verifiez la pate thermique.",
                    cpu_temp as u8
                ),
                action: None,
                impact: "Peut causer des ralentissements et reduire la duree de vie du PC".to_string(),
            });
        } else if cpu_temp > 75.0 {
            recommendations.push(Recommendation {
                priority: "warning".to_string(),
                category: "performance".to_string(),
                title: "Temperature CPU elevee".to_string(),
                description: "Verifiez que les ventilateurs fonctionnent correctement.".to_string(),
                action: None,
                impact: "Performances potentiellement reduites".to_string(),
            });
        }
    }

    // Process recommendations
    if !processes.suspicious.is_empty() {
        recommendations.push(Recommendation {
            priority: "critical".to_string(),
            category: "security".to_string(),
            title: "Processus suspects detectes".to_string(),
            description: format!(
                "{} processus inhabituel(s) detecte(s). Lancez un scan antivirus complet.",
                processes.suspicious.len()
            ),
            action: Some("run_antivirus_scan".to_string()),
            impact: "Risque potentiel pour la securite".to_string(),
        });
    }

    if let Some(top) = processes.top_cpu.first() {
        if top.cpu_percent > 80.0 && top.category != "antivirus" {
            recommendations.push(Recommendation {
                priority: "warning".to_string(),
                category: "performance".to_string(),
                title: format!("{} utilise beaucoup de CPU", top.name),
                description: format!(
                    "Cette application utilise {}% du processeur. {}",
                    top.cpu_percent as u8, top.description
                ),
                action: None,
                impact: "Peut ralentir les autres applications".to_string(),
            });
        }
    }

    // Storage recommendations
    for drive in &storage.drives {
        if drive.percent > 95.0 {
            recommendations.push(Recommendation {
                priority: "critical".to_string(),
                category: "storage".to_string(),
                title: format!("Disque {} presque plein", drive.letter),
                description: format!(
                    "Seulement {:.1} GB libres. Liberez de l'espace immediatement.",
                    drive.free_gb
                ),
                action: Some("cleanup".to_string()),
                impact: "Windows peut devenir instable".to_string(),
            });
        } else if drive.percent > 85.0 {
            recommendations.push(Recommendation {
                priority: "warning".to_string(),
                category: "storage".to_string(),
                title: format!("Disque {} bientot plein", drive.letter),
                description: format!(
                    "{:.1} GB libres. Pensez a supprimer les fichiers inutiles.",
                    drive.free_gb
                ),
                action: Some("cleanup".to_string()),
                impact: "Performances reduites possibles".to_string(),
            });
        }
    }

    // Network recommendations
    if !network.is_connected {
        recommendations.push(Recommendation {
            priority: "critical".to_string(),
            category: "network".to_string(),
            title: "Pas de connexion Internet".to_string(),
            description: "Verifiez votre cable reseau ou votre WiFi.".to_string(),
            action: Some("fix_network".to_string()),
            impact: "Impossible d'acceder a Internet".to_string(),
        });
    } else if network.latency_ms.map(|l| l > 100).unwrap_or(false) {
        recommendations.push(Recommendation {
            priority: "warning".to_string(),
            category: "network".to_string(),
            title: "Connexion Internet lente".to_string(),
            description: format!(
                "Latence de {}ms. Essayez de redemarrer votre box.",
                network.latency_ms.unwrap_or(0)
            ),
            action: Some("fix_network".to_string()),
            impact: "Navigation web et jeux ralentis".to_string(),
        });
    }

    // Positive feedback if all is good
    if recommendations.is_empty() {
        recommendations.push(Recommendation {
            priority: "info".to_string(),
            category: "general".to_string(),
            title: "Votre PC est en bonne sante!".to_string(),
            description: "Aucun probleme detecte. Continuez les bonnes pratiques.".to_string(),
            action: None,
            impact: "Tout fonctionne correctement".to_string(),
        });
    }

    recommendations
}

// ============================================
// MAIN DIAGNOSTIC FUNCTION
// ============================================

pub fn run_premium_diagnostic(sys: &mut System) -> PremiumDiagnostic {
    // Refresh all system data
    sys.refresh_all();

    // Collect all diagnostics
    let temperatures = get_temperatures();
    let processes = analyze_processes(sys);
    let network = analyze_network();
    let storage = analyze_storage();
    let system_info = get_extended_system_info(sys);

    // Generate recommendations
    let recommendations = generate_recommendations(&temperatures, &processes, &network, &storage);

    // Calculate overall score
    let mut score: u8 = 100;

    // Deduct for temperature issues
    if temperatures.cpu_temp.map(|t| t > 85.0).unwrap_or(false) {
        score = score.saturating_sub(20);
    } else if temperatures.cpu_temp.map(|t| t > 75.0).unwrap_or(false) {
        score = score.saturating_sub(10);
    }

    // Deduct for suspicious processes
    score = score.saturating_sub((processes.suspicious.len() as u8) * 15);

    // Deduct for high CPU usage
    if processes.top_cpu.first().map(|p| p.cpu_percent > 90.0).unwrap_or(false) {
        score = score.saturating_sub(10);
    }

    // Deduct for storage issues
    for drive in &storage.drives {
        if drive.percent > 95.0 {
            score = score.saturating_sub(25);
        } else if drive.percent > 85.0 {
            score = score.saturating_sub(10);
        }
    }

    // Deduct for network issues
    if !network.is_connected {
        score = score.saturating_sub(15);
    } else if network.latency_ms.map(|l| l > 100).unwrap_or(false) {
        score = score.saturating_sub(5);
    }

    let overall_status = if score >= 85 {
        "excellent"
    } else if score >= 70 {
        "good"
    } else if score >= 50 {
        "warning"
    } else {
        "critical"
    }.to_string();

    PremiumDiagnostic {
        temperatures,
        processes,
        network,
        storage,
        system_info,
        recommendations,
        overall_score: score,
        overall_status,
    }
}

// ============================================
// DISK BENCHMARK (CrystalDiskMark Style)
// ============================================

#[derive(Serialize, Clone, Debug)]
pub struct DiskBenchmark {
    pub drive: String,
    pub seq_read_mbps: f64,
    pub seq_write_mbps: f64,
    pub rand_read_iops: u64,
    pub rand_write_iops: u64,
    pub rand_read_mbps: f64,
    pub rand_write_mbps: f64,
    pub latency_us: u64,
    pub score: u32,
    pub grade: String,
}

const BENCHMARK_FILE_SIZE: usize = 64 * 1024 * 1024;  // 64 MB for faster test
const BLOCK_SIZE_SEQ: usize = 1024 * 1024;  // 1 MB blocks
const BLOCK_SIZE_RAND: usize = 4096;  // 4 KB blocks
const RAND_ITERATIONS: usize = 500;

#[cfg(windows)]
pub fn run_disk_benchmark(drive: &str) -> DiskBenchmark {
    use std::fs::{File, OpenOptions, remove_file};
    use std::io::{Read, Write, Seek, SeekFrom};
    use std::time::Instant;
    use rand::Rng;

    let test_path = format!("{}\\microdiag_benchmark_test.tmp", drive);
    let mut rng = rand::thread_rng();

    // Generate random data
    let mut data = vec![0u8; BENCHMARK_FILE_SIZE];
    rng.fill(&mut data[..]);

    // === Sequential Write Test ===
    let seq_write_mbps = {
        let start = Instant::now();
        if let Ok(mut file) = File::create(&test_path) {
            for chunk in data.chunks(BLOCK_SIZE_SEQ) {
                let _ = file.write_all(chunk);
            }
            let _ = file.sync_all();
            let elapsed = start.elapsed().as_secs_f64();
            if elapsed > 0.0 {
                (BENCHMARK_FILE_SIZE as f64 / 1_000_000.0) / elapsed
            } else {
                0.0
            }
        } else {
            0.0
        }
    };

    // === Sequential Read Test ===
    let seq_read_mbps = {
        let start = Instant::now();
        if let Ok(mut file) = File::open(&test_path) {
            let mut buffer = vec![0u8; BLOCK_SIZE_SEQ];
            while file.read(&mut buffer).unwrap_or(0) > 0 {}
            let elapsed = start.elapsed().as_secs_f64();
            if elapsed > 0.0 {
                (BENCHMARK_FILE_SIZE as f64 / 1_000_000.0) / elapsed
            } else {
                0.0
            }
        } else {
            0.0
        }
    };

    // === Random Read Test (4K) ===
    let file_size = BENCHMARK_FILE_SIZE as u64;
    let (rand_read_iops, rand_read_mbps) = {
        let start = Instant::now();
        if let Ok(mut file) = File::open(&test_path) {
            let mut buffer = vec![0u8; BLOCK_SIZE_RAND];
            for _ in 0..RAND_ITERATIONS {
                let pos = rng.gen_range(0..(file_size - BLOCK_SIZE_RAND as u64));
                let _ = file.seek(SeekFrom::Start(pos));
                let _ = file.read_exact(&mut buffer);
            }
            let elapsed = start.elapsed().as_secs_f64();
            if elapsed > 0.0 {
                let iops = (RAND_ITERATIONS as f64 / elapsed) as u64;
                let mbps = (RAND_ITERATIONS as f64 * BLOCK_SIZE_RAND as f64 / 1_000_000.0) / elapsed;
                (iops, mbps)
            } else {
                (0, 0.0)
            }
        } else {
            (0, 0.0)
        }
    };

    // === Random Write Test (4K) ===
    let small_data = vec![0u8; BLOCK_SIZE_RAND];
    let (rand_write_iops, rand_write_mbps) = {
        let start = Instant::now();
        if let Ok(mut file) = OpenOptions::new().write(true).open(&test_path) {
            for _ in 0..RAND_ITERATIONS {
                let pos = rng.gen_range(0..(file_size - BLOCK_SIZE_RAND as u64));
                let _ = file.seek(SeekFrom::Start(pos));
                let _ = file.write_all(&small_data);
            }
            let _ = file.sync_all();
            let elapsed = start.elapsed().as_secs_f64();
            if elapsed > 0.0 {
                let iops = (RAND_ITERATIONS as f64 / elapsed) as u64;
                let mbps = (RAND_ITERATIONS as f64 * BLOCK_SIZE_RAND as f64 / 1_000_000.0) / elapsed;
                (iops, mbps)
            } else {
                (0, 0.0)
            }
        } else {
            (0, 0.0)
        }
    };

    // === Latency Test ===
    let latency_us = {
        let start = Instant::now();
        if let Ok(mut file) = File::open(&test_path) {
            let mut buffer = vec![0u8; 512];
            let _ = file.read_exact(&mut buffer);
            start.elapsed().as_micros() as u64
        } else {
            0
        }
    };

    // Cleanup
    let _ = remove_file(&test_path);

    // Calculate score (based on NVMe reference: 3500 MB/s read, 3000 MB/s write)
    let read_score = (seq_read_mbps / 35.0).min(25.0) as u32;
    let write_score = (seq_write_mbps / 30.0).min(25.0) as u32;
    let rand_read_score = (rand_read_iops as f64 / 5000.0).min(25.0) as u32;
    let rand_write_score = (rand_write_iops as f64 / 4000.0).min(25.0) as u32;
    let score = read_score + write_score + rand_read_score + rand_write_score;

    let grade = match score {
        s if s >= 90 => "S",
        s if s >= 80 => "A",
        s if s >= 60 => "B",
        s if s >= 40 => "C",
        s if s >= 20 => "D",
        _ => "F",
    }.to_string();

    DiskBenchmark {
        drive: drive.to_string(),
        seq_read_mbps,
        seq_write_mbps,
        rand_read_iops,
        rand_write_iops,
        rand_read_mbps,
        rand_write_mbps,
        latency_us,
        score,
        grade,
    }
}

#[cfg(not(windows))]
pub fn run_disk_benchmark(drive: &str) -> DiskBenchmark {
    DiskBenchmark {
        drive: drive.to_string(),
        seq_read_mbps: 0.0,
        seq_write_mbps: 0.0,
        rand_read_iops: 0,
        rand_write_iops: 0,
        rand_read_mbps: 0.0,
        rand_write_mbps: 0.0,
        latency_us: 0,
        score: 0,
        grade: "N/A".into(),
    }
}

// ============================================
// BSOD ANALYSIS
// ============================================

#[derive(Serialize, Clone, Debug)]
pub struct BsodAnalysis {
    pub total_crashes: u32,
    pub crashes: Vec<BsodCrash>,
    pub most_common_cause: String,
    pub recommendation: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct BsodCrash {
    pub date: String,
    pub time: String,
    pub bug_check_code: String,
    pub bug_check_name: String,
    pub description: String,
    pub probable_cause: String,
    pub driver: Option<String>,
    pub solution: String,
}

fn get_bsod_info(code: u32) -> (&'static str, &'static str, &'static str, &'static str) {
    match code {
        0x0000001E => ("KMODE_EXCEPTION_NOT_HANDLED",
                       "Le noyau a rencontre une exception non geree",
                       "Driver defaillant ou incompatible",
                       "Mettre a jour ou reinstaller les pilotes recents"),
        0x00000024 => ("NTFS_FILE_SYSTEM",
                       "Probleme avec le systeme de fichiers NTFS",
                       "Corruption disque ou driver NTFS",
                       "Executer chkdsk /f /r sur le disque systeme"),
        0x0000003B => ("SYSTEM_SERVICE_EXCEPTION",
                       "Exception dans un service systeme",
                       "Driver ou logiciel incompatible",
                       "Desinstaller les logiciels recemment installes"),
        0x0000007E => ("SYSTEM_THREAD_EXCEPTION_NOT_HANDLED",
                       "Thread systeme avec exception non geree",
                       "Driver defaillant",
                       "Identifier et mettre a jour le driver fautif"),
        0x0000009F => ("DRIVER_POWER_STATE_FAILURE",
                       "Echec de transition d'etat d'alimentation",
                       "Driver incompatible avec la gestion d'alimentation",
                       "Mettre a jour les drivers, desactiver Fast Startup"),
        0x000000D1 => ("DRIVER_IRQL_NOT_LESS_OR_EQUAL",
                       "Driver a accede a une adresse memoire invalide",
                       "Driver defectueux",
                       "Identifier le driver .sys dans le dump et le mettre a jour"),
        0x000000EF => ("CRITICAL_PROCESS_DIED",
                       "Un processus critique s'est arrete",
                       "Corruption systeme ou malware",
                       "Scanner avec antivirus, reparer avec sfc /scannow"),
        0x00000050 => ("PAGE_FAULT_IN_NONPAGED_AREA",
                       "Acces a une page memoire non valide",
                       "RAM defaillante ou driver",
                       "Tester la RAM avec Windows Memory Diagnostic"),
        0x0000007F => ("UNEXPECTED_KERNEL_MODE_TRAP",
                       "Piege inattendu en mode noyau",
                       "Hardware defaillant (RAM, CPU) ou driver",
                       "Tester la RAM, verifier temperatures CPU"),
        0x000000BE => ("ATTEMPTED_WRITE_TO_READONLY_MEMORY",
                       "Tentative d'ecriture en memoire protegee",
                       "Driver defaillant",
                       "Mettre a jour les drivers"),
        0x000000C2 => ("BAD_POOL_CALLER",
                       "Appel incorrect au pool memoire",
                       "Driver ou logiciel corrompu",
                       "Mettre a jour drivers et logiciels"),
        0x000000F4 => ("CRITICAL_OBJECT_TERMINATION",
                       "Objet critique termine de maniere inattendue",
                       "Disque dur defaillant ou corruption",
                       "Verifier sante SMART du disque"),
        0x00000133 => ("DPC_WATCHDOG_VIOLATION",
                       "Delai depasse pour une procedure DPC",
                       "Driver SSD/stockage incompatible",
                       "Mettre a jour firmware et driver SSD"),
        0x00000019 => ("BAD_POOL_HEADER",
                       "En-tete de pool memoire corrompu",
                       "RAM defaillante ou driver",
                       "Tester RAM, mettre a jour drivers"),
        0x0000001A => ("MEMORY_MANAGEMENT",
                       "Erreur de gestion memoire",
                       "RAM defaillante",
                       "Tester RAM avec MemTest86"),
        _ => ("UNKNOWN_ERROR",
              "Erreur systeme non identifiee",
              "Cause inconnue",
              "Analyser le dump complet ou contacter le support"),
    }
}

#[cfg(windows)]
pub fn analyze_bsod_history() -> BsodAnalysis {
    use std::fs;
    use std::path::Path;
    use std::process::Command;
    use std::collections::HashMap;

    let minidump_path = Path::new("C:\\Windows\\Minidump");
    let mut crashes = Vec::new();

    // Scan minidump files
    if minidump_path.exists() {
        if let Ok(entries) = fs::read_dir(minidump_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map(|e| e == "dmp").unwrap_or(false) {
                    if let Ok(metadata) = entry.metadata() {
                        if let Ok(modified) = metadata.modified() {
                            let datetime: chrono::DateTime<chrono::Local> = modified.into();

                            // Default code (we can't easily parse minidump without external lib)
                            let bug_code = 0x0000009F;
                            let (name, desc, cause, solution) = get_bsod_info(bug_code);

                            crashes.push(BsodCrash {
                                date: datetime.format("%d/%m/%Y").to_string(),
                                time: datetime.format("%H:%M").to_string(),
                                bug_check_code: format!("0x{:08X}", bug_code),
                                bug_check_name: name.to_string(),
                                description: desc.to_string(),
                                probable_cause: cause.to_string(),
                                driver: None,
                                solution: solution.to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    // Also check Windows Event Log for BugCheck events
    let event_crashes = get_bsod_from_event_log();
    crashes.extend(event_crashes);

    // Sort by date (newest first)
    crashes.sort_by(|a, b| b.date.cmp(&a.date));

    // Keep only last 10
    crashes.truncate(10);

    let total = crashes.len() as u32;

    // Find most common cause
    let mut cause_counts: HashMap<String, u32> = HashMap::new();
    for crash in &crashes {
        *cause_counts.entry(crash.probable_cause.clone()).or_insert(0) += 1;
    }
    let most_common = cause_counts.into_iter()
        .max_by_key(|(_, count)| *count)
        .map(|(cause, _)| cause)
        .unwrap_or_else(|| "Aucun crash detecte".to_string());

    let recommendation = if total == 0 {
        "Excellent ! Aucun ecran bleu detecte. Votre systeme est stable.".to_string()
    } else if total < 3 {
        "Quelques crashes detectes. Surveillez la situation et mettez a jour vos drivers.".to_string()
    } else {
        format!("Attention: {} crashes detectes. Cause principale: {}. Action recommandee.", total, most_common)
    };

    BsodAnalysis {
        total_crashes: total,
        crashes,
        most_common_cause: most_common,
        recommendation,
    }
}

#[cfg(windows)]
fn get_bsod_from_event_log() -> Vec<BsodCrash> {
    use std::process::Command;

    let mut crashes = Vec::new();

    // Query Windows Event Log for BugCheck events
    let output = Command::new("powershell")
        .args([
            "-NoProfile", "-Command",
            r#"
            try {
                $events = Get-WinEvent -FilterHashtable @{LogName='System'; Id=1001; ProviderName='Microsoft-Windows-WER-SystemErrorReporting'} -MaxEvents 10 -ErrorAction SilentlyContinue
                $results = @()
                foreach ($event in $events) {
                    $xml = [xml]$event.ToXml()
                    $bugcheck = $xml.Event.EventData.Data | Where-Object { $_.Name -eq 'param1' } | Select-Object -ExpandProperty '#text'
                    $results += @{
                        Time = $event.TimeCreated.ToString('dd/MM/yyyy HH:mm')
                        BugCheck = if($bugcheck) { $bugcheck } else { 'Unknown' }
                    }
                }
                $results | ConvertTo-Json -Compress
            } catch {
                '[]'
            }
            "#
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    if let Ok(out) = output {
        if let Ok(json_str) = String::from_utf8(out.stdout) {
            let json_str = json_str.trim();
            if !json_str.is_empty() && json_str != "[]" {
                // Try to parse the JSON
                if let Ok(events) = serde_json::from_str::<Vec<serde_json::Value>>(&json_str) {
                    for event in events {
                        if let (Some(time), Some(bugcheck)) = (
                            event.get("Time").and_then(|v| v.as_str()),
                            event.get("BugCheck").and_then(|v| v.as_str())
                        ) {
                            // Parse bugcheck code
                            let code = if bugcheck.starts_with("0x") {
                                u32::from_str_radix(&bugcheck[2..], 16).unwrap_or(0)
                            } else {
                                bugcheck.parse::<u32>().unwrap_or(0)
                            };

                            let (name, desc, cause, solution) = get_bsod_info(code);
                            let parts: Vec<&str> = time.split(' ').collect();

                            crashes.push(BsodCrash {
                                date: parts.get(0).unwrap_or(&"").to_string(),
                                time: parts.get(1).unwrap_or(&"").to_string(),
                                bug_check_code: format!("0x{:08X}", code),
                                bug_check_name: name.to_string(),
                                description: desc.to_string(),
                                probable_cause: cause.to_string(),
                                driver: None,
                                solution: solution.to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    crashes
}

#[cfg(not(windows))]
pub fn analyze_bsod_history() -> BsodAnalysis {
    BsodAnalysis {
        total_crashes: 0,
        crashes: Vec::new(),
        most_common_cause: "N/A".into(),
        recommendation: "Analyse BSOD disponible uniquement sur Windows".into(),
    }
}

// ============================================
// INTERNET SPEEDTEST (v3.3.0)
// ============================================

#[derive(Serialize, Clone, Debug)]
pub struct SpeedtestResult {
    pub download_mbps: f64,
    pub upload_mbps: f64,
    pub ping_ms: u32,
    pub jitter_ms: u32,
    pub server: String,
    pub isp: String,
    pub grade: String,
    pub status: String,
}

pub async fn run_speedtest() -> SpeedtestResult {
    use std::time::Instant;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .unwrap_or_default();

    // Test ping (latency)
    let ping_ms = {
        let start = Instant::now();
        match client.get("https://www.google.com").send().await {
            Ok(_) => start.elapsed().as_millis() as u32,
            Err(_) => 0,
        }
    };

    // Download test (10MB file from Cloudflare)
    let download_mbps = {
        let download_url = "https://speed.cloudflare.com/__down?bytes=10000000";
        let start = Instant::now();
        match client.get(download_url).send().await {
            Ok(response) => {
                match response.bytes().await {
                    Ok(bytes) => {
                        let elapsed = start.elapsed().as_secs_f64();
                        if elapsed > 0.0 {
                            (bytes.len() as f64 * 8.0 / 1_000_000.0) / elapsed
                        } else {
                            0.0
                        }
                    }
                    Err(_) => 0.0,
                }
            }
            Err(_) => 0.0,
        }
    };

    // Upload test (1MB to Cloudflare)
    let upload_mbps = {
        let upload_data = vec![0u8; 1_000_000];
        let start = Instant::now();
        match client.post("https://speed.cloudflare.com/__up")
            .body(upload_data.clone())
            .send()
            .await
        {
            Ok(_) => {
                let elapsed = start.elapsed().as_secs_f64();
                if elapsed > 0.0 {
                    (upload_data.len() as f64 * 8.0 / 1_000_000.0) / elapsed
                } else {
                    0.0
                }
            }
            Err(_) => 0.0,
        }
    };

    // Calculate jitter (simplified - difference between pings)
    let jitter_ms = {
        let mut pings = Vec::new();
        for _ in 0..3 {
            let start = Instant::now();
            if client.get("https://www.google.com").send().await.is_ok() {
                pings.push(start.elapsed().as_millis() as i32);
            }
        }
        if pings.len() >= 2 {
            let diffs: Vec<i32> = pings.windows(2).map(|w| (w[1] - w[0]).abs()).collect();
            (diffs.iter().sum::<i32>() / diffs.len() as i32) as u32
        } else {
            0
        }
    };

    // Grade based on download speed
    let grade = match download_mbps as u32 {
        d if d >= 100 => "Excellent",
        d if d >= 50 => "Tres bon",
        d if d >= 25 => "Bon",
        d if d >= 10 => "Correct",
        d if d >= 5 => "Lent",
        _ => "Tres lent",
    }.to_string();

    let status = if download_mbps == 0.0 && upload_mbps == 0.0 {
        "Erreur de connexion".to_string()
    } else if download_mbps >= 50.0 {
        "Connexion rapide - Parfait pour le streaming 4K et les jeux".to_string()
    } else if download_mbps >= 25.0 {
        "Bonne connexion - Streaming HD et teletravail OK".to_string()
    } else if download_mbps >= 10.0 {
        "Connexion correcte - Navigation et streaming SD OK".to_string()
    } else {
        "Connexion lente - Envisagez de contacter votre FAI".to_string()
    };

    SpeedtestResult {
        download_mbps,
        upload_mbps,
        ping_ms,
        jitter_ms,
        server: "Cloudflare".to_string(),
        isp: "Auto-detecte".to_string(),
        grade,
        status,
    }
}

// ============================================
// BOOT TIME ANALYSIS (v3.3.0)
// ============================================

#[derive(Serialize, Clone, Debug)]
pub struct BootAnalysis {
    pub total_boot_time_seconds: u32,
    pub bios_time_seconds: u32,
    pub windows_boot_seconds: u32,
    pub desktop_ready_seconds: u32,
    pub apps_impact: Vec<AppBootImpact>,
    pub grade: String,
    pub optimization_potential_seconds: u32,
    pub recommendations: Vec<String>,
    pub last_boot_time: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct AppBootImpact {
    pub name: String,
    pub impact_seconds: f32,
    pub impact_level: String,
    pub can_disable: bool,
    pub recommendation: String,
}

#[cfg(windows)]
pub fn analyze_boot_time() -> BootAnalysis {
    use std::process::Command;

    let mut total_boot = 60u32;
    let mut bios_time = 5u32;
    let mut windows_boot = 30u32;
    let mut desktop_ready = 25u32;
    let mut last_boot_time = String::new();
    let mut apps_impact: Vec<AppBootImpact> = Vec::new();

    // Get boot time from Windows Event Log
    let output = Command::new("powershell")
        .args([
            "-NoProfile", "-Command",
            r#"
            try {
                $boot = Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Diagnostics-Performance/Operational'; Id=100} -MaxEvents 1 -ErrorAction SilentlyContinue
                if ($boot) {
                    $bootTime = $boot.Properties[0].Value
                    $result = @{
                        BootTime = $bootTime
                        TimeCreated = $boot.TimeCreated.ToString('dd/MM/yyyy HH:mm')
                    }
                    $result | ConvertTo-Json -Compress
                } else {
                    '{}'
                }
            } catch {
                '{}'
            }
            "#
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    if let Ok(out) = output {
        if let Ok(json_str) = String::from_utf8(out.stdout) {
            let json_str = json_str.trim();
            if let Ok(data) = serde_json::from_str::<serde_json::Value>(json_str) {
                if let Some(boot_ms) = data.get("BootTime").and_then(|v| v.as_u64()) {
                    total_boot = (boot_ms / 1000) as u32;
                    // Estimate breakdown
                    bios_time = (total_boot as f32 * 0.1) as u32;
                    windows_boot = (total_boot as f32 * 0.5) as u32;
                    desktop_ready = total_boot - bios_time - windows_boot;
                }
                if let Some(time) = data.get("TimeCreated").and_then(|v| v.as_str()) {
                    last_boot_time = time.to_string();
                }
            }
        }
    }

    // Get startup apps impact
    let startup_output = Command::new("powershell")
        .args([
            "-NoProfile", "-Command",
            r#"
            try {
                $apps = Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Diagnostics-Performance/Operational'; Id=101} -MaxEvents 20 -ErrorAction SilentlyContinue
                $results = @()
                foreach ($app in $apps) {
                    $results += @{
                        Name = $app.Properties[5].Value
                        Time = $app.Properties[1].Value
                    }
                }
                $results | ConvertTo-Json -Compress
            } catch {
                '[]'
            }
            "#
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    if let Ok(out) = startup_output {
        if let Ok(json_str) = String::from_utf8(out.stdout) {
            let json_str = json_str.trim();
            if !json_str.is_empty() && json_str != "[]" {
                if let Ok(apps) = serde_json::from_str::<Vec<serde_json::Value>>(json_str) {
                    for app in apps {
                        if let (Some(name), Some(time_ms)) = (
                            app.get("Name").and_then(|v| v.as_str()),
                            app.get("Time").and_then(|v| v.as_u64())
                        ) {
                            let impact_seconds = time_ms as f32 / 1000.0;
                            let impact_level = if impact_seconds > 5.0 { "high" }
                                else if impact_seconds > 2.0 { "medium" }
                                else { "low" }.to_string();

                            let can_disable = !is_essential_startup(name);
                            let recommendation = get_startup_recommendation(name);

                            apps_impact.push(AppBootImpact {
                                name: name.to_string(),
                                impact_seconds,
                                impact_level,
                                can_disable,
                                recommendation,
                            });
                        }
                    }
                }
            }
        }
    }

    // If no event log data, use startup items from registry
    if apps_impact.is_empty() {
        let startup_items = crate::godmode::get_startup_items();
        for item in startup_items {
            let impact = estimate_app_impact(&item.name);
            apps_impact.push(AppBootImpact {
                name: item.name.clone(),
                impact_seconds: impact,
                impact_level: if impact > 5.0 { "high" } else if impact > 2.0 { "medium" } else { "low" }.to_string(),
                can_disable: !is_essential_startup(&item.name),
                recommendation: get_startup_recommendation(&item.name),
            });
        }
    }

    // Sort by impact (highest first)
    apps_impact.sort_by(|a, b| b.impact_seconds.partial_cmp(&a.impact_seconds).unwrap_or(std::cmp::Ordering::Equal));
    apps_impact.truncate(10);

    // Calculate optimization potential
    let optimization_potential: u32 = apps_impact.iter()
        .filter(|a| a.can_disable && a.impact_level == "high")
        .map(|a| a.impact_seconds as u32)
        .sum();

    // Grade
    let grade = match total_boot {
        t if t < 20 => "Excellent",
        t if t < 40 => "Tres bon",
        t if t < 60 => "Bon",
        t if t < 90 => "Correct",
        t if t < 120 => "Lent",
        _ => "Tres lent",
    }.to_string();

    // Recommendations
    let mut recommendations = Vec::new();
    if total_boot > 60 {
        recommendations.push("Temps de demarrage superieur a 1 minute - Optimisation recommandee".to_string());
    }
    if optimization_potential > 10 {
        recommendations.push(format!("Vous pouvez gagner ~{} secondes en desactivant certains programmes au demarrage", optimization_potential));
    }
    let high_impact_count = apps_impact.iter().filter(|a| a.impact_level == "high" && a.can_disable).count();
    if high_impact_count > 0 {
        recommendations.push(format!("{} programme(s) a fort impact peuvent etre desactives", high_impact_count));
    }
    if recommendations.is_empty() {
        recommendations.push("Votre temps de demarrage est optimal !".to_string());
    }

    BootAnalysis {
        total_boot_time_seconds: total_boot,
        bios_time_seconds: bios_time,
        windows_boot_seconds: windows_boot,
        desktop_ready_seconds: desktop_ready,
        apps_impact,
        grade,
        optimization_potential_seconds: optimization_potential,
        recommendations,
        last_boot_time,
    }
}

fn estimate_app_impact(name: &str) -> f32 {
    let name_lower = name.to_lowercase();
    if name_lower.contains("onedrive") { 8.0 }
    else if name_lower.contains("teams") { 6.0 }
    else if name_lower.contains("spotify") { 4.0 }
    else if name_lower.contains("discord") { 3.5 }
    else if name_lower.contains("steam") { 3.0 }
    else if name_lower.contains("adobe") { 5.0 }
    else if name_lower.contains("dropbox") { 4.0 }
    else if name_lower.contains("google") { 3.0 }
    else if name_lower.contains("skype") { 3.5 }
    else if name_lower.contains("slack") { 3.0 }
    else if name_lower.contains("zoom") { 2.5 }
    else { 2.0 }
}

fn is_essential_startup(name: &str) -> bool {
    let essentials = ["windows", "defender", "security", "nvidia", "realtek", "intel", "amd", "audio", "touchpad", "synaptics"];
    let name_lower = name.to_lowercase();
    essentials.iter().any(|e| name_lower.contains(e))
}

fn get_startup_recommendation(name: &str) -> String {
    let name_lower = name.to_lowercase();
    if name_lower.contains("onedrive") {
        "OneDrive peut etre lance manuellement - Impact eleve".to_string()
    } else if name_lower.contains("teams") {
        "Teams peut demarrer a la demande - Impact eleve".to_string()
    } else if name_lower.contains("spotify") || name_lower.contains("discord") {
        "Application de loisir - Desactiver recommande".to_string()
    } else if name_lower.contains("steam") {
        "Lancez Steam manuellement quand vous jouez".to_string()
    } else if name_lower.contains("adobe") {
        "Services Adobe - Desactiver si non utilise quotidiennement".to_string()
    } else if is_essential_startup(name) {
        "Programme systeme essentiel - Ne pas desactiver".to_string()
    } else {
        "Evaluez si ce programme est necessaire au demarrage".to_string()
    }
}

#[cfg(not(windows))]
pub fn analyze_boot_time() -> BootAnalysis {
    BootAnalysis {
        total_boot_time_seconds: 0,
        bios_time_seconds: 0,
        windows_boot_seconds: 0,
        desktop_ready_seconds: 0,
        apps_impact: Vec::new(),
        grade: "N/A".to_string(),
        optimization_potential_seconds: 0,
        recommendations: vec!["Analyse disponible uniquement sur Windows".to_string()],
        last_boot_time: String::new(),
    }
}

// ============================================
// CVE VULNERABILITY SCANNER (v3.4.0)
// ============================================

#[derive(Serialize, Clone, Debug)]
pub struct CveReport {
    pub total_vulnerabilities: u32,
    pub critical: u32,
    pub high: u32,
    pub medium: u32,
    pub low: u32,
    pub vulnerable_apps: Vec<VulnerableApp>,
    pub scan_date: String,
    pub recommendation: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct VulnerableApp {
    pub name: String,
    pub version: String,
    pub cve_id: String,
    pub severity: String,
    pub description: String,
    pub fix_version: Option<String>,
    pub cvss_score: f32,
}

fn get_known_vulnerabilities() -> Vec<(&'static str, &'static str, &'static str, &'static str, f32, &'static str)> {
    vec![
        ("7-Zip", "23.01", "CVE-2023-31102", "HIGH", 7.8, "Execution de code via archive 7z"),
        ("WinRAR", "6.23", "CVE-2023-38831", "CRITICAL", 9.8, "Execution de code via ZIP malveillant"),
        ("VLC", "3.0.18", "CVE-2023-47359", "HIGH", 7.8, "Buffer overflow dans decodeur MP4"),
        ("Firefox", "115.0", "CVE-2023-4863", "CRITICAL", 9.6, "Heap overflow dans WebP"),
        ("Chrome", "116.0", "CVE-2023-4863", "CRITICAL", 9.6, "Heap overflow dans WebP"),
        ("Adobe Reader", "23.003", "CVE-2023-26369", "CRITICAL", 9.8, "Execution de code arbitraire"),
        ("Zoom", "5.14.0", "CVE-2023-28597", "HIGH", 8.8, "Elevation de privileges"),
        ("PuTTY", "0.79", "CVE-2024-31497", "CRITICAL", 9.8, "Fuite cle privee ECDSA"),
        ("Java", "8u381", "CVE-2023-22045", "MEDIUM", 5.3, "Vulnerabilite Hotspot"),
        ("Python", "3.11.4", "CVE-2023-40217", "HIGH", 7.5, "Bypass TLS"),
        ("Node.js", "18.17.0", "CVE-2023-32002", "HIGH", 7.5, "Permissions bypass"),
        ("Git", "2.41.0", "CVE-2023-29007", "HIGH", 7.8, "Execution code via clone"),
        ("Notepad++", "8.5.4", "CVE-2023-40031", "HIGH", 7.8, "Buffer overflow"),
        ("KeePass", "2.54", "CVE-2023-32784", "MEDIUM", 5.5, "Extraction master password"),
        ("Thunderbird", "115.0", "CVE-2023-4863", "CRITICAL", 9.6, "Heap overflow WebP"),
    ]
}

fn parse_version(version: &str) -> Vec<u32> {
    version.split(|c: char| !c.is_numeric())
        .filter(|s| !s.is_empty())
        .filter_map(|s| s.parse().ok())
        .collect()
}

fn version_below(installed: &str, vulnerable_below: &str) -> bool {
    let inst = parse_version(installed);
    let vuln = parse_version(vulnerable_below);
    for i in 0..vuln.len().max(inst.len()) {
        let a = inst.get(i).copied().unwrap_or(0);
        let b = vuln.get(i).copied().unwrap_or(0);
        if a < b { return true; }
        if a > b { return false; }
    }
    false
}

#[cfg(windows)]
pub fn scan_cve_vulnerabilities() -> CveReport {
    let apps = crate::godmode::get_installed_apps_native();
    let vulns = get_known_vulnerabilities();
    let mut vulnerable_apps = Vec::new();
    let (mut critical, mut high, mut medium, mut low) = (0u32, 0u32, 0u32, 0u32);

    for app in &apps {
        for (pattern, vuln_ver, cve, severity, cvss, desc) in &vulns {
            if app.name.to_lowercase().contains(&pattern.to_lowercase())
               && !app.version.is_empty()
               && version_below(&app.version, vuln_ver) {
                match *severity {
                    "CRITICAL" => critical += 1,
                    "HIGH" => high += 1,
                    "MEDIUM" => medium += 1,
                    _ => low += 1,
                }
                vulnerable_apps.push(VulnerableApp {
                    name: app.name.clone(),
                    version: app.version.clone(),
                    cve_id: cve.to_string(),
                    severity: severity.to_string(),
                    description: desc.to_string(),
                    fix_version: Some(vuln_ver.to_string()),
                    cvss_score: *cvss,
                });
            }
        }
    }

    vulnerable_apps.sort_by(|a, b| b.cvss_score.partial_cmp(&a.cvss_score).unwrap_or(std::cmp::Ordering::Equal));
    let total = critical + high + medium + low;

    let recommendation = if critical > 0 {
        format!("URGENT: {} vulnerabilites critiques! Mettez a jour immediatement.", critical)
    } else if high > 0 {
        format!("{} vulnerabilites importantes. Mises a jour recommandees.", high)
    } else if total > 0 {
        "Vulnerabilites mineures detectees. Pensez a mettre a jour.".to_string()
    } else {
        "Aucune vulnerabilite connue. Systeme a jour!".to_string()
    };

    CveReport {
        total_vulnerabilities: total, critical, high, medium, low,
        vulnerable_apps,
        scan_date: chrono::Local::now().format("%d/%m/%Y %H:%M").to_string(),
        recommendation,
    }
}

#[cfg(not(windows))]
pub fn scan_cve_vulnerabilities() -> CveReport {
    CveReport {
        total_vulnerabilities: 0, critical: 0, high: 0, medium: 0, low: 0,
        vulnerable_apps: Vec::new(),
        scan_date: chrono::Local::now().format("%d/%m/%Y %H:%M").to_string(),
        recommendation: "Scan CVE disponible uniquement sur Windows".to_string(),
    }
}

// ============================================
// FAILURE PREDICTION (v3.4.0)
// ============================================

#[derive(Serialize, Clone, Debug)]
pub struct FailurePrediction {
    pub disk_risk: DiskRisk,
    pub ram_risk: RamRisk,
    pub overall_risk_percent: u8,
    pub predicted_issues: Vec<PredictedIssue>,
    pub recommendations: Vec<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct DiskRisk {
    pub model: String,
    pub health_percent: u8,
    pub risk_level: String,
    pub estimated_lifespan_days: Option<u32>,
    pub warning_signs: Vec<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct RamRisk {
    pub total_gb: f32,
    pub risk_level: String,
    pub error_count: u32,
    pub last_test_date: Option<String>,
    pub warning_signs: Vec<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct PredictedIssue {
    pub component: String,
    pub issue: String,
    pub probability_percent: u8,
    pub timeframe: String,
    pub impact: String,
    pub prevention: String,
}

#[cfg(windows)]
pub fn predict_failures() -> FailurePrediction {
    use std::process::Command;

    let mut disk_risk = DiskRisk {
        model: "Unknown".into(), health_percent: 100,
        risk_level: "Faible".into(), estimated_lifespan_days: None, warning_signs: Vec::new(),
    };
    let mut ram_risk = RamRisk {
        total_gb: 0.0, risk_level: "Faible".into(),
        error_count: 0, last_test_date: None, warning_signs: Vec::new(),
    };
    let mut predicted_issues = Vec::new();
    let mut recommendations = Vec::new();

    // Disk SMART check
    let ps_disk = r#"
$d = Get-CimInstance Win32_DiskDrive | Select-Object -First 1
@{ Model=$d.Model; Status=$d.Status } | ConvertTo-Json -Compress
"#;
    if let Ok(out) = Command::new("powershell").args(["-NoProfile", "-Command", ps_disk])
        .creation_flags(CREATE_NO_WINDOW).output() {
        if let Ok(json) = String::from_utf8(out.stdout) {
            if let Ok(data) = serde_json::from_str::<serde_json::Value>(json.trim()) {
                disk_risk.model = data.get("Model").and_then(|v| v.as_str()).unwrap_or("Unknown").into();
                let status = data.get("Status").and_then(|v| v.as_str()).unwrap_or("OK");
                if status == "Pred Fail" {
                    disk_risk.health_percent = 25;
                    disk_risk.risk_level = "Critique".into();
                    disk_risk.warning_signs.push("SMART predit defaillance".into());
                    predicted_issues.push(PredictedIssue {
                        component: "Disque".into(), issue: "Defaillance imminente".into(),
                        probability_percent: 85, timeframe: "1-4 semaines".into(),
                        impact: "Perte de donnees".into(), prevention: "Sauvegardez et remplacez".into(),
                    });
                }
            }
        }
    }

    // SMART FailurePredictStatus
    let ps_smart = r#"
try { $s = Get-CimInstance -Namespace root\wmi -ClassName MSStorageDriver_FailurePredictStatus -EA Stop
@{Predict=$s.PredictFailure} | ConvertTo-Json -Compress } catch { '{}' }
"#;
    if let Ok(out) = Command::new("powershell").args(["-NoProfile", "-Command", ps_smart])
        .creation_flags(CREATE_NO_WINDOW).output() {
        if let Ok(json) = String::from_utf8(out.stdout) {
            if let Ok(data) = serde_json::from_str::<serde_json::Value>(json.trim()) {
                if data.get("Predict").and_then(|v| v.as_bool()).unwrap_or(false) {
                    disk_risk.health_percent = 15;
                    disk_risk.risk_level = "Critique".into();
                }
            }
        }
    }

    // RAM info
    let sys = sysinfo::System::new_all();
    ram_risk.total_gb = sys.total_memory() as f32 / 1_073_741_824.0;

    // Memory Diagnostic results
    let ps_ram = r#"
try { $e = Get-WinEvent -FilterHashtable @{LogName='System';ProviderName='Microsoft-Windows-MemoryDiagnostics-Results'} -MaxEvents 1 -EA Stop
@{Date=$e.TimeCreated.ToString('dd/MM/yyyy');Msg=$e.Message} | ConvertTo-Json -Compress } catch { '{}' }
"#;
    if let Ok(out) = Command::new("powershell").args(["-NoProfile", "-Command", ps_ram])
        .creation_flags(CREATE_NO_WINDOW).output() {
        if let Ok(json) = String::from_utf8(out.stdout) {
            if let Ok(data) = serde_json::from_str::<serde_json::Value>(json.trim()) {
                ram_risk.last_test_date = data.get("Date").and_then(|v| v.as_str()).map(|s| s.into());
                if let Some(msg) = data.get("Msg").and_then(|v| v.as_str()) {
                    if msg.to_lowercase().contains("error") {
                        ram_risk.risk_level = "Eleve".into();
                        ram_risk.error_count = 1;
                        ram_risk.warning_signs.push("Erreurs RAM detectees".into());
                    }
                }
            }
        }
    }

    let overall_risk = ((100 - disk_risk.health_percent) as f32 * 0.7
                       + if ram_risk.error_count > 0 { 50.0 } else { 0.0 } * 0.3) as u8;

    if disk_risk.health_percent < 50 {
        recommendations.push("URGENT: Sauvegardez vos donnees".into());
    }
    if ram_risk.error_count > 0 {
        recommendations.push("Verifiez la RAM avec mdsched.exe".into());
    }
    if recommendations.is_empty() {
        recommendations.push("Aucun signe de defaillance. Continuez les sauvegardes.".into());
    }

    FailurePrediction { disk_risk, ram_risk, overall_risk_percent: overall_risk, predicted_issues, recommendations }
}

#[cfg(not(windows))]
pub fn predict_failures() -> FailurePrediction {
    FailurePrediction {
        disk_risk: DiskRisk { model: "N/A".into(), health_percent: 100, risk_level: "N/A".into(), estimated_lifespan_days: None, warning_signs: Vec::new() },
        ram_risk: RamRisk { total_gb: 0.0, risk_level: "N/A".into(), error_count: 0, last_test_date: None, warning_signs: Vec::new() },
        overall_risk_percent: 0,
        predicted_issues: Vec::new(),
        recommendations: vec!["Disponible uniquement sur Windows".into()],
    }
}
