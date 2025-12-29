// ============================================
// MICRODIAG AGENT - Security Monitoring
// ============================================

use serde::{Deserialize, Serialize};
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

// Hide PowerShell window on Windows
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SecurityStatus {
    pub antivirus_enabled: bool,
    pub realtime_protection: bool,
    pub firewall_enabled: bool,
    pub last_scan_days: i32,
    pub definitions_age_days: i32,
    pub issues: Vec<String>,
}

impl SecurityStatus {
    #[cfg(windows)]
    fn run_powershell_hidden(script: &str) -> Option<String> {
        Command::new("powershell")
            .args(["-NoProfile", "-Command", script])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .ok()
            .filter(|o| o.status.success())
            .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
    }

    #[cfg(not(windows))]
    fn run_powershell_hidden(_script: &str) -> Option<String> {
        None
    }

    pub fn check() -> Self {
        let mut status = SecurityStatus {
            antivirus_enabled: true,
            realtime_protection: true,
            firewall_enabled: true,
            last_scan_days: 0,
            definitions_age_days: 0,
            issues: Vec::new(),
        };

        // Check Windows Defender (hidden window)
        if let Some(output) = Self::run_powershell_hidden(r#"
            try {
                $s = Get-MpComputerStatus -ErrorAction Stop
                @{ AV = $s.AntivirusEnabled; RTP = $s.RealTimeProtectionEnabled; DefAge = $s.AntivirusSignatureAge } | ConvertTo-Json -Compress
            } catch { '{"error":true}' }
        "#) {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&output) {
                if parsed.get("error").is_none() {
                    status.antivirus_enabled = parsed["AV"].as_bool().unwrap_or(true);
                    status.realtime_protection = parsed["RTP"].as_bool().unwrap_or(true);
                    status.definitions_age_days = parsed["DefAge"].as_i64().unwrap_or(0) as i32;
                }
            }
        }

        // Check Firewall (hidden window)
        if let Some(output) = Self::run_powershell_hidden(
            "(Get-NetFirewallProfile -Profile Domain,Public,Private | Where-Object {$_.Enabled -eq $true}).Count -gt 0"
        ) {
            status.firewall_enabled = output.trim().to_lowercase() == "true";
        }

        // Build issues list
        if !status.antivirus_enabled {
            status.issues.push("Antivirus désactivé".to_string());
        }
        if !status.realtime_protection {
            status.issues.push("Protection temps réel désactivée".to_string());
        }
        if !status.firewall_enabled {
            status.issues.push("Pare-feu désactivé".to_string());
        }
        if status.definitions_age_days > 7 {
            status.issues.push(format!("Définitions AV obsolètes ({} jours)", status.definitions_age_days));
        }

        status
    }

    pub fn is_critical(&self) -> bool {
        !self.antivirus_enabled || !self.realtime_protection
    }
}

#[derive(Serialize, Debug)]
pub struct SecurityLog {
    pub severity: String,
    pub category: String,
    pub message: String,
    pub details: serde_json::Value,
}

impl SecurityLog {
    pub fn from_status(status: &SecurityStatus) -> Option<Self> {
        if status.issues.is_empty() {
            return None;
        }

        let severity = if status.is_critical() { "critical" } else { "warning" };

        Some(SecurityLog {
            severity: severity.to_string(),
            category: "security".to_string(),
            message: status.issues.join(", "),
            details: serde_json::json!({
                "antivirus": status.antivirus_enabled,
                "realtime": status.realtime_protection,
                "firewall": status.firewall_enabled,
                "def_age": status.definitions_age_days
            }),
        })
    }
}
