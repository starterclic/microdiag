// ============================================
// MICRODIAG SENTINEL - Main App
// Version 2.0.0
// ============================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import './styles/index.css';

// Types & Constants
import { SystemMetrics, HealthScore, SecurityStatus, Script, ChatMessage, UpdateInfo, Page, ScanReport, RemoteExecution } from './types';
import { SUPABASE_URL, SUPABASE_ANON_KEY, APP_VERSION, LOADER_MESSAGES, SECURITY_TIPS, STARTUP_STEPS } from './constants';

// Components
import { Sidebar, ScriptLoaderModal, UpdateModal, RemoteExecutionModal, OnboardingTutorial } from './components';

// Pages
import { DashboardPage, ToolsPage, ScanPage, ChatPage, SettingsPage } from './pages';

// Scan steps timing (10 steps)
const SCAN_STEP_DURATION = 1500;

function App() {
  // Core state
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [health, setHealth] = useState<HealthScore | null>(null);
  const [security, setSecurity] = useState<SecurityStatus | null>(null);
  const [deviceToken, setDeviceToken] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingTip, setLoadingTip] = useState(SECURITY_TIPS[Math.floor(Math.random() * SECURITY_TIPS.length)]);

  // Scripts state
  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [actionRunning, setActionRunning] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [loaderMessage, setLoaderMessage] = useState<string>('');
  const [loaderProgress, setLoaderProgress] = useState<number>(0);
  const [runningScript, setRunningScript] = useState<Script | null>(null);

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

      setLoadingStep(2);
      const [metricsData, healthData, securityData, tokenData] = await Promise.all([
        invoke<SystemMetrics>('get_system_metrics'),
        invoke<HealthScore>('get_health_score'),
        invoke<SecurityStatus>('get_security_status'),
        invoke<string>('get_device_token'),
      ]);

      setLoadingStep(3);
      setMetrics(metricsData);
      setHealth(healthData);
      setSecurity(securityData);
      setDeviceToken(tokenData);

      setLoadingStep(4);
      // Minimal delay for visual feedback
      await new Promise(r => setTimeout(r, 200));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchScripts = useCallback(async () => {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/scripts?is_active=eq.true&select=*`, {
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY },
      });
      if (response.ok) setScripts(await response.json());
    } catch (error) {
      console.error('Error fetching scripts:', error);
    }
  }, []);

  // ==========================================
  // SCRIPT EXECUTION
  // ==========================================
  const runScript = async (script: Script) => {
    setActionRunning(script.slug);
    setActionResult(null);
    setRunningScript(script);
    setLoaderProgress(0);

    const messages = LOADER_MESSAGES[script.category] || LOADER_MESSAGES.custom;
    let messageIndex = 0;

    const messageInterval = setInterval(() => {
      setLoaderMessage(messages[messageIndex % messages.length]);
      setLoaderProgress((prev) => Math.min(prev + 15, 90));
      messageIndex++;
    }, 1500);

    setLoaderMessage(messages[0]);

    try {
      const output = await invoke<string>('run_script', { scriptId: script.slug, code: script.code, language: script.language });
      clearInterval(messageInterval);
      setLoaderProgress(100);
      // Show last meaningful line of output or success message
      const lines = output.trim().split('\n').filter(l => l.trim());
      const lastLine = lines.length > 0 ? lines[lines.length - 1] : 'Termine avec succes !';
      setLoaderMessage(lastLine.replace(/\[[\w]+\]/g, '').trim() || 'Termine avec succes !');
      setTimeout(() => {
        setActionResult({ success: true, message: lastLine.length > 60 ? `${script.name} termine !` : lastLine });
        setRunningScript(null);
      }, 500);
      await invoke('send_notification', { title: 'Microdiag Sentinel', body: `${script.name} termine` });
      fetchData();
    } catch (error) {
      clearInterval(messageInterval);
      setRunningScript(null);
      setActionResult({ success: false, message: `Erreur: ${error}` });
    } finally {
      setActionRunning(null);
      setTimeout(() => setActionResult(null), 5000);
    }
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
        const lastLine = lines.length > 0 ? lines[lines.length - 1] : `${name} termine !`;
        setActionResult({ success: true, message: lastLine.length > 60 ? `${name} termine !` : lastLine });
        fetchData();
      } catch (error) {
        setActionResult({ success: false, message: `Erreur: ${error}` });
      } finally {
        setActionRunning(null);
        setTimeout(() => setActionResult(null), 5000);
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
  // CHAT
  // ==========================================
  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMessage: ChatMessage = { id: Date.now(), role: 'user', content: chatInput, timestamp: new Date() };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ message: userMessage.content, device_id: deviceToken }),
      });
      const data = await response.json();
      setChatMessages((prev) => [...prev, {
        id: Date.now() + 1, role: 'assistant',
        content: data.response || data.error || "Erreur.",
        timestamp: new Date(), action: data.action,
      }]);
    } catch {
      setChatMessages((prev) => [...prev, {
        id: Date.now() + 1, role: 'assistant',
        content: "Connexion impossible.",
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

      await invoke('send_notification', { title: 'Demande envoyee', body: 'Un expert vous contactera rapidement.' });
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
      await invoke('send_notification', { title: 'Erreur', body: 'Impossible d\'envoyer la demande.' });
    } finally {
      setUrgencySending(false);
    }
  };

  // ==========================================
  // UPDATES
  // ==========================================
  const checkForUpdates = async () => {
    setUpdateChecking(true);
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
      } else {
        await invoke('send_notification', { title: 'Microdiag Sentinel', body: 'Derniere version !' });
      }
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setUpdateChecking(false);
    }
  };

  const installUpdate = async () => {
    if (!updateAvailable) return;
    setUpdateDownloading(true);
    setUpdateProgress(0);
    const progressInterval = setInterval(() => setUpdateProgress((prev) => prev >= 90 ? prev : prev + 10), 500);

    try {
      const { open } = await import('@tauri-apps/api/shell');
      await open('https://app.microdiag.cybtek.fr/downloads/MicrodiagSentinel_latest_setup.exe');
      clearInterval(progressInterval);
      setUpdateProgress(100);
      setTimeout(() => { setShowUpdateModal(false); setUpdateDownloading(false); }, 1500);
    } catch {
      clearInterval(progressInterval);
      setUpdateDownloading(false);
    }
  };

  // ==========================================
  // SECURITY SCAN
  // ==========================================
  const runSecurityScan = async () => {
    setScanRunning(true);
    setScanStep(0);
    setScanProgress(0);
    setScanReport(null);
    setScanError(null);

    const scanPromise = invoke<ScanReport>('run_security_scan');
    let currentStep = 0;

    const stepInterval = setInterval(() => {
      if (currentStep < 10) {
        setScanStep(currentStep);
        setScanProgress(Math.min(95, (currentStep + 1) * 10));
        currentStep++;
      }
    }, SCAN_STEP_DURATION);

    try {
      const report = await scanPromise;
      clearInterval(stepInterval);
      setScanProgress(100);
      setScanStep(8);
      setTimeout(() => {
        setScanReport(report);
        setScanRunning(false);
      }, 500);
      await invoke('send_notification', { title: 'Scan termine', body: `Score: ${report.score}/100` });
    } catch (error) {
      clearInterval(stepInterval);
      setScanRunning(false);
      setScanError(String(error));
    }
  };

  // ==========================================
  // EFFECTS
  // ==========================================
  useEffect(() => {
    fetchData();
    fetchScripts();
    // Auto-check for updates on startup
    setTimeout(() => checkForUpdates(), 3000);
    const interval = setInterval(fetchData, 30000);
    // Poll for remote executions every 10 seconds
    const execInterval = setInterval(checkRemoteExecutions, 10000);
    // Initial check after 5 seconds
    setTimeout(checkRemoteExecutions, 5000);
    const unlisten = listen('run-scan', fetchData);
    return () => { clearInterval(interval); clearInterval(execInterval); unlisten.then((fn) => fn()); };
  }, [fetchData, fetchScripts, checkRemoteExecutions]);

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
            actionRunning={actionRunning}
            onRefresh={fetchData}
            onQuickAction={runQuickAction}
            onGoToTools={handleGoToTools}
            onShowUrgency={handleShowUrgency}
          />
        )}

        {currentPage === 'tools' && (
          <ToolsPage
            scripts={scripts}
            selectedCategory={selectedCategory}
            actionRunning={actionRunning}
            actionResult={actionResult}
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

      {/* Script Loader Modal */}
      {runningScript && <ScriptLoaderModal script={runningScript} message={loaderMessage} progress={loaderProgress} />}

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
    </div>
  );
}

export default App;
