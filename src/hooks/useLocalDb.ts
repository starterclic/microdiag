/**
 * React Hooks for Local-First Database
 *
 * Ces hooks fournissent une interface React-friendly pour accéder
 * à la base SQLite locale avec gestion d'état automatique.
 */

import { useState, useEffect, useCallback } from 'react';
import * as localDb from '../services/localDb';
import type { LocalScript, LocalMetrics, ChatMessage, RemoteExecution } from '../services/localDb';

// Re-export types
export type { LocalScript, LocalMetrics, ChatMessage, RemoteExecution };

// ============================================
// ONLINE STATUS HOOK
// ============================================

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [checking, setChecking] = useState(true);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    const status = await localDb.checkOnlineStatus();
    setIsOnline(status);
    setChecking(false);
  }, []);

  useEffect(() => {
    checkStatus();
    // Check every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  return { isOnline, checking, refresh: checkStatus };
}

// ============================================
// SCRIPTS HOOK
// ============================================

export function useScripts(category?: string) {
  const [scripts, setScripts] = useState<LocalScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadScripts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = category
        ? await localDb.getScriptsByCategory(category)
        : await localDb.getScripts();
      setScripts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [category]);

  const syncFromCloud = useCallback(async () => {
    setLoading(true);
    try {
      await localDb.syncScripts();
      await loadScripts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de synchronisation');
    } finally {
      setLoading(false);
    }
  }, [loadScripts]);

  useEffect(() => {
    loadScripts();
  }, [loadScripts]);

  // Get unique categories
  const categories = [...new Set(scripts.map(s => s.category))];

  return {
    scripts,
    loading,
    error,
    refresh: loadScripts,
    sync: syncFromCloud,
    categories,
    count: scripts.length,
  };
}

// ============================================
// METRICS HISTORY HOOK
// ============================================

export function useMetricsHistory(limit: number = 100) {
  const [metrics, setMetrics] = useState<LocalMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    const data = await localDb.getRecentMetrics(limit);
    setMetrics(data);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    loadMetrics();
    // Refresh every 30 seconds
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
  }, [loadMetrics]);

  return { metrics, loading, refresh: loadMetrics };
}

// ============================================
// CHAT HISTORY HOOK
// ============================================

export function useChatHistory(limit: number = 50) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const data = await localDb.getChatHistory(limit);
    setMessages(data);
    setLoading(false);
  }, [limit]);

  const addMessage = useCallback(async (role: string, content: string) => {
    await localDb.addChatMessage(role, content);
    await loadHistory();
  }, [loadHistory]);

  const clearHistory = useCallback(async () => {
    await localDb.clearChatHistory();
    setMessages([]);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return {
    messages,
    loading,
    addMessage,
    clearHistory,
    refresh: loadHistory,
  };
}

// ============================================
// REMOTE EXECUTION HOOK
// ============================================

export function useRemoteExecutions(pollInterval: number = 10000) {
  const [executions, setExecutions] = useState<RemoteExecution[]>([]);
  const [loading, setLoading] = useState(true);

  const checkExecutions = useCallback(async () => {
    const data = await localDb.checkRemoteExecutions();
    setExecutions(data);
    setLoading(false);
  }, []);

  const updateExecution = useCallback(async (
    id: string,
    status: string,
    output?: string,
    error?: string
  ) => {
    await localDb.updateRemoteExecution(id, status, output, error);
    await checkExecutions();
  }, [checkExecutions]);

  useEffect(() => {
    checkExecutions();
    const interval = setInterval(checkExecutions, pollInterval);
    return () => clearInterval(interval);
  }, [checkExecutions, pollInterval]);

  return {
    executions,
    loading,
    pending: executions.filter(e => e.status === 'authorized'),
    updateExecution,
    refresh: checkExecutions,
  };
}

// ============================================
// SETTINGS HOOK
// ============================================

export function useSetting(key: string, defaultValue: string = '') {
  const [value, setValue] = useState<string>(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const stored = await localDb.getSetting(key);
      if (stored !== null) {
        setValue(stored);
      }
      setLoading(false);
    };
    load();
  }, [key]);

  const updateValue = useCallback(async (newValue: string) => {
    await localDb.setSetting(key, newValue);
    setValue(newValue);
  }, [key]);

  return { value, loading, setValue: updateValue };
}

// ============================================
// INITIALIZATION HOOK
// ============================================

export function useLocalDbInit() {
  const [initialized, setInitialized] = useState(false);
  const [scriptsCount, setScriptsCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const init = async () => {
      const result = await localDb.initializeLocalDb();
      setScriptsCount(result.scriptsCount);
      setIsOnline(result.isOnline);
      setInitialized(true);
    };
    init();
  }, []);

  return { initialized, scriptsCount, isOnline };
}
