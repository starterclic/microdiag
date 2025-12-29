// ============================================
// MICRODIAG SENTINEL - Scan Page Premium
// ============================================

import { useState } from 'react';
import { ScanReport } from '../types';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants';

const SCAN_STEPS = [
  { icon: '!', label: 'Journaux systeme' },
  { icon: 'X', label: 'Ecrans bleus' },
  { icon: 'S', label: 'Protection antivirus' },
  { icon: 'A', label: 'Applications' },
  { icon: 'D', label: 'Bureau distant' },
  { icon: 'P', label: 'Ports reseau' },
  { icon: 'C', label: 'Extensions Chrome' },
  { icon: 'S', label: 'Demarrage' },
  { icon: 'D', label: 'Espace disque' },
  { icon: 'U', label: 'Mises a jour' },
];

const SECTION_ICONS: Record<string, string> = {
  logs: '!',
  bsod: 'X',
  shield: 'S',
  apps: 'A',
  rdp: 'D',
  network: 'P',
  browser: 'C',
  startup: 'S',
  disk: 'D',
  update: 'U',
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

  const getAiRecommendations = async () => {
    if (!scanReport) return;
    setAiLoading(true);
    setAiRecommendation(null);

    const problemSections = scanReport.sections
      .filter(s => s.status === 'critical' || s.status === 'warning')
      .map(s => `${s.title}: ${s.items.summary}. ${s.explanation}`)
      .join('. ');

    const prompt = `Analyse ce rapport de securite PC et donne des recommandations claires et rassurantes en francais. Score: ${scanReport.score}/100. Problemes: ${problemSections || 'Aucun probleme majeur'}. Reponds en 3-4 phrases maximum avec des conseils concrets.`;

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
          .score-message { font-size: 16px; color: #333; margin-bottom: 8px; }
          .score-advice { font-size: 14px; color: #666; font-style: italic; }
          .summary-badges { display: flex; gap: 15px; margin-top: 15px; }
          .badge { padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; }
          .badge.critical { background: #fef2f2; color: #ef4444; }
          .badge.warning { background: #fffbeb; color: #d97706; }
          .badge.ok { background: #f0fdf4; color: #16a34a; }
          .section { margin-bottom: 20px; padding: 20px; border-radius: 12px; background: #fafafa; border-left: 4px solid #ddd; page-break-inside: avoid; }
          .section.ok { border-left-color: #00c853; }
          .section.warning { border-left-color: #ffc107; }
          .section.critical { border-left-color: #ef4444; }
          .section.info { border-left-color: #3b82f6; }
          .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
          .section-icon { width: 36px; height: 36px; border-radius: 50%; background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-weight: 600; }
          .section-title { flex: 1; font-size: 16px; font-weight: 600; }
          .section-badge { padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
          .section-badge.ok { background: #dcfce7; color: #16a34a; }
          .section-badge.warning { background: #fef3c7; color: #d97706; }
          .section-badge.critical { background: #fef2f2; color: #dc2626; }
          .section-badge.info { background: #dbeafe; color: #2563eb; }
          .section-summary { font-size: 14px; color: #333; margin-bottom: 10px; font-weight: 500; }
          .section-explanation { font-size: 13px; color: #555; line-height: 1.6; margin-bottom: 10px; padding: 12px; background: #fff; border-radius: 8px; }
          .section-action { font-size: 13px; color: #ff6b00; font-weight: 500; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #eee; text-align: center; color: #888; font-size: 12px; }
          .ai-section { margin: 30px 0; padding: 25px; background: linear-gradient(135deg, #fff7ed 0%, #fff 100%); border-radius: 16px; border: 2px solid #ff6b00; }
          .ai-title { font-size: 16px; font-weight: 600; color: #ff6b00; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
          .ai-content { font-size: 14px; color: #333; line-height: 1.7; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">MICRODIAG SENTINEL</div>
          <div class="title">Rapport de Securite Informatique</div>
          <div class="info">${scanReport.hostname} | ${scanReport.osVersion} | ${scanReport.timestamp}</div>
        </div>

        <div class="score-section">
          <div class="score-circle">
            <div class="score-value">${scanReport.score}</div>
            <div class="score-label">/100</div>
          </div>
          <div class="score-info">
            <h2>Score de Securite Global</h2>
            <p class="score-message">${scanReport.message}</p>
            <p class="score-advice">${scanReport.advice}</p>
            <div class="summary-badges">
              <span class="badge critical">${scanReport.summary.critical} critique(s)</span>
              <span class="badge warning">${scanReport.summary.warning} attention(s)</span>
              <span class="badge ok">${scanReport.summary.ok} OK</span>
            </div>
          </div>
        </div>

        ${aiRecommendation ? `
        <div class="ai-section">
          <div class="ai-title">Recommandations de l'Assistant IA</div>
          <div class="ai-content">${aiRecommendation}</div>
        </div>
        ` : ''}

        ${scanReport.sections.map(section => `
          <div class="section ${section.status}">
            <div class="section-header">
              <div class="section-icon">${SECTION_ICONS[section.icon] || section.icon}</div>
              <div class="section-title">${section.title}</div>
              <span class="section-badge ${section.status}">${section.status === 'ok' ? 'OK' : section.status === 'warning' ? 'Attention' : section.status === 'critical' ? 'Critique' : 'Info'}</span>
            </div>
            <div class="section-summary">${section.items.summary}</div>
            <div class="section-explanation">${section.explanation}</div>
            ${section.action ? `<div class="section-action">Recommandation: ${section.action}</div>` : ''}
          </div>
        `).join('')}

        <div class="footer">
          <p>Rapport genere par Microdiag Sentinel | ${new Date().toLocaleDateString('fr-FR')} | www.microdiag.fr</p>
          <p style="margin-top: 8px;">Ce rapport est une analyse automatisee. Pour une expertise approfondie, contactez nos techniciens.</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  return (
    <div className="page scan-page">
      <div className="page-header">
        <div>
          <h1>Rapport de Securite</h1>
          <p className="page-subtitle">Analyse approfondie de votre systeme</p>
        </div>
        {scanReport && !scanRunning && (
          <div className="header-actions">
            <button className="btn-export" onClick={exportPDF}>
              Exporter PDF
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
                <span className="radar-icon">{SCAN_STEPS[scanStep]?.icon || '?'}</span>
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

            <div className="scan-steps-list">
              {SCAN_STEPS.map((step, i) => (
                <div key={i} className={`scan-step-item ${i < scanStep ? 'done' : i === scanStep ? 'active' : ''}`}>
                  <span className="step-icon">{i < scanStep ? 'OK' : step.icon}</span>
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
          <div className="scan-error-icon">!</div>
          <h2>Erreur lors du scan</h2>
          <p className="error-details">{scanError}</p>
          <button className="scan-start-btn" onClick={onRunScan}>
            Reessayer
          </button>
        </div>
      )}

      {/* No Report Yet */}
      {!scanRunning && !scanReport && !scanError && (
        <div className="scan-empty">
          <div className="scan-empty-icon">Shield</div>
          <h2>Analysez la sante de votre PC</h2>
          <p>Notre scan intelligent examine 10 points critiques de securite et vous fournit un rapport detaille avec des recommandations personnalisees.</p>
          <div className="scan-features">
            <div className="feature-item">Journaux systeme</div>
            <div className="feature-item">Protection antivirus</div>
            <div className="feature-item">Ports reseau</div>
            <div className="feature-item">Mises a jour</div>
          </div>
          <button className="scan-start-btn" onClick={onRunScan}>
            Lancer l'analyse complete
          </button>
        </div>
      )}

      {/* Scan Report */}
      {!scanRunning && scanReport && (
        <div className="scan-report">
          {/* Score Card */}
          <div className={`scan-score-card ${scanReport.status}`}>
            <div className="scan-score-circle">
              <svg viewBox="0 0 100 100">
                <circle className="score-bg" cx="50" cy="50" r="45" />
                <circle
                  className="score-progress"
                  cx="50" cy="50" r="45"
                  strokeDasharray={`${scanReport.score * 2.83} 283`}
                />
              </svg>
              <div className="score-value">{scanReport.score}</div>
            </div>
            <div className="scan-score-info">
              <h2>{scanReport.message}</h2>
              <p className="score-advice">{scanReport.advice}</p>
              <div className="scan-summary">
                {scanReport.summary.critical > 0 && (
                  <span className="summary-item critical">{scanReport.summary.critical} critique(s)</span>
                )}
                {scanReport.summary.warning > 0 && (
                  <span className="summary-item warning">{scanReport.summary.warning} attention(s)</span>
                )}
                {(scanReport.summary.info || 0) > 0 && (
                  <span className="summary-item info">{scanReport.summary.info} info(s)</span>
                )}
                <span className="summary-item ok">{scanReport.summary.ok} OK</span>
              </div>
              <p className="scan-timestamp">{scanReport.hostname} | {scanReport.timestamp}</p>
            </div>
            <button className="scan-refresh-btn" onClick={onRunScan}>
              Relancer
            </button>
          </div>

          {/* AI Recommendations */}
          <div className="ai-recommendations-card">
            <div className="ai-card-header">
              <span className="ai-icon">AI</span>
              <h3>Recommandations Intelligentes</h3>
            </div>
            {!aiRecommendation && !aiLoading && (
              <div className="ai-card-empty">
                <p>Notre IA peut analyser votre rapport et vous donner des conseils personnalises.</p>
                <button className="ai-btn" onClick={getAiRecommendations}>
                  Obtenir des recommandations
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
              <div className="ai-content">
                <p>{aiRecommendation}</p>
                <button className="ai-refresh" onClick={getAiRecommendations}>
                  Nouvelle analyse
                </button>
              </div>
            )}
          </div>

          {/* Escalation Card */}
          {scanReport.status === 'critical' && (
            <div className="escalation-card">
              <div className="escalation-icon">!</div>
              <div className="escalation-content">
                <h3>Intervention recommandee</h3>
                <p>Votre PC presente des problemes necessitant l'attention d'un expert. Nos techniciens Microdiag peuvent vous aider.</p>
              </div>
              <button className="escalation-btn">
                Demander une intervention
              </button>
            </div>
          )}

          {/* Sections */}
          <div className="scan-sections">
            {scanReport.sections.map((section, i) => (
              <div
                key={i}
                className={`scan-section ${section.status} ${expandedSections.has(i) ? 'expanded' : ''}`}
                onClick={() => toggleSection(i)}
              >
                <div className="section-header">
                  <span className="section-icon">{SECTION_ICONS[section.icon] || section.icon}</span>
                  <h3>{section.title}</h3>
                  <span className={`section-badge ${section.status}`}>
                    {section.status === 'ok' ? 'OK' : section.status === 'warning' ? 'Attention' : section.status === 'critical' ? 'Critique' : 'Info'}
                  </span>
                  <span className="section-expand">{expandedSections.has(i) ? '-' : '+'}</span>
                </div>
                <p className="section-summary">{section.items.summary}</p>

                {expandedSections.has(i) && (
                  <div className="section-expanded-content">
                    <div className="section-explanation">
                      <strong>Explication:</strong> {section.explanation}
                    </div>
                    {section.action && (
                      <div className="section-action">
                        <strong>Recommandation:</strong> {section.action}
                      </div>
                    )}
                    {section.items.details && Array.isArray(section.items.details) && section.items.details.length > 0 && (
                      <div className="section-details">
                        <strong>Details:</strong>
                        {section.items.details.slice(0, 8).map((detail: Record<string, unknown>, j: number) => (
                          <div key={j} className="detail-item">
                            {Object.entries(detail).slice(0, 4).map(([key, val]) => (
                              <span key={key} className="detail-value" title={key}>{String(val)}</span>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
