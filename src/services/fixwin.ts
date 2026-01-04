// ============================================
// MICRODIAG SENTINEL - FixWin Service
// TypeScript bindings for system repair tools
// ============================================

import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

// Types matching Rust structs
export interface FixResult {
  success: boolean;
  message: string;
  output: string[];
  requires_reboot: boolean;
}

export interface FixCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  fixes: FixItem[];
}

export interface FixItem {
  id: string;
  name: string;
  description: string;
  risk_level: 'low' | 'medium' | 'high';
  requires_reboot: boolean;
  requires_admin: boolean;
  estimated_time: string;
}

export interface StreamOutput {
  fix_id: string;
  line: string;
  line_type: 'info' | 'progress' | 'success' | 'error' | 'warning';
  progress: number | null;
}

export interface FixComplete {
  fix_id: string;
  success: boolean;
  message: string;
  requires_reboot: boolean;
}

// Risk level colors and labels
export const RISK_LEVELS = {
  low: {
    label: 'Faible risque',
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
    description: 'Operation sure, aucun effet secondaire'
  },
  medium: {
    label: 'Risque modere',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    description: 'Peut necessiter un redemarrage'
  },
  high: {
    label: 'Risque eleve',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    description: 'Modification systeme importante'
  }
};

// Category icons mapping
export const CATEGORY_ICONS: Record<string, string> = {
  network: 'wifi',
  system: 'settings',
  explorer: 'folder',
  windows_update: 'download',
  cleanup: 'trash',
  services: 'zap'
};

// ============================================
// API CALLS
// ============================================

/**
 * Get all fix categories with their items
 */
export async function getFixCategories(): Promise<FixCategory[]> {
  try {
    return await invoke<FixCategory[]>('fw_get_categories');
  } catch (error) {
    console.error('Failed to get fix categories:', error);
    return [];
  }
}

/**
 * Execute a fix by ID (streaming output via events)
 */
export async function executeFix(fixId: string): Promise<FixResult> {
  try {
    return await invoke<FixResult>('fw_execute_fix', { fixId });
  } catch (error) {
    console.error('Failed to execute fix:', error);
    return {
      success: false,
      message: `Erreur: ${error}`,
      output: [],
      requires_reboot: false
    };
  }
}

/**
 * Create a system restore point
 */
export async function createRestorePoint(): Promise<FixResult> {
  try {
    return await invoke<FixResult>('fw_create_restore_point');
  } catch (error) {
    console.error('Failed to create restore point:', error);
    return {
      success: false,
      message: `Erreur: ${error}`,
      output: [],
      requires_reboot: false
    };
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

/**
 * Listen to streaming output from fix execution
 */
export async function onFixOutput(
  callback: (output: StreamOutput) => void
): Promise<UnlistenFn> {
  return await listen<StreamOutput>('fixwin-output', (event) => {
    callback(event.payload);
  });
}

/**
 * Listen to fix completion events
 */
export async function onFixComplete(
  callback: (result: FixComplete) => void
): Promise<UnlistenFn> {
  return await listen<FixComplete>('fixwin-complete', (event) => {
    callback(event.payload);
  });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get human-readable category name in French
 */
export function getCategoryDisplayName(categoryId: string): string {
  const names: Record<string, string> = {
    network: 'Reseau',
    system: 'Systeme',
    explorer: 'Explorateur',
    windows_update: 'Windows Update',
    cleanup: 'Nettoyage',
    services: 'Services'
  };
  return names[categoryId] || categoryId;
}

/**
 * Format terminal line with color
 */
export function getLineColor(lineType: string): string {
  switch (lineType) {
    case 'success': return '#22c55e';
    case 'error': return '#ef4444';
    case 'warning': return '#f59e0b';
    case 'progress': return '#3b82f6';
    default: return '#a1a1aa';
  }
}

/**
 * Format terminal line prefix
 */
export function getLinePrefix(lineType: string): string {
  switch (lineType) {
    case 'success': return '[OK]';
    case 'error': return '[ERREUR]';
    case 'warning': return '[ATTENTION]';
    case 'progress': return '[...]';
    default: return '>';
  }
}
