// ============================================
// MICRODIAG SENTINEL - Scan Page Premium v2
// Affichage en colonnes, vulgarise et rassurant
// ============================================

import { useState } from 'react';
import { ScanReport, ScanSection } from '../types';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants';

const SCAN_STEPS = [
  { icon: '📋', label: 'Journaux systeme' },
  { icon: '💥', label: 'Ecrans bleus' },
  { icon: '🛡️', label: 'Protection antivirus' },
  { icon: '📦', label: 'Applications' },
  { icon: '🌐', label: 'Bureau distant' },
  { icon: '🔌', label: 'Ports reseau' },
  { icon: '🚀', label: 'Demarrage' },
  { icon: '🔄', label: 'Mises a jour' },
  { icon: '💾', label: 'Espace disque' },
  { icon: '📊', label: 'Generation rapport' },
];

// Categories thematiques pour le rapport
const THEMES: Record<string, { title: string; icon: string; color: string; description: string }> = {
  security: {
    title: 'Securite',
    icon: '🛡️',
    color: '#ef4444',
    description: 'Protection contre les menaces'
  },
  performance: {
    title: 'Performances',
    icon: '⚡',
    color: '#3b82f6',
    description: 'Vitesse et reactivite'
  },
  maintenance: {
    title: 'Entretien',
    icon: '🔧',
    color: '#10b981',
    description: 'Sante generale du systeme'
  },
  info: {
    title: 'Informations',
    icon: '📊',
    color: '#8b5cf6',
    description: 'Details techniques'
  }
};

// Mapping des sections vers les themes
const SECTION_THEMES: Record<string, string> = {
  shield: 'security',
  rdp: 'security',
  network: 'security',
  browser: 'security',
  bsod: 'performance',
  startup: 'performance',
  disk: 'maintenance',
  update: 'maintenance',
  apps: 'maintenance',
  logs: 'info'
};

// Titres vulgarises
const SECTION_TITLES: Record<string, string> = {
  shield: 'Antivirus et Protection',
  rdp: 'Acces a distance',
  network: 'Securite reseau',
  browser: 'Extensions navigateur',
  bsod: 'Stabilite systeme',
  startup: 'Demarrage rapide',
  disk: 'Espace de stockage',
  update: 'Mises a jour Windows',
  apps: 'Applications installees',
  logs: 'Journal systeme'
};

// Messages rassurants par status
const STATUS_MESSAGES: Record<string, { label: string; message: string }> = {
  ok: { label: 'Tout va bien', message: 'Aucun probleme detecte' },
  warning: { label: 'A surveiller', message: 'Quelques points meritent attention' },
  critical: { label: 'Action requise', message: 'Necessite votre attention' },
  info: { label: 'Information', message: 'Detail technique' }
};

interface ScanPageProps {
  scanRunning: boolean;
  scanStep: number;
  scanProgress: number;
  scanReport: ScanReport | null;
  scanError: string | null;
  onRunScan: () => void;
}

