// ============================================
// MICRODIAG SENTINEL - Sidebar Component
// ============================================

import { Page, HealthScore } from '../types';
import { APP_VERSION } from '../constants';

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  health: HealthScore | null;
}

export function Sidebar({ currentPage, setCurrentPage, health }: SidebarProps) {
  const statusColor =
    health?.status === 'online' || health?.status === 'healthy'
      ? '#00c853'
      : health?.status === 'warning'
      ? '#ffc107'
      : '#ef4444';

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-icon">M</div>
        <span className="logo-text">Sentinel</span>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`nav-btn ${currentPage === 'dashboard' ? 'active' : ''}`}
          onClick={() => setCurrentPage('dashboard')}
        >
          <span className="nav-icon">📊</span>
          Tableau de bord
        </button>
        <button
          className={`nav-btn ${currentPage === 'tools' ? 'active' : ''}`}
          onClick={() => setCurrentPage('tools')}
        >
          <span className="nav-icon">🧰</span>
          Boîte à Outils
        </button>
        <button
          className={`nav-btn ${currentPage === 'scan' ? 'active' : ''}`}
          onClick={() => setCurrentPage('scan')}
        >
          <span className="nav-icon">🔍</span>
          Rapport Sécurité
        </button>
        <button
          className={`nav-btn ${currentPage === 'chat' ? 'active' : ''}`}
          onClick={() => setCurrentPage('chat')}
        >
          <span className="nav-icon">💬</span>
          Assistant IA
        </button>
        <button
          className={`nav-btn ${currentPage === 'settings' ? 'active' : ''}`}
          onClick={() => setCurrentPage('settings')}
        >
          <span className="nav-icon">⚙️</span>
          Paramètres
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="status-indicator" style={{ color: statusColor }}>
          ● {health?.status === 'online' || health?.status === 'healthy' ? 'Protégé' : health?.status === 'warning' ? 'Attention' : 'Critique'}
        </div>
        <div className="version">v{APP_VERSION}</div>
      </div>
    </aside>
  );
}
