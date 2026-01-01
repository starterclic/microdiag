// ============================================
// MICRODIAG SENTINEL - Premium Dashboard
// Real-time metrics with professional UI
// ============================================

import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SystemMetrics, HealthScore, SecurityStatus } from '../types';
import { DeepHealth } from '../services/godmode';
import { PremiumDiagnostic, runPremiumDiagnostic, ProcessInfo } from '../services/diagnostics';

interface DashboardPageProps {
  metrics: SystemMetrics | null;
  health: HealthScore | null;
  deepHealth: DeepHealth | null;
  security?: SecurityStatus | null;
  actionRunning: string | null;
  onRefresh: () => void;
  onQuickAction: (slug: string, name: string) => void;
  onGoToTools: () => void;
  onShowUrgency: () => void;
}

// Circular gauge component
function CircularGauge({ value, max = 100, size = 120, strokeWidth = 8, color, label, sublabel }: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  label: string;
  sublabel?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="circular-gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: '50% 50%',
            transition: 'stroke-dashoffset 0.5s ease-out'
          }}
        />
      </svg>
      <div className="gauge-content">
        <span className="gauge-value" style={{ color }}>{Math.round(value)}</span>
        <span className="gauge-label">{label}</span>
        {sublabel && <span className="gauge-sublabel">{sublabel}</span>}
      </div>
    </div>
  );
}

// Progress bar component
function MetricBar({ label, value, max = 100, color, icon, detail }: {
  label: string;
  value: number;
  max?: number;
  color: string;
  icon: string;
  detail?: string;
}) {
  const percent = Math.min(100, (value / max) * 100);
  const status = percent > 90 ? 'critical' : percent > 75 ? 'warning' : 'good';

  return (
    <div className={`metric-bar ${status}`}>
      <div className="metric-bar-header">
        <span className="metric-bar-icon">{icon}</span>
        <span className="metric-bar-label">{label}</span>
        <span className="metric-bar-value" style={{ color }}>{value.toFixed(1)}%</span>
      </div>
      <div className="metric-bar-track">
        <div
          className="metric-bar-fill"
          style={{ width: `${percent}%`, background: color }}
        />
      </div>
      {detail && <span className="metric-bar-detail">{detail}</span>}
    </div>
  );
}

// Process row component
function ProcessRow({ process, index }: { process: ProcessInfo; index: number }) {
  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'browser': return '🌐';
      case 'antivirus': return '🛡️';
      case 'system': return '⚙️';
      case 'office': return '📄';
      case 'game': return '🎮';
      case 'dev': return '💻';
      case 'media': return '🎵';
      case 'communication': return '💬';
      default: return '📦';
    }
  };

  const cpuColor = process.cpu_percent > 50 ? '#ef4444' : process.cpu_percent > 20 ? '#f59e0b' : '#10b981';

  return (
    <div className="process-row" style={{ animationDelay: `${index * 0.05}s` }}>
      <div className="process-info">
        <span className="process-icon">{getCategoryIcon(process.category)}</span>
        <div className="process-details">
          <span className="process-name">{process.name}</span>
          <span className="process-desc">{process.description}</span>
        </div>
      </div>
      <div className="process-stats">
        <div className="process-stat">
          <span className="stat-label">CPU</span>
          <span className="stat-value" style={{ color: cpuColor }}>{process.cpu_percent.toFixed(1)}%</span>
        </div>
        <div className="process-stat">
          <span className="stat-label">RAM</span>
          <span className="stat-value">{process.memory_mb.toFixed(0)} MB</span>
        </div>
      </div>
    </div>
  );
}

// Security item component
function SecurityItem({ label, status, detail }: { label: string; status: 'ok' | 'warning' | 'critical' | 'unknown'; detail?: string }) {
  const colors = {
    ok: '#10b981',
    warning: '#f59e0b',
    critical: '#ef4444',
    unknown: '#6b7280',
  };
  const icons = {
    ok: '✓',
    warning: '!',
    critical: '✕',
    unknown: '?',
  };

  return (
    <div className={`security-item ${status}`}>
      <div className="security-indicator" style={{ background: colors[status] }}>
        {icons[status]}
      </div>
      <div className="security-content">
        <span className="security-label">{label}</span>
        {detail && <span className="security-detail">{detail}</span>}
      </div>
    </div>
  );
}

