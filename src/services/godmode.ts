// ============================================
// MICRODIAG SENTINEL - God Mode Service
// Native Performance API (Rust Backend)
// ============================================

import { invoke } from '@tauri-apps/api/core';

// ============================================
// TYPES
// ============================================

export interface InstalledApp {
  name: string;
  version: string;
  publisher: string;
  install_date: string;
  install_location: string;
  uninstall_string: string;
}

export interface StartupItem {
  name: string;
  command: string;
  location: string;
  enabled: boolean;
}

export interface DeepHealth {
  bios_serial: string;
  bios_manufacturer: string;
  bios_version: string;
  disk_smart_status: string;
  disk_model: string;
  battery: BatteryHealth;
  last_boot_time: string;
  windows_version: string;
  computer_name: string;
  smart_disks: SmartDiskInfo[];
  drivers: DriverInfo[];
}

export interface DriverInfo {
  name: string;
  version: string;
  driver_type: string;  // GPU, Network, Chipset, Audio
  manufacturer: string;
  driver_date: string;
  status: string;
}

// CrystalDisk-style SMART info
export interface SmartDiskInfo {
  device_id: string;
  model: string;
  serial: string;
  firmware: string;
  interface_type: string;
  media_type: string;  // SSD, HDD, NVMe
  size_gb: number;
  health_status: string;  // Bon, Attention, Critique
  health_percent: number;
  temperature_c: number | null;
  power_on_hours: number | null;
  power_on_count: number | null;
  reallocated_sectors: number | null;
  pending_sectors: number | null;
  uncorrectable_errors: number | null;
  read_error_rate: number | null;
  seek_error_rate: number | null;
  spin_retry_count: number | null;
}

export interface BatteryHealth {
  is_present: boolean;
  charge_percent: number;
  health_percent: number;
  status: string;
  design_capacity: number;
  full_charge_capacity: number;
}

export interface OutdatedApp {
  name: string;
  id: string;
  current_version: string;
  available_version: string;
}

export interface TweakResult {
  success: boolean;
  message: string;
  backup_path: string | null;
}

export interface RegBackup {
  name: string;
  path: string;
  created_at: string;
  size_bytes: number;
}

export interface PrivacyTweak {
  id: string;
  name: string;
  description: string;
  category: string;
  risk: 'low' | 'medium' | 'high';
}

// ============================================
// RECOMMENDED APPS FOR BULK INSTALL
// ============================================

export const RECOMMENDED_APPS: Record<string, Array<{ id: string; name: string; desc: string }>> = {
  "Securite": [
    { id: 'Malwarebytes.Malwarebytes', name: 'Malwarebytes', desc: 'Anti-malware de reference' },
    { id: 'Bitwarden.Bitwarden', name: 'Bitwarden', desc: 'Gestionnaire mots de passe' },
    { id: 'BleachBit.BleachBit', name: 'BleachBit', desc: 'Nettoyeur disque Open Source' },
  ],
  "Navigateurs": [
    { id: 'Mozilla.Firefox', name: 'Firefox', desc: 'Navigateur libre et rapide' },
    { id: 'BraveSoftware.BraveBrowser', name: 'Brave', desc: 'Navigateur prive avec bloqueur' },
    { id: 'Google.Chrome', name: 'Chrome', desc: 'Navigateur standard Google' },
  ],
  "Utilitaires": [
    { id: '7zip.7zip', name: '7-Zip', desc: 'Compression haute performance' },
    { id: 'VideoLAN.VLC', name: 'VLC', desc: 'Lecteur multimedia universel' },
    { id: 'Notepad++.Notepad++', name: 'Notepad++', desc: 'Editeur texte avance' },
    { id: 'Greenshot.Greenshot', name: 'Greenshot', desc: 'Capture ecran rapide' },
  ],
  "Pro & Dev": [
    { id: 'Microsoft.VisualStudioCode', name: 'VS Code', desc: 'Editeur de code Microsoft' },
    { id: 'Git.Git', name: 'Git', desc: 'Controle de version' },
    { id: 'RustDesk.RustDesk', name: 'RustDesk', desc: 'Support a distance Microdiag' },
    { id: 'PuTTY.PuTTY', name: 'PuTTY', desc: 'Client SSH/Telnet' },
  ],
};

// ============================================
// PRIVACY TWEAKS DEFINITIONS
// ============================================

