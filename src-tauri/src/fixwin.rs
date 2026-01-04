// ============================================
// MICRODIAG SENTINEL - FixWin Module
// Windows System Repair & Maintenance Tools
// Streaming output via Tauri Events
// ============================================

use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

// ============================================
// TYPES
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FixResult {
    pub success: bool,
    pub message: String,
    pub output: Vec<String>,
    pub requires_reboot: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FixCategory {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub fixes: Vec<FixItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FixItem {
    pub id: String,
    pub name: String,
    pub description: String,
    pub risk_level: String,        // "low", "medium", "high"
    pub requires_reboot: bool,
    pub requires_admin: bool,
    pub estimated_time: String,    // "~5 sec", "~2 min", etc.
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamOutput {
    pub line: String,
    pub line_type: String,  // "info", "progress", "success", "error", "warning"
    pub progress: Option<u8>,
}

// ============================================
// FIX CATEGORIES DEFINITION
// ============================================

pub fn get_fix_categories() -> Vec<FixCategory> {
    vec![
        FixCategory {
            id: "network".into(),
            name: "Reseau".into(),
            description: "Reparation des problemes de connexion".into(),
            icon: "wifi".into(),
            fixes: vec![
                FixItem {
                    id: "flush_dns".into(),
                    name: "Vider le cache DNS".into(),
                    description: "Efface le cache DNS pour resoudre les problemes de resolution de noms".into(),
                    risk_level: "low".into(),
                    requires_reboot: false,
                    requires_admin: true,
                    estimated_time: "~5 sec".into(),
                },
                FixItem {
                    id: "reset_winsock".into(),
                    name: "Reinitialiser Winsock".into(),
                    description: "Repare la pile reseau Windows (sockets)".into(),
                    risk_level: "medium".into(),
                    requires_reboot: true,
                    requires_admin: true,
                    estimated_time: "~10 sec".into(),
                },
                FixItem {
                    id: "reset_tcpip".into(),
                    name: "Reinitialiser TCP/IP".into(),
                    description: "Remet a zero la configuration TCP/IP".into(),
                    risk_level: "medium".into(),
                    requires_reboot: true,
                    requires_admin: true,
                    estimated_time: "~10 sec".into(),
                },
                FixItem {
                    id: "reset_network_complete".into(),
                    name: "Reinitialisation reseau complete".into(),
                    description: "DNS + Winsock + TCP/IP + Release/Renew IP".into(),
                    risk_level: "medium".into(),
                    requires_reboot: true,
                    requires_admin: true,
                    estimated_time: "~30 sec".into(),
                },
                FixItem {
                    id: "reset_firewall".into(),
                    name: "Reinitialiser le pare-feu".into(),
                    description: "Remet le pare-feu Windows aux parametres par defaut".into(),
                    risk_level: "medium".into(),
                    requires_reboot: false,
                    requires_admin: true,
                    estimated_time: "~10 sec".into(),
                },
            ],
        },
        FixCategory {
            id: "system".into(),
            name: "Systeme".into(),
            description: "Reparation des fichiers systeme Windows".into(),
            icon: "settings".into(),
            fixes: vec![
                FixItem {
                    id: "sfc_scannow".into(),
                    name: "SFC /scannow".into(),
                    description: "Analyse et repare les fichiers systeme corrompus".into(),
                    risk_level: "low".into(),
                    requires_reboot: false,
                    requires_admin: true,
                    estimated_time: "~10-15 min".into(),
                },
                FixItem {
                    id: "dism_health".into(),
                    name: "DISM Repair".into(),
                    description: "Repare l'image systeme Windows (Component Store)".into(),
                    risk_level: "low".into(),
                    requires_reboot: false,
                    requires_admin: true,
                    estimated_time: "~15-20 min".into(),
                },
                FixItem {
                    id: "sfc_dism_full".into(),
                    name: "Reparation complete (DISM + SFC)".into(),
                    description: "DISM puis SFC pour une reparation approfondie".into(),
                    risk_level: "low".into(),
                    requires_reboot: true,
                    requires_admin: true,
                    estimated_time: "~25-35 min".into(),
                },
                FixItem {
                    id: "chkdsk_scan".into(),
                    name: "Verifier le disque (CHKDSK)".into(),
                    description: "Analyse le disque pour erreurs (lecture seule)".into(),
                    risk_level: "low".into(),
                    requires_reboot: false,
                    requires_admin: true,
                    estimated_time: "~5-10 min".into(),
                },
                FixItem {
                    id: "restore_point".into(),
                    name: "Creer un point de restauration".into(),
                    description: "Sauvegarde l'etat actuel du systeme".into(),
                    risk_level: "low".into(),
                    requires_reboot: false,
                    requires_admin: true,
                    estimated_time: "~1-2 min".into(),
                },
            ],
        },
        FixCategory {
            id: "explorer".into(),
            name: "Explorateur".into(),
            description: "Reparation de l'explorateur Windows".into(),
            icon: "folder".into(),
            fixes: vec![
                FixItem {
                    id: "restart_explorer".into(),
                    name: "Redemarrer l'Explorateur".into(),
                    description: "Tue et relance explorer.exe".into(),
                    risk_level: "low".into(),
                    requires_reboot: false,
                    requires_admin: false,
                    estimated_time: "~3 sec".into(),
                },
                FixItem {
                    id: "reset_icon_cache".into(),
                    name: "Vider le cache des icones".into(),
                    description: "Supprime iconcache.db et redemarrer l'explorateur".into(),
                    risk_level: "low".into(),
                    requires_reboot: false,
                    requires_admin: false,
                    estimated_time: "~5 sec".into(),
                },
                FixItem {
                    id: "reset_thumbnail_cache".into(),
                    name: "Vider le cache des miniatures".into(),
                    description: "Supprime les fichiers thumbcache".into(),
                    risk_level: "low".into(),
                    requires_reboot: false,
                    requires_admin: false,
                    estimated_time: "~5 sec".into(),
                },
                FixItem {
                    id: "reset_folder_options".into(),
                    name: "Reinitialiser les options de dossier".into(),
                    description: "Remet les options d'affichage par defaut".into(),
                    risk_level: "low".into(),
                    requires_reboot: false,
                    requires_admin: false,
                    estimated_time: "~3 sec".into(),
                },
            ],
        },
        FixCategory {
            id: "windows_update".into(),
            name: "Windows Update".into(),
            description: "Reparation des mises a jour Windows".into(),
            icon: "download".into(),
            fixes: vec![
                FixItem {
                    id: "clear_update_cache".into(),
                    name: "Vider le cache des mises a jour".into(),
                    description: "Supprime les fichiers telecharges de Windows Update".into(),
                    risk_level: "medium".into(),
                    requires_reboot: false,
                    requires_admin: true,
                    estimated_time: "~30 sec".into(),
                },
                FixItem {
                    id: "reset_windows_update".into(),
                    name: "Reinitialiser Windows Update".into(),
                    description: "Arrete les services, vide le cache, et redemarre".into(),
                    risk_level: "medium".into(),
                    requires_reboot: true,
                    requires_admin: true,
                    estimated_time: "~1 min".into(),
                },
                FixItem {
                    id: "reregister_dlls".into(),
                    name: "Reenregistrer les DLLs Windows Update".into(),
                    description: "Execute regsvr32 sur les DLLs necessaires".into(),
                    risk_level: "medium".into(),
                    requires_reboot: false,
                    requires_admin: true,
                    estimated_time: "~30 sec".into(),
                },
            ],
        },
        FixCategory {
            id: "cleanup".into(),
            name: "Nettoyage".into(),
            description: "Nettoyage des fichiers temporaires".into(),
            icon: "trash".into(),
            fixes: vec![
                FixItem {
                    id: "clean_temp".into(),
                    name: "Nettoyer les fichiers temporaires".into(),
                    description: "Supprime les fichiers temp de l'utilisateur".into(),
                    risk_level: "low".into(),
                    requires_reboot: false,
                    requires_admin: false,
                    estimated_time: "~10 sec".into(),
                },
                FixItem {
                    id: "clean_system_temp".into(),
                    name: "Nettoyer les fichiers systeme temp".into(),
                    description: "Supprime les fichiers temp systeme (Windows\\Temp)".into(),
                    risk_level: "low".into(),
                    requires_reboot: false,
                    requires_admin: true,
                    estimated_time: "~15 sec".into(),
                },
                FixItem {
                    id: "clean_prefetch".into(),
                    name: "Vider le cache Prefetch".into(),
                    description: "Supprime les fichiers de prefetch Windows".into(),
                    risk_level: "low".into(),
                    requires_reboot: false,
                    requires_admin: true,
                    estimated_time: "~5 sec".into(),
                },
                FixItem {
                    id: "disk_cleanup".into(),
                    name: "Nettoyage de disque avance".into(),
                    description: "Lance cleanmgr avec options systeme".into(),
                    risk_level: "low".into(),
                    requires_reboot: false,
                    requires_admin: true,
                    estimated_time: "~2-5 min".into(),
                },
            ],
        },
        FixCategory {
            id: "services".into(),
            name: "Services".into(),
            description: "Gestion des services Windows".into(),
            icon: "zap".into(),
            fixes: vec![
                FixItem {
                    id: "restart_audio".into(),
                    name: "Redemarrer le service audio".into(),
                    description: "Redemarre Windows Audio et AudioEndpointBuilder".into(),
                    risk_level: "low".into(),
                    requires_reboot: false,
                    requires_admin: true,
                    estimated_time: "~5 sec".into(),
                },
                FixItem {
                    id: "restart_print_spooler".into(),
                    name: "Redemarrer le spooler d'impression".into(),
                    description: "Redemarre le service Print Spooler".into(),
                    risk_level: "low".into(),
                    requires_reboot: false,
                    requires_admin: true,
                    estimated_time: "~5 sec".into(),
                },
                FixItem {
                    id: "restart_search".into(),
                    name: "Redemarrer Windows Search".into(),
                    description: "Redemarre le service d'indexation".into(),
                    risk_level: "low".into(),
                    requires_reboot: false,
                    requires_admin: true,
                    estimated_time: "~5 sec".into(),
                },
            ],
        },
    ]
}

// ============================================
// HELPER: Run PowerShell with streaming output
// ============================================

#[cfg(windows)]
pub fn run_powershell_streaming<F>(command: &str, mut on_output: F) -> FixResult
where F: FnMut(StreamOutput)
{
    let mut cmd = Command::new("powershell");
    cmd.args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW);

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            return FixResult {
                success: false,
                message: format!("Erreur lancement PowerShell: {}", e),
                output: vec![],
                requires_reboot: false,
            };
        }
    };

    let stdout = child.stdout.take().unwrap();
    let reader = BufReader::new(stdout);
    let mut output_lines = Vec::new();

    for line in reader.lines() {
        if let Ok(line) = line {
            let line_type = detect_line_type(&line);
            let progress = extract_progress(&line);

            output_lines.push(line.clone());
            on_output(StreamOutput {
                line,
                line_type,
                progress,
            });
        }
    }

    let status = child.wait().unwrap_or_else(|_| std::process::ExitStatus::default());

    FixResult {
        success: status.success(),
        message: if status.success() { "Operation terminee avec succes".into() } else { "Operation terminee avec erreurs".into() },
        output: output_lines,
        requires_reboot: false,
    }
}

