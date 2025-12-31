// ============================================
// MICRODIAG AGENT - Security Monitoring
// Uses Windows Registry API (FAST) instead of PowerShell
// ============================================

use serde::{Deserialize, Serialize};

#[cfg(windows)]
use winreg::enums::*;
#[cfg(windows)]
use winreg::RegKey;

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
    pub fn check() -> Self {
        let mut status = SecurityStatus {
            antivirus_enabled: true,
            realtime_protection: true,
            firewall_enabled: true,
            last_scan_days: 0,
            definitions_age_days: 0,
            issues: Vec::new(),
        };

        // Check Windows Defender via Registry (FAST - ~1ms)
        if let Ok(hklm) = RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey("SOFTWARE\\Microsoft\\Windows Defender")
        {
            // Check if Defender is disabled
            if let Ok(disabled) = hklm.get_value::<u32, _>("DisableAntiSpyware") {
                if disabled == 1 {
                    status.antivirus_enabled = false;
                }
            }
        }

        // Check Real-Time Protection via Registry
        if let Ok(hklm) = RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey("SOFTWARE\\Microsoft\\Windows Defender\\Real-Time Protection")
        {
            if let Ok(disabled) = hklm.get_value::<u32, _>("DisableRealtimeMonitoring") {
                if disabled == 1 {
                    status.realtime_protection = false;
                }
            }
        }

        // Check Windows Firewall via Registry (Domain, Private, Public profiles)
        let firewall_profiles = [
            "SYSTEM\\CurrentControlSet\\Services\\SharedAccess\\Parameters\\FirewallPolicy\\DomainProfile",
            "SYSTEM\\CurrentControlSet\\Services\\SharedAccess\\Parameters\\FirewallPolicy\\StandardProfile",
            "SYSTEM\\CurrentControlSet\\Services\\SharedAccess\\Parameters\\FirewallPolicy\\PublicProfile",
        ];

        let mut any_firewall_enabled = false;
        for profile_path in firewall_profiles {
            if let Ok(profile) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(profile_path) {
                if let Ok(enabled) = profile.get_value::<u32, _>("EnableFirewall") {
                    if enabled == 1 {
                        any_firewall_enabled = true;
                        break;
                    }
                }
            }
        }
        status.firewall_enabled = any_firewall_enabled;

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

        status
    }

    #[cfg(not(windows))]
    pub fn check() -> Self {
        // Non-Windows: return safe defaults
        SecurityStatus {
            antivirus_enabled: true,
            realtime_protection: true,
            firewall_enabled: true,
            last_scan_days: 0,
            definitions_age_days: 0,
            issues: Vec::new(),
        }
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
