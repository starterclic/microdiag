// ============================================
// MICRODIAG SENTINEL - Settings Page
// ============================================

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SystemMetrics, SecurityStatus } from '../types';
import { APP_VERSION } from '../constants';

interface RustDeskResult {
  success: boolean;
  message: string;
  rustdesk_id: string | null;
}

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
  const [rustdeskLoading, setRustdeskLoading] = useState(false);
  const [rustdeskId, setRustdeskId] = useState<string | null>(null);
  const [rustdeskError, setRustdeskError] = useState<string | null>(null);

  const handleInstallRustdesk = async () => {
    setRustdeskLoading(true);
    setRustdeskError(null);
    try {
      const result = await invoke<RustDeskResult>('gm_install_rustdesk');
      if (result.success) {
        setRustdeskId(result.rustdesk_id);
      } else {
        setRustdeskError(result.message);
      }
    } catch (err) {
      setRustdeskError(String(err));
    } finally {
      setRustdeskLoading(false);
    }
  };

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
          <h3>Support a distance</h3>
          <p style={{ color: '#888', marginBottom: '12px', fontSize: '13px' }}>
            Permettez a un technicien Microdiag de vous aider a distance.
          </p>
          {rustdeskId ? (
            <div style={{ background: '#1a2e1a', border: '1px solid #22c55e', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <p style={{ color: '#22c55e', fontWeight: 600, marginBottom: '8px' }}>Support pret</p>
              <p style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '2px', color: '#fff' }}>{rustdeskId}</p>
              <p style={{ color: '#888', fontSize: '12px', marginTop: '8px' }}>Communiquez cet ID au support</p>
            </div>
          ) : (
            <div className="update-actions">
              <button
                className={`update-btn ${rustdeskLoading ? 'checking' : ''}`}
                onClick={handleInstallRustdesk}
                disabled={rustdeskLoading}
                style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
              >
                {rustdeskLoading ? 'Installation...' : 'Activer le support a distance'}
              </button>
              {rustdeskError && (
                <p style={{ color: '#ef4444', marginTop: '8px', fontSize: '13px' }}>{rustdeskError}</p>
              )}
            </div>
          )}
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