#[cfg(not(windows))]
pub fn run_powershell_streaming<F>(_command: &str, mut on_output: F) -> FixResult
where F: FnMut(StreamOutput)
{
    on_output(StreamOutput {
        line: "Cette fonctionnalite n'est disponible que sur Windows".into(),
        line_type: "error".into(),
        progress: None,
    });
    FixResult {
        success: false,
        message: "Disponible uniquement sur Windows".into(),
        output: vec![],
        requires_reboot: false,
    }
}

fn detect_line_type(line: &str) -> String {
    let lower = line.to_lowercase();
    if lower.contains("erreur") || lower.contains("error") || lower.contains("failed") || lower.contains("echec") {
        "error".into()
    } else if lower.contains("succes") || lower.contains("success") || lower.contains("complete") || lower.contains("termine") || lower.contains("ok") {
        "success".into()
    } else if lower.contains("warning") || lower.contains("attention") || lower.contains("avertissement") {
        "warning".into()
    } else if lower.contains("%") || lower.contains("progress") || lower.contains("scan") {
        "progress".into()
    } else {
        "info".into()
    }
}

fn extract_progress(line: &str) -> Option<u8> {
    // Try to extract percentage from line like "45%" or "Progress: 45"
    let re_percent = regex::Regex::new(r"(\d+)\s*%").ok()?;
    if let Some(caps) = re_percent.captures(line) {
        if let Some(m) = caps.get(1) {
            return m.as_str().parse().ok();
        }
    }
    None
}

