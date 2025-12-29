// ============================================
// MICRODIAG SENTINEL - Tools Page
// ============================================

import { Script } from '../types';
import { CATEGORIES } from '../constants';

interface ToolsPageProps {
  scripts: Script[];
  selectedCategory: string;
  actionRunning: string | null;
  actionResult: { success: boolean; message: string } | null;
  onSelectCategory: (category: string) => void;
  onRunScript: (script: Script) => void;
}

export function ToolsPage({
  scripts,
  selectedCategory,
  actionRunning,
  actionResult,
  onSelectCategory,
  onRunScript,
}: ToolsPageProps) {
  const filteredScripts = selectedCategory === 'all'
    ? scripts
    : scripts.filter(s => s.category === selectedCategory);

  return (
    <div className="page tools-page">
      <div className="page-header">
        <h1>Boite a Outils</h1>
        <p className="page-subtitle">Des solutions simples pour garder votre PC en forme</p>
      </div>

      {actionResult && (
        <div className={`result-toast ${actionResult.success ? 'success' : 'error'}`}>
          {actionResult.success ? 'OK' : 'Erreur'} {actionResult.message}
        </div>
      )}

      <div className="category-filters">
        <button
          className={`category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
          onClick={() => onSelectCategory('all')}
        >
          Tous
        </button>
        {Object.entries(CATEGORIES).map(([key, cat]) => (
          <button
            key={key}
            className={`category-btn ${selectedCategory === key ? 'active' : ''}`}
            onClick={() => onSelectCategory(key)}
            style={{ '--cat-color': cat.color } as React.CSSProperties}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>

      <div className="tools-grid">
        {filteredScripts.length === 0 ? (
          <div className="no-tools">
            <p>Aucun outil disponible dans cette categorie.</p>
            <p className="hint">Votre technicien peut ajouter des outils personnalises.</p>
          </div>
        ) : (
          filteredScripts.map((script) => {
            const cat = CATEGORIES[script.category as keyof typeof CATEGORIES] || CATEGORIES.custom;
            const isRunning = actionRunning === script.slug;
            return (
              <div
                key={script.id}
                className={`tool-card ${isRunning ? 'running' : ''}`}
                style={{ '--tool-color': cat.color } as React.CSSProperties}
              >
                <div className="tool-header">
                  <span className="tool-icon">{cat.icon}</span>
                  <span className="tool-category">{cat.name}</span>
                </div>
                <h3 className="tool-name">{script.name}</h3>
                <p className="tool-description">{script.description}</p>
                <button
                  className="tool-btn"
                  onClick={() => onRunScript(script)}
                  disabled={!!actionRunning}
                >
                  {isRunning ? 'En cours...' : 'Lancer'}
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="info-box">
        <span className="info-icon">Info</span>
        <div className="info-content">
          <h4>Besoin d'un outil specifique ?</h4>
          <p>Demandez a votre technicien d'ajouter de nouveaux outils via le cockpit admin.</p>
        </div>
      </div>
    </div>
  );
}