export const PRIVACY_TWEAKS: PrivacyTweak[] = [
  {
    id: 'telemetry',
    name: 'Telemetrie Windows',
    description: 'Desactive l\'envoi de donnees a Microsoft',
    category: 'Privacy',
    risk: 'low',
  },
  {
    id: 'cortana',
    name: 'Cortana',
    description: 'Desactive l\'assistant vocal Microsoft',
    category: 'Privacy',
    risk: 'low',
  },
  {
    id: 'advertising_id',
    name: 'ID Publicitaire',
    description: 'Desactive le tracking publicitaire',
    category: 'Privacy',
    risk: 'low',
  },
  {
    id: 'activity_history',
    name: 'Historique Activite',
    description: 'Desactive la synchronisation de l\'historique',
    category: 'Privacy',
    risk: 'low',
  },
  {
    id: 'location',
    name: 'Localisation',
    description: 'Desactive le service de localisation',
    category: 'Privacy',
    risk: 'medium',
  },
  {
    id: 'feedback',
    name: 'Feedback Windows',
    description: 'Desactive les notifications de feedback',
    category: 'Privacy',
    risk: 'low',
  },
];

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Get installed applications (Native - <100ms)
 */
export async function getInstalledApps(): Promise<InstalledApp[]> {
  return invoke<InstalledApp[]>('gm_get_installed_apps');
}

/**
 * Get deep health info (WMI - BIOS, SMART, Battery)
 */
export async function getDeepHealth(): Promise<DeepHealth> {
  return invoke<DeepHealth>('gm_get_deep_health');
}

/**
 * Get startup items
 */
export async function getStartupItems(): Promise<StartupItem[]> {
  return invoke<StartupItem[]>('gm_get_startup_items');
}

/**
 * Disable a startup item
 */
export async function disableStartupItem(name: string, location: string): Promise<TweakResult> {
  return invoke<TweakResult>('gm_disable_startup_item', { name, location });
}

/**
 * Check for app updates via Winget
 */
export async function checkUpdates(): Promise<OutdatedApp[]> {
  return invoke<OutdatedApp[]>('gm_check_updates');
}

/**
 * Install multiple apps via Winget
 */
export async function installApps(appIds: string[]): Promise<TweakResult> {
  return invoke<TweakResult>('gm_install_apps', { appIds });
}

/**
 * Update all apps via Winget
 */
export async function updateAllApps(): Promise<TweakResult> {
  return invoke<TweakResult>('gm_update_all');
}

/**
 * Apply a privacy tweak
 */
export async function applyTweak(tweakId: string, enable: boolean): Promise<TweakResult> {
  return invoke<TweakResult>('gm_apply_tweak', { tweakId, enable });
}

/**
 * Activate Ghost Mode (clear traces)
 */
export async function activateGhostMode(): Promise<TweakResult> {
  return invoke<TweakResult>('gm_ghost_mode');
}

/**
 * List registry backups
 */
export async function listBackups(): Promise<RegBackup[]> {
  return invoke<RegBackup[]>('gm_list_backups');
}

/**
 * Restore a registry backup
 */
export async function restoreBackup(backupPath: string): Promise<TweakResult> {
  return invoke<TweakResult>('gm_restore_backup', { backupPath });
}

// ============================================
// HEALTH SCORE CALCULATOR
// ============================================

export function calculateHealthScore(
  cpuUsage: number,
  ramPercent: number,
  diskFreePercent: number,
  deepHealth: DeepHealth | null
): number {
  let score = 100;

  // CPU penalty
  if (cpuUsage > 90) score -= 15;
  else if (cpuUsage > 70) score -= 5;

  // RAM penalty
  if (ramPercent > 90) score -= 15;
  else if (ramPercent > 80) score -= 5;

  // Disk penalty
  if (diskFreePercent < 5) score -= 25;
  else if (diskFreePercent < 10) score -= 15;
  else if (diskFreePercent < 20) score -= 5;

  // SMART status
  if (deepHealth) {
    if (deepHealth.disk_smart_status !== 'OK' && deepHealth.disk_smart_status !== 'Unknown') {
      score -= 50; // Critical!
    }

    // Battery health
    if (deepHealth.battery.is_present && deepHealth.battery.health_percent < 50) {
      score -= 10;
    }
  }

  return Math.max(0, Math.min(100, score));
}