// ============================================
// NETWORK FIXES
// ============================================

#[cfg(windows)]
pub fn fix_flush_dns<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) {
    run_powershell_streaming(
        r#"
        Write-Output "[INFO] Vidage du cache DNS..."
        ipconfig /flushdns
        Write-Output "[OK] Cache DNS vide avec succes"
        "#,
        on_output
    )
}

#[cfg(windows)]
pub fn fix_reset_winsock<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) {
    let mut result = run_powershell_streaming(
        r#"
        Write-Output "[INFO] Reinitialisation de Winsock..."
        netsh winsock reset
        Write-Output "[OK] Winsock reinitialise"
        Write-Output "[ATTENTION] Un redemarrage est necessaire pour appliquer les changements"
        "#,
        on_output
    );
    result.requires_reboot = true;
    result
}

#[cfg(windows)]
pub fn fix_reset_tcpip<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) {
    let mut result = run_powershell_streaming(
        r#"
        Write-Output "[INFO] Reinitialisation de TCP/IP..."
        netsh int ip reset
        Write-Output "[OK] TCP/IP reinitialise"
        Write-Output "[ATTENTION] Un redemarrage est necessaire pour appliquer les changements"
        "#,
        on_output
    );
    result.requires_reboot = true;
    result
}

#[cfg(windows)]
pub fn fix_reset_network_complete<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) {
    let mut result = run_powershell_streaming(
        r#"
        Write-Output "[INFO] Reinitialisation reseau complete..."
        Write-Output "[1/5] Vidage du cache DNS..."
        ipconfig /flushdns
        Write-Output "[2/5] Reinitialisation de Winsock..."
        netsh winsock reset
        Write-Output "[3/5] Reinitialisation de TCP/IP..."
        netsh int ip reset
        Write-Output "[4/5] Liberation de l'adresse IP..."
        ipconfig /release
        Start-Sleep -Seconds 2
        Write-Output "[5/5] Renouvellement de l'adresse IP..."
        ipconfig /renew
        Write-Output "[OK] Reinitialisation reseau complete terminee"
        Write-Output "[ATTENTION] Un redemarrage est recommande"
        "#,
        on_output
    );
    result.requires_reboot = true;
    result
}

