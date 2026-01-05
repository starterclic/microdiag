// ============================================
// MICRODIAG SENTINEL - Main App
// Version 2.4.0 - Local-First Architecture
// ============================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Toaster, toast } from 'sonner';
import './styles/index.css';
import './styles/diagnostic.css';
import './styles/script-execution.css';
import './styles/fixwin.css';

// Types & Constants
import { SystemMetrics, HealthScore, SecurityStatus, Script, ChatMessage, UpdateInfo, Page, ScanReport, RemoteExecution } from './types';
import { SUPABASE_URL, SUPABASE_ANON_KEY, APP_VERSION, LOADER_MESSAGES, SECURITY_TIPS, STARTUP_STEPS, OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_API_URL } from './constants';

// Local-First Hooks
import { useScripts, useOnlineStatus, useRemoteExecutions } from './hooks/useLocalDb';
import * as localDb from './services/localDb';
import * as godmode from './services/godmode';

// Components
import { Sidebar, UpdateModal, RemoteExecutionModal, OnboardingTutorial, CommandPalette } from './components';
import { ScriptExecutionModal, ExecutionPhase, ExecutionStep, parseScriptSteps, updateStepsFromOutput } from './components/ScriptExecutionModal';

// Pages
import { DashboardPage, ToolsPage, ScanPage, ChatPage, SettingsPage, GodModePage, DiagnosticPage, FixWinPage } from './pages';

