// ============================================
// MICRODIAG SENTINEL - Remote Execution Authorization Modal
// ============================================

import { RemoteExecution } from '../types';

interface Props {
  execution: RemoteExecution | null;
  onAccept: () => void;
  onReject: () => void;
  loading: boolean;
}

const RISK_COLORS = {
  low: { bg: 'rgba(34, 197, 94, 0.15)', border: '#22c55e', text: '#22c55e', label: 'Faible' },
  medium: { bg: 'rgba(234, 179, 8, 0.15)', border: '#eab308', text: '#eab308', label: 'Moyen' },
  high: { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#ef4444', label: 'Élevé' },
};

export function RemoteExecutionModal({ execution, onAccept, onReject, loading }: Props) {
  if (!execution) return null;

  const script = execution.script_library;
  const risk = RISK_COLORS[script?.risk_level as keyof typeof RISK_COLORS] || RISK_COLORS.low;
  const expiresAt = new Date(execution.authorization_expires_at);
  const now = new Date();
  const remainingMs = expiresAt.getTime() - now.getTime();
  const remainingMin = Math.max(0, Math.floor(remainingMs / 60000));
  const remainingSec = Math.max(0, Math.floor((remainingMs % 60000) / 1000));

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px',
    }}>
      <div className="modal-content" style={{
        background: 'linear-gradient(180deg, #1a1a2e 0%, #16162a 100%)',
        border: '1px solid rgba(255, 107, 53, 0.3)',
        borderRadius: '16px',
        maxWidth: '480px',
        width: '100%',
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
      }}>
        {/* Header */}
        <div style={{
          background: 'rgba(255, 107, 53, 0.1)',
          borderBottom: '1px solid rgba(255, 107, 53, 0.2)',
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(255, 107, 53, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
          }}>
            📡
          </div>
          <div>
            <h2 style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 600 }}>
              Demande d'exécution à distance
            </h2>
            <p style={{ margin: '4px 0 0', color: 'rgba(255, 255, 255, 0.6)', fontSize: '13px' }}>
              Un administrateur demande votre autorisation
            </p>
          </div>
        </div>

        {/* Script Info */}
        <div style={{ padding: '20px' }}>
          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ fontSize: '32px' }}>{script?.icon || '📜'}</span>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: 600 }}>
                  {script?.name || 'Script inconnu'}
                </h3>
                <p style={{ margin: '6px 0 0', color: 'rgba(255, 255, 255, 0.7)', fontSize: '13px', lineHeight: 1.5 }}>
                  {script?.description || 'Aucune description'}
                </p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    background: risk.bg,
                    color: risk.text,
                    border: `1px solid ${risk.border}`,
                    textTransform: 'uppercase',
                  }}>
                    Risque {risk.label}
                  </span>
                  {script?.requires_admin && (
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: 'rgba(234, 179, 8, 0.15)',
                      color: '#eab308',
                      border: '1px solid rgba(234, 179, 8, 0.3)',
                    }}>
                      🔐 Admin requis
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Requester Info */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            background: 'rgba(59, 130, 246, 0.1)',
            borderRadius: '8px',
            marginBottom: '16px',
          }}>
            <span style={{ fontSize: '16px' }}>👤</span>
            <span style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '13px' }}>
              Demandé par: <strong style={{ color: '#fff' }}>{execution.requested_by}</strong>
            </span>
          </div>

          {/* Timer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            background: remainingMs < 60000 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            marginBottom: '20px',
          }}>
            <span style={{ fontSize: '16px' }}>⏱️</span>
            <span style={{ color: remainingMs < 60000 ? '#ef4444' : 'rgba(255, 255, 255, 0.8)', fontSize: '13px' }}>
              Expire dans: <strong>{remainingMin}:{remainingSec.toString().padStart(2, '0')}</strong>
            </span>
          </div>

          {/* High Risk Warning */}
          {script?.risk_level === 'high' && (
            <div style={{
              display: 'flex',
              gap: '10px',
              padding: '12px 16px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              marginBottom: '20px',
            }}>
              <span style={{ fontSize: '18px' }}>⚠️</span>
              <p style={{ margin: 0, color: '#fca5a5', fontSize: '13px', lineHeight: 1.5 }}>
                <strong>Attention:</strong> Ce script est classé à risque élevé.
                Assurez-vous de connaître l'administrateur avant d'accepter.
              </p>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onReject}
              disabled={loading}
              style={{
                flex: 1,
                padding: '14px 20px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'all 0.2s',
              }}
            >
              🚫 Refuser
            </button>
            <button
              onClick={onAccept}
              disabled={loading}
              style={{
                flex: 1,
                padding: '14px 20px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {loading ? (
                <>
                  <span className="spinner" style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  Traitement...
                </>
              ) : (
                <>✅ Autoriser</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