#[cfg(windows)]
pub fn fix_reset_firewall<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) {
    run_powershell_streaming(
        r#"
        Write-Output "[INFO] Reinitialisation du pare-feu Windows..."
        netsh advfirewall reset
        Write-Output "[OK] Pare-feu reinitialise aux parametres par defaut"
        "#,
        on_output
    )
}

// ============================================
// SYSTEM FIXES
// ============================================

#[cfg(windows)]
pub fn fix_sfc_scannow<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) {
    run_powershell_streaming(
        r#"
        Write-Output "[INFO] Lancement de SFC /scannow..."
        Write-Output "[INFO] Cette operation peut prendre 10-15 minutes"
        Write-Output ""
        sfc /scannow
        Write-Output ""
        Write-Output "[OK] Analyse SFC terminee"
        "#,
        on_output
    )
}

#[cfg(windows)]
pub fn fix_dism_health<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) {
    run_powershell_streaming(
        r#"
        Write-Output "[INFO] Lancement de DISM pour reparer l'image systeme..."
        Write-Output "[INFO] Cette operation peut prendre 15-20 minutes"
        Write-Output ""
        Write-Output "[1/3] Verification de l'image..."
        DISM /Online /Cleanup-Image /CheckHealth
        Write-Output "[2/3] Analyse de l'image..."
        DISM /Online /Cleanup-Image /ScanHealth
        Write-Output "[3/3] Reparation de l'image..."
        DISM /Online /Cleanup-Image /RestoreHealth
        Write-Output ""
        Write-Output "[OK] Reparation DISM terminee"
        "#,
        on_output
    )
}

#[cfg(windows)]
pub fn fix_sfc_dism_full<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) {
    let mut result = run_powershell_streaming(
        r#"
        Write-Output "[INFO] Reparation complete du systeme (DISM + SFC)"
        Write-Output "[INFO] Cette operation peut prendre 25-35 minutes"
        Write-Output ""
        Write-Output "=== ETAPE 1: DISM ==="
        DISM /Online /Cleanup-Image /RestoreHealth
        Write-Output ""
        Write-Output "=== ETAPE 2: SFC ==="
        sfc /scannow
        Write-Output ""
        Write-Output "[OK] Reparation complete terminee"
        Write-Output "[ATTENTION] Un redemarrage est recommande"
        "#,
        on_output
    );
    result.requires_reboot = true;
    result
}

#[cfg(windows)]
pub fn fix_chkdsk_scan<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) {
    run_powershell_streaming(
        r#"
        Write-Output "[INFO] Verification du disque C: (lecture seule)..."
        chkdsk C:
        Write-Output "[OK] Verification du disque terminee"
        "#,
        on_output
    )
}

#[cfg(windows)]
pub fn fix_create_restore_point<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) {
    run_powershell_streaming(
        r#"
        Write-Output "[INFO] Creation d'un point de restauration..."
        try {
            # Enable System Restore if not enabled
            Enable-ComputerRestore -Drive "C:\" -ErrorAction SilentlyContinue

            # Create restore point
            Checkpoint-Computer -Description "Microdiag Sentinel Backup" -RestorePointType "MODIFY_SETTINGS"
            Write-Output "[OK] Point de restauration cree avec succes"
        } catch {
            Write-Output "[ERREUR] Impossible de creer le point de restauration: $_"
        }
        "#,
        on_output
    )
}

