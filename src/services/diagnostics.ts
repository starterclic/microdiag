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
// v3.2.0 - BENCHMARK & BSOD TYPES
// ============================================

export interface DiskBenchmark {
  drive: string;
  seq_read_mbps: number;
  seq_write_mbps: number;
  rand_read_iops: number;
  rand_write_iops: number;
  rand_read_mbps: number;
  rand_write_mbps: number;
  latency_us: number;
  score: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F' | 'N/A' | 'Error';
}

export interface BsodAnalysis {
  total_crashes: number;
  crashes: BsodCrash[];
  most_common_cause: string;
  recommendation: string;
}

export interface BsodCrash {
  date: string;
  time: string;
  bug_check_code: string;
  bug_check_name: string;
  description: string;
  probable_cause: string;
  driver: string | null;
  solution: string;
}

// ============================================
// v3.3.0 - SPEEDTEST & BOOT TIME TYPES
// ============================================

export interface SpeedtestResult {
  download_mbps: number;
  upload_mbps: number;
  ping_ms: number;
  jitter_ms: number;
  server: string;
  isp: string;
  grade: string;
  status: string;
}

export interface BootAnalysis {
  total_boot_time_seconds: number;
  bios_time_seconds: number;
  windows_boot_seconds: number;
  desktop_ready_seconds: number;
  apps_impact: AppBootImpact[];
  grade: string;
  optimization_potential_seconds: number;
  recommendations: string[];
  last_boot_time: string;
}

export interface AppBootImpact {
  name: string;
  impact_seconds: number;
  impact_level: 'high' | 'medium' | 'low';
  can_disable: boolean;
  recommendation: string;
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

/**
 * Run disk benchmark (CrystalDiskMark style)
 * @param drive Drive letter (e.g., "C:")
 */
export async function runDiskBenchmark(drive: string = 'C:'): Promise<DiskBenchmark> {
  return invoke<DiskBenchmark>('run_disk_benchmark', { drive });
}

/**
 * Analyze BSOD (Blue Screen) history
 * Returns crash history and recommendations
 */
export async function analyzeBsod(): Promise<BsodAnalysis> {
  return invoke<BsodAnalysis>('analyze_bsod');
}

/**
 * Run internet speedtest
 * Tests download, upload speed and latency
 */
export async function runSpeedtest(): Promise<SpeedtestResult> {
  return invoke<SpeedtestResult>('run_speedtest');
}

/**
 * Analyze boot time and startup impact
 * Returns boot time breakdown and optimization recommendations
 */
export async function analyzeBootTime(): Promise<BootAnalysis> {
  return invoke<BootAnalysis>('analyze_boot_time');
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

// ============================================
// v3.2.0 - BENCHMARK & BSOD HELPERS
// ============================================

/**
 * Get grade color for benchmark
 */
export function getBenchmarkGradeColor(grade: string): string {
  switch (grade) {
    case 'S':
      return 'linear-gradient(135deg, #ffd700, #ff6b00)';
    case 'A':
      return '#10b981';
    case 'B':
      return '#3b82f6';
    case 'C':
      return '#f59e0b';
    case 'D':
      return '#ef4444';
    case 'F':
      return '#6b7280';
    default:
      return '#9e9e9e';
  }
}

/**
 * Format benchmark speed
 */
export function formatBenchmarkSpeed(mbps: number): string {
  if (mbps >= 1000) {
    return `${(mbps / 1000).toFixed(2)} GB/s`;
  }
  return `${mbps.toFixed(0)} MB/s`;
}

/**
 * Format IOPS
 */
export function formatIOPS(iops: number): string {
  if (iops >= 1000000) {
    return `${(iops / 1000000).toFixed(2)}M`;
  }
  if (iops >= 1000) {
    return `${(iops / 1000).toFixed(1)}K`;
  }
  return iops.toString();
}

/**
 * Get BSOD severity color
 */
export function getBsodSeverityColor(crashCount: number): string {
  if (crashCount === 0) return '#10b981';
  if (crashCount < 3) return '#f59e0b';
  return '#ef4444';
}

/**
 * Get benchmark status description
 */
export function getBenchmarkStatus(score: number): string {
  if (score >= 90) return 'Performances exceptionnelles (NVMe haut de gamme)';
  if (score >= 80) return 'Excellentes performances (SSD NVMe)';
  if (score >= 60) return 'Bonnes performances (SSD SATA)';
  if (score >= 40) return 'Performances correctes';
  if (score >= 20) return 'Performances limitees (HDD ou SSD ancien)';
  return 'Performances faibles - Envisagez un upgrade';
}

// ============================================
// v3.3.0 - SPEEDTEST & BOOT TIME HELPERS
// ============================================

/**
 * Format speed for display
 */
export function formatSpeed(mbps: number): string {
  if (mbps >= 1000) {
    return `${(mbps / 1000).toFixed(2)} Gbps`;
  }
  return `${mbps.toFixed(1)} Mbps`;
}

/**
 * Get speedtest grade color
 */
export function getSpeedtestGradeColor(grade: string): string {
  switch (grade) {
    case 'Excellent':
      return '#10b981';
    case 'Tres bon':
      return '#22c55e';
    case 'Bon':
      return '#3b82f6';
    case 'Correct':
      return '#f59e0b';
    case 'Lent':
      return '#ef4444';
    default:
      return '#6b7280';
  }
}

/**
 * Format boot time for display
 */
export function formatBootTime(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }
  return `${seconds}s`;
}

/**
 * Get boot time grade color
 */
export function getBootGradeColor(grade: string): string {
  switch (grade) {
    case 'Excellent':
      return '#10b981';
    case 'Tres bon':
      return '#22c55e';
    case 'Bon':
      return '#3b82f6';
    case 'Correct':
      return '#f59e0b';
    case 'Lent':
      return '#ef4444';
    default:
      return '#6b7280';
  }
}

/**
 * Get impact level color
 */
export function getImpactLevelColor(level: string): string {
  switch (level) {
    case 'high':
      return '#ef4444';
    case 'medium':
      return '#f59e0b';
    case 'low':
      return '#10b981';
    default:
      return '#6b7280';
  }
}

/**
 * Get speedtest status icon
 */
export function getSpeedtestIcon(grade: string): string {
  switch (grade) {
    case 'Excellent':
    case 'Tres bon':
      return '🚀';
    case 'Bon':
      return '✅';
    case 'Correct':
      return '⚠️';
    default:
      return '🐢';
  }
}
