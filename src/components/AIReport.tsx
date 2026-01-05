// ============================================
// MICRODIAG SENTINEL - AI Report Component
// Premium Design, Welcoming, Professional
// ============================================

import { AIReport as AIReportType } from '../services/aiReport';

interface AIReportProps {
  report: AIReportType | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenChat?: () => void;
}

export function AIReport({ report, loading, onRefresh, onOpenChat }: AIReportProps) {
  if (loading) {
    return (
      <div className="ai-report ai-report-loading">
        <div className="ai-report-header">
          <div className="ai-avatar-pulse">
            <span>🤖</span>
          </div>
          <div className="ai-loading-content">
            <span className="shimmer-text">Analyse de votre PC en cours...</span>
            <span className="ai-loading-sub">Je prepare votre bilan personnalise</span>
          </div>
        </div>
        <div className="ai-loading-bar">
          <div className="ai-loading-progress"></div>
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="ai-report">
      {/* Greeting Section */}
      <div className="ai-greeting">
        <div className="ai-avatar">
          <span>🤖</span>
        </div>
        <div className="ai-greeting-content">
          <p className="ai-greeting-text">{report.greeting}</p>
          <button className="ai-refresh-btn" onClick={onRefresh} title="Actualiser l'analyse">
            ↻
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="ai-body">
        <h3 className="ai-title">{report.title}</h3>
        <p className="ai-summary">{report.summary}</p>

        {/* Analysis Items */}
        <ul className="ai-items">
          {report.items.map((item, i) => (
            <li key={i} className={`ai-item ai-item-${item.status}`}>
              <span className="ai-item-icon">{item.icon}</span>
              <span className="ai-item-text">{item.text}</span>
              <span className={`ai-item-check ${item.status}`}>
                {item.status === 'ok' ? '✓' : item.status === 'warning' ? '!' : 'i'}
              </span>
            </li>
          ))}
        </ul>

        {/* Tips Section */}
        {report.tips.length > 0 && (
          <div className="ai-tips">
            <span className="ai-tips-title">Mes conseils</span>
            <ul>
              {report.tips.map((tip, i) => (
                <li key={i}>
                  <span className="tip-bullet">💡</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Closing / CTA */}
      <div className="ai-closing">
        <p>{report.closing}</p>
        {onOpenChat && (
          <button className="ai-chat-btn" onClick={onOpenChat}>
            💬 Ouvrir le chat
          </button>
        )}
      </div>
    </div>
  );
}