// ============================================
// EXPLORER FIXES
// ============================================

#[cfg(windows)]
pub fn fix_restart_explorer<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) {
    run_powershell_streaming(
        r#"
        Write-Output "[INFO] Redemarrage de l'Explorateur Windows..."
        Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Start-Process explorer
        Write-Output "[OK] Explorateur redemarre"
        "#,
        on_output
    )
}

#[cfg(windows)]
pub fn fix_reset_icon_cache<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) {
    run_powershell_streaming(
        r#"
        Write-Output "[INFO] Nettoyage du cache des icones..."

        # Stop explorer
        Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2

        # Delete icon cache files
        $localAppData = $env:LOCALAPPDATA
        $iconCachePath = "$localAppData\Microsoft\Windows\Explorer"

        Get-ChildItem -Path $iconCachePath -Filter "iconcache*" -ErrorAction SilentlyContinue | Remove-Item -Force
        Get-ChildItem -Path $iconCachePath -Filter "thumbcache*" -ErrorAction SilentlyContinue | Remove-Item -Force

        # Also clean the old location
        $oldIconCache = "$localAppData\IconCache.db"
        if (Test-Path $oldIconCache) {
            Remove-Item $oldIconCache -Force
        }

        Write-Output "[OK] Cache des icones supprime"

        # Restart explorer
        Start-Process explorer
        Write-Output "[OK] Explorateur redemarre"
        "#,
        on_output
    )
}

#[cfg(windows)]
pub fn fix_reset_thumbnail_cache<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) {
    run_powershell_streaming(
        r#"
        Write-Output "[INFO] Nettoyage du cache des miniatures..."

        Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2

        $thumbCachePath = "$env:LOCALAPPDATA\Microsoft\Windows\Explorer"
        Get-ChildItem -Path $thumbCachePath -Filter "thumbcache*" -ErrorAction SilentlyContinue | Remove-Item -Force

        Write-Output "[OK] Cache des miniatures supprime"

        Start-Process explorer
        Write-Output "[OK] Explorateur redemarre"
        "#,
        on_output
    )
}

#[cfg(windows)]
pub fn fix_reset_folder_options<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) {
    run_powershell_streaming(
        r#"
        Write-Output "[INFO] Reinitialisation des options de dossier..."

        # Reset folder view settings
        $bagMRU = "HKCU:\Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\BagMRU"
        $bags = "HKCU:\Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\Bags"

        if (Test-Path $bagMRU) { Remove-Item $bagMRU -Recurse -Force -ErrorAction SilentlyContinue }
        if (Test-Path $bags) { Remove-Item $bags -Recurse -Force -ErrorAction SilentlyContinue }

        Write-Output "[OK] Options de dossier reinitialisees"
        Write-Output "[INFO] Redemarrage de l'explorateur..."

        Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Start-Process explorer

        Write-Output "[OK] Explorateur redemarre"
        "#,
        on_output
    )
}

// ============================================
// WINDOWS UPDATE FIXES
// ============================================

#[cfg(windows)]
pub fn fix_clear_update_cache<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) {
    run_powershell_streaming(
        r#"
        Write-Output "[INFO] Nettoyage du cache Windows Update..."

        Write-Output "[1/3] Arret du service Windows Update..."
        Stop-Service -Name wuauserv -Force -ErrorAction SilentlyContinue
        Stop-Service -Name bits -Force -ErrorAction SilentlyContinue

        Start-Sleep -Seconds 2

        Write-Output "[2/3] Suppression des fichiers de cache..."
        $downloadPath = "C:\Windows\SoftwareDistribution\Download"
        if (Test-Path $downloadPath) {
            Get-ChildItem -Path $downloadPath -Recurse | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
        }

        Write-Output "[3/3] Redemarrage des services..."
        Start-Service -Name wuauserv -ErrorAction SilentlyContinue
        Start-Service -Name bits -ErrorAction SilentlyContinue

        Write-Output "[OK] Cache Windows Update nettoye"
        "#,
        on_output
    )
}

