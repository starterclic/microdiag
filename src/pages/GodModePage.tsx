// ============================================
// MICRODIAG SENTINEL - GOD MODE PAGE
// Advanced System Control & Optimization
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import * as godmode from '../services/godmode';
import type {
  InstalledApp,
  StartupItem,
  DeepHealth,
  OutdatedApp,
  RegBackup,
} from '../services/godmode';

interface GodModePageProps {
  metrics: {
    cpu_usage: number;
    memory_percent: number;
    memory_total: number;
    memory_used: number;
    disks: Array<{ name: string; total_gb: number; free_gb: number; percent: number }>;
  } | null;
}

type GodModeTab = 'monitor' | 'apps' | 'startup' | 'updates' | 'privacy' | 'install';

export function GodModePage({ metrics }: GodModePageProps) {
  const [activeTab, setActiveTab] = useState<GodModeTab>('monitor');
  const [deepHealth, setDeepHealth] = useState<DeepHealth | null>(null);
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [startupItems, setStartupItems] = useState<StartupItem[]>([]);
  const [updates, setUpdates] = useState<OutdatedApp[]>([]);
  const [backups, setBackups] = useState<RegBackup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInstallApps, setSelectedInstallApps] = useState<Set<string>>(new Set());
  const [installing, setInstalling] = useState(false);
  const [tweakStates, setTweakStates] = useState<Record<string, boolean>>({});
  const [crystalDiskInstalled, setCrystalDiskInstalled] = useState<boolean | null>(null);
  const [installingCrystalDisk, setInstallingCrystalDisk] = useState(false);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [health, appList, startup] = await Promise.all([
          godmode.getDeepHealth(),
          godmode.getInstalledApps(),
          godmode.getStartupItems(),
        ]);

        console.log('🔍 MODE EXPERT - DeepHealth loaded:', health);
        console.log('📊 SMART Disks count:', health?.smart_disks?.length || 0);
        console.log('🔋 Battery present:', health?.battery?.is_present);
        console.log('🔧 Drivers count:', health?.drivers?.length || 0);

        setDeepHealth(health);
        setApps(appList);
        setStartupItems(startup);

        // Check CrystalDiskInfo if no SMART data
        const hasSmartData = health?.smart_disks?.some(d => d.temperature_c !== null || d.power_on_hours !== null);
        if (!hasSmartData) {
          const cdiStatus = await godmode.checkCrystalDiskInfo();
          setCrystalDiskInstalled(cdiStatus.installed);
        }
      } catch (e) {
        console.error('Error loading Mode Expert data:', e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Calculate health score (only if we have metrics data)
  const healthScore = metrics
    ? godmode.calculateHealthScore(
        metrics.cpu_usage,
        metrics.memory_percent,
        metrics.disks[0]?.percent ? 100 - metrics.disks[0].percent : 50,
        deepHealth
      )
    : null;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const formatBytes = (bytes: number) => {
    const gb = bytes / 1073741824;
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1048576).toFixed(0)} MB`;
  };

  // Handlers
  const handleCheckUpdates = async () => {
    toast.info('Recherche des mises a jour...');
    try {
      const result = await godmode.checkUpdates();
      setUpdates(result);
      toast.success(`${result.length} mises a jour disponibles`);
    } catch (e) {
      toast.error('Erreur: ' + e);
    }
  };

  const handleUpdateAll = async () => {
    toast.info('Mise a jour en cours...');
    try {
      const result = await godmode.updateAllApps();
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (e) {
      toast.error('Erreur: ' + e);
    }
  };

  const handleDisableStartup = async (item: StartupItem) => {
    try {
      const result = await godmode.disableStartupItem(item.name, item.location);
      if (result.success) {
        toast.success(result.message);
        setStartupItems(prev => prev.filter(i => i.name !== item.name));
      } else {
        toast.error(result.message);
      }
    } catch (e) {
      toast.error('Erreur: ' + e);
    }
  };

  const handleApplyTweak = async (tweakId: string, enable: boolean) => {
    try {
      const result = await godmode.applyTweak(tweakId, enable);
      if (result.success) {
        toast.success(result.message);
        setTweakStates(prev => ({ ...prev, [tweakId]: !enable }));
        // Refresh backups
        const newBackups = await godmode.listBackups();
        setBackups(newBackups);
      } else {
        toast.error(result.message);
      }
    } catch (e) {
      toast.error('Erreur: ' + e);
    }
  };

  const handleGhostMode = async () => {
    toast.info('Activation Ghost Mode...');
    try {
      const result = await godmode.activateGhostMode();
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (e) {
      toast.error('Erreur: ' + e);
    }
  };

  const handleBulkInstall = async () => {
    if (selectedInstallApps.size === 0) return;
    setInstalling(true);
    toast.info(`Installation de ${selectedInstallApps.size} applications...`);
    try {
      const result = await godmode.installApps(Array.from(selectedInstallApps));
      if (result.success) {
        toast.success(result.message);
        setSelectedInstallApps(new Set());
      } else {
        toast.error(result.message);
      }
    } catch (e) {
      toast.error('Erreur: ' + e);
    } finally {
      setInstalling(false);
    }
  };

  const handleRestoreBackup = async (backup: RegBackup) => {
    try {
      const result = await godmode.restoreBackup(backup.path);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (e) {
      toast.error('Erreur: ' + e);
    }
  };

  const handleInstallCrystalDiskInfo = async () => {
    setInstallingCrystalDisk(true);
    toast.info('Installation de CrystalDiskInfo via winget...');
    try {
      const result = await godmode.installCrystalDiskInfo();
      if (result.success) {
        toast.success(result.message);
        setCrystalDiskInstalled(true);
        // Reload SMART data after installation
        setTimeout(async () => {
          const health = await godmode.getDeepHealth();
          setDeepHealth(health);
        }, 3000);
      } else {
        toast.error(result.message);
      }
    } catch (e) {
      toast.error('Erreur: ' + e);
    } finally {
      setInstallingCrystalDisk(false);
    }
  };

  const toggleAppSelection = (id: string) => {
    const newSet = new Set(selectedInstallApps);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedInstallApps(newSet);
  };

  const filteredApps = apps.filter(app =>
    app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.publisher.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tabs: Array<{ id: GodModeTab; label: string; icon: string }> = [
    { id: 'monitor', label: 'Monitoring', icon: '📊' },
    { id: 'apps', label: 'Applications', icon: '📦' },
    { id: 'startup', label: 'Demarrage', icon: '🚀' },
    { id: 'updates', label: 'Mises a jour', icon: '🔄' },
    { id: 'privacy', label: 'Privacy', icon: '🛡️' },
    { id: 'install', label: 'Installateur', icon: '📥' },
  ];

  if (loading) {
    return (
      <div className="page god-mode-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Chargement Mode Expert...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page god-mode-page">
      {/* Header */}
      <div className="page-header gm-header">
        <div className="gm-title">
          <h1>MODE EXPERT</h1>
          <span className="gm-subtitle">Controle & Optimisation Systeme</span>
        </div>
        {healthScore !== null && (
          <div className="gm-score">
            <span className="score-label">Sante Systeme</span>
            <div className="score-display">
              <span className={`score-value ${getScoreColor(healthScore)}`}>{healthScore}</span>
              <span className="score-max">/100</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="gm-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`gm-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="gm-content">
        {/* MONITORING TAB */}
        {activeTab === 'monitor' && metrics && (
          <div className="gm-monitor">
            <div className="monitor-grid">
              {/* CPU */}
              <div className="monitor-card">
                <div className="card-header">
                  <span className="card-icon">💻</span>
                  <span className="card-title">CPU</span>
                </div>
                <div className="card-value">{metrics.cpu_usage.toFixed(1)}%</div>
                <div className="progress-bar">
                  <div
                    className={`progress-fill ${metrics.cpu_usage > 80 ? 'danger' : metrics.cpu_usage > 50 ? 'warning' : 'success'}`}
                    style={{ width: `${metrics.cpu_usage}%` }}
                  ></div>
                </div>
              </div>

              {/* RAM */}
              <div className="monitor-card">
                <div className="card-header">
                  <span className="card-icon">🧠</span>
                  <span className="card-title">Memoire</span>
                </div>
                <div className="card-value">{metrics.memory_percent.toFixed(1)}%</div>
                <div className="card-detail">
                  {formatBytes(metrics.memory_used * 1024)} / {formatBytes(metrics.memory_total * 1024)}
                </div>
                <div className="progress-bar">
                  <div
                    className={`progress-fill ${metrics.memory_percent > 80 ? 'danger' : metrics.memory_percent > 60 ? 'warning' : 'success'}`}
                    style={{ width: `${metrics.memory_percent}%` }}
                  ></div>
                </div>
              </div>

              {/* Disk */}
              {metrics.disks[0] && (
                <div className="monitor-card">
                  <div className="card-header">
                    <span className="card-icon">💾</span>
                    <span className="card-title">Disque</span>
                  </div>
                  <div className="card-value">{metrics.disks[0].free_gb.toFixed(1)} GB libre</div>
                  <div className="card-detail">
                    Sur {metrics.disks[0].total_gb.toFixed(0)} GB total
                  </div>
                  <div className="progress-bar">
                    <div
                      className={`progress-fill ${metrics.disks[0].percent > 90 ? 'danger' : metrics.disks[0].percent > 70 ? 'warning' : 'success'}`}
                      style={{ width: `${metrics.disks[0].percent}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Battery */}
              {deepHealth?.battery.is_present && (
                <div className="monitor-card">
                  <div className="card-header">
                    <span className="card-icon">🔋</span>
                    <span className="card-title">Batterie</span>
                  </div>
                  <div className="card-value">{deepHealth.battery.charge_percent}%</div>
                  <div className="card-detail">
                    Sante: {deepHealth.battery.health_percent}% - {deepHealth.battery.status}
                  </div>
                  <div className="progress-bar">
                    <div
                      className={`progress-fill ${deepHealth.battery.charge_percent < 20 ? 'danger' : 'success'}`}
                      style={{ width: `${deepHealth.battery.charge_percent}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {/* Deep Health Info */}
            {deepHealth && (
              <div className="deep-health-info">
                <h3>Informations Systeme</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">PC</span>
                    <span className="info-value">{deepHealth.computer_name}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">OS</span>
                    <span className="info-value">{deepHealth.windows_version}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">BIOS</span>
                    <span className="info-value">{deepHealth.bios_manufacturer} {deepHealth.bios_version}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Serial</span>
                    <span className="info-value">{deepHealth.bios_serial}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Battery Info - Only show if relevant */}
            {deepHealth?.battery && (
              <div className="dashboard-card" style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(30, 30, 50, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '2rem' }}>
                    {deepHealth.battery.is_present ? '🔋' : deepHealth.battery.status === 'PC fixe' ? '🖥️' : '🔌'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {deepHealth.battery.is_present
                        ? `Batterie: ${deepHealth.battery.charge_percent}%`
                        : deepHealth.battery.status === 'PC fixe'
                          ? 'PC de bureau (pas de batterie)'
                          : 'Batterie retirée'}
                    </div>
                    {deepHealth.battery.is_present && (
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {deepHealth.battery.status} • Santé: {deepHealth.battery.health_percent}%
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SMART Disks Details - CrystalDisk Style */}
            {deepHealth?.smart_disks && deepHealth.smart_disks.length > 0 ? (
              <div className="dashboard-card smart-card" style={{ marginTop: '1rem', background: 'rgba(30, 30, 50, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1.25rem' }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.875rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Sante des Disques</h3>
                  <span className="smart-subtitle" style={{ fontSize: '12px', background: 'rgba(255, 107, 0, 0.1)', padding: '4px 10px', borderRadius: '12px', color: '#ff6b00' }}>SMART Diagnostic</span>
                </div>
                <div className="smart-disks-list">
                  {deepHealth.smart_disks.map((disk, i) => (
                    <div key={i} className="smart-disk-item">
                      <div className="smart-disk-header">
                        <div className="disk-icon">
                          {disk.media_type === 'SSD' || disk.media_type === 'NVMe' ? '⚡' : '💿'}
                        </div>
                        <div className="disk-info">
                          <span className="disk-model">{disk.model}</span>
                          <span className="disk-meta">
                            {disk.media_type} • {disk.size_gb.toFixed(0)} GB • {disk.interface_type}
                          </span>
                        </div>
                        <div className={`disk-health-badge ${disk.health_status === 'Bon' ? 'good' : disk.health_status === 'Attention' ? 'warning' : 'critical'}`}>
                          <span className="health-percent">{disk.health_percent}%</span>
                          <span className="health-label">{disk.health_status}</span>
                        </div>
                      </div>
                      <div className="smart-attributes">
                        {disk.temperature_c && (
                          <div className="smart-attr">
                            <span className="attr-icon">🌡️</span>
                            <span className="attr-label">Temp</span>
                            <span className="attr-value">{disk.temperature_c}°C</span>
                          </div>
                        )}
                        {disk.power_on_hours && (
                          <div className="smart-attr">
                            <span className="attr-icon">⏱️</span>
                            <span className="attr-label">Heures</span>
                            <span className="attr-value">{disk.power_on_hours.toLocaleString()}h</span>
                          </div>
                        )}
                        {disk.power_on_count && (
                          <div className="smart-attr">
                            <span className="attr-icon">🔄</span>
                            <span className="attr-label">Cycles</span>
                            <span className="attr-value">{disk.power_on_count}</span>
                          </div>
                        )}
                        {disk.reallocated_sectors !== null && disk.reallocated_sectors !== undefined && (
                          <div className={`smart-attr ${disk.reallocated_sectors > 0 ? 'warning' : ''}`}>
                            <span className="attr-icon">⚠️</span>
                            <span className="attr-label">Secteurs</span>
                            <span className="attr-value">{disk.reallocated_sectors}</span>
                          </div>
                        )}
                      </div>
                      <div className="disk-health-bar">
                        <div
                          className="health-fill"
                          style={{
                            width: `${disk.health_percent}%`,
                            background: disk.health_percent >= 80 ? '#10b981' :
                                       disk.health_percent >= 50 ? '#f59e0b' : '#ef4444'
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : deepHealth && (
              <div style={{ padding: '1.5rem', background: 'rgba(255, 107, 0, 0.08)', borderRadius: '12px', marginTop: '1rem', textAlign: 'center', border: '1px solid rgba(255, 107, 0, 0.2)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💿</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem' }}>Donnees SMART non disponibles</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
                  Les disques NVMe necessitent CrystalDiskInfo pour lire les donnees SMART detaillees
                  (temperature, heures d'utilisation, sante).
                </div>
                {crystalDiskInstalled === false && (
                  <button
                    onClick={handleInstallCrystalDiskInfo}
                    disabled={installingCrystalDisk}
                    style={{
                      background: 'linear-gradient(135deg, #ff6b00 0%, #ff8c00 100%)',
                      color: 'white',
                      border: 'none',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '8px',
                      cursor: installingCrystalDisk ? 'wait' : 'pointer',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      opacity: installingCrystalDisk ? 0.7 : 1,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {installingCrystalDisk ? (
                      <>⏳ Installation en cours...</>
                    ) : (
                      <>📥 Installer CrystalDiskInfo (gratuit)</>
                    )}
                  </button>
                )}
                {crystalDiskInstalled === true && (
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: '#10b981',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    display: 'inline-block'
                  }}>
                    ✓ CrystalDiskInfo installe - Redemarrez l'app
                  </div>
                )}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                  Logiciel open source MIT - Installation silencieuse via winget
                </div>
              </div>
            )}

            {/* Drivers Info */}
            {deepHealth?.drivers && deepHealth.drivers.length > 0 && (
              <div className="deep-health-info" style={{ marginTop: '1rem' }}>
                <h3>Pilotes (Drivers)</h3>
                <div className="info-grid" style={{ gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                  {deepHealth.drivers.map((driver, i) => (
                    <div key={i} className="driver-item" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '0.75rem 1rem',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}>
                      <span style={{ fontSize: '1.5rem' }}>
                        {driver.driver_type === 'GPU' ? '🎮' :
                         driver.driver_type === 'Network' ? '🌐' :
                         driver.driver_type === 'Chipset' ? '🔧' :
                         driver.driver_type === 'Audio' ? '🔊' : '⚙️'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                          {driver.name}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          {driver.manufacturer} • v{driver.version}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          background: driver.status === 'OK' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: driver.status === 'OK' ? '#10b981' : '#ef4444',
                          marginBottom: '0.25rem'
                        }}>
                          {driver.status}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {driver.driver_date}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* APPLICATIONS TAB */}
        {activeTab === 'apps' && (
          <div className="gm-apps">
            <div className="apps-header">
              <div className="apps-count">{apps.length} applications installees</div>
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="apps-search"
              />
            </div>
            <div className="apps-list">
              <table>
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Version</th>
                    <th>Editeur</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApps.slice(0, 100).map((app, i) => (
                    <tr key={i}>
                      <td className="app-name">{app.name}</td>
                      <td className="app-version">{app.version || '-'}</td>
                      <td className="app-publisher">{app.publisher || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredApps.length > 100 && (
                <div className="apps-more">
                  Et {filteredApps.length - 100} autres...
                </div>
              )}
            </div>
          </div>
        )}

        {/* STARTUP TAB */}
        {activeTab === 'startup' && (
          <div className="gm-startup">
            <div className="startup-header">
              <h3>Programmes au Demarrage</h3>
              <span className="startup-count">{startupItems.length} elements</span>
            </div>
            <div className="startup-list">
              {startupItems.map((item, i) => (
                <div key={i} className="startup-item">
                  <div className="startup-info">
                    <div className="startup-name">{item.name}</div>
                    <div className="startup-location">{item.location}</div>
                    <div className="startup-command">{item.command}</div>
                  </div>
                  <button
                    className="btn-danger-small"
                    onClick={() => handleDisableStartup(item)}
                  >
                    Desactiver
                  </button>
                </div>
              ))}
              {startupItems.length === 0 && (
                <div className="empty-state">Aucun programme au demarrage</div>
              )}
            </div>
          </div>
        )}

        {/* UPDATES TAB */}
        {activeTab === 'updates' && (
          <div className="gm-updates">
            <div className="updates-header">
              <h3>Mises a jour Logicielles (Winget)</h3>
              <div className="updates-actions">
                <button className="btn-secondary" onClick={handleCheckUpdates}>
                  🔍 Rechercher
                </button>
                <button
                  className="btn-primary"
                  onClick={handleUpdateAll}
                  disabled={updates.length === 0}
                >
                  🔄 Tout Mettre a Jour
                </button>
              </div>
            </div>
            <div className="updates-list">
              {updates.length === 0 ? (
                <div className="empty-state">
                  Cliquez sur "Rechercher" pour verifier les mises a jour
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Application</th>
                      <th>Version Actuelle</th>
                      <th>Nouvelle Version</th>
                    </tr>
                  </thead>
                  <tbody>
                    {updates.map((app, i) => (
                      <tr key={i}>
                        <td>{app.name}</td>
                        <td>{app.current_version}</td>
                        <td className="text-green">{app.available_version}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* PRIVACY TAB */}
        {activeTab === 'privacy' && (
          <div className="gm-privacy">
            <div className="privacy-header">
              <h3>Tweaks Privacy & Performance</h3>
              <button className="btn-danger" onClick={handleGhostMode}>
                👻 Ghost Mode
              </button>
            </div>

            <div className="tweaks-grid">
              {godmode.PRIVACY_TWEAKS.map(tweak => (
                <div key={tweak.id} className="tweak-card">
                  <div className="tweak-info">
                    <div className="tweak-name">{tweak.name}</div>
                    <div className="tweak-desc">{tweak.description}</div>
                    <div className={`tweak-risk risk-${tweak.risk}`}>
                      Risque: {tweak.risk}
                    </div>
                  </div>
                  <button
                    className={`tweak-toggle ${tweakStates[tweak.id] ? 'active' : ''}`}
                    onClick={() => handleApplyTweak(tweak.id, tweakStates[tweak.id] || false)}
                  >
                    {tweakStates[tweak.id] ? 'Reactiver' : 'Desactiver'}
                  </button>
                </div>
              ))}
            </div>

            {/* Backups */}
            <div className="backups-section">
              <h4>Sauvegardes Registre</h4>
              <div className="backups-list">
                {backups.length === 0 ? (
                  <div className="empty-state">Aucune sauvegarde</div>
                ) : (
                  backups.slice(0, 10).map((backup, i) => (
                    <div key={i} className="backup-item">
                      <div className="backup-info">
                        <div className="backup-name">{backup.name}</div>
                        <div className="backup-date">{backup.created_at}</div>
                      </div>
                      <button
                        className="btn-secondary-small"
                        onClick={() => handleRestoreBackup(backup)}
                      >
                        Restaurer
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* INSTALL TAB */}
        {activeTab === 'install' && (
          <div className="gm-install">
            <div className="install-header">
              <div>
                <h3>Installateur Rapide (Winget)</h3>
                <p className="install-subtitle">
                  Selectionnez les applications a installer en un clic
                </p>
              </div>
              <button
                className="btn-primary btn-large"
                onClick={handleBulkInstall}
                disabled={selectedInstallApps.size === 0 || installing}
              >
                {installing ? (
                  <>⏳ Installation...</>
                ) : (
                  <>📥 Installer ({selectedInstallApps.size})</>
                )}
              </button>
            </div>

            <div className="install-categories">
              {Object.entries(godmode.RECOMMENDED_APPS).map(([category, appList]) => (
                <div key={category} className="install-category">
                  <h4>{category}</h4>
                  <div className="install-apps">
                    {appList.map(app => {
                      const isSelected = selectedInstallApps.has(app.id);
                      return (
                        <div
                          key={app.id}
                          className={`install-app ${isSelected ? 'selected' : ''}`}
                          onClick={() => !installing && toggleAppSelection(app.id)}
                        >
                          <div className="install-checkbox">
                            {isSelected ? '✓' : ''}
                          </div>
                          <div className="install-app-info">
                            <div className="install-app-name">{app.name}</div>
                            <div className="install-app-desc">{app.desc}</div>
                          </div>
                        </div>
                      );
                    })}
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
