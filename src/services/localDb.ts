/**
 * Local-First Database Service
 *
 * Ce service encapsule l'accès à la base SQLite locale via Tauri IPC.
 * Il fournit une API simple pour les composants React tout en gérant
 * la synchronisation avec Supabase en arrière-plan.
 *
 * Architecture:
 * [React Component] → [localDb Service] → [Tauri IPC] → [SQLite]
 *                                                            ↓ (async)
 *                                                       [Supabase Cloud]
 */

import { invoke } from '@tauri-apps/api/tauri';

// ============================================
// TYPES
// ============================================

export interface LocalScript {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  language: string;
  code: string;
  icon: string | null;
  is_active: boolean;
  requires_admin: boolean;
  estimated_time: string | null;
  success_message: string | null;
}

export interface LocalMetrics {
  id?: number;
  timestamp: string;
  cpu_usage: number;
  memory_percent: number;
  disk_percent: number;
  health_score: number;
  health_status: string;
  synced: boolean;
}

export interface ChatMessage {
  id?: number;
  role: string;
  content: string;
  timestamp?: string;
}

export interface RemoteExecution {
  id: string;
  script_id: string;
  script_name: string | null;
  script_code: string | null;
  script_language: string | null;
  requested_by: string | null;
  status: string;
}

// ============================================
// SCRIPTS API
// ============================================

/**
 * Récupère tous les scripts depuis SQLite local (instantané)
 */
export async function getScripts(): Promise<LocalScript[]> {
  try {
    return await invoke<LocalScript[]>('db_get_scripts');
  } catch (error) {
    console.error('[LocalDB] Error getting scripts:', error);
    return [];
  }
}

/**
 * Récupère les scripts par catégorie
 */
export async function getScriptsByCategory(category: string): Promise<LocalScript[]> {
  try {
    return await invoke<LocalScript[]>('db_get_scripts_by_category', { category });
  } catch (error) {
    console.error('[LocalDB] Error getting scripts by category:', error);
    return [];
  }
}

/**
 * Compte le nombre de scripts actifs
 */
export async function getScriptsCount(): Promise<number> {
  try {
    return await invoke<number>('db_get_scripts_count');
  } catch (error) {
    console.error('[LocalDB] Error counting scripts:', error);
    return 0;
  }
}

/**
 * Force la synchronisation des scripts depuis Supabase
 */
export async function syncScripts(): Promise<number> {
  try {
    return await invoke<number>('db_sync_scripts');
  } catch (error) {
    console.error('[LocalDB] Error syncing scripts:', error);
    return 0;
  }
}

// ============================================
// METRICS API
// ============================================

/**
 * Sauvegarde les métriques localement
 */
export async function saveMetrics(metrics: Omit<LocalMetrics, 'id' | 'synced'>): Promise<number> {
  try {
    return await invoke<number>('db_save_metrics', { metrics });
  } catch (error) {
    console.error('[LocalDB] Error saving metrics:', error);
    return -1;
  }
}

/**
 * Récupère les métriques récentes
 */
export async function getRecentMetrics(limit: number = 100): Promise<LocalMetrics[]> {
  try {
    return await invoke<LocalMetrics[]>('db_get_recent_metrics', { limit });
  } catch (error) {
    console.error('[LocalDB] Error getting recent metrics:', error);
    return [];
  }
}

// ============================================
// CHAT API
// ============================================

/**
 * Récupère l'historique de chat local
 */
export async function getChatHistory(limit: number = 50): Promise<ChatMessage[]> {
  try {
    return await invoke<ChatMessage[]>('db_get_chat_history', { limit });
  } catch (error) {
    console.error('[LocalDB] Error getting chat history:', error);
    return [];
  }
}

/**
 * Ajoute un message au chat local
 */
export async function addChatMessage(role: string, content: string): Promise<number> {
  try {
    return await invoke<number>('db_add_chat_message', { role, content });
  } catch (error) {
    console.error('[LocalDB] Error adding chat message:', error);
    return -1;
  }
}

/**
 * Efface l'historique de chat
 */
export async function clearChatHistory(): Promise<void> {
  try {
    await invoke('db_clear_chat');
  } catch (error) {
    console.error('[LocalDB] Error clearing chat:', error);
  }
}

// ============================================
// SETTINGS API
// ============================================

/**
 * Récupère un paramètre local
 */
export async function getSetting(key: string): Promise<string | null> {
  try {
    return await invoke<string | null>('db_get_setting', { key });
  } catch (error) {
    console.error('[LocalDB] Error getting setting:', error);
    return null;
  }
}

/**
 * Définit un paramètre local
 */
export async function setSetting(key: string, value: string): Promise<void> {
  try {
    await invoke('db_set_setting', { key, value });
  } catch (error) {
    console.error('[LocalDB] Error setting:', error);
  }
}

// ============================================
// ONLINE STATUS
// ============================================

/**
 * Vérifie si le client est en ligne (peut atteindre Supabase)
 */
export async function checkOnlineStatus(): Promise<boolean> {
  try {
    return await invoke<boolean>('db_check_online');
  } catch (error) {
    console.error('[LocalDB] Error checking online status:', error);
    return false;
  }
}

// ============================================
// REMOTE EXECUTION API
// ============================================

/**
 * Vérifie les exécutions à distance en attente (optimisé avec cache device_id)
 */
export async function checkRemoteExecutions(): Promise<RemoteExecution[]> {
  try {
    return await invoke<RemoteExecution[]>('db_check_remote_executions');
  } catch (error) {
    console.error('[LocalDB] Error checking remote executions:', error);
    return [];
  }
}

/**
 * Met à jour le statut d'une exécution à distance
 */
export async function updateRemoteExecution(
  id: string,
  status: string,
  output?: string,
  error?: string
): Promise<void> {
  try {
    await invoke('db_update_remote_execution', { id, status, output, error });
  } catch (error) {
    console.error('[LocalDB] Error updating remote execution:', error);
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Hook-friendly wrapper pour charger les scripts avec fallback Supabase
 */
export async function loadScriptsWithSync(): Promise<LocalScript[]> {
  // First try local
  let scripts = await getScripts();

  // If empty, try to sync from Supabase
  if (scripts.length === 0) {
    const isOnline = await checkOnlineStatus();
    if (isOnline) {
      await syncScripts();
      scripts = await getScripts();
    }
  }

  return scripts;
}

/**
 * Initialise le service (appelé au démarrage de l'app)
 */
export async function initializeLocalDb(): Promise<{
  scriptsCount: number;
  isOnline: boolean;
}> {
  const [scriptsCount, isOnline] = await Promise.all([
    getScriptsCount(),
    checkOnlineStatus(),
  ]);

  console.log(`[LocalDB] Initialized: ${scriptsCount} scripts, online: ${isOnline}`);

  return { scriptsCount, isOnline };
}