#[cfg(windows)]
pub fn fix_reset_windows_update<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) {
    let mut result = run_powershell_streaming(
        r#"
        Write-Output "[INFO] Reinitialisation complete de Windows Update..."

        Write-Output "[1/6] Arret des services..."
        Stop-Service -Name wuauserv -Force -ErrorAction SilentlyContinue
        Stop-Service -Name bits -Force -ErrorAction SilentlyContinue
        Stop-Service -Name cryptSvc -Force -ErrorAction SilentlyContinue
        Stop-Service -Name msiserver -Force -ErrorAction SilentlyContinue

        Start-Sleep -Seconds 2

        Write-Output "[2/6] Renommage des dossiers de cache..."
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        if (Test-Path "C:\Windows\SoftwareDistribution") {
            Rename-Item "C:\Windows\SoftwareDistribution" "SoftwareDistribution_$timestamp" -ErrorAction SilentlyContinue
        }
        if (Test-Path "C:\Windows\System32\catroot2") {
            Rename-Item "C:\Windows\System32\catroot2" "catroot2_$timestamp" -ErrorAction SilentlyContinue
        }

        Write-Output "[3/6] Reinitialisation de Winsock..."
        netsh winsock reset | Out-Null

        Write-Output "[4/6] Reinitialisation du proxy..."
        netsh winhttp reset proxy | Out-Null

        Write-Output "[5/6] Redemarrage des services..."
        Start-Service -Name wuauserv -ErrorAction SilentlyContinue
        Start-Service -Name bits -ErrorAction SilentlyContinue
        Start-Service -Name cryptSvc -ErrorAction SilentlyContinue
        Start-Service -Name msiserver -ErrorAction SilentlyContinue

        Write-Output "[6/6] Verification..."
        Start-Sleep -Seconds 2

        Write-Output "[OK] Windows Update reinitialise"
        Write-Output "[ATTENTION] Un redemarrage est recommande"
        "#,
        on_output
    );
    result.requires_reboot = true;
    result
}

#[cfg(windows)]
pub fn fix_reregister_dlls<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) {
    run_powershell_streaming(
        r#"
        Write-Output "[INFO] Reenregistrement des DLLs Windows Update..."

        $dlls = @(
            "atl.dll", "urlmon.dll", "mshtml.dll", "shdocvw.dll",
            "browseui.dll", "jscript.dll", "vbscript.dll", "scrrun.dll",
            "msxml.dll", "msxml3.dll", "msxml6.dll", "actxprxy.dll",
            "softpub.dll", "wintrust.dll", "dssenh.dll", "rsaenh.dll",
            "gpkcsp.dll", "sccbase.dll", "slbcsp.dll", "cryptdlg.dll",
            "oleaut32.dll", "ole32.dll", "shell32.dll", "initpki.dll",
            "wuapi.dll", "wuaueng.dll", "wuaueng1.dll", "wucltui.dll",
            "wups.dll", "wups2.dll", "wuweb.dll", "qmgr.dll", "qmgrprxy.dll",
            "wucltux.dll", "muweb.dll", "wuwebv.dll"
        )

        $total = $dlls.Count
        $current = 0

        foreach ($dll in $dlls) {
            $current++
            $percent = [math]::Round(($current / $total) * 100)
            Write-Output "[$percent%] Enregistrement de $dll..."
            regsvr32 /s $dll 2>$null
        }

        Write-Output "[OK] DLLs reenregistrees"
        "#,
        on_output
    )
}

// ============================================
// CLEANUP FIXES
// ============================================

#[cfg(windows)]
pub fn fix_clean_temp<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) {
    run_powershell_streaming(
        r#"
        Write-Output "[INFO] Nettoyage des fichiers temporaires utilisateur..."

        $tempPath = $env:TEMP
        $count = 0
        $size = 0

        Get-ChildItem -Path $tempPath -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
            $size += $_.Length
            $count++
            Remove-Item $_.FullName -Force -Recurse -ErrorAction SilentlyContinue
        }

        $sizeMB = [math]::Round($size / 1MB, 2)
        Write-Output "[OK] $count fichiers supprimes ($sizeMB MB liberes)"
        "#,
        on_output
    )
}

#[cfg(windows)]
pub fn fix_clean_system_temp<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) {
    run_powershell_streaming(
        r#"
        Write-Output "[INFO] Nettoyage des fichiers temporaires systeme..."

        $paths = @(
            "C:\Windows\Temp",
            "C:\Windows\Logs\CBS"
        )

        $totalCount = 0
        $totalSize = 0

        foreach ($path in $paths) {
            if (Test-Path $path) {
                Write-Output "[INFO] Nettoyage de $path..."
                Get-ChildItem -Path $path -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
                    $totalSize += $_.Length
                    $totalCount++
                    Remove-Item $_.FullName -Force -Recurse -ErrorAction SilentlyContinue
                }
            }
        }

        $sizeMB = [math]::Round($totalSize / 1MB, 2)
        Write-Output "[OK] $totalCount fichiers supprimes ($sizeMB MB liberes)"
        "#,
        on_output
    )
}

