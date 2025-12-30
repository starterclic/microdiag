// ============================================
// MICRODIAG AGENT - System Metrics
// ============================================

use serde::{Deserialize, Serialize};
use sysinfo::{System, Disks};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SystemMetrics {
    pub cpu_usage: f32,
    pub memory_total: u64,
    pub memory_used: u64,
    pub memory_percent: f32,
    pub disks: Vec<DiskInfo>,
    pub hostname: String,
    pub os_version: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DiskInfo {
    pub name: String,
    pub mount_point: String,
    pub total_gb: f64,
    pub used_gb: f64,
    pub free_gb: f64,
    pub percent: f32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HealthScore {
    pub score: u8,
    pub status: String,
    pub issues: Vec<String>,
}

impl SystemMetrics {
    pub fn collect(sys: &mut System) -> Self {
        // Only refresh what we need (FAST - ~200ms vs ~2s for refresh_all)
        sys.refresh_cpu();
        sys.refresh_memory();

        // Small delay for CPU measurement accuracy (sysinfo needs 2 samples)
        std::thread::sleep(std::time::Duration::from_millis(200));
        sys.refresh_cpu();

        let cpus = sys.cpus();
        let cpu_usage = if cpus.is_empty() {
            0.0
        } else {
            cpus.iter().map(|c| c.cpu_usage()).sum::<f32>() / cpus.len() as f32
        };

        let memory_total = sys.total_memory();
        let memory_used = sys.used_memory();
        let memory_percent = (memory_used as f64 / memory_total as f64 * 100.0) as f32;

        let disks = Disks::new_with_refreshed_list();
        let disk_infos: Vec<DiskInfo> = disks.iter().map(|disk| {
            let total = disk.total_space() as f64;
            let available = disk.available_space() as f64;
            let used = total - available;
            DiskInfo {
                name: disk.name().to_string_lossy().to_string(),
                mount_point: disk.mount_point().to_string_lossy().to_string(),
                total_gb: total / 1_073_741_824.0,
                used_gb: used / 1_073_741_824.0,
                free_gb: available / 1_073_741_824.0,
                percent: if total > 0.0 { (used / total * 100.0) as f32 } else { 0.0 },
            }
        }).collect();

        SystemMetrics {
            cpu_usage,
            memory_total,
            memory_used,
            memory_percent,
            disks: disk_infos,
            hostname: System::host_name().unwrap_or_default(),
            os_version: System::os_version().unwrap_or_default(),
        }
    }

    pub fn calculate_health(&self) -> HealthScore {
        let mut score: u8 = 100;
        let mut issues: Vec<String> = Vec::new();

        if self.cpu_usage > 80.0 {
            score = score.saturating_sub(15);
            issues.push("CPU élevé".to_string());
        }

        if self.memory_percent > 85.0 {
            score = score.saturating_sub(20);
            issues.push("Mémoire faible".to_string());
        }

        for disk in &self.disks {
            if disk.percent > 90.0 {
                score = score.saturating_sub(25);
                issues.push(format!("Disque {} plein", disk.mount_point));
            }
        }

        let status = if score >= 80 {
            "online"
        } else if score >= 50 {
            "warning"
        } else {
            "critical"
        }.to_string();

        HealthScore { score, status, issues }
    }
}
