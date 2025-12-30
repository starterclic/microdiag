// ============================================
// MICRODIAG SENTINEL - Onboarding Tutorial
// ============================================

import { useState, useEffect } from 'react';

interface Props {
  onComplete: () => void;
  onSkip: () => void;
}

const TUTORIAL_STEPS = [
  {
    title: "Bienvenue sur Microdiag Sentinel !",
    description: "Votre assistant de maintenance PC intelligent. En quelques clics, gardez votre ordinateur en pleine forme.",
    icon: "👋",
    highlight: null,
    image: null,
  },
  {
    title: "Tableau de bord",
    description: "Visualisez l'état de santé de votre PC en un coup d'oeil. Le score reflète les performances, la sécurité et le stockage.",
    icon: "📊",
    highlight: "dashboard",
    tips: ["Score vert = tout va bien", "Score orange = optimisation recommandée", "Score rouge = action requise"],
  },
  {
    title: "Outils de maintenance",
    description: "Accédez à une boîte à outils complète pour entretenir votre PC : nettoyage, réseau, imprimante, sécurité...",
    icon: "🧰",
    highlight: "tools",
    tips: ["Cliquez sur un outil pour l'exécuter", "Les outils sont classés par catégorie", "Chaque outil affiche son avancement"],
  },
  {
    title: "Scan complet",
    description: "Lancez une analyse approfondie pour détecter les problèmes potentiels et recevoir des recommandations personnalisées.",
    icon: "🔍",
    highlight: "scan",
    tips: ["Le scan prend environ 2 minutes", "Recevez un rapport détaillé", "Des conseils adaptés à votre PC"],
  },
  {
    title: "Assistant IA",
    description: "Posez vos questions en français ! L'assistant vous aide à résoudre vos problèmes informatiques.",
    icon: "🤖",
    highlight: "chat",
    tips: ["Décrivez votre problème simplement", "L'IA peut exécuter des actions pour vous", "Disponible 24h/24"],
  },
  {
    title: "Demande d'intervention",
    description: "Besoin d'aide urgente ? Envoyez une demande et un expert Microdiag vous contactera rapidement.",
    icon: "🆘",
    highlight: "urgency",
    tips: ["Bouton d'urgence sur le tableau de bord", "Un technicien vous rappelle", "Support humain garanti"],
  },
  {
    title: "Exécution à distance",
    description: "Votre administrateur peut vous envoyer des scripts de maintenance. Vous gardez toujours le contrôle !",
    icon: "📡",
    highlight: null,
    tips: ["Une popup vous demande l'autorisation", "Vous pouvez toujours refuser", "Voir le détail du script avant d'accepter"],
  },
  {
    title: "C'est parti !",
    description: "Vous êtes prêt à utiliser Microdiag Sentinel. Profitez d'un PC toujours au top !",
    icon: "🚀",
    highlight: null,
    final: true,
  },
];

export function OnboardingTutorial({ onComplete, onSkip }: Props) {
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);

  const currentStep = TUTORIAL_STEPS[step];
  const progress = ((step + 1) / TUTORIAL_STEPS.length) * 100;

  const nextStep = () => {
    if (step < TUTORIAL_STEPS.length - 1) {
      setAnimating(true);
      setTimeout(() => {
        setStep(step + 1);
        setAnimating(false);
      }, 200);
    } else {
      onComplete();
    }
  };

  const prevStep = () => {
    if (step > 0) {
      setAnimating(true);
      setTimeout(() => {
        setStep(step - 1);
        setAnimating(false);
      }, 200);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.92)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px',
    }}>
      <div style={{
        background: 'linear-gradient(180deg, #1e1e3f 0%, #151528 100%)',
        border: '1px solid rgba(255, 107, 53, 0.2)',
        borderRadius: '24px',
        maxWidth: '520px',
        width: '100%',
        overflow: 'hidden',
        boxShadow: '0 30px 60px rgba(0, 0, 0, 0.5)',
      }}>
        {/* Progress bar */}
        <div style={{
          height: '4px',
          background: 'rgba(255, 255, 255, 0.1)',
          position: 'relative',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #ff6b35, #ff8f5a)',
            transition: 'width 0.3s ease',
            borderRadius: '4px',
          }} />
        </div>

        {/* Skip button */}
        {step < TUTORIAL_STEPS.length - 1 && (
          <button
            onClick={onSkip}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: '13px',
              cursor: 'pointer',
              padding: '8px 16px',
              borderRadius: '8px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)'}
          >
            Passer le tutoriel →
          </button>
        )}

        {/* Content */}
        <div style={{
          padding: '48px 40px 32px',
          textAlign: 'center',
          opacity: animating ? 0 : 1,
          transform: animating ? 'translateY(10px)' : 'translateY(0)',
          transition: 'all 0.2s ease',
        }}>
          {/* Icon */}
          <div style={{
            width: '100px',
            height: '100px',
            margin: '0 auto 24px',
            background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.2) 0%, rgba(255, 107, 53, 0.05) 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            border: '2px solid rgba(255, 107, 53, 0.3)',
            boxShadow: '0 10px 30px rgba(255, 107, 53, 0.2)',
          }}>
            {currentStep.icon}
          </div>

          {/* Title */}
          <h2 style={{
            margin: '0 0 16px',
            color: '#fff',
            fontSize: '24px',
            fontWeight: 700,
            letterSpacing: '-0.5px',
          }}>
            {currentStep.title}
          </h2>

          {/* Description */}
          <p style={{
            margin: '0 0 24px',
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '15px',
            lineHeight: 1.6,
          }}>
            {currentStep.description}
          </p>

          {/* Tips */}
          {currentStep.tips && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '24px',
              textAlign: 'left',
            }}>
              {currentStep.tips.map((tip, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: i < currentStep.tips!.length - 1 ? '10px' : 0,
                }}>
                  <span style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #ff6b35, #ff8f5a)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    color: '#fff',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    ✓
                  </span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '13px' }}>
                    {tip}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Step indicator */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '6px',
            marginBottom: '28px',
          }}>
            {TUTORIAL_STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === step ? '24px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  background: i === step
                    ? 'linear-gradient(90deg, #ff6b35, #ff8f5a)'
                    : i < step
                    ? 'rgba(255, 107, 53, 0.5)'
                    : 'rgba(255, 255, 255, 0.2)',
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            {step > 0 && (
              <button
                onClick={prevStep}
                style={{
                  padding: '14px 28px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'transparent',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                ← Précédent
              </button>
            )}
            <button
              onClick={nextStep}
              style={{
                padding: '14px 32px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #ff6b35 0%, #ff8f5a 100%)',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 15px rgba(255, 107, 53, 0.3)',
              }}
            >
              {currentStep.final ? "Commencer !" : "Suivant →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