#[cfg(windows)]
pub fn fix_clean_prefetch<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) {
    run_powershell_streaming(
        r#"
        Write-Output "[INFO] Nettoyage du cache Prefetch..."

        $prefetchPath = "C:\Windows\Prefetch"
        $count = 0

        if (Test-Path $prefetchPath) {
            $files = Get-ChildItem -Path $prefetchPath -Force -ErrorAction SilentlyContinue
            $count = $files.Count
            $files | Remove-Item -Force -ErrorAction SilentlyContinue
        }

        Write-Output "[OK] $count fichiers Prefetch supprimes"
        Write-Output "[INFO] Le cache sera reconstruit automatiquement"
        "#,
        on_output
    )
}

#[cfg(windows)]
pub fn fix_disk_cleanup<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) {
    run_powershell_streaming(
        r#"
        Write-Output "[INFO] Lancement du nettoyage de disque avance..."
        Write-Output "[INFO] Configuration des options..."

        # Set cleanup flags in registry for automated cleanup
        $cleanupPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VolumeCaches"

        $categories = @(
            "Active Setup Temp Folders",
            "Downloaded Program Files",
            "Internet Cache Files",
            "Old ChkDsk Files",
            "Recycle Bin",
            "Setup Log Files",
            "System error memory dump files",
            "System error minidump files",
            "Temporary Files",
            "Temporary Setup Files",
            "Thumbnail Cache",
            "Update Cleanup",
            "Windows Error Reporting Archive Files",
            "Windows Error Reporting Queue Files"
        )

        foreach ($cat in $categories) {
            $path = "$cleanupPath\$cat"
            if (Test-Path $path) {
                Set-ItemProperty -Path $path -Name "StateFlags0100" -Value 2 -ErrorAction SilentlyContinue
            }
        }

        Write-Output "[INFO] Execution du nettoyage..."
        Start-Process cleanmgr -ArgumentList "/sagerun:100" -Wait -ErrorAction SilentlyContinue

        Write-Output "[OK] Nettoyage de disque termine"
        "#,
        on_output
    )
}

// ============================================
// SERVICE FIXES
// ============================================

#[cfg(windows)]
pub fn fix_restart_audio<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) {
    run_powershell_streaming(
        r#"
        Write-Output "[INFO] Redemarrage des services audio..."

        Write-Output "[1/2] Arret des services..."
        Stop-Service -Name AudioSrv -Force -ErrorAction SilentlyContinue
        Stop-Service -Name AudioEndpointBuilder -Force -ErrorAction SilentlyContinue

        Start-Sleep -Seconds 2

        Write-Output "[2/2] Demarrage des services..."
        Start-Service -Name AudioEndpointBuilder -ErrorAction SilentlyContinue
        Start-Service -Name AudioSrv -ErrorAction SilentlyContinue

        Write-Output "[OK] Services audio redemarres"
        "#,
        on_output
    )
}

#[cfg(windows)]
pub fn fix_restart_print_spooler<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) {
    run_powershell_streaming(
        r#"
        Write-Output "[INFO] Redemarrage du spooler d'impression..."

        Stop-Service -Name Spooler -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2

        # Clear print queue
        $printPath = "C:\Windows\System32\spool\PRINTERS"
        if (Test-Path $printPath) {
            Get-ChildItem -Path $printPath | Remove-Item -Force -ErrorAction SilentlyContinue
        }

        Start-Service -Name Spooler -ErrorAction SilentlyContinue

        Write-Output "[OK] Spooler d'impression redemarre"
        "#,
        on_output
    )
}

#[cfg(windows)]
pub fn fix_restart_search<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) {
    run_powershell_streaming(
        r#"
        Write-Output "[INFO] Redemarrage du service Windows Search..."

        Stop-Service -Name WSearch -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Start-Service -Name WSearch -ErrorAction SilentlyContinue

        Write-Output "[OK] Windows Search redemarre"
        "#,
        on_output
    )
}

// ============================================
// NON-WINDOWS FALLBACKS
// ============================================

