// ============================================
// MICRODIAG SENTINEL - Premium Diagnostic Page
// Full System Analysis with Beautiful UX
// ============================================

import { useState, useEffect, useCallback } from 'react';
import {
  PremiumDiagnostic,
  runPremiumDiagnostic,
  getStatusColor,
  getPriorityIcon,
  formatTemp,
  formatMemory,
  formatLatency,
  getCategoryInfo,
  formatUptime,
} from '../services/diagnostics';

interface DiagnosticPageProps {
  onRunAction?: (action: string) => void;
}

export function DiagnosticPage({ onRunAction }: DiagnosticPageProps) {
  const [diagnostic, setDiagnostic] = useState<PremiumDiagnostic | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'processes' | 'network' | 'storage'>('overview');
  const [scanProgress, setScanProgress] = useState(0);

  const runDiagnostic = useCallback(async () => {
    setLoading(true);
    setError(null);
    setScanProgress(0);

    // Animated progress
    const progressInterval = setInterval(() => {
      setScanProgress((prev) => (prev >= 90 ? prev : prev + Math.random() * 15));
    }, 200);

    try {
      const result = await runPremiumDiagnostic();
      clearInterval(progressInterval);
      setScanProgress(100);
      setTimeout(() => {
        setDiagnostic(result);
        setLoading(false);
      }, 300);
    } catch (err) {
      clearInterval(progressInterval);
      setError(String(err));
      setLoading(false);
    }
  }, []);

  // Auto-run on mount
  useEffect(() => {
    runDiagnostic();
  }, [runDiagnostic]);

  // Loading state with premium animation
  if (loading) {
    return (
      <div className="page diagnostic-page">
        <div className="diagnostic-loading">
          <div className="loading-circle">
            <svg viewBox="0 0 100 100">
              <circle className="loading-bg" cx="50" cy="50" r="45" />
              <circle
                className="loading-progress"
                cx="50"
                cy="50"
                r="45"
                style={{ strokeDashoffset: 283 - (283 * scanProgress) / 100 }}
              />
            </svg>
            <div className="loading-percent">{Math.round(scanProgress)}%</div>
          </div>
          <h2>Analyse Premium en cours...</h2>
          <p className="loading-step">
            {scanProgress < 20 && "Collecte des informations systeme..."}
            {scanProgress >= 20 && scanProgress < 40 && "Analyse des temperatures..."}
            {scanProgress >= 40 && scanProgress < 60 && "Scan des processus..."}
            {scanProgress >= 60 && scanProgress < 80 && "Test de la connexion reseau..."}
            {scanProgress >= 80 && "Finalisation du diagnostic..."}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page diagnostic-page">
        <div className="diagnostic-error">
          <span className="error-icon">⚠️</span>
          <h2>Erreur de diagnostic</h2>
          <p>{error}</p>
          <button onClick={runDiagnostic} className="retry-btn">
            Reessayer
          </button>
        </div>
      </div>
    );
  }

  if (!diagnostic) return null;

  const { temperatures, processes, network, storage, system_info, recommendations, overall_score, overall_status } = diagnostic;

  return (
    <div className="page diagnostic-page">
      {/* Header with Score */}
      <div className="diagnostic-header">
        <div className="header-left">
          <h1>Diagnostic Premium</h1>
          <p>Analyse complete de votre systeme</p>
        </div>
        <button onClick={runDiagnostic} className="refresh-diagnostic-btn">
          <span>↻</span> Actualiser
        </button>
      </div>

      {/* Overall Score Card */}
      <div className={`score-hero score-${overall_status}`}>
        <div className="score-ring">
          <svg viewBox="0 0 100 100">
            <circle className="ring-bg" cx="50" cy="50" r="45" />
            <circle
              className="ring-progress"
              cx="50"
              cy="50"
              r="45"
              style={{
                strokeDashoffset: 283 - (283 * overall_score) / 100,
                stroke: getStatusColor(overall_status),
              }}
            />
          </svg>
          <div className="score-value">
            <span className="score-number">{overall_score}</span>
            <span className="score-label">/ 100</span>
          </div>
        </div>
        <div className="score-details">
          <h2>
            {overall_status === 'excellent' && "Excellent! Votre PC est en parfaite sante"}
            {overall_status === 'good' && "Bon! Quelques optimisations possibles"}
            {overall_status === 'warning' && "Attention! Des problemes ont ete detectes"}
            {overall_status === 'critical' && "Critique! Action requise immediatement"}
          </h2>
          <div className="quick-stats">
            <div className="stat">
              <span className="stat-icon">🌡️</span>
              <span className="stat-value">{formatTemp(temperatures.cpu_temp)}</span>
              <span className="stat-label">CPU</span>
            </div>
            <div className="stat">
              <span className="stat-icon">📊</span>
              <span className="stat-value">{processes.total_count}</span>
              <span className="stat-label">Processus</span>
            </div>
            <div className="stat">
              <span className="stat-icon">🌐</span>
              <span className="stat-value">{network.latency_ms ? `${network.latency_ms}ms` : '--'}</span>
              <span className="stat-label">Latence</span>
            </div>
            <div className="stat">
              <span className="stat-icon">💾</span>
              <span className="stat-value">{storage.free_space_gb.toFixed(0)} GB</span>
              <span className="stat-label">Libre</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <section className="recommendations-section">
          <h3>Recommandations</h3>
          <div className="recommendations-list">
            {recommendations.map((rec, i) => (
              <div key={i} className={`recommendation-card priority-${rec.priority}`}>
                <div className="rec-header">
                  <span className="rec-icon">{getPriorityIcon(rec.priority)}</span>
                  <span className="rec-title">{rec.title}</span>
                  <span className={`rec-badge ${rec.priority}`}>{rec.priority}</span>
                </div>
                <p className="rec-description">{rec.description}</p>
                <p className="rec-impact">
                  <strong>Impact:</strong> {rec.impact}
                </p>
                {rec.action && onRunAction && (
                  <button onClick={() => onRunAction(rec.action!)} className="rec-action-btn">
                    Corriger automatiquement
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tabs Navigation */}
      <div className="diagnostic-tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Vue d'ensemble
        </button>
        <button
          className={`tab ${activeTab === 'processes' ? 'active' : ''}`}
          onClick={() => setActiveTab('processes')}
        >
          Processus ({processes.total_count})
        </button>
        <button
          className={`tab ${activeTab === 'network' ? 'active' : ''}`}
          onClick={() => setActiveTab('network')}
        >
          Reseau
        </button>
        <button
          className={`tab ${activeTab === 'storage' ? 'active' : ''}`}
          onClick={() => setActiveTab('storage')}
        >
          Stockage
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="overview-grid">
            {/* Temperatures Card */}
            <div className="diagnostic-card temps-card">
              <h4>🌡️ Temperatures</h4>
              <div className="temp-main">
                <div className={`temp-gauge temp-${temperatures.cpu_status}`}>
                  <span className="temp-value">{formatTemp(temperatures.cpu_temp)}</span>
                  <span className="temp-label">CPU</span>
                </div>
                {temperatures.gpu_temp && (
                  <div className="temp-gauge">
                    <span className="temp-value">{formatTemp(temperatures.gpu_temp)}</span>
                    <span className="temp-label">GPU</span>
                  </div>
                )}
              </div>
              <p className="temp-message">{temperatures.cpu_message}</p>
            </div>

            {/* System Info Card */}
            <div className="diagnostic-card system-card">
              <h4>💻 Systeme</h4>
              <div className="system-info-grid">
                <div className="info-row">
                  <span className="info-label">CPU</span>
                  <span className="info-value">{system_info.cpu_name || 'Non detecte'}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Coeurs</span>
                  <span className="info-value">{system_info.cpu_cores} coeurs / {system_info.cpu_threads} threads</span>
                </div>
                <div className="info-row">
                  <span className="info-label">RAM</span>
                  <span className="info-value">{system_info.ram_total_gb.toFixed(1)} GB</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Windows</span>
                  <span className="info-value">{system_info.windows_version}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Uptime</span>
                  <span className="info-value">{formatUptime(system_info.uptime_hours)}</span>
                </div>
              </div>
            </div>

            {/* Quick Network Card */}
            <div className="diagnostic-card network-quick-card">
              <h4>🌐 Connexion</h4>
              <div className={`network-status ${network.is_connected ? 'connected' : 'disconnected'}`}>
                <span className="status-dot"></span>
                <span>{network.is_connected ? 'Connecte' : 'Deconnecte'}</span>
              </div>
              <div className="network-stats">
                <div className="net-stat">
                  <span className="net-label">Latence</span>
                  <span className="net-value">{formatLatency(network.latency_ms)}</span>
                </div>
                <div className="net-stat">
                  <span className="net-label">DNS</span>
                  <span className="net-value">{network.dns_status}</span>
                </div>
              </div>
              <p className="network-summary">{network.summary}</p>
            </div>

            {/* Quick Storage Card */}
            <div className="diagnostic-card storage-quick-card">
              <h4>💾 Stockage</h4>
              {storage.drives.slice(0, 2).map((drive, i) => (
                <div key={i} className="drive-quick">
                  <div className="drive-header">
                    <span className="drive-letter">{drive.letter}</span>
                    <span className="drive-space">{drive.free_gb.toFixed(0)} GB libres</span>
                  </div>
                  <div className="drive-bar">
                    <div
                      className={`drive-fill ${drive.health}`}
                      style={{ width: `${drive.percent}%` }}
                    ></div>
                  </div>
                  <span className="drive-percent">{drive.percent.toFixed(0)}% utilise</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Processes Tab */}
        {activeTab === 'processes' && (
          <div className="processes-content">
            <p className="section-summary">{processes.summary}</p>

            {/* Suspicious Processes Warning */}
            {processes.suspicious.length > 0 && (
              <div className="suspicious-warning">
                <h4>⚠️ Processus suspects detectes</h4>
                {processes.suspicious.map((proc, i) => (
                  <div key={i} className="suspicious-item">
                    <span className="proc-name">{proc.name}</span>
                    <span className="proc-desc">{proc.description}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Top CPU */}
            <div className="process-section">
              <h4>📊 Top CPU</h4>
              <div className="process-list">
                {processes.top_cpu.map((proc, i) => {
                  const catInfo = getCategoryInfo(proc.category);
                  return (
                    <div key={i} className="process-item">
                      <div className="proc-icon" style={{ background: catInfo.color }}>
                        {catInfo.icon}
                      </div>
                      <div className="proc-info">
                        <span className="proc-name">{proc.name}</span>
                        <span className="proc-desc">{proc.description}</span>
                      </div>
                      <div className="proc-stats">
                        <span className={`proc-cpu ${proc.cpu_percent > 50 ? 'high' : ''}`}>
                          {proc.cpu_percent.toFixed(1)}% CPU
                        </span>
                        <span className="proc-mem">{formatMemory(proc.memory_mb)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Memory */}
            <div className="process-section">
              <h4>🧠 Top Memoire</h4>
              <div className="process-list">
                {processes.top_memory.map((proc, i) => {
                  const catInfo = getCategoryInfo(proc.category);
                  return (
                    <div key={i} className="process-item">
                      <div className="proc-icon" style={{ background: catInfo.color }}>
                        {catInfo.icon}
                      </div>
                      <div className="proc-info">
                        <span className="proc-name">{proc.name}</span>
                        <span className="proc-desc">{proc.description}</span>
                      </div>
                      <div className="proc-stats">
                        <span className="proc-cpu">{proc.cpu_percent.toFixed(1)}% CPU</span>
                        <span className={`proc-mem ${proc.memory_mb > 1000 ? 'high' : ''}`}>
                          {formatMemory(proc.memory_mb)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Network Tab */}
        {activeTab === 'network' && (
          <div className="network-content">
            <div className="network-hero">
              <div className={`connection-status ${network.is_connected ? 'online' : 'offline'}`}>
                <span className="status-icon">{network.is_connected ? '✓' : '✗'}</span>
                <span className="status-text">{network.is_connected ? 'Connecte a Internet' : 'Pas de connexion'}</span>
              </div>
              <div className="latency-display">
                <span className="latency-value">{network.latency_ms ?? '--'}</span>
                <span className="latency-unit">ms</span>
                <span className="latency-label">{network.latency_status}</span>
              </div>
            </div>

            <div className="network-details">
              <h4>Interfaces reseau</h4>
              <div className="interfaces-list">
                {network.interfaces.map((iface, i) => (
                  <div key={i} className={`interface-item ${iface.is_up ? 'up' : 'down'}`}>
                    <div className="iface-header">
                      <span className="iface-name">{iface.name}</span>
                      <span className={`iface-status ${iface.is_up ? 'up' : 'down'}`}>
                        {iface.is_up ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                    <div className="iface-stats">
                      <span>⬇️ {iface.received_mb.toFixed(1)} MB recus</span>
                      <span>⬆️ {iface.transmitted_mb.toFixed(1)} MB envoyes</span>
                    </div>
                    {iface.mac && <span className="iface-mac">MAC: {iface.mac}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Storage Tab */}
        {activeTab === 'storage' && (
          <div className="storage-content">
            <div className="storage-summary">
              <div className="storage-total">
                <span className="total-used">{storage.used_space_gb.toFixed(0)} GB</span>
                <span className="total-sep">/</span>
                <span className="total-all">{storage.total_space_gb.toFixed(0)} GB</span>
              </div>
              <p>{storage.summary}</p>
            </div>

            <div className="drives-list">
              {storage.drives.map((drive, i) => (
                <div key={i} className={`drive-card health-${drive.health}`}>
                  <div className="drive-icon">
                    {drive.drive_type === 'SSD' ? '⚡' : drive.drive_type === 'NVMe' ? '🚀' : '💿'}
                  </div>
                  <div className="drive-details">
                    <div className="drive-name">
                      <span className="letter">{drive.letter}</span>
                      <span className="name">{drive.name || 'Disque local'}</span>
                      <span className="type-badge">{drive.drive_type}</span>
                    </div>
                    <div className="drive-bar-large">
                      <div
                        className={`fill health-${drive.health}`}
                        style={{ width: `${drive.percent}%` }}
                      >
                        <span className="fill-label">{drive.percent.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="drive-sizes">
                      <span>{drive.used_gb.toFixed(1)} GB utilises</span>
                      <span>{drive.free_gb.toFixed(1)} GB libres</span>
                      <span>{drive.total_gb.toFixed(0)} GB total</span>
                    </div>
                    <div className="drive-health">
                      <span className="smart-status">SMART: {drive.smart_status}</span>
                      <span className={`health-badge ${drive.health}`}>
                        {drive.health === 'good' && '✓ Sain'}
                        {drive.health === 'warning' && '⚠ Attention'}
                        {drive.health === 'critical' && '✗ Critique'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
