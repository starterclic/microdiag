// ============================================
// MICRODIAG SENTINEL - Update Modal
// ============================================

import { UpdateInfo } from '../types';
import { APP_VERSION } from '../constants';

interface UpdateModalProps {
  updateInfo: UpdateInfo;
  downloading: boolean;
  progress: number;
  onClose: () => void;
  onInstall: () => void;
}

export function UpdateModal({ updateInfo, downloading, progress, onClose, onInstall }: UpdateModalProps) {
  return (
    <div className="modal-overlay" onClick={() => !downloading && onClose()}>
      <div className="modal update-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🚀 Mise à jour disponible</h2>
          {!downloading && (
            <button className="close-btn" onClick={onClose}>×</button>
          )}
        </div>
        <div className="modal-body">
          <div className="update-version-info">
            <span className="version-current">v{APP_VERSION}</span>
            <span className="version-arrow">→</span>
            <span className="version-new">v{updateInfo.version}</span>
          </div>

          {updateInfo.notes && (
            <div className="update-notes">
              <h4>Nouveautés :</h4>
              <div className="notes-content">
                {updateInfo.notes.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          )}

          {downloading && (
            <div className="update-progress">
              <div className="loader-progress-bar">
                <div
                  className="loader-progress-fill"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <span className="update-progress-text">
                {progress < 100 ? 'Téléchargement...' : 'Prêt !'}
              </span>
            </div>
          )}
        </div>
        <div className="modal-footer">
          {!downloading ? (
            <>
              <button className="btn-secondary" onClick={onClose}>
                Plus tard
              </button>
              <button className="btn-primary" onClick={onInstall}>
                📥 Télécharger
              </button>
            </>
          ) : (
            <button className="btn-secondary" disabled>
              Installation en cours...
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