export function DashboardPage({
  metrics,
  health,
  deepHealth,
  security,
  onRefresh,
  onShowUrgency,
}: DashboardPageProps) {
  const [diagnostic, setDiagnostic] = useState<PremiumDiagnostic | null>(null);
  const [loading, setLoading] = useState(true);
  const [processView, setProcessView] = useState<'cpu' | 'memory'>('cpu');

  // Load premium diagnostic data
  useEffect(() => {
    const loadDiagnostic = async () => {
      try {
        const data = await runPremiumDiagnostic();
        setDiagnostic(data);
      } catch (error) {
        console.error('Error loading diagnostic:', error);
      } finally {
        setLoading(false);
      }
    };
    loadDiagnostic();
    const interval = setInterval(loadDiagnostic, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  // Calculate health score
  const healthScore = useMemo(() => {
    if (diagnostic?.overall_score) return diagnostic.overall_score;
    if (health?.score) return health.score;
    return 0;
  }, [diagnostic, health]);

  const healthColor = useMemo(() => {
    if (healthScore >= 85) return '#10b981';
    if (healthScore >= 70) return '#22c55e';
    if (healthScore >= 50) return '#f59e0b';
    return '#ef4444';
  }, [healthScore]);

  const healthStatus = useMemo(() => {
    if (healthScore >= 85) return 'Excellent';
    if (healthScore >= 70) return 'Bon';
    if (healthScore >= 50) return 'Attention';
    return 'Critique';
  }, [healthScore]);

  // Get top processes
  const topProcesses = useMemo(() => {
    if (!diagnostic) return [];
    return processView === 'cpu' ? diagnostic.processes.top_cpu : diagnostic.processes.top_memory;
  }, [diagnostic, processView]);

  // Security items
  const securityItems = useMemo(() => {
    const items: { label: string; status: 'ok' | 'warning' | 'critical' | 'unknown'; detail?: string }[] = [];

    if (security) {
      items.push({
        label: 'Antivirus',
        status: security.antivirus_enabled ? 'ok' : 'critical',
        detail: security.antivirus_enabled ? 'Protection active' : 'Desactive',
      });
      items.push({
        label: 'Protection temps reel',
        status: security.realtime_protection ? 'ok' : 'warning',
        detail: security.realtime_protection ? 'Active' : 'Desactivee',
      });
      items.push({
        label: 'Pare-feu',
        status: security.firewall_enabled ? 'ok' : 'critical',
        detail: security.firewall_enabled ? 'Actif' : 'Desactive',
      });
    }

    // Disk health from SMART
    if (deepHealth) {
      items.push({
        label: 'Sante disque',
        status: deepHealth.disk_smart_status === 'OK' ? 'ok' :
               deepHealth.disk_smart_status === 'Unknown' ? 'unknown' : 'critical',
        detail: deepHealth.disk_model || 'Non detecte',
      });
    }

    return items;
  }, [security, deepHealth]);

  // Temperature display
  const tempDisplay = useMemo(() => {
    if (!diagnostic?.temperatures.cpu_temp) return null;
    const temp = diagnostic.temperatures.cpu_temp;
    return {
      value: temp,
      status: temp < 60 ? 'cool' : temp < 75 ? 'warm' : 'hot',
      color: temp < 60 ? '#10b981' : temp < 75 ? '#f59e0b' : '#ef4444',
    };
  }, [diagnostic]);

  // Battery display
  const batteryDisplay = useMemo(() => {
    if (!deepHealth?.battery?.is_present) return null;
    const charge = deepHealth.battery.charge_percent;
    const health = deepHealth.battery.health_percent;
    return {
      charge,
      health,
      status: charge > 50 ? 'good' : charge > 20 ? 'medium' : 'low',
      color: charge > 50 ? '#10b981' : charge > 20 ? '#f59e0b' : '#ef4444',
      healthColor: health > 70 ? '#10b981' : health > 40 ? '#f59e0b' : '#ef4444',
    };
  }, [deepHealth]);

  return (
    <div className="page dashboard-page premium">
      <div className="page-header">
        <div className="header-left">
          <h1>Tableau de bord</h1>
          <span className="header-subtitle">Vue en temps reel</span>
        </div>
        <div className="header-actions">
          <button className="refresh-btn" onClick={onRefresh}>
            <span className="refresh-icon">↻</span>
            Actualiser
          </button>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Main Health Score */}
        <section className="dashboard-card health-card">
          <div className="card-header">
            <h2>Sante du Systeme</h2>
          </div>
          <div className="health-content">
            <CircularGauge
              value={healthScore}
              max={100}
              size={160}
              strokeWidth={12}
              color={healthColor}
              label={`${healthScore}`}
              sublabel="/100"
            />
            <div className="health-info">
              <span className="health-status" style={{ color: healthColor }}>{healthStatus}</span>
              <span className="health-message">
                {diagnostic?.processes.summary || health?.issues?.[0] || 'Systeme operationnel'}
              </span>
              {diagnostic?.recommendations?.[0] && diagnostic.recommendations[0].priority !== 'info' && (
                <div className={`health-recommendation ${diagnostic.recommendations[0].priority}`}>
                  <span className="rec-icon">{diagnostic.recommendations[0].priority === 'critical' ? '⚠️' : '💡'}</span>
                  <span>{diagnostic.recommendations[0].title}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Resources Section */}
        <section className="dashboard-card resources-card">
          <div className="card-header">
            <h2>Ressources</h2>
          </div>
          <div className="resources-content">
            <MetricBar
              label="Processeur"
              value={metrics?.cpu_usage || 0}
              color={(metrics?.cpu_usage || 0) > 80 ? '#ef4444' : (metrics?.cpu_usage || 0) > 60 ? '#f59e0b' : '#10b981'}
              icon="⚡"
              detail={diagnostic?.system_info.cpu_name?.split(' ').slice(0, 3).join(' ')}
            />
            <MetricBar
              label="Memoire RAM"
              value={metrics?.memory_percent || 0}
              color={(metrics?.memory_percent || 0) > 85 ? '#ef4444' : (metrics?.memory_percent || 0) > 70 ? '#f59e0b' : '#3b82f6'}
              icon="🧠"
              detail={`${((metrics?.memory_used || 0) / 1024 / 1024 / 1024).toFixed(1)} / ${((metrics?.memory_total || 0) / 1024 / 1024 / 1024).toFixed(1)} GB`}
            />
            {metrics?.disks.slice(0, 2).map((disk, i) => (
              <MetricBar
                key={i}
                label={`Disque ${disk.mount_point}`}
                value={disk.percent}
                color={disk.percent > 90 ? '#ef4444' : disk.percent > 75 ? '#f59e0b' : '#8b5cf6'}
                icon="💾"
                detail={`${disk.free_gb.toFixed(0)} GB libres`}
              />
            ))}
          </div>
        </section>

        {/* Temperature & Battery */}
        <section className="dashboard-card sensors-card">
          <div className="card-header">
            <h2>Capteurs</h2>
          </div>
          <div className="sensors-content">
            {/* Temperature */}
            <div className="sensor-item">
              <div className="sensor-icon">🌡️</div>
              <div className="sensor-data">
                <span className="sensor-label">Temperature CPU</span>
                {tempDisplay ? (
                  <span className="sensor-value" style={{ color: tempDisplay.color }}>
                    {tempDisplay.value.toFixed(0)}°C
                  </span>
                ) : (
                  <span className="sensor-value muted">Non disponible</span>
                )}
              </div>
              {tempDisplay && (
                <div className={`sensor-badge ${tempDisplay.status}`}>
                  {tempDisplay.status === 'cool' ? 'Optimal' : tempDisplay.status === 'warm' ? 'Chaud' : 'Surchauffe'}
                </div>
              )}
            </div>

            {/* Battery if present */}
            {batteryDisplay && (
              <div className="sensor-item battery-item">
                <div className="sensor-icon">🔋</div>
                <div className="sensor-data">
                  <span className="sensor-label">Batterie</span>
                  <div className="battery-info">
                    <span className="sensor-value" style={{ color: batteryDisplay.color }}>
                      {batteryDisplay.charge}%
                    </span>
                    <div className="battery-bar">
                      <div
                        className="battery-fill"
                        style={{
                          width: `${batteryDisplay.charge}%`,
                          background: batteryDisplay.color
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="battery-health">
                  <span className="health-label">Sante</span>
                  <span className="health-value" style={{ color: batteryDisplay.healthColor }}>
                    {batteryDisplay.health}%
                  </span>
                </div>
              </div>
            )}

            {/* Network latency */}
            {diagnostic?.network && (
              <div className="sensor-item">
                <div className="sensor-icon">📶</div>
                <div className="sensor-data">
                  <span className="sensor-label">Connexion</span>
                  <span className="sensor-value" style={{
                    color: diagnostic.network.is_connected ?
                      (diagnostic.network.latency_ms && diagnostic.network.latency_ms < 50 ? '#10b981' : '#f59e0b')
                      : '#ef4444'
                  }}>
                    {diagnostic.network.is_connected ?
                      (diagnostic.network.latency_ms ? `${diagnostic.network.latency_ms}ms` : 'Connecte')
                      : 'Deconnecte'}
                  </span>
                </div>
                <div className={`sensor-badge ${diagnostic.network.latency_status === 'Excellent' ? 'cool' : 'warm'}`}>
                  {diagnostic.network.latency_status}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Security Overview */}
        <section className="dashboard-card security-card">
          <div className="card-header">
            <h2>Securite</h2>
            <div className="security-score">
              <span className="sec-score-value" style={{
                color: securityItems.every(i => i.status === 'ok') ? '#10b981' :
                       securityItems.some(i => i.status === 'critical') ? '#ef4444' : '#f59e0b'
              }}>
                {securityItems.filter(i => i.status === 'ok').length}/{securityItems.length}
              </span>
              <span className="sec-score-label">elements securises</span>
            </div>
          </div>
          <div className="security-grid">
            {securityItems.map((item, i) => (
              <SecurityItem key={i} {...item} />
            ))}
          </div>
        </section>

        {/* Processes Monitor */}
        <section className="dashboard-card processes-card">
          <div className="card-header">
            <h2>Processus Actifs</h2>
            <div className="process-tabs">
              <button
                className={`tab ${processView === 'cpu' ? 'active' : ''}`}
                onClick={() => setProcessView('cpu')}
              >
                CPU
              </button>
              <button
                className={`tab ${processView === 'memory' ? 'active' : ''}`}
                onClick={() => setProcessView('memory')}
              >
                RAM
              </button>
            </div>
          </div>
          <div className="processes-list">
            {loading ? (
              <div className="processes-loading">
                <div className="loading-spinner"></div>
                <span>Analyse des processus...</span>
              </div>
            ) : topProcesses.length > 0 ? (
              topProcesses.map((proc, i) => (
                <ProcessRow key={`${proc.pid}-${i}`} process={proc} index={i} />
              ))
            ) : (
              <div className="processes-empty">
                <span>Aucun processus detecte</span>
              </div>
            )}
          </div>
          <div className="processes-summary">
            <span className="summary-text">
              {diagnostic?.processes.total_count || 0} processus actifs
            </span>
            {diagnostic?.processes.suspicious.length > 0 && (
              <span className="summary-warning">
                ⚠️ {diagnostic.processes.suspicious.length} suspect(s)
              </span>
            )}
          </div>
        </section>
      </div>

      {/* Emergency Button - Sticky Bottom */}
      <div className="emergency-floating">
        <button className="emergency-btn" onClick={onShowUrgency}>
          <span className="sos-icon">SOS</span>
          <span className="sos-text">Besoin d'aide ?</span>
        </button>
      </div>
    </div>
  );
}
