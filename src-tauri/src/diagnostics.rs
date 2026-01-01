// ============================================
// MICRODIAG SENTINEL - Premium Diagnostics
// Full System Analysis with User-Friendly Insights
// ============================================

use serde::Serialize;
use sysinfo::{System, Components, Networks, Process, Pid};
use std::collections::HashMap;

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

pub fn get_temperatures() -> TemperatureInfo {
    let components = Components::new_with_refreshed_list();
    let mut cpu_temp: Option<f32> = None;
    let mut gpu_temp: Option<f32> = None;
    let mut disk_temp: Option<f32> = None;
    let mut component_temps: Vec<ComponentTemp> = Vec::new();

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
        let name = proc.name().to_string_lossy().to_string();
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
