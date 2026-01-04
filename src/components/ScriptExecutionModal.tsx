// ============================================
// MICRODIAG SENTINEL - Script Execution Modal
// Pro UX with terminal output & confirmations
// ============================================

import { useState, useEffect, useRef } from 'react';
import { Script } from '../types';
import { CATEGORIES } from '../constants';

// Risk level explanations for users
const RISK_EXPLANATIONS: Record<string, { title: string; description: string; color: string }> = {
  low: {
    title: 'Action sans risque',
    description: 'Cette operation est sure et n\'affecte pas vos fichiers personnels.',
    color: '#10b981'
  },
  medium: {
    title: 'Action moderee',
    description: 'Cette operation peut modifier des parametres systeme. Vos fichiers restent intacts.',
    color: '#f59e0b'
  },
  high: {
    title: 'Action sensible',
    description: 'Cette operation modifie des parametres importants. Lisez attentivement avant de continuer.',
    color: '#ef4444'
  }
};

// Simple explanations for common operations
const OPERATION_EXPLANATIONS: Record<string, string> = {
  'cache': 'Supprime les fichiers temporaires qui ralentissent votre PC',
  'dns': 'Vide la memoire des adresses internet pour resoudre les problemes de connexion',
  'spooler': 'Redemarre le service d\'impression pour debloquer les documents',
  'temp': 'Nettoie les fichiers temporaires pour liberer de l\'espace',
  'network': 'Reinitialise les parametres reseau pour corriger les problemes de connexion',
  'update': 'Recherche et installe les mises a jour disponibles',
  'defender': 'Lance une analyse antivirus de votre systeme',
  'disk': 'Verifie et repare les erreurs sur votre disque dur',
  'startup': 'Optimise les programmes qui se lancent au demarrage',
  'registry': 'Nettoie les entrees obsoletes du registre Windows',
};

export type ExecutionPhase = 'confirm' | 'running' | 'completed' | 'error';

export interface ExecutionStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  output?: string;
}

interface ScriptExecutionModalProps {
  script: Script;
  phase: ExecutionPhase;
  steps: ExecutionStep[];
  terminalOutput: string[];
  progress: number;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
  onClose: () => void;
  onRequestSupport: () => void;
}