export function ScanPage({
  scanRunning,
  scanStep,
  scanProgress,
  scanReport,
  scanError,
  onRunScan,
}: ScanPageProps) {
  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  const toggleSection = (index: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSections(newExpanded);
  };

  // Grouper les sections par theme
  const groupSectionsByTheme = (sections: ScanSection[]) => {
    const grouped: Record<string, ScanSection[]> = {
      security: [],
      performance: [],
      maintenance: [],
      info: []
    };
    sections.forEach(section => {
      const theme = SECTION_THEMES[section.icon] || 'info';
      grouped[theme].push(section);
    });
    return grouped;
  };

  const getAiRecommendations = async () => {
    if (!scanReport) return;
    setAiLoading(true);
    setAiRecommendation(null);

    const problemSections = scanReport.sections
      .filter(s => s.status === 'critical' || s.status === 'warning')
      .map(s => `${s.title}: ${s.items.summary}. ${s.explanation}`)
      .join('. ');

    const prompt = `Tu es un assistant informatique bienveillant. Analyse ce rapport de securite PC et donne des conseils simples, rassurants et actionables en francais. Score: ${scanReport.score}/100. Problemes: ${problemSections || 'Aucun probleme majeur'}. Commence par rassurer l'utilisateur, puis donne 2-3 conseils pratiques. Maximum 4 phrases.`;

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ message: prompt, device_id: 'scan-report' }),
      });
      const data = await response.json();
      setAiRecommendation(data.response || data.error || 'Impossible de generer des recommandations.');
    } catch {
      setAiRecommendation('Connexion impossible. Verifiez votre connexion internet.');
    } finally {
      setAiLoading(false);
    }
  };

  const exportPDF = () => {
    if (!scanReport) return;
    const groupedSections = groupSectionsByTheme(scanReport.sections);

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Rapport de Securite - ${scanReport.hostname}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; padding: 40px; background: #fff; }
          .header { text-align: center; margin-bottom: 40px; padding-bottom: 30px; border-bottom: 3px solid #ff6b00; }
          .logo { font-size: 28px; font-weight: 700; color: #ff6b00; margin-bottom: 5px; }
          .title { font-size: 24px; color: #333; margin-bottom: 15px; }
          .info { color: #666; font-size: 14px; }
          .score-section { display: flex; align-items: center; gap: 30px; background: linear-gradient(135deg, #f8f9fa 0%, #fff 100%); padding: 30px; border-radius: 16px; margin-bottom: 30px; border: 2px solid ${scanReport.status === 'critical' ? '#ef4444' : scanReport.status === 'warning' ? '#ffc107' : '#00c853'}; }
          .score-circle { width: 120px; height: 120px; border-radius: 50%; border: 8px solid ${scanReport.status === 'critical' ? '#ef4444' : scanReport.status === 'warning' ? '#ffc107' : '#00c853'}; display: flex; align-items: center; justify-content: center; flex-direction: column; }
          .score-value { font-size: 42px; font-weight: 700; color: ${scanReport.status === 'critical' ? '#ef4444' : scanReport.status === 'warning' ? '#ffc107' : '#00c853'}; }
          .score-label { font-size: 12px; color: #666; }
          .score-info h2 { font-size: 20px; margin-bottom: 10px; }
          .theme-section { margin-bottom: 30px; }
          .theme-title { font-size: 18px; font-weight: 600; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #eee; }
          .section { margin-bottom: 15px; padding: 15px; border-radius: 10px; background: #fafafa; border-left: 4px solid #ddd; }
          .section.ok { border-left-color: #00c853; }
          .section.warning { border-left-color: #ffc107; }
          .section.critical { border-left-color: #ef4444; }
          .section-title { font-weight: 600; margin-bottom: 5px; }
          .section-summary { color: #555; font-size: 14px; margin-bottom: 8px; }
          .section-action { color: #ff6b00; font-size: 13px; font-weight: 500; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #eee; text-align: center; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">MICRODIAG SENTINEL</div>
          <div class="title">Rapport de Sante de votre PC</div>
          <div class="info">${scanReport.hostname} | ${scanReport.osVersion} | ${scanReport.timestamp}</div>
        </div>

        <div class="score-section">
          <div class="score-circle">
            <div class="score-value">${scanReport.score}</div>
            <div class="score-label">/100</div>
          </div>
          <div class="score-info">
            <h2>${scanReport.message}</h2>
            <p>${scanReport.advice}</p>
          </div>
        </div>

        ${Object.entries(groupedSections).filter(([, sections]) => sections.length > 0).map(([theme, sections]) => `
          <div class="theme-section">
            <div class="theme-title">${THEMES[theme].icon} ${THEMES[theme].title}</div>
            ${sections.map(section => `
              <div class="section ${section.status}">
                <div class="section-title">${SECTION_TITLES[section.icon] || section.title}</div>
                <div class="section-summary">${section.items.summary}</div>
                ${section.action ? `<div class="section-action">💡 ${section.action}</div>` : ''}
              </div>
            `).join('')}
          </div>
        `).join('')}

        <div class="footer">
          <p>Rapport genere par Microdiag Sentinel | ${new Date().toLocaleDateString('fr-FR')}</p>
          <p style="margin-top: 8px;">Pour une expertise approfondie, contactez nos techniciens.</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  // Calculer le verdict global
  const getVerdict = () => {
    if (!scanReport) return null;
    if (scanReport.score >= 80) {
      return { emoji: '✅', title: 'Excellent !', subtitle: 'Votre PC est en pleine forme', color: 'success' };
    } else if (scanReport.score >= 60) {
      return { emoji: '👍', title: 'Correct', subtitle: 'Quelques points a ameliorer', color: 'warning' };
    } else if (scanReport.score >= 40) {
      return { emoji: '⚠️', title: 'A surveiller', subtitle: 'Plusieurs elements necessitent attention', color: 'warning' };
    }
    return { emoji: '🔴', title: 'Attention requise', subtitle: 'Des actions sont necessaires', color: 'critical' };
  };

  const groupedSections = scanReport ? groupSectionsByTheme(scanReport.sections) : null;
  const verdict = getVerdict();

  return (
    <div className="page scan-page">
      <div className="page-header">
        <div>
          <h1>Bilan de Sante</h1>
          <p className="page-subtitle">Diagnostic complet de votre PC</p>
        </div>
        {scanReport && !scanRunning && (
          <div className="header-actions">
            <button className="btn-secondary" onClick={onRunScan}>
              🔄 Relancer
            </button>
            <button className="btn-export" onClick={exportPDF}>
              📄 Exporter PDF
            </button>
          </div>
        )}
      </div>

      {/* Scan Loader */}
      {scanRunning && (
        <div className="scan-loader">
          <div className="scan-loader-container">
            <div className="scan-radar">
              <div className="radar-sweep"></div>
              <div className="radar-center">
                <span className="radar-icon">{SCAN_STEPS[scanStep]?.icon || '🔍'}</span>
              </div>
            </div>

            <h2 className="scan-loader-title">Analyse en cours...</h2>
            <p className="scan-loader-step">{SCAN_STEPS[scanStep]?.label || 'Finalisation...'}</p>

            <div className="scan-progress-container">
              <div className="scan-progress-bar">
                <div className="scan-progress-fill" style={{ width: `${scanProgress}%` }}></div>
              </div>
              <span className="scan-progress-text">{scanProgress}%</span>
            </div>

            <div className="scan-steps-grid">
              {SCAN_STEPS.map((step, i) => (
                <div key={i} className={`scan-step-chip ${i < scanStep ? 'done' : i === scanStep ? 'active' : ''}`}>
                  <span className="step-icon">{i < scanStep ? '✓' : step.icon}</span>
                  <span className="step-label">{step.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {scanError && !scanRunning && (
        <div className="scan-error">
          <div className="scan-error-icon">⚠️</div>
          <h2>Oups, une erreur s'est produite</h2>
          <p className="error-details">{scanError}</p>
          <button className="scan-start-btn" onClick={onRunScan}>
            Reessayer l'analyse
          </button>
        </div>
      )}

      {/* No Report Yet */}
      {!scanRunning && !scanReport && !scanError && (
        <div className="scan-empty">
          <div className="scan-empty-icon">🔍</div>
          <h2>Faites le check-up de votre PC</h2>
          <p>Notre analyse intelligente examine 10 points essentiels de votre ordinateur et vous donne des conseils personnalises.</p>
          <div className="scan-features-grid">
            <div className="feature-card">
              <span className="feature-icon">🛡️</span>
              <span className="feature-label">Securite</span>
              <span className="feature-desc">Antivirus, reseau</span>
            </div>
            <div className="feature-card">
              <span className="feature-icon">⚡</span>
              <span className="feature-label">Performance</span>
              <span className="feature-desc">Demarrage, stabilite</span>
            </div>
            <div className="feature-card">
              <span className="feature-icon">🔧</span>
              <span className="feature-label">Entretien</span>
              <span className="feature-desc">Disque, mises a jour</span>
            </div>
          </div>
          <button className="scan-start-btn" onClick={onRunScan}>
            🚀 Lancer le diagnostic
          </button>
        </div>
      )}

      {/* Scan Report - Nouvelle mise en page */}
      {!scanRunning && scanReport && verdict && groupedSections && (
        <div className="scan-report-v2">
          {/* Score Card - Pleine largeur */}
          <div className={`verdict-card ${verdict.color}`}>
            <div className="verdict-emoji">{verdict.emoji}</div>
            <div className="verdict-score">
              <span className="score-number">{scanReport.score}</span>
              <span className="score-label">/100</span>
            </div>
            <div className="verdict-text">
              <h2>{verdict.title}</h2>
              <p>{verdict.subtitle}</p>
            </div>
            <div className="verdict-summary">
              {scanReport.summary.critical > 0 && (
                <span className="badge critical">🔴 {scanReport.summary.critical} critique(s)</span>
              )}
              {scanReport.summary.warning > 0 && (
                <span className="badge warning">🟡 {scanReport.summary.warning} attention(s)</span>
              )}
              <span className="badge ok">🟢 {scanReport.summary.ok} OK</span>
            </div>
          </div>

          {/* AI Recommendations */}
          <div className="ai-card">
            <div className="ai-header">
              <span className="ai-icon">🤖</span>
              <h3>Conseils personnalises</h3>
            </div>
            {!aiRecommendation && !aiLoading && (
              <div className="ai-empty">
                <p>Notre assistant peut analyser votre rapport et vous donner des conseils adaptes.</p>
                <button className="ai-btn" onClick={getAiRecommendations}>
                  ✨ Obtenir des conseils
                </button>
              </div>
            )}
            {aiLoading && (
              <div className="ai-loading">
                <div className="spinner-small"></div>
                <span>Analyse en cours...</span>
              </div>
            )}
            {aiRecommendation && (
              <div className="ai-result">
                <p>{aiRecommendation}</p>
                <button className="ai-refresh" onClick={getAiRecommendations}>
                  🔄 Nouvelle analyse
                </button>
              </div>
            )}
          </div>

          {/* Themes Grid - 2 colonnes */}
          <div className="themes-grid">
            {Object.entries(THEMES).map(([themeKey, theme]) => {
              const themeSections = groupedSections[themeKey] || [];
              if (themeSections.length === 0) return null;

              const hasIssues = themeSections.some(s => s.status === 'critical' || s.status === 'warning');
              const allOk = themeSections.every(s => s.status === 'ok');

              return (
                <div key={themeKey} className={`theme-card ${hasIssues ? 'has-issues' : ''} ${allOk ? 'all-ok' : ''}`}>
                  <div className="theme-header" style={{ borderColor: theme.color }}>
                    <span className="theme-icon">{theme.icon}</span>
                    <div className="theme-title">
                      <h3>{theme.title}</h3>
                      <span className="theme-desc">{theme.description}</span>
                    </div>
                    <span className={`theme-status ${allOk ? 'ok' : hasIssues ? 'warning' : ''}`}>
                      {allOk ? '✓' : hasIssues ? '!' : '•'}
                    </span>
                  </div>
                  <div className="theme-sections">
                    {themeSections.map((section, i) => {
                      const sectionIndex = scanReport.sections.indexOf(section);
                      const isExpanded = expandedSections.has(sectionIndex);
                      const statusInfo = STATUS_MESSAGES[section.status] || STATUS_MESSAGES.info;

                      return (
                        <div
                          key={i}
                          className={`section-item ${section.status} ${isExpanded ? 'expanded' : ''}`}
                          onClick={() => toggleSection(sectionIndex)}
                        >
                          <div className="section-row">
                            <div className="section-main">
                              <span className="section-name">{SECTION_TITLES[section.icon] || section.title}</span>
                              <span className="section-summary-text">{section.items.summary}</span>
                            </div>
                            <div className="section-right">
                              <span className={`status-badge ${section.status}`}>
                                {section.status === 'ok' ? '✓' : section.status === 'warning' ? '!' : section.status === 'critical' ? '✗' : 'i'}
                              </span>
                              <span className="expand-icon">{isExpanded ? '−' : '+'}</span>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="section-details">
                              <div className="detail-block">
                                <strong>💬 Explication simple :</strong>
                                <p>{section.explanation}</p>
                              </div>
                              {section.action && (
                                <div className="detail-block action">
                                  <strong>💡 Notre conseil :</strong>
                                  <p>{section.action}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Help Card - si problemes critiques */}
          {scanReport.summary.critical > 0 && (
            <div className="help-card">
              <div className="help-icon">🆘</div>
              <div className="help-content">
                <h3>Besoin d'aide ?</h3>
                <p>Notre equipe peut vous aider a resoudre les problemes detectes.</p>
              </div>
              <button className="help-btn">
                Demander de l'aide
              </button>
            </div>
          )}

          {/* Footer info */}
          <div className="scan-footer">
            <span>📍 {scanReport.hostname}</span>
            <span>🖥️ {scanReport.osVersion}</span>
            <span>🕐 {scanReport.timestamp}</span>
          </div>
        </div>
      )}
    </div>
  );
}
