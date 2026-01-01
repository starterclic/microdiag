// ============================================
// MICRODIAG SENTINEL - Premium Diagnostics Service
// TypeScript bindings for native diagnostics
// ============================================

import { invoke } from '@tauri-apps/api/core';

// ============================================
// TYPES
// ============================================

export interface PremiumDiagnostic {
  temperatures: TemperatureInfo;
  processes: ProcessAnalysis;
  network: NetworkAnalysis;
  storage: StorageAnalysis;
  system_info: ExtendedSystemInfo;
  recommendations: Recommendation[];
  overall_score: number;
  overall_status: 'excellent' | 'good' | 'warning' | 'critical';
}

export interface TemperatureInfo {
  cpu_temp: number | null;
  gpu_temp: number | null;
  disk_temp: number | null;
  cpu_status: string;
  cpu_message: string;
  components: ComponentTemp[];
}

export interface ComponentTemp {
  name: string;
  temp: number;
  max_temp: number;
  status: 'excellent' | 'normal' | 'warm' | 'hot';
}

export interface ProcessAnalysis {
  total_count: number;
  top_cpu: ProcessInfo[];
  top_memory: ProcessInfo[];
  suspicious: ProcessInfo[];
  startup_impact: StartupProcess[];
  summary: string;
}

export interface ProcessInfo {
  name: string;
  pid: number;
  cpu_percent: number;
  memory_mb: number;
  memory_percent: number;
  status: string;
  description: string;
  category: string;
}

export interface StartupProcess {
  name: string;
  impact: 'low' | 'medium' | 'high';
  description: string;
  can_disable: boolean;
}

export interface NetworkAnalysis {
  is_connected: boolean;
  latency_ms: number | null;
  latency_status: string;
  dns_status: string;
  interfaces: NetworkInterface[];
  download_speed: number | null;
  upload_speed: number | null;
  public_ip: string | null;
  summary: string;
}

export interface NetworkInterface {
  name: string;
  ip: string;
  mac: string;
  received_mb: number;
  transmitted_mb: number;
  is_up: boolean;
}

export interface StorageAnalysis {
  drives: DriveAnalysis[];
  total_space_gb: number;
  used_space_gb: number;
  free_space_gb: number;
  largest_files: LargeFile[];
  temp_files_mb: number;
  recycle_bin_mb: number;
  summary: string;
}

export interface DriveAnalysis {
  letter: string;
  name: string;
  total_gb: number;
  used_gb: number;
  free_gb: number;
  percent: number;
  health: 'good' | 'warning' | 'critical';
  smart_status: string;
  drive_type: string;
  read_speed: number | null;
  write_speed: number | null;
}

export interface LargeFile {
  path: string;
  size_mb: number;
  file_type: string;
}

export interface ExtendedSystemInfo {
  cpu_name: string;
  cpu_cores: number;
  cpu_threads: number;
  cpu_frequency_mhz: number;
  ram_total_gb: number;
  ram_slots_used: string;
  gpu_name: string;
  gpu_memory_mb: number;
  motherboard: string;
  bios_version: string;
  windows_version: string;
  windows_build: string;
  install_date: string;
  last_boot: string;
  uptime_hours: number;
}

export interface Recommendation {
  priority: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  action: string | null;
  impact: string;
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Run complete premium diagnostic
 * Returns all system analysis data in one call
 */
export async function runPremiumDiagnostic(): Promise<PremiumDiagnostic> {
  return invoke<PremiumDiagnostic>('run_premium_diagnostic');
}

/**
 * Get temperature readings
 */
export async function getTemperatures(): Promise<TemperatureInfo> {
  return invoke<TemperatureInfo>('get_temperatures');
}

/**
 * Get process analysis with top consumers
 */
export async function getProcessAnalysis(): Promise<ProcessAnalysis> {
  return invoke<ProcessAnalysis>('get_process_analysis');
}

/**
 * Get network analysis with latency test
 */
export async function getNetworkAnalysis(): Promise<NetworkAnalysis> {
  return invoke<NetworkAnalysis>('get_network_analysis');
}

/**
 * Get storage analysis
 */
export async function getStorageAnalysis(): Promise<StorageAnalysis> {
  return invoke<StorageAnalysis>('get_storage_analysis');
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get status color based on value
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'excellent':
    case 'good':
      return '#00c853';
    case 'normal':
      return '#4caf50';
    case 'warning':
    case 'warm':
      return '#ff9800';
    case 'critical':
    case 'hot':
      return '#f44336';
    default:
      return '#9e9e9e';
  }
}

/**
 * Get priority icon
 */
export function getPriorityIcon(priority: string): string {
  switch (priority) {
    case 'critical':
      return '🔴';
    case 'warning':
      return '🟠';
    case 'info':
      return '🟢';
    default:
      return '⚪';
  }
}

/**
 * Format temperature for display
 */
export function formatTemp(temp: number | null): string {
  if (temp === null) return '--';
  return `${Math.round(temp)}°C`;
}

/**
 * Format memory size
 */
export function formatMemory(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${Math.round(mb)} MB`;
}

/**
 * Format latency
 */
export function formatLatency(ms: number | null): string {
  if (ms === null) return '--';
  if (ms < 30) return `${ms}ms (Excellent)`;
  if (ms < 60) return `${ms}ms (Bon)`;
  if (ms < 100) return `${ms}ms (Correct)`;
  return `${ms}ms (Lent)`;
}

/**
 * Get category display info
 */
export function getCategoryInfo(category: string): { icon: string; name: string; color: string } {
  const categories: Record<string, { icon: string; name: string; color: string }> = {
    browser: { icon: '🌐', name: 'Navigateur', color: '#4285f4' },
    antivirus: { icon: '🛡️', name: 'Antivirus', color: '#4caf50' },
    system: { icon: '⚙️', name: 'Systeme', color: '#607d8b' },
    office: { icon: '📄', name: 'Office', color: '#d83b01' },
    game: { icon: '🎮', name: 'Jeu', color: '#9c27b0' },
    dev: { icon: '💻', name: 'Dev', color: '#00bcd4' },
    media: { icon: '🎵', name: 'Media', color: '#e91e63' },
    communication: { icon: '💬', name: 'Communication', color: '#5865f2' },
    other: { icon: '📦', name: 'Application', color: '#757575' },
  };
  return categories[category] || categories.other;
}

/**
 * Get uptime display string
 */
export function formatUptime(hours: number): string {
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}j ${remainingHours}h`;
}