#[cfg(not(windows))]
pub fn fix_flush_dns<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) { run_powershell_streaming("", on_output) }
#[cfg(not(windows))]
pub fn fix_reset_winsock<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) { run_powershell_streaming("", on_output) }
#[cfg(not(windows))]
pub fn fix_reset_tcpip<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) { run_powershell_streaming("", on_output) }
#[cfg(not(windows))]
pub fn fix_reset_network_complete<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) { run_powershell_streaming("", on_output) }
#[cfg(not(windows))]
pub fn fix_reset_firewall<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) { run_powershell_streaming("", on_output) }
#[cfg(not(windows))]
pub fn fix_sfc_scannow<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) { run_powershell_streaming("", on_output) }
#[cfg(not(windows))]
pub fn fix_dism_health<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) { run_powershell_streaming("", on_output) }
#[cfg(not(windows))]
pub fn fix_sfc_dism_full<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) { run_powershell_streaming("", on_output) }
#[cfg(not(windows))]
pub fn fix_chkdsk_scan<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) { run_powershell_streaming("", on_output) }
#[cfg(not(windows))]
pub fn fix_create_restore_point<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) { run_powershell_streaming("", on_output) }
#[cfg(not(windows))]
pub fn fix_restart_explorer<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) { run_powershell_streaming("", on_output) }
#[cfg(not(windows))]
pub fn fix_reset_icon_cache<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) { run_powershell_streaming("", on_output) }
#[cfg(not(windows))]
pub fn fix_reset_thumbnail_cache<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) { run_powershell_streaming("", on_output) }
#[cfg(not(windows))]
pub fn fix_reset_folder_options<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) { run_powershell_streaming("", on_output) }
#[cfg(not(windows))]
pub fn fix_clear_update_cache<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) { run_powershell_streaming("", on_output) }
#[cfg(not(windows))]
pub fn fix_reset_windows_update<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) { run_powershell_streaming("", on_output) }
#[cfg(not(windows))]
pub fn fix_reregister_dlls<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) { run_powershell_streaming("", on_output) }
#[cfg(not(windows))]
pub fn fix_clean_temp<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) { run_powershell_streaming("", on_output) }
#[cfg(not(windows))]
pub fn fix_clean_system_temp<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) { run_powershell_streaming("", on_output) }
#[cfg(not(windows))]
pub fn fix_clean_prefetch<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) { run_powershell_streaming("", on_output) }
#[cfg(not(windows))]
pub fn fix_disk_cleanup<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) { run_powershell_streaming("", on_output) }
#[cfg(not(windows))]
pub fn fix_restart_audio<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) { run_powershell_streaming("", on_output) }
#[cfg(not(windows))]
pub fn fix_restart_print_spooler<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) { run_powershell_streaming("", on_output) }
#[cfg(not(windows))]
pub fn fix_restart_search<F>(on_output: F) -> FixResult where F: FnMut(StreamOutput) { run_powershell_streaming("", on_output) }

// ============================================
// DISPATCHER - Execute fix by ID
// ============================================

pub fn execute_fix<F>(fix_id: &str, on_output: F) -> FixResult
where F: FnMut(StreamOutput)
{
    match fix_id {
        // Network
        "flush_dns" => fix_flush_dns(on_output),
        "reset_winsock" => fix_reset_winsock(on_output),
        "reset_tcpip" => fix_reset_tcpip(on_output),
        "reset_network_complete" => fix_reset_network_complete(on_output),
        "reset_firewall" => fix_reset_firewall(on_output),
        // System
        "sfc_scannow" => fix_sfc_scannow(on_output),
        "dism_health" => fix_dism_health(on_output),
        "sfc_dism_full" => fix_sfc_dism_full(on_output),
        "chkdsk_scan" => fix_chkdsk_scan(on_output),
        "restore_point" => fix_create_restore_point(on_output),
        // Explorer
        "restart_explorer" => fix_restart_explorer(on_output),
        "reset_icon_cache" => fix_reset_icon_cache(on_output),
        "reset_thumbnail_cache" => fix_reset_thumbnail_cache(on_output),
        "reset_folder_options" => fix_reset_folder_options(on_output),
        // Windows Update
        "clear_update_cache" => fix_clear_update_cache(on_output),
        "reset_windows_update" => fix_reset_windows_update(on_output),
        "reregister_dlls" => fix_reregister_dlls(on_output),
        // Cleanup
        "clean_temp" => fix_clean_temp(on_output),
        "clean_system_temp" => fix_clean_system_temp(on_output),
        "clean_prefetch" => fix_clean_prefetch(on_output),
        "disk_cleanup" => fix_disk_cleanup(on_output),
        // Services
        "restart_audio" => fix_restart_audio(on_output),
        "restart_print_spooler" => fix_restart_print_spooler(on_output),
        "restart_search" => fix_restart_search(on_output),
        // Unknown
        _ => FixResult {
            success: false,
            message: format!("Fix inconnu: {}", fix_id),
            output: vec![],
            requires_reboot: false,
        }
    }
}
