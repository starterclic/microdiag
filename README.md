# Microdiag - Plateforme de Maintenance PC Intelligente

Solution complète de gestion et maintenance à distance pour parcs informatiques Windows.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        INFRASTRUCTURE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │   Frontend   │     │   Backend    │     │   Database   │    │
│  │    Sites     │     │  Supabase    │     │  PostgreSQL  │    │
│  └──────────────┘     └──────────────┘     └──────────────┘    │
│         │                    │                    │             │
│         └────────────────────┴────────────────────┘             │
│                              │                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     api.microdiag.cybtek.fr              │   │
│  │  - REST API    - Auth    - Edge Functions    - Realtime  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  Site Public │      │    Admin     │      │  Windows App │
│  microdiag.  │      │   Cockpit    │      │   Sentinel   │
│  cybtek.fr   │      │    admin.    │      │    Tauri     │
└──────────────┘      └──────────────┘      └──────────────┘
```

## Composants

### 1. Site Public (`/public`)
- Landing page moderne
- Présentation des services
- Téléchargement de l'application

### 2. Admin Cockpit (`/admin`)
Interface d'administration complète :
- **Dashboard** : Vue globale des appareils, statuts, alertes
- **Flotte** : Gestion des appareils clients avec monitoring temps réel
- **Tickets** : Système de support avec historique
- **Scripts** : Bibliothèque de 59 scripts PowerShell
- **Clients** : Gestion des entreprises clientes
- **IA** : Configuration des agents IA et prompts

### 3. Application Windows Sentinel (`/tauri-agent`)
Application desktop Tauri/React :
- **Dashboard** : Score de santé PC, métriques système
- **Outils** : Scripts de maintenance catégorisés
- **Scan** : Analyse complète avec rapport détaillé
- **Chat IA** : Assistant intelligent pour résoudre les problèmes
- **Exécution à distance** : Autorisation de scripts depuis l'admin
- **Tutoriel** : Onboarding interactif

### 4. Supabase Backend (`/supabase`)
- Edge Functions (Deno)
- Migrations SQL
- Policies RLS

## Bibliothèque de Scripts

59 scripts PowerShell professionnels organisés en 9 catégories :

| Catégorie | Nombre | Description |
|-----------|--------|-------------|
| Diagnostic | 10 | Analyse hardware/software/réseau |
| Sécurité | 8 | Pare-feu, Defender, mises à jour |
| Réseau | 8 | DNS, WiFi, cartes réseau |
| Performance | 6 | Processus, services, énergie |
| Maintenance | 10 | Nettoyage, disques, corbeille |
| Périphériques | 5 | USB, imprimantes, Bluetooth |
| Logiciels | 8 | Installation Chrome, Firefox, VS Code... |
| Avancé | 4 | Utilisateurs, processus, IPv6 |

## Flux d'Exécution à Distance

```
ADMIN COCKPIT                    CLIENT WINDOWS
     │                                │
     │ 1. Sélection script           │
     │    + appareil cible           │
     │────────────────────────────────▶
     │                                │
     │ 2. Notification               │
     │    popup autorisation         │
     │                                │
     │ 3a. AUTORISER ───────────────▶│
     │                                │ Exécution script
     │                                │
     │◀──────────────────────────────│ 4. Résultat
     │    Output + status            │
     │                                │
     │ 3b. REFUSER ────────────────▶│
     │    (expiration 5 min)         │
```

## Technologies

- **Frontend** : React 18, Tailwind CSS
- **Desktop** : Tauri (Rust + React)
- **Backend** : Supabase (PostgreSQL, Auth, Edge Functions)
- **Scripts** : PowerShell 5.1+
- **CI/CD** : GitHub Actions
- **Hosting** : VPS Contabo + Traefik

## Structure des Dossiers

```
/opt/Microdiag/
├── admin/                 # Cockpit administrateur
│   ├── index.html
│   └── js/cockpit.js
├── public/                # Site vitrine
├── tauri-agent/           # Application Windows
│   ├── src/               # React frontend
│   ├── src-tauri/         # Rust backend
│   └── .github/workflows/ # CI/CD
├── supabase/
│   ├── functions/         # Edge Functions
│   └── migrations/        # SQL migrations
├── scripts-library/       # Scripts PowerShell
│   ├── *.ps1
│   └── import_scripts.py
└── downloads/             # Fichiers téléchargeables
```

## Installation

### Prérequis
- Node.js 18+
- Rust (pour Tauri)
- PostgreSQL 15+
- Docker (pour Supabase local)

### Développement local

```bash
# Clone du repo
git clone https://github.com/starterclic/microdiag.git

# Installation app Windows
cd tauri-agent
npm install
npm run tauri dev

# Supabase local
supabase start
supabase db push
```

### Production

L'infrastructure est déployée sur :
- `microdiag.cybtek.fr` - Site public
- `admin.microdiag.cybtek.fr` - Cockpit admin
- `app.microdiag.cybtek.fr` - Téléchargements
- `api.microdiag.cybtek.fr` - API Supabase

## API Endpoints

### REST API (Supabase)
```
GET  /rest/v1/devices          # Liste appareils
GET  /rest/v1/script_library   # Liste scripts
POST /rest/v1/remote_executions # Demande exécution
GET  /rest/v1/tickets          # Liste tickets
```

### Edge Functions
```
POST /functions/v1/heartbeat   # Ping appareil
POST /functions/v1/ai-chat     # Chat IA
GET  /functions/v1/check-update # Vérif mise à jour
POST /functions/v1/create-user # Création utilisateur
```

## Sécurité

- **RLS** : Row Level Security sur toutes les tables
- **JWT** : Authentification par token
- **Autorisation** : Confirmation utilisateur pour scripts à distance
- **Expiration** : Tokens d'exécution valides 5 minutes
- **Niveaux de risque** : low/medium/high pour scripts

## Versions

| Version | Date | Nouveautés |
|---------|------|------------|
| 2.3.0 | 2024-12-30 | Exécution à distance, Onboarding |
| 2.2.8 | 2024-12-29 | Signing keys, build fixes |
| 2.2.0 | 2024-12-28 | Scan complet, Chat IA |
| 2.0.0 | 2024-12-27 | Refonte UI, Tauri |

## Licence

Propriétaire - Microdiag Solutions 2025

## Contact

- Support : support@microdiag.fr
- Site : https://microdiag.cybtek.fr
