// ============================================
// MICRODIAG SENTINEL - Settings Page
// ============================================

import { SystemMetrics, SecurityStatus } from '../types';
import { APP_VERSION } from '../constants';

interface SettingsPageProps {
  metrics: SystemMetrics | null;
  security: SecurityStatus | null;
  deviceToken: string;
  updateChecking: boolean;
  onCheckUpdates: () => void;
  onRestartTutorial?: () => void;
}

export function SettingsPage({
  metrics,
  security,
  deviceToken,
  updateChecking,
  onCheckUpdates,
  onRestartTutorial,
}: SettingsPageProps) {
  return (
    <div className="page settings-page">
      <div className="page-header">
        <h1>Parametres</h1>
      </div>
      <div className="settings-container">
        <section className="setting-group">
          <h3>Securite</h3>
          <div className="security-grid">
            <div className={`security-item ${security?.antivirus_enabled ? 'ok' : 'alert'}`}>
              <span className="security-icon">{security?.antivirus_enabled ? 'OK' : 'X'}</span>
              <span>Antivirus</span>
            </div>
            <div className={`security-item ${security?.realtime_protection ? 'ok' : 'alert'}`}>
              <span className="security-icon">{security?.realtime_protection ? 'OK' : 'X'}</span>
              <span>Protection temps reel</span>
            </div>
            <div className={`security-item ${security?.firewall_enabled ? 'ok' : 'alert'}`}>
              <span className="security-icon">{security?.firewall_enabled ? 'OK' : 'X'}</span>
              <span>Pare-feu</span>
            </div>
          </div>
        </section>

        <section className="setting-group">
          <h3>Appareil</h3>
          <div className="setting-item">
            <label>Nom</label>
            <input type="text" value={metrics?.hostname || ''} readOnly />
          </div>
          <div className="setting-item">
            <label>Systeme</label>
            <input type="text" value={`Windows ${metrics?.os_version}`} readOnly />
          </div>
        </section>

        <section className="setting-group">
          <h3>Connexion</h3>
          <div className="setting-item">
            <label>Statut</label>
            <span className="status-badge online">Connecte</span>
          </div>
          <div className="setting-item">
            <label>Identifiant</label>
            <input type="text" value={deviceToken.slice(0, 20) + '...'} readOnly />
          </div>
        </section>

        <section className="setting-group">
          <h3>Mises a jour</h3>
          <div className="setting-item">
            <label>Version actuelle</label>
            <span className="version-badge">v{APP_VERSION}</span>
          </div>
          <div className="update-actions">
            <button
              className={`update-btn ${updateChecking ? 'checking' : ''}`}
              onClick={onCheckUpdates}
              disabled={updateChecking}
            >
              {updateChecking ? 'Verification...' : 'Verifier les mises a jour'}
            </button>
          </div>
        </section>

        <section className="setting-group">
          <h3>Aide</h3>
          <div className="update-actions">
            <button
              className="update-btn"
              onClick={onRestartTutorial}
              style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
            >
              Revoir le tutoriel
            </button>
          </div>
        </section>

        <section className="setting-group">
          <h3>A propos</h3>
          <p><strong>Microdiag Sentinel</strong> v{APP_VERSION}</p>
          <p>Surveillance intelligente de votre PC</p>
          <p className="muted">2025 Microdiag Solutions</p>
        </section>
      </div>
    </div>
  );
}
