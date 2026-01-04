// ============================================
// MICRODIAG SENTINEL - FixWin Page
// Ultra Premium Design with Lucide Icons
// ============================================

import { useState, useEffect, useRef } from 'react';
import {
  FixCategory,
  FixItem,
  StreamOutput,
  FixComplete,
  RISK_LEVELS,
  getFixCategories,
  executeFix,
  createRestorePoint,
  onFixOutput,
  onFixComplete,
  getLineColor
} from '../services/fixwin';

// Lucide Icons
import {
  Wifi,
  Settings,
  FolderOpen,
  Download,
  Trash2,
  Zap,
  Shield,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  Play,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  HelpCircle,
  Save,
  Loader2,
  Sparkles,
  Wrench,
  Activity,
  MonitorSpeaker,
  Printer,
  Search,
  type LucideIcon
} from 'lucide-react';

// Icon mapping for categories
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  wifi: Wifi,
  settings: Settings,
  folder: FolderOpen,
  download: Download,
  trash: Trash2,
  zap: Zap,
  network: Wifi,
  system: Settings,
  explorer: FolderOpen,
  windows_update: Download,
  cleanup: Trash2,
  services: Zap
};

interface Props {
  onRequestSupport?: () => void;
}

export default function FixWinPage({ onRequestSupport }: Props) {
  // State
  const [categories, setCategories] = useState<FixCategory[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedFix, setSelectedFix] = useState<FixItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [currentFixId, setCurrentFixId] = useState<string | null>(null);
  const [terminalOutput, setTerminalOutput] = useState<Array<{ line: string; type: string }>>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<FixComplete | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [creatingRestorePoint, setCreatingRestorePoint] = useState(false);

  const terminalRef = useRef<HTMLDivElement>(null);

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  // Setup event listeners
  useEffect(() => {
    let unlistenOutput: (() => void) | undefined;
    let unlistenComplete: (() => void) | undefined;

    const setupListeners = async () => {
      unlistenOutput = await onFixOutput((output: StreamOutput) => {
        if (output.fix_id === currentFixId) {
          setTerminalOutput(prev => [...prev, { line: output.line, type: output.line_type }]);
          if (output.progress !== null) {
            setProgress(output.progress);
          }
        }
      });

      unlistenComplete = await onFixComplete((complete: FixComplete) => {
        if (complete.fix_id === currentFixId) {
          setResult(complete);
          setIsRunning(false);
          setProgress(100);
        }
      });
    };

    setupListeners();

    return () => {
      unlistenOutput?.();
      unlistenComplete?.();
    };
  }, [currentFixId]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  const loadCategories = async () => {
    const cats = await getFixCategories();
    setCategories(cats);
    if (cats.length > 0) {
      setExpandedCategories(new Set([cats[0].id]));
    }
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const selectFix = (fix: FixItem, categoryId: string) => {
    setSelectedFix(fix);
    setSelectedCategory(categoryId);
    setResult(null);
    setTerminalOutput([]);
    setProgress(null);
  };

  const handleRunFix = () => {
    if (!selectedFix) return;
    setShowConfirmModal(true);
  };

  const confirmAndRun = async () => {
    if (!selectedFix) return;

    setShowConfirmModal(false);
    setIsRunning(true);
    setCurrentFixId(selectedFix.id);
    setTerminalOutput([{
      line: `> Demarrage de "${selectedFix.name}"...`,
      type: 'info'
    }]);
    setProgress(0);
    setResult(null);

    try {
      await executeFix(selectedFix.id);
    } catch (error) {
      setTerminalOutput(prev => [...prev, {
        line: `[ERREUR] ${error}`,
        type: 'error'
      }]);
      setIsRunning(false);
    }
  };

  const handleCreateRestorePoint = async () => {
    setCreatingRestorePoint(true);
    setTerminalOutput([{
      line: '> Creation d\'un point de restauration...',
      type: 'info'
    }]);

    try {
      const restoreResult = await createRestorePoint();
      setTerminalOutput(prev => [...prev, {
        line: restoreResult.success ? '[OK] Point de restauration cree' : `[ERREUR] ${restoreResult.message}`,
        type: restoreResult.success ? 'success' : 'error'
      }]);
    } catch (error) {
      setTerminalOutput(prev => [...prev, {
        line: `[ERREUR] ${error}`,
        type: 'error'
      }]);
    }

    setCreatingRestorePoint(false);
  };

  const getRiskStyle = (level: string) => {
    const risk = RISK_LEVELS[level as keyof typeof RISK_LEVELS] || RISK_LEVELS.low;
    return {
      backgroundColor: risk.bgColor,
      borderColor: risk.borderColor,
      color: risk.color
    };
  };

  const getCategoryIcon = (iconName: string) => {
    const Icon = CATEGORY_ICONS[iconName] || CATEGORY_ICONS[iconName?.toLowerCase()] || Wrench;
    return <Icon size={18} strokeWidth={2} />;
  };

  return (
    <div className="fw-page">
      {/* Premium Header */}
      <div className="fw-header">
        <div className="fw-header-content">
          <div className="fw-header-icon">
            <ShieldCheck size={28} strokeWidth={1.5} />
            <Sparkles size={14} className="fw-sparkle" />
          </div>
          <div className="fw-header-text">
            <h1>Outils de Reparation</h1>
            <p>Diagnostics et corrections automatiques pour Windows</p>
          </div>
        </div>
        <button
          className="fw-restore-btn"
          onClick={handleCreateRestorePoint}
          disabled={creatingRestorePoint || isRunning}
        >
          {creatingRestorePoint ? (
            <Loader2 size={18} className="fw-spin" />
          ) : (
            <Save size={18} />
          )}
          <span>{creatingRestorePoint ? 'Creation...' : 'Point de restauration'}</span>
        </button>
      </div>

      <div className="fw-main">
        {/* Sidebar - Categories */}
        <div className="fw-sidebar">
          <div className="fw-sidebar-header">
            <Wrench size={16} />
            <h3>Categories</h3>
          </div>
          <div className="fw-categories">
            {categories.map(category => (
              <div key={category.id} className="fw-category">
                <button
                  className={`fw-category-header ${expandedCategories.has(category.id) ? 'expanded' : ''}`}
                  onClick={() => toggleCategory(category.id)}
                >
                  <span className="fw-category-icon">{getCategoryIcon(category.icon || category.id)}</span>
                  <span className="fw-category-name">{category.name}</span>
                  <span className="fw-category-count">{category.fixes.length}</span>
                  {expandedCategories.has(category.id) ? (
                    <ChevronDown size={14} className="fw-chevron" />
                  ) : (
                    <ChevronRight size={14} className="fw-chevron" />
                  )}
                </button>

                {expandedCategories.has(category.id) && (
                  <div className="fw-fixes-list">
                    {category.fixes.map(fix => (
                      <button
                        key={fix.id}
                        className={`fw-fix-item ${selectedFix?.id === fix.id ? 'selected' : ''}`}
                        onClick={() => selectFix(fix, category.id)}
                      >
                        <span className="fw-fix-name">{fix.name}</span>
                        <span
                          className="fw-fix-risk"
                          style={getRiskStyle(fix.risk_level)}
                        >
                          {fix.risk_level === 'low' ? 'Sur' : fix.risk_level === 'medium' ? 'Mod' : 'Att'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="fw-content">
          {selectedFix ? (
            <>
              {/* Fix Details Card */}
              <div className="fw-details">
                <div className="fw-details-header">
                  <h2>{selectedFix.name}</h2>
                  <div className="fw-details-meta">
                    <span
                      className="fw-badge fw-risk-badge"
                      style={getRiskStyle(selectedFix.risk_level)}
                    >
                      <Activity size={12} />
                      {RISK_LEVELS[selectedFix.risk_level as keyof typeof RISK_LEVELS]?.label}
                    </span>
                    <span className="fw-badge fw-time-badge">
                      <Clock size={12} />
                      {selectedFix.estimated_time}
                    </span>
                    {selectedFix.requires_reboot && (
                      <span className="fw-badge fw-reboot-badge">
                        <RefreshCw size={12} />
                        Redemarrage
                      </span>
                    )}
                    {selectedFix.requires_admin && (
                      <span className="fw-badge fw-admin-badge">
                        <Shield size={12} />
                        Admin
                      </span>
                    )}
                  </div>
                </div>

                <p className="fw-details-desc">{selectedFix.description}</p>

                {/* Risk Warning */}
                {selectedFix.risk_level !== 'low' && (
                  <div className="fw-warning" style={getRiskStyle(selectedFix.risk_level)}>
                    <AlertTriangle size={20} />
                    <div>
                      <strong>{RISK_LEVELS[selectedFix.risk_level as keyof typeof RISK_LEVELS]?.label}</strong>
                      <p>{RISK_LEVELS[selectedFix.risk_level as keyof typeof RISK_LEVELS]?.description}</p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="fw-actions">
                  <button
                    className="fw-run-btn"
                    onClick={handleRunFix}
                    disabled={isRunning}
                  >
                    {isRunning ? (
                      <>
                        <Loader2 size={18} className="fw-spin" />
                        <span>Execution en cours...</span>
                      </>
                    ) : (
                      <>
                        <Play size={18} />
                        <span>Executer</span>
                      </>
                    )}
                  </button>

                  {onRequestSupport && (
                    <button className="fw-help-btn" onClick={onRequestSupport}>
                      <HelpCircle size={18} />
                      <span>Demander de l'aide</span>
                    </button>
                  )}
                </div>

                {/* Progress Bar */}
                {isRunning && progress !== null && (
                  <div className="fw-progress">
                    <div className="fw-progress-bar">
                      <div
                        className="fw-progress-fill"
                        style={{ width: `${progress}%` }}
                      >
                        <div className="fw-progress-shimmer" />
                      </div>
                    </div>
                    <span className="fw-progress-text">{progress}%</span>
                  </div>
                )}

                {/* Result Banner */}
                {result && (
                  <div className={`fw-result ${result.success ? 'success' : 'error'}`}>
                    {result.success ? (
                      <CheckCircle2 size={24} />
                    ) : (
                      <XCircle size={24} />
                    )}
                    <div>
                      <strong>{result.success ? 'Operation reussie !' : 'Erreur'}</strong>
                      <p>{result.message}</p>
                      {result.requires_reboot && (
                        <p className="fw-reboot-notice">
                          <RefreshCw size={14} />
                          Un redemarrage est necessaire pour appliquer les changements
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Terminal Output */}
              {terminalOutput.length > 0 && (
                <div className="fw-terminal">
                  <div className="fw-terminal-header">
                    <Terminal size={14} />
                    <span>Sortie</span>
                    <div className="fw-terminal-dots">
                      <span className="dot red" />
                      <span className="dot yellow" />
                      <span className="dot green" />
                    </div>
                  </div>
                  <div className="fw-terminal-content" ref={terminalRef}>
                    {terminalOutput.map((output, i) => (
                      <div
                        key={i}
                        className={`fw-terminal-line ${output.type}`}
                        style={{ color: getLineColor(output.type) }}
                      >
                        {output.line}
                      </div>
                    ))}
                    {isRunning && <span className="fw-terminal-cursor">_</span>}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Empty State */
            <div className="fw-empty">
              <div className="fw-empty-icon">
                <Wrench size={48} strokeWidth={1} />
              </div>
              <h3>Selectionnez un outil</h3>
              <p>Choisissez une categorie et un outil dans le panneau de gauche pour commencer</p>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedFix && (
        <div className="fw-modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="fw-modal" onClick={e => e.stopPropagation()}>
            <div className="fw-modal-header">
              <AlertTriangle size={24} style={{ color: RISK_LEVELS[selectedFix.risk_level as keyof typeof RISK_LEVELS]?.color }} />
              <h3>Confirmer l'operation</h3>
            </div>

            <div className="fw-modal-content">
              <p>Vous etes sur le point d'executer :</p>
              <div className="fw-modal-fix-name">
                <strong>{selectedFix.name}</strong>
              </div>

              <div className="fw-modal-info">
                <div className="fw-modal-info-row">
                  <span>Niveau de risque</span>
                  <span className="fw-badge" style={getRiskStyle(selectedFix.risk_level)}>
                    {RISK_LEVELS[selectedFix.risk_level as keyof typeof RISK_LEVELS]?.label}
                  </span>
                </div>
                <div className="fw-modal-info-row">
                  <span>Duree estimee</span>
                  <span>{selectedFix.estimated_time}</span>
                </div>
                {selectedFix.requires_reboot && (
                  <div className="fw-modal-info-row warning">
                    <RefreshCw size={14} />
                    <span>Un redemarrage sera necessaire</span>
                  </div>
                )}
              </div>

              <p className="fw-modal-warning">
                <Shield size={14} />
                Nous recommandons de creer un point de restauration avant de continuer.
              </p>
            </div>

            <div className="fw-modal-actions">
              <button className="fw-modal-cancel" onClick={() => setShowConfirmModal(false)}>
                Annuler
              </button>
              <button className="fw-modal-confirm" onClick={confirmAndRun}>
                <Play size={16} />
                Executer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
