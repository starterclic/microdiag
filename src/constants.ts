// ============================================
// MICRODIAG SENTINEL - Constants
// ============================================

export const SUPABASE_URL = 'https://api.microdiag.cybtek.fr';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzY2OTQ3Nzk5LCJleHAiOjIwODIzMDc3OTl9.WlRjQRwCpfgNaGHqiOzsAgwtxufS59sOIbwSdm2sJyc';
export const APP_VERSION = '2.2.4';

// Messages de vulgarisation par catégorie (rassurants)
export const LOADER_MESSAGES: Record<string, string[]> = {
  maintenance: [
    "Analyse des fichiers temporaires...",
    "Nettoyage des caches en cours...",
    "Optimisation de votre système...",
    "Libération de l'espace disque...",
    "Finalisation du nettoyage...",
  ],
  network: [
    "Diagnostic de votre connexion...",
    "Réinitialisation des paramètres réseau...",
    "Vidage du cache DNS...",
    "Renouvellement de votre adresse IP...",
    "Vérification de la connectivité...",
  ],
  printer: [
    "Arrêt du service d'impression...",
    "Suppression des travaux bloqués...",
    "Nettoyage de la file d'attente...",
    "Redémarrage du spooler...",
    "Vérification de l'imprimante...",
  ],
  security: [
    "Analyse de sécurité en cours...",
    "Vérification des paramètres...",
    "Application des protections...",
    "Mise à jour des configurations...",
    "Finalisation de la sécurisation...",
  ],
  custom: [
    "Préparation de l'outil...",
    "Exécution en cours...",
    "Traitement des données...",
    "Application des modifications...",
    "Finalisation...",
  ],
};

// Category config for premium display
export const CATEGORIES: Record<string, { name: string; icon: string; color: string; description: string }> = {
  maintenance: {
    name: 'Entretien',
    icon: '🧹',
    color: '#10b981',
    description: 'Nettoyage et optimisation'
  },
  network: {
    name: 'Connexion',
    icon: '🌐',
    color: '#3b82f6',
    description: 'Réseau et Internet'
  },
  printer: {
    name: 'Impression',
    icon: '🖨️',
    color: '#8b5cf6',
    description: 'Imprimantes et scanners'
  },
  security: {
    name: 'Sécurité',
    icon: '🛡️',
    color: '#ef4444',
    description: 'Protection et confidentialité'
  },
  custom: {
    name: 'Avancé',
    icon: '⚡',
    color: '#f59e0b',
    description: 'Outils spécialisés'
  }
};