function App() {
  // Core state
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [health, setHealth] = useState<HealthScore | null>(null);
  const [security, setSecurity] = useState<SecurityStatus | null>(null);
  const [deviceToken, setDeviceToken] = useState<string>('');
  const [deepHealth, setDeepHealth] = useState<godmode.DeepHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingTip, setLoadingTip] = useState(SECURITY_TIPS[Math.floor(Math.random() * SECURITY_TIPS.length)]);

  // Local-First: Scripts from SQLite (instant)
  const { scripts: localScripts, loading: scriptsLoading, sync: syncScripts, categories } = useScripts();
  const scripts = localScripts as unknown as Script[]; // Type compatibility
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Local-First: Online status
  const { isOnline } = useOnlineStatus();
  const [actionRunning, setActionRunning] = useState<string | null>(null);
  const [loaderMessage, setLoaderMessage] = useState<string>('');
  const [loaderProgress, setLoaderProgress] = useState<number>(0);
  const [runningScript, setRunningScript] = useState<Script | null>(null);

  // Script Execution Modal state
  const [execPhase, setExecPhase] = useState<ExecutionPhase>('confirm');
  const [execSteps, setExecSteps] = useState<ExecutionStep[]>([]);
  const [execTerminalOutput, setExecTerminalOutput] = useState<string[]>([]);
  const [execError, setExecError] = useState<string>('');
  const [pendingScript, setPendingScript] = useState<Script | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: 1, role: 'assistant', content: "Bonjour ! Je suis votre assistant Microdiag.", timestamp: new Date() },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Modals state
  const [showUrgency, setShowUrgency] = useState(false);
  const [urgencyType, setUrgencyType] = useState('crash');
  const [urgencyDesc, setUrgencyDesc] = useState('');
  const [urgencyName, setUrgencyName] = useState('');
  const [urgencyEmail, setUrgencyEmail] = useState('');
  const [urgencyPhone, setUrgencyPhone] = useState('');
  const [urgencySending, setUrgencySending] = useState(false);
  const [urgencySuccess, setUrgencySuccess] = useState(false);

  // Update state
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateDownloading, setUpdateDownloading] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);

  // Scan state
  const [scanRunning, setScanRunning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanReport, setScanReport] = useState<ScanReport | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Remote execution state
  const [pendingExecution, setPendingExecution] = useState<RemoteExecution | null>(null);
  const [executionLoading, setExecutionLoading] = useState(false);

  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('microdiag_onboarding_complete');
  });

  // Onboarding handlers
  const handleOnboardingComplete = useCallback(() => {
    localStorage.setItem('microdiag_onboarding_complete', 'true');
    setShowOnboarding(false);
  }, []);

  const handleOnboardingSkip = useCallback(() => {
    localStorage.setItem('microdiag_onboarding_complete', 'true');
    setShowOnboarding(false);
  }, []);

  // Memoized page setter to prevent child re-renders
  const handleSetCurrentPage = useCallback((page: Page) => setCurrentPage(page), []);
  const handleGoToTools = useCallback(() => setCurrentPage('tools'), []);
  const handleShowUrgency = useCallback(() => setShowUrgency(true), []);

  // ==========================================
  // DATA FETCHING
  // ==========================================
  const fetchData = useCallback(async () => {
    try {
      setLoadingStep(1);
      console.log('[Microdiag] fetchData starting...');

      // ALL FAST now - security uses Registry API instead of PowerShell
      setLoadingStep(2);
      const [metricsResult, healthResult, securityResult, tokenResult, deepHealthResult] = await Promise.allSettled([
        invoke<SystemMetrics>('get_system_metrics'),
        invoke<HealthScore>('get_health_score'),
        invoke<SecurityStatus>('get_security_status'),
        invoke<string>('get_device_token'),
        godmode.getDeepHealth(),
      ]);

      console.log('[Microdiag] Results:', {
        metrics: metricsResult,
        health: healthResult,
        security: securityResult,
        token: tokenResult,
        deepHealth: deepHealthResult
      });

      setLoadingStep(3);

      // Apply results with fallbacks
      if (metricsResult.status === 'fulfilled') {
        setMetrics(metricsResult.value);
      } else {
        console.error('Metrics error:', metricsResult.reason);
        setMetrics({ cpu_usage: 0, memory_total: 0, memory_used: 0, memory_percent: 0, disks: [], hostname: 'Inconnu', os_version: '' });
      }

      if (healthResult.status === 'fulfilled') {
        setHealth(healthResult.value);
      } else {
        console.error('Health error:', healthResult.reason);
        setHealth({ score: 0, status: 'unknown', issues: ['Erreur de chargement'] });
      }

      if (securityResult.status === 'fulfilled') {
        setSecurity(securityResult.value);
      } else {
        console.error('Security error:', securityResult.reason);
        setSecurity({ antivirus_enabled: true, realtime_protection: true, firewall_enabled: true, last_scan_days: 0, definitions_age_days: 0, issues: [] });
      }

      if (tokenResult.status === 'fulfilled') {
        setDeviceToken(tokenResult.value);
      }

      if (deepHealthResult.status === 'fulfilled') {
        setDeepHealth(deepHealthResult.value);
      } else {
        console.error('DeepHealth error:', deepHealthResult.reason);
      }

      setLoadingStep(4);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // fetchScripts removed - now using useScripts() hook for Local-First architecture

  // ==========================================
  // SCRIPT EXECUTION (New Pro UX Flow)
  // ==========================================

  // Step 1: Show confirmation modal
  const runScript = async (script: Script) => {
    // Initialize execution modal state
    setPendingScript(script);
    setExecPhase('confirm');
    setExecSteps(parseScriptSteps(script.slug));
    setExecTerminalOutput([]);
    setExecError('');
    setLoaderProgress(0);
    setRunningScript(script);
  };

  // Step 2: User confirms - execute the script
  const handleExecConfirm = async () => {
    if (!pendingScript) return;

    const script = pendingScript;
    setExecPhase('running');
    setActionRunning(script.slug);
    setActionResult(null);

    // Initialize steps as pending
    const steps = parseScriptSteps(script.slug);
    setExecSteps(steps);
    setExecTerminalOutput([`> Execution de ${script.name}...`, '']);

    // Simulate step progression during execution
    let currentStep = 0;
    const stepInterval = setInterval(() => {
      if (currentStep < steps.length) {
        setExecSteps(prev => prev.map((s, i) => ({
          ...s,
          status: i < currentStep ? 'done' : i === currentStep ? 'running' : 'pending'
        })));
        setLoaderProgress(Math.min(((currentStep + 1) / steps.length) * 90, 90));
        currentStep++;
      }
    }, 1500);

    try {
      const output = await invoke<string>('run_script', {
        scriptId: script.slug,
        code: script.code,
        language: script.language
      });

      clearInterval(stepInterval);

      // Parse output and display in terminal
      const lines = output.trim().split('\n').filter(l => l.trim());
      const terminalLines = lines.map(line => {
        // Format output lines nicely
        if (line.toLowerCase().includes('succes') || line.toLowerCase().includes('ok') || line.toLowerCase().includes('termine')) {
          return `[OK] ${line.replace(/\[[\w]+\]/g, '').trim()}`;
        }
        if (line.toLowerCase().includes('erreur') || line.toLowerCase().includes('error')) {
          return `[ERREUR] ${line.replace(/\[[\w]+\]/g, '').trim()}`;
        }
        return `> ${line.replace(/\[[\w]+\]/g, '').trim()}`;
      });

      setExecTerminalOutput(prev => [...prev, ...terminalLines, '', '[OK] Operation terminee avec succes !']);

      // Mark all steps as done
      setExecSteps(prev => prev.map(s => ({ ...s, status: 'done' as const })));
      setLoaderProgress(100);
      setExecPhase('completed');

      await invoke('send_notification', { title: 'Microdiag Sentinel', body: `${script.name} termine` });
      fetchData();

    } catch (error) {
      clearInterval(stepInterval);

      const errorMsg = String(error);
      setExecTerminalOutput(prev => [...prev, '', `[ERREUR] ${errorMsg}`]);
      setExecSteps(prev => prev.map((s, i) => ({
        ...s,
        status: s.status === 'running' ? 'error' : s.status === 'done' ? 'done' : 'pending'
      })));
      setExecError(errorMsg);
      setExecPhase('error');

    } finally {
      setActionRunning(null);
    }
  };

  // Cancel execution (from confirm phase)
  const handleExecCancel = () => {
    setPendingScript(null);
    setRunningScript(null);
    setExecPhase('confirm');
  };

  // Close modal (from completed/error phase)
  const handleExecClose = () => {
    setPendingScript(null);
    setRunningScript(null);
    setExecPhase('confirm');
    if (execPhase === 'completed') {
      toast.success(`${pendingScript?.name || 'Operation'} termine !`);
    }
  };

  // Request support
  const handleExecRequestSupport = () => {
    handleExecClose();
    setShowUrgency(true);
    setUrgencyType('technique');
  };

  const runQuickAction = async (slug: string, name: string) => {
    const script = scripts.find(s => s.slug === slug);
    if (script) {
      await runScript(script);
    } else {
      setActionRunning(slug);
      try {
        const output = await invoke<string>('run_script', { scriptId: slug, code: '', language: 'powershell' });
        const lines = output.trim().split('\n').filter(l => l.trim());
        const lastLine = lines.length > 0 ? lines[lines.length - 1] : `${name} terminé !`;
        toast.success(lastLine.length > 60 ? `${name} terminé !` : lastLine);
        fetchData();
      } catch (error) {
        toast.error(`Erreur: ${error}`);
      } finally {
        setActionRunning(null);
      }
    }
  };

  // ==========================================
  // REMOTE EXECUTION
  // ==========================================
  const checkRemoteExecutions = useCallback(async () => {
    if (!deviceToken || pendingExecution) return;

    try {
      // Get device ID first
      const deviceResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/devices?device_token=eq.${deviceToken}&select=id`,
        { headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY } }
      );
      const devices = await deviceResponse.json();
      if (!devices || devices.length === 0) return;

      const deviceId = devices[0].id;

      // Check for pending executions
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/remote_executions?device_id=eq.${deviceId}&status=eq.pending&select=*,script_library(*)&order=created_at.desc&limit=1`,
        { headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY } }
      );
      const executions = await response.json();

      if (executions && executions.length > 0) {
        const exec = executions[0];
        // Check if not expired
        const expiresAt = new Date(exec.authorization_expires_at);
        if (expiresAt > new Date()) {
          setPendingExecution(exec);
          // Show notification
          await invoke('send_notification', {
            title: 'Demande d\'exécution à distance',
            body: `${exec.script_library?.name || 'Script'} - Cliquez pour autoriser ou refuser`
          });
        }
      }
    } catch (error) {
      console.error('Error checking remote executions:', error);
    }
  }, [deviceToken, pendingExecution]);

  const handleAcceptExecution = async () => {
    if (!pendingExecution) return;
    setExecutionLoading(true);

    try {
      // Update status to authorized
      await fetch(
        `${SUPABASE_URL}/rest/v1/remote_executions?id=eq.${pendingExecution.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ status: 'running', started_at: new Date().toISOString() }),
        }
      );

      // Execute the script
      const script = pendingExecution.script_library;
      if (script) {
        try {
          const output = await invoke<string>('run_script', {
            scriptId: script.slug,
            code: script.code,
            language: 'powershell',
          });

          // Update status to completed
          await fetch(
            `${SUPABASE_URL}/rest/v1/remote_executions?id=eq.${pendingExecution.id}`,
            {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                apikey: SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({
                status: 'completed',
                completed_at: new Date().toISOString(),
                output: output.substring(0, 10000), // Limit output size
              }),
            }
          );

          await invoke('send_notification', {
            title: 'Script exécuté',
            body: `${script.name} terminé avec succès`,
          });
        } catch (error) {
          // Update status to failed
          await fetch(
            `${SUPABASE_URL}/rest/v1/remote_executions?id=eq.${pendingExecution.id}`,
            {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                apikey: SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({
                status: 'failed',
                completed_at: new Date().toISOString(),
                error: String(error),
              }),
            }
          );
        }
      }

      setPendingExecution(null);
      fetchData();
    } catch (error) {
      console.error('Error accepting execution:', error);
    } finally {
      setExecutionLoading(false);
    }
  };

  const handleRejectExecution = async () => {
    if (!pendingExecution) return;
    setExecutionLoading(true);

    try {
      await fetch(
        `${SUPABASE_URL}/rest/v1/remote_executions?id=eq.${pendingExecution.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ status: 'rejected' }),
        }
      );
      setPendingExecution(null);
    } catch (error) {
      console.error('Error rejecting execution:', error);
    } finally {
      setExecutionLoading(false);
    }
  };

  // ==========================================
  // CHAT - OpenRouter AI
  // ==========================================
  const buildChatContext = useCallback(() => {
    const parts: string[] = [];
    if (metrics) {
      parts.push(`PC: ${metrics.hostname}`);
      parts.push(`OS: ${metrics.os_version || 'Windows'}`);
      parts.push(`CPU: ${metrics.cpu_usage?.toFixed(0) || 0}%`);
      parts.push(`RAM: ${metrics.memory_percent?.toFixed(0) || 0}%`);
      if (metrics.disks && metrics.disks.length > 0) {
        const disk = metrics.disks[0];
        parts.push(`Disque: ${disk.percent?.toFixed(0)}% utilise, ${disk.free_gb?.toFixed(0)}GB libre`);
      }
    }
    if (health) {
      parts.push(`Score sante: ${health.score}/100`);
    }
    if (security) {
      parts.push(`Antivirus: ${security.antivirus_enabled ? 'Actif' : 'Inactif'}`);
      parts.push(`Pare-feu: ${security.firewall_enabled ? 'Actif' : 'Inactif'}`);
    }
    return parts.join('. ');
  }, [metrics, health, security]);

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMessage: ChatMessage = { id: Date.now(), role: 'user', content: chatInput, timestamp: new Date() };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);

    const systemPrompt = `Tu es l'assistant Microdiag Sentinel, un expert informatique bienveillant et accessible.
Tu aides les utilisateurs avec leurs problemes informatiques de maniere simple et rassurante.

CONTEXTE SYSTEME ACTUEL:
${buildChatContext()}

STYLE:
- Chaleureux et rassurant, comme un ami qui s'y connait en informatique
- Vulgarise: pas de jargon technique complexe, explique simplement
- Positif: meme si des problemes, rassure et propose des solutions pratiques
- Concis: reponses courtes et utiles, pas de paragraphes interminables
- Si tu detectes un probleme critique, suggere d'utiliser le bouton SOS pour contacter un expert

CAPACITES:
- Tu connais l'etat actuel du PC de l'utilisateur (voir contexte ci-dessus)
- Tu peux suggerer des outils de maintenance (nettoyage, reseau, imprimante, securite)
- Tu peux expliquer simplement les concepts informatiques
- Tu peux rassurer sur les problemes courants et guider vers des solutions`;

    try {
      // Build conversation history (last 10 messages for context)
      const recentMessages = chatMessages.slice(-10).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));

      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://microdiag.cybtek.fr',
          'X-Title': 'Microdiag Sentinel Chat'
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            ...recentMessages,
            { role: 'user', content: userMessage.content }
          ],
          temperature: 0.7,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const assistantContent = data.choices?.[0]?.message?.content || "Desole, je n'ai pas pu generer de reponse.";

      // Check if response suggests an action
      let action: string | undefined;
      if (assistantContent.toLowerCase().includes('nettoyage') || assistantContent.toLowerCase().includes('nettoyer')) {
        action = 'cleanup';
      } else if (assistantContent.toLowerCase().includes('reseau') && assistantContent.toLowerCase().includes('reinitialiser')) {
        action = 'fix-network';
      }

      setChatMessages((prev) => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
        action
      }]);
    } catch (error) {
      console.error('[Chat] Error:', error);
      setChatMessages((prev) => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: "Desole, je rencontre un probleme de connexion. Reessayez dans quelques instants ou utilisez le bouton SOS si c'est urgent.",
        timestamp: new Date(),
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  // ==========================================
  // URGENCY / SUPPORT REQUEST
  // ==========================================
  const sendUrgencyRequest = async () => {
    if (!urgencyDesc.trim()) return;
    setUrgencySending(true);

    try {
      // Get device info to include with the request
      const hostname = metrics?.hostname || 'Unknown';
      const osInfo = metrics?.os_type ? `${metrics.os_type} ${metrics.os_version || ''}` : 'Unknown';

      // Build the description with contact info and device info
      let fullDescription = urgencyDesc;
      if (urgencyName || urgencyEmail || urgencyPhone) {
        fullDescription += `\n\n--- Coordonnees ---`;
        if (urgencyName) fullDescription += `\nNom: ${urgencyName}`;
        if (urgencyEmail) fullDescription += `\nEmail: ${urgencyEmail}`;
        if (urgencyPhone) fullDescription += `\nTel: ${urgencyPhone}`;
      }
      fullDescription += `\n\n--- Appareil ---\nPC: ${hostname}\nOS: ${osInfo}`;

      // Find device ID from token
      let deviceId = null;
      try {
        const deviceRes = await fetch(`${SUPABASE_URL}/rest/v1/devices?device_token=eq.${deviceToken}&select=id`, {
          headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY },
        });
        const devices = await deviceRes.json();
        if (devices && devices.length > 0) {
          deviceId = devices[0].id;
        }
      } catch {
        // Device lookup failed, continue without device_id
      }

      // Create the support request
      const requestBody: Record<string, unknown> = {
        type: urgencyType,
        description: fullDescription,
        status: 'pending',
        priority: urgencyType === 'virus' || urgencyType === 'crash' ? 'urgent' : 'high',
      };

      // Add device_id if found
      if (deviceId) {
        requestBody.device_id = deviceId;
      }

      // Add contact info as metadata for the admin to see
      if (urgencyEmail) {
        requestBody.contact_email = urgencyEmail;
      }
      if (urgencyPhone) {
        requestBody.contact_phone = urgencyPhone;
      }
      if (urgencyName) {
        requestBody.contact_name = urgencyName;
      }

      await fetch(`${SUPABASE_URL}/rest/v1/support_requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(requestBody),
      });

      toast.success('Demande envoyée ! Un expert vous contactera rapidement.');
      setUrgencySuccess(true);
      setTimeout(() => {
        setShowUrgency(false);
        setUrgencyDesc('');
        setUrgencyName('');
        setUrgencyEmail('');
        setUrgencyPhone('');
        setUrgencySuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Erreur urgence:', error);
      toast.error('Impossible d\'envoyer la demande.');
    } finally {
      setUrgencySending(false);
    }
  };

  // ==========================================
  // UPDATES - Silent Auto-Update with Tauri Plugin
  // ==========================================
  const checkForUpdates = async (silent = false) => {
    if (!silent) setUpdateChecking(true);
    try {
      // Use Tauri native updater for seamless silent updates
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();

      if (update) {
        console.log('[Update] New version available:', update.version);
        setUpdateAvailable({
          version: update.version,
          notes: update.body || 'Ameliorations et corrections',
          mandatory: false
        });
        if (!silent) {
          setShowUpdateModal(true);
        } else {
          // Silent mode: auto-install in background
          toast.info(`Mise a jour ${update.version} disponible, installation...`);
          await installUpdateSilent(update);
        }
      } else if (!silent) {
        toast.success('Vous avez la derniere version !');
      }
    } catch (error) {
      console.error('[Update] Check error:', error);
      // Fallback to API check
      if (!silent) {
        try {
          const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY },
            body: JSON.stringify({ current_version: APP_VERSION }),
          });
          const data = await response.json();
          if (data.update_available) {
            setUpdateAvailable({ version: data.version, notes: data.notes || '', mandatory: data.mandatory || false });
            setShowUpdateModal(true);
          }
        } catch { /* ignore fallback errors */ }
      }
    } finally {
      if (!silent) setUpdateChecking(false);
    }
  };

  // Silent update installation - runs in background
  const installUpdateSilent = async (update: Awaited<ReturnType<typeof import('@tauri-apps/plugin-updater').check>>) => {
    if (!update) return;
    try {
      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            console.log(`[Update] Downloading ${contentLength} bytes`);
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            const percent = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0;
            setUpdateProgress(percent);
            break;
          case 'Finished':
            console.log('[Update] Download complete');
            break;
        }
      });

      toast.success('Mise a jour installee ! Redemarrage...');
      // Relaunch app after short delay
      setTimeout(async () => {
        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
      }, 1500);
    } catch (error) {
      console.error('[Update] Install error:', error);
      toast.error('Erreur de mise a jour');
    }
  };

  const installUpdate = async () => {
    if (!updateAvailable) return;
    setUpdateDownloading(true);
    setUpdateProgress(0);

    try {
      // Try native Tauri updater first
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();

      if (update) {
        await installUpdateSilent(update);
      } else {
        // Fallback: open download page
        const { open } = await import('@tauri-apps/plugin-shell');
        await open('https://app.microdiag.cybtek.fr/downloads/MicrodiagSentinel_latest.msi');
        setUpdateProgress(100);
        setTimeout(() => { setShowUpdateModal(false); setUpdateDownloading(false); }, 1500);
      }
    } catch (error) {
      console.error('[Update] Error:', error);
      // Fallback to browser download
      const { open } = await import('@tauri-apps/plugin-shell');
      await open('https://app.microdiag.cybtek.fr/downloads/MicrodiagSentinel_latest.msi');
      setUpdateProgress(100);
      setTimeout(() => { setShowUpdateModal(false); setUpdateDownloading(false); }, 1500);
    }
  };

  // ==========================================
  // SECURITY SCAN - Real-time streaming
  // ==========================================
  const runSecurityScan = async () => {
    setScanRunning(true);
    setScanStep(0);
    setScanProgress(0);
    setScanReport(null);
    setScanError(null);

    // Listen for real-time progress events from Rust
    const unlisten = await listen<{ step: number; message: string; progress: number }>('scan-progress', (event) => {
      const { step, progress } = event.payload;
      setScanStep(step);
      setScanProgress(progress);
    });

    try {
      const report = await invoke<ScanReport>('run_security_scan');
      unlisten();
      setScanProgress(100);
      setScanStep(10);
      setTimeout(() => {
        setScanReport(report);
        setScanRunning(false);
      }, 300);
      await invoke('send_notification', { title: 'Scan termine', body: `Score: ${report.score}/100` });
    } catch (error) {
      unlisten();
      setScanRunning(false);
      setScanError(String(error));
    }
  };

  // ==========================================
  // EFFECTS
  // ==========================================
  useEffect(() => {
    fetchData();
    // Scripts now loaded via useScripts() hook - Local-First
    // Sync scripts from cloud on startup (background)
    syncScripts().catch(console.error);
    // Auto-check for updates silently on startup (background)
    setTimeout(() => checkForUpdates(true), 5000);
    const interval = setInterval(fetchData, 30000);
    // Poll for remote executions every 10 seconds
    const execInterval = setInterval(checkRemoteExecutions, 10000);
    // Initial check after 5 seconds
    setTimeout(checkRemoteExecutions, 5000);
    const unlisten = listen('run-scan', fetchData);
    return () => { clearInterval(interval); clearInterval(execInterval); unlisten.then((fn) => fn()); };
  }, [fetchData, syncScripts, checkRemoteExecutions]);

  // ==========================================
  // RENDER
  // ==========================================
  if (loading) {
    return (
      <div className="startup-loader">
        <div className="startup-container">
          <div className="startup-logo">
            <div className="logo-circle">
              <div className="logo-pulse"></div>
              <span className="logo-text">M</span>
            </div>
          </div>

          <h1 className="startup-title">Microdiag Sentinel</h1>
          <p className="startup-version">Version {APP_VERSION}</p>

          <div className="startup-steps">
            {STARTUP_STEPS.slice(0, 4).map((step, i) => (
              <div key={i} className={`startup-step ${i < loadingStep ? 'done' : i === loadingStep ? 'active' : ''}`}>
                <div className="step-indicator">
                  {i < loadingStep ? '✓' : i === loadingStep ? <div className="step-spinner"></div> : (i + 1)}
                </div>
                <div className="step-content">
                  <span className="step-message">{step.message}</span>
                  <span className="step-detail">{step.detail}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="startup-tip">
            <div className="tip-icon">💡</div>
            <div className="tip-content">
              <span className="tip-label">Conseil sécurité</span>
              <span className="tip-text">{loadingTip}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Sidebar currentPage={currentPage} setCurrentPage={handleSetCurrentPage} health={health} />

      <main className="main-content">
        {currentPage === 'dashboard' && (
          <DashboardPage
            metrics={metrics}
            health={health}
            deepHealth={deepHealth}
            security={security}
            actionRunning={actionRunning}
            onRefresh={fetchData}
            onQuickAction={runQuickAction}
            onGoToTools={handleGoToTools}
            onShowUrgency={handleShowUrgency}
            onOpenChat={() => setCurrentPage('chat')}
          />
        )}

        {currentPage === 'tools' && (
          <ToolsPage
            scripts={scripts}
            selectedCategory={selectedCategory}
            actionRunning={actionRunning}
            onSelectCategory={setSelectedCategory}
            onRunScript={runScript}
          />
        )}

        {currentPage === 'scan' && (
          <ScanPage
            scanRunning={scanRunning}
            scanStep={scanStep}
            scanProgress={scanProgress}
            scanReport={scanReport}
            scanError={scanError}
            onRunScan={runSecurityScan}
          />
        )}

        {currentPage === 'chat' && (
          <ChatPage
            messages={chatMessages}
            input={chatInput}
            loading={chatLoading}
            onInputChange={setChatInput}
            onSend={sendChatMessage}
            onQuickAction={runQuickAction}
          />
        )}

        {currentPage === 'settings' && (
          <SettingsPage
            metrics={metrics}
            security={security}
            deviceToken={deviceToken}
            updateChecking={updateChecking}
            onCheckUpdates={checkForUpdates}
            onRestartTutorial={() => setShowOnboarding(true)}
          />
        )}

        {currentPage === 'godmode' && (
          <GodModePage metrics={metrics} />
        )}

        {currentPage === 'diagnostic' && (
          <DiagnosticPage onRunAction={(action) => runQuickAction(action, action)} />
        )}

        {currentPage === 'fixwin' && (
          <FixWinPage onRequestSupport={() => { setShowUrgency(true); setUrgencyType('technique'); }} />
        )}
      </main>

      {/* Urgency Modal */}
      {showUrgency && (
        <div className="modal-overlay" onClick={() => !urgencySending && setShowUrgency(false)}>
          <div className="modal urgency-modal" onClick={(e) => e.stopPropagation()}>
            {urgencySuccess ? (
              <div className="success-state">
                <div className="success-icon">✓</div>
                <h2>Demande Envoyee !</h2>
                <p>Un expert Microdiag vous contactera tres rapidement.</p>
              </div>
            ) : (
              <>
                <div className="modal-header">
                  <h2>🆘 Demande d'Intervention</h2>
                  <button className="close-btn" onClick={() => setShowUrgency(false)} disabled={urgencySending}>✕</button>
                </div>
                <div className="modal-body">
                  <div className="urgency-intro">
                    <p>Un probleme avec votre PC ? Decrivez-le et un expert vous contactera.</p>
                  </div>
                  <div className="form-group">
                    <label>Type de probleme</label>
                    <select value={urgencyType} onChange={(e) => setUrgencyType(e.target.value)} disabled={urgencySending}>
                      <option value="crash">💥 Mon PC a plante / ecran bleu</option>
                      <option value="virus">🦠 Suspicion de virus / comportement anormal</option>
                      <option value="network">🌐 Plus d'internet / connexion lente</option>
                      <option value="slow">🐢 PC tres lent</option>
                      <option value="printer">🖨️ Probleme imprimante</option>
                      <option value="software">📦 Probleme logiciel</option>
                      <option value="hardware">🔧 Probleme materiel</option>
                      <option value="other">❓ Autre</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Decrivez le probleme</label>
                    <textarea
                      value={urgencyDesc}
                      onChange={(e) => setUrgencyDesc(e.target.value)}
                      placeholder="Depuis quand ? Que s'est-il passe ? Messages d'erreur ?"
                      rows={3}
                      disabled={urgencySending}
                    />
                  </div>
                  <div className="form-divider">
                    <span>Vos coordonnees (optionnel)</span>
                  </div>
                  <div className="form-row">
                    <div className="form-group half">
                      <label>Votre nom</label>
                      <input
                        type="text"
                        value={urgencyName}
                        onChange={(e) => setUrgencyName(e.target.value)}
                        placeholder="Jean Dupont"
                        disabled={urgencySending}
                      />
                    </div>
                    <div className="form-group half">
                      <label>Telephone</label>
                      <input
                        type="tel"
                        value={urgencyPhone}
                        onChange={(e) => setUrgencyPhone(e.target.value)}
                        placeholder="06 12 34 56 78"
                        disabled={urgencySending}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={urgencyEmail}
                      onChange={(e) => setUrgencyEmail(e.target.value)}
                      placeholder="votre@email.com"
                      disabled={urgencySending}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn-secondary" onClick={() => setShowUrgency(false)} disabled={urgencySending}>
                    Annuler
                  </button>
                  <button className="btn-danger" onClick={sendUrgencyRequest} disabled={urgencySending || !urgencyDesc.trim()}>
                    {urgencySending ? (
                      <><span className="spinner-small"></span>Envoi...</>
                    ) : (
                      <>📤 Envoyer la demande</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Script Execution Modal (Pro UX) */}
      {runningScript && (
        <ScriptExecutionModal
          script={runningScript}
          phase={execPhase}
          steps={execSteps}
          terminalOutput={execTerminalOutput}
          progress={loaderProgress}
          error={execError}
          onConfirm={handleExecConfirm}
          onCancel={handleExecCancel}
          onClose={handleExecClose}
          onRequestSupport={handleExecRequestSupport}
        />
      )}

      {/* Update Modal */}
      {showUpdateModal && updateAvailable && (
        <UpdateModal updateInfo={updateAvailable} downloading={updateDownloading} progress={updateProgress} onClose={() => setShowUpdateModal(false)} onInstall={installUpdate} />
      )}

      {/* Remote Execution Authorization Modal */}
      {pendingExecution && (
        <RemoteExecutionModal
          execution={pendingExecution}
          onAccept={handleAcceptExecution}
          onReject={handleRejectExecution}
          loading={executionLoading}
        />
      )}

      {/* Onboarding Tutorial */}
      {showOnboarding && !loading && (
        <OnboardingTutorial
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette
        scripts={scripts}
        onRunScript={runScript}
        onNavigate={(page) => setCurrentPage(page as Page)}
        onAction={(action) => {
          switch (action) {
            case 'refresh': fetchData(); toast.info('Actualisation...'); break;
            case 'scan': setCurrentPage('scan'); runSecurityScan(); break;
            case 'sync': syncScripts().then(() => toast.success('Scripts synchronisés !')); break;
            case 'urgency': setShowUrgency(true); break;
          }
        }}
      />

      {/* Toast Notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'toast-custom',
          style: { background: '#1f2937', color: '#f3f4f6', border: '1px solid #374151' },
        }}
        richColors
        closeButton
      />
    </div>
  );
}

export default App;
