// ============================================
// MICRODIAG SENTINEL - Dashboard Page
// ============================================

import { SystemMetrics, HealthScore } from '../types';

interface DashboardPageProps {
  metrics: SystemMetrics | null;
  health: HealthScore | null;
  actionRunning: string | null;
  onRefresh: () => void;
  onQuickAction: (slug: string, name: string) => void;
  onGoToTools: () => void;
  onShowUrgency: () => void;
}

export function DashboardPage({
  metrics,
  health,
  actionRunning,
  onRefresh,
  onQuickAction,
  onGoToTools,
  onShowUrgency,
}: DashboardPageProps) {
  const statusColor = health?.status === 'online' || health?.status === 'healthy'
    ? '#00c853' : health?.status === 'warning' ? '#ffc107' : '#ef4444';

  return (
    <div className="page dashboard-page">
      <div className="page-header">
        <h1>Tableau de bord</h1>
        <button className="refresh-btn" onClick={onRefresh}>Actualiser</button>
      </div>

      {/* Health Score */}
      <div className="score-card" style={{ borderColor: statusColor }}>
        <div className="score" style={{ borderColor: statusColor }}>
          <span className="score-value" style={{ color: statusColor }}>{health?.score || 0}</span>
          <span className="score-label">/ 100</span>
        </div>
        <div className="score-info">
          <h2>Sante Systeme</h2>
          {(health?.issues?.length ?? 0) > 0 ? (
            <ul className="issues">{health?.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>
          ) : (
            <p className="ok">Tout fonctionne correctement</p>
          )}
        </div>
      </div>

      {/* Metrics */}
      <section className="metrics-section">
        <h3>Ressources Systeme</h3>
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-label">Processeur</span>
              <span className="metric-value">{metrics?.cpu_usage.toFixed(1)}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress" style={{
                width: `${metrics?.cpu_usage}%`,
                background: (metrics?.cpu_usage ?? 0) > 80 ? '#ef4444' : '#10b981'
              }}></div>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-label">Memoire RAM</span>
              <span className="metric-value">{metrics?.memory_percent.toFixed(1)}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress" style={{
                width: `${metrics?.memory_percent}%`,
                background: (metrics?.memory_percent ?? 0) > 85 ? '#ef4444' : '#3b82f6'
              }}></div>
            </div>
          </div>
          {metrics?.disks.slice(0, 2).map((disk, i) => (
            <div className="metric-card" key={i}>
              <div className="metric-header">
                <span className="metric-label">Disque {disk.mount_point}</span>
                <span className="metric-value">{disk.percent.toFixed(1)}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress" style={{
                  width: `${disk.percent}%`,
                  background: disk.percent > 90 ? '#ef4444' : '#8b5cf6'
                }}></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="actions-section">
        <h3>Actions Rapides</h3>
        <div className="action-grid">
          <button
            className={`action-btn ${actionRunning === 'cleanup' ? 'running' : ''}`}
            onClick={() => onQuickAction('cleanup', 'Nettoyage')}
            disabled={!!actionRunning}
          >
            {actionRunning === 'cleanup' ? 'En cours...' : 'Nettoyage'}
          </button>
          <button
            className={`action-btn ${actionRunning === 'fix_network' ? 'running' : ''}`}
            onClick={() => onQuickAction('fix_network', 'Reseau')}
            disabled={!!actionRunning}
          >
            {actionRunning === 'fix_network' ? 'En cours...' : 'Reparer Reseau'}
          </button>
          <button
            className={`action-btn ${actionRunning === 'fix_printer' ? 'running' : ''}`}
            onClick={() => onQuickAction('fix_printer', 'Imprimante')}
            disabled={!!actionRunning}
          >
            {actionRunning === 'fix_printer' ? 'En cours...' : 'Reparer Imprimante'}
          </button>
          <button className="action-btn tools-btn" onClick={onGoToTools}>
            Boite a Outils
          </button>
        </div>
      </section>

      {/* Emergency */}
      <section className="emergency-section">
        <div className="emergency-card">
          <span className="emergency-icon">SOS</span>
          <div className="emergency-text">
            <h4>Besoin d'aide urgente ?</h4>
            <p>Un technicien vous rappelle dans les 5 minutes</p>
          </div>
          <button className="emergency-btn" onClick={onShowUrgency}>
            J'appelle un expert
          </button>
        </div>
      </section>
    </div>
  );
}
