# Changelog

Tous les changements notables de Microdiag Sentinel sont documentés ici.

## [v2.4.0] - 2025-12-30

### Architecture Local-First 🚀
- **SQLite embarqué** : Base de données locale pour réponses instantanées (<5ms)
- **Sync background** : Synchronisation Supabase en arrière-plan (transparent)
- **Cache intelligent** : Device ID caché 1h, scripts syncés toutes les 5min
- **Mode Offline** : L'app fonctionne sans internet (lectures locales)

### Nouveaux modules Rust
- `database.rs` : Gestion SQLite (scripts, metrics, chat, settings)
- `sync.rs` : Synchronisation asynchrone avec Supabase

### Hooks React
- `useScripts()` : Chargement instantané depuis SQLite
- `useOnlineStatus()` : Détection connexion
- `useChatHistory()` : Historique local
- `useRemoteExecutions()` : Optimisé avec cache device_id

### Performance
- -70% requêtes API (cache device_id, batch)
- Latence UI: 500ms → 5ms (lectures locales)
- Démarrage plus rapide (pas d'attente réseau)

## [v2.3.0] - 2025-12-30

### Nouveautés
- **Exécution à distance** : Autorisation de scripts depuis l'admin cockpit
- **Tutoriel interactif** : 8 étapes pour découvrir l'application
- **Script Library** : 59 scripts PowerShell professionnels

### Corrections
- Signatures Tauri pour auto-update
- Version affichée dynamiquement sur les pages web

## [v2.1.0] - 2025-12-29

### Corrections
- Clé API Supabase corrigée
- Device token persistant (ne change plus au redémarrage)
- Stabilité générale améliorée

### Améliorations
- Version affichée correctement : 2.1.0
- CI/CD GitHub Actions configuré
- Builds automatiques Windows

## [v2.0.0] - 2025-12-28

### Nouveautés
- Première version Tauri stable
- Interface utilisateur moderne
- Intégration Supabase complète
- Surveillance système en temps réel
- Communication bidirectionnelle avec le backend

### Fonctionnalités
- Monitoring CPU, RAM, Disk
- Exécution de scripts distants
- Historique des sessions
- Détection automatique du device

---

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/)