export function ScriptExecutionModal({
  script,
  phase,
  steps,
  terminalOutput,
  progress,
  error,
  onConfirm,
  onCancel,
  onClose,
  onRequestSupport,
}: ScriptExecutionModalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const cat = CATEGORIES[script.category as keyof typeof CATEGORIES] || CATEGORIES.custom;

  // Determine risk level from script or default to low
  const riskLevel = (script as Script & { risk_level?: string }).risk_level || 'low';
  const riskInfo = RISK_EXPLANATIONS[riskLevel] || RISK_EXPLANATIONS.low;

  // Find a simple explanation for this script
  const getSimpleExplanation = () => {
    const slug = script.slug.toLowerCase();
    for (const [key, explanation] of Object.entries(OPERATION_EXPLANATIONS)) {
      if (slug.includes(key)) {
        return explanation;
      }
    }
    return script.description;
  };

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  // Confirmation Phase
  if (phase === 'confirm') {
    return (
      <div className="modal-overlay script-exec-overlay">
        <div className="script-exec-modal confirm-phase">
          <div className="exec-header">
            <div className="exec-icon" style={{ background: cat.color }}>
              {cat.icon}
            </div>
            <div className="exec-title-section">
              <h2>{script.name}</h2>
              <span className="exec-category">{cat.name}</span>
            </div>
          </div>

          <div className="exec-explanation">
            <div className="explanation-icon">?</div>
            <div className="explanation-content">
              <h4>Que va faire cet outil ?</h4>
              <p>{getSimpleExplanation()}</p>
            </div>
          </div>

          {riskLevel !== 'low' && (
            <div className="exec-risk-warning" style={{ borderColor: riskInfo.color }}>
              <div className="risk-icon" style={{ color: riskInfo.color }}>
                {riskLevel === 'high' ? '!' : 'i'}
              </div>
              <div className="risk-content">
                <h4 style={{ color: riskInfo.color }}>{riskInfo.title}</h4>
                <p>{riskInfo.description}</p>
              </div>
            </div>
          )}

          <div className="exec-steps-preview">
            <h4>Etapes prevues :</h4>
            <ul>
              {steps.map((step, i) => (
                <li key={step.id}>
                  <span className="step-number">{i + 1}</span>
                  <span className="step-label">{step.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="exec-actions">
            <button className="btn-secondary" onClick={onCancel}>
              Annuler
            </button>
            <button className="btn-primary" onClick={onConfirm}>
              J'ai compris, lancer
            </button>
          </div>

          <div className="exec-support-hint">
            <span>Une question ?</span>
            <button className="link-btn" onClick={onRequestSupport}>
              Demander de l'aide
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Running / Completed / Error Phases
  return (
    <div className="modal-overlay script-exec-overlay">
      <div className={`script-exec-modal ${phase}-phase`}>
        <div className="exec-header">
          <div className="exec-icon" style={{ background: cat.color }}>
            {cat.icon}
          </div>
          <div className="exec-title-section">
            <h2>{script.name}</h2>
            <span className="exec-status">
              {phase === 'running' && 'En cours...'}
              {phase === 'completed' && 'Termine !'}
              {phase === 'error' && 'Erreur'}
            </span>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="exec-steps">
          {steps.map((step, i) => (
            <div key={step.id} className={`exec-step ${step.status}`}>
              <div className="step-indicator">
                {step.status === 'done' && <span className="check">OK</span>}
                {step.status === 'running' && <span className="spinner"></span>}
                {step.status === 'error' && <span className="error-x">X</span>}
                {step.status === 'pending' && <span className="number">{i + 1}</span>}
              </div>
              <div className="step-info">
                <span className="step-label">{step.label}</span>
                {step.output && <span className="step-output">{step.output}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        <div className="exec-progress">
          <div className="progress-bar-container">
            <div
              className={`progress-bar-fill ${phase === 'error' ? 'error' : ''}`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <span className="progress-text">{progress}%</span>
        </div>

        {/* Terminal Output */}
        <div className="exec-terminal" ref={terminalRef}>
          <div className="terminal-header">
            <span className="terminal-dot red"></span>
            <span className="terminal-dot yellow"></span>
            <span className="terminal-dot green"></span>
            <span className="terminal-title">Sortie</span>
          </div>
          <div className="terminal-content">
            {terminalOutput.map((line, i) => (
              <div key={i} className={`terminal-line ${line.startsWith('[OK]') ? 'success' : line.startsWith('[ERREUR]') ? 'error' : ''}`}>
                {line}
              </div>
            ))}
            {phase === 'running' && <span className="terminal-cursor">_</span>}
          </div>
        </div>

        {/* Result Message */}
        {phase === 'completed' && (
          <div className="exec-result success">
            <span className="result-icon">OK</span>
            <div className="result-content">
              <h4>Operation reussie !</h4>
              <p>Votre PC a ete optimise avec succes.</p>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="exec-result error">
            <span className="result-icon">!</span>
            <div className="result-content">
              <h4>Une erreur s'est produite</h4>
              <p>{error || 'L\'operation n\'a pas pu etre completee.'}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="exec-actions">
          {phase === 'running' ? (
            <p className="running-hint">Veuillez patienter, votre PC reste utilisable.</p>
          ) : (
            <>
              <button className="btn-primary" onClick={onClose}>
                {phase === 'completed' ? 'Parfait !' : 'Fermer'}
              </button>
              {phase === 'error' && (
                <button className="btn-secondary" onClick={onRequestSupport}>
                  Contacter le support
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper to parse script output into steps
export function parseScriptSteps(scriptSlug: string): ExecutionStep[] {
  const slug = scriptSlug.toLowerCase();

  // Common step patterns based on script type
  if (slug.includes('cache') || slug.includes('temp') || slug.includes('clean')) {
    return [
      { id: 'analyse', label: 'Analyse des fichiers temporaires', status: 'pending' },
      { id: 'clean', label: 'Nettoyage en cours', status: 'pending' },
      { id: 'verify', label: 'Verification', status: 'pending' },
    ];
  }

  if (slug.includes('network') || slug.includes('dns') || slug.includes('ip')) {
    return [
      { id: 'stop', label: 'Arret des services reseau', status: 'pending' },
      { id: 'flush', label: 'Vidage du cache DNS', status: 'pending' },
      { id: 'renew', label: 'Renouvellement IP', status: 'pending' },
      { id: 'restart', label: 'Redemarrage des services', status: 'pending' },
    ];
  }

  if (slug.includes('print') || slug.includes('spooler')) {
    return [
      { id: 'stop', label: 'Arret du spooler', status: 'pending' },
      { id: 'clean', label: 'Suppression des travaux bloques', status: 'pending' },
      { id: 'restart', label: 'Redemarrage du service', status: 'pending' },
    ];
  }

  if (slug.includes('defender') || slug.includes('scan') || slug.includes('virus')) {
    return [
      { id: 'init', label: 'Initialisation de l\'analyse', status: 'pending' },
      { id: 'scan', label: 'Analyse en cours', status: 'pending' },
      { id: 'report', label: 'Generation du rapport', status: 'pending' },
    ];
  }

  // Default steps
  return [
    { id: 'prepare', label: 'Preparation', status: 'pending' },
    { id: 'execute', label: 'Execution', status: 'pending' },
    { id: 'finalize', label: 'Finalisation', status: 'pending' },
  ];
}

// Helper to simulate step progression based on output
export function updateStepsFromOutput(
  steps: ExecutionStep[],
  output: string,
  progress: number
): ExecutionStep[] {
  const updated = [...steps];
  const completedCount = Math.floor((progress / 100) * steps.length);

  for (let i = 0; i < updated.length; i++) {
    if (i < completedCount) {
      updated[i].status = 'done';
    } else if (i === completedCount && progress < 100) {
      updated[i].status = 'running';
    } else {
      updated[i].status = 'pending';
    }
  }

  return updated;
}
