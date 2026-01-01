// ============================================
// MICRODIAG SENTINEL - Types
// ============================================

export interface SystemMetrics {
  cpu_usage: number;
  memory_total: number;
  memory_used: number;
  memory_percent: number;
  disks: DiskInfo[];
  hostname: string;
  os_version: string;
  os_type?: string;
}

export interface DiskInfo {
  name: string;
  mount_point: string;
  total_gb: number;
  used_gb: number;
  free_gb: number;
  percent: number;
}

export interface HealthScore {
  score: number;
  status: string;
  issues: string[];
}

export interface SecurityStatus {
  antivirus_enabled: boolean;
  realtime_protection: boolean;
  firewall_enabled: boolean;
  issues: string[];
}

export interface Script {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  language: string;
  code: string;
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  action?: string;
}

export interface UpdateInfo {
  version: string;
  notes: string;
  mandatory: boolean;
}

export interface ScanSection {
  title: string;
  icon: string;
  status: 'ok' | 'warning' | 'critical' | 'info';
  explanation: string;
  action: string;
  items: {
    summary: string;
    details?: unknown[];
    [key: string]: unknown;
  };
}

export interface ScanReport {
  timestamp: string;
  hostname: string;
  username: string;
  osVersion: string;
  score: number;
  status: 'ok' | 'warning' | 'critical';
  message: string;
  advice: string;
  summary: {
    critical: number;
    warning: number;
    info: number;
    ok: number;
    total: number;
  };
  sections: ScanSection[];
}

export type Page = 'dashboard' | 'tools' | 'chat' | 'settings' | 'scan' | 'godmode' | 'diagnostic';

export interface RemoteExecution {
  id: string;
  script_id: string;
  device_id: string;
  requested_by: string;
  status: 'pending' | 'authorized' | 'running' | 'completed' | 'failed' | 'rejected' | 'expired';
  authorization_token: string;
  authorization_expires_at: string;
  created_at: string;
  script_library?: {
    id: string;
    slug: string;
    name: string;
    description: string;
    category: string;
    risk_level: string;
    code: string;
    requires_admin: boolean;
    icon: string;
  };
}
