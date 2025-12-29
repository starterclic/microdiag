// ============================================
// MICRODIAG SENTINEL - Sidebar Component
// Collapsible sidebar with icons
// ============================================

import { useState } from 'react';
import { Page, HealthScore } from '../types';
import { APP_VERSION } from '../constants';

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  health: HealthScore | null;
}

const NAV_ITEMS = [
  { page: 'dashboard' as Page, icon: '📊', label: 'Tableau de bord' },
  { page: 'tools' as Page, icon: '🧰', label: 'Boîte à Outils' },
  { page: 'scan' as Page, icon: '🔍', label: 'Rapport Sécurité' },
  { page: 'chat' as Page, icon: '💬', label: 'Assistant IA' },
  { page: 'settings' as Page, icon: '⚙️', label: 'Paramètres' },
];

export function Sidebar({ currentPage, setCurrentPage, health }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusColor =
    health?.status === 'online' || health?.status === 'healthy'
      ? '#00c853'
      : health?.status === 'warning'
      ? '#ffc107'
      : '#ef4444';

  const statusText =
    health?.status === 'online' || health?.status === 'healthy'
      ? 'Protégé'
      : health?.status === 'warning'
      ? 'Attention'
      : 'Critique';

  return (
    <aside
      className={`sidebar ${isExpanded ? 'expanded' : 'collapsed'}`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="sidebar-header">
        <div className="logo-icon">M</div>
        <span className="logo-text">Sentinel</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ page, icon, label }) => (
          <button
            key={page}
            className={`nav-btn ${currentPage === page ? 'active' : ''}`}
            onClick={() => setCurrentPage(page)}
            title={label}
          >
            <span className="nav-icon">{icon}</span>
            <span className="nav-label">{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="status-indicator" style={{ color: statusColor }}>
          <span className="status-dot">●</span>
          <span className="status-text">{statusText}</span>
        </div>
        <div className="version">v{APP_VERSION}</div>
      </div>
    </aside>
  );
}
