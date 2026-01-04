// ============================================
// MICRODIAG SENTINEL - AI Report Component
// Premium Design, Concise, Professional
// ============================================

import { AIReport as AIReportType } from '../services/aiReport';

interface AIReportProps {
  report: AIReportType | null;
  loading: boolean;
  onRefresh: () => void;
}

export function AIReport({ report, loading, onRefresh }: AIReportProps) {
  if (loading) {
    return (
      <div className="ai-report ai-report-loading">
        <div className="ai-report-header">
          <div className="ai-icon-pulse">
            <span>🤖</span>
          </div>
          <div className="ai-title-loading">
            <span className="shimmer-text">Analyse en cours...</span>
          </div>
        </div>
        <div className="ai-loading-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="ai-report">
      <div className="ai-report-header">
        <div className="ai-icon">🤖</div>
        <div className="ai-title">
          <h3>{report.title}</h3>
          <p className="ai-summary">{report.summary}</p>
        </div>
        <button className="ai-refresh-btn" onClick={onRefresh} title="Actualiser">
          ↻
        </button>
      </div>

      <ul className="ai-items">
        {report.items.map((item, i) => (
          <li key={i} className={`ai-item ai-item-${item.status}`}>
            <span className="ai-item-icon">{item.icon}</span>
            <span className="ai-item-text">{item.text}</span>
            <span className={`ai-item-badge ${item.status}`}>
              {item.status === 'ok' ? '✓' : item.status === 'warning' ? '!' : 'i'}
            </span>
          </li>
        ))}
      </ul>

      {report.tips.length > 0 && (
        <div className="ai-tips">
          <span className="ai-tips-label">💡 Conseils</span>
          <ul>
            {report.tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
