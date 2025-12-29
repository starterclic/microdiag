// ============================================
// MICRODIAG SENTINEL - Script Loader Modal
// ============================================

import { Script } from '../types';
import { CATEGORIES } from '../constants';

interface ScriptLoaderModalProps {
  script: Script;
  message: string;
  progress: number;
}

export function ScriptLoaderModal({ script, message, progress }: ScriptLoaderModalProps) {
  return (
    <div className="modal-overlay script-loader-overlay">
      <div className="script-loader-modal">
        <div className="loader-icon-container">
          <div className="loader-icon-bg"></div>
          <span className="loader-icon">
            {CATEGORIES[script.category as keyof typeof CATEGORIES]?.icon || '⚡'}
          </span>
        </div>

        <h2 className="loader-title">{script.name}</h2>

        <div className="loader-message-container">
          <p className="loader-message">{message}</p>
        </div>

        <div className="loader-progress-container">
          <div className="loader-progress-bar">
            <div
              className="loader-progress-fill"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <span className="loader-progress-text">{progress}%</span>
        </div>

        <p className="loader-reassurance">
          {progress < 100
            ? "Veuillez patienter, votre PC reste utilisable pendant l'opération."
            : "Opération terminée !"
          }
        </p>
      </div>
    </div>
  );
}
