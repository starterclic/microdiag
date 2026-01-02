# Guide de Mise à Jour de Version - Microdiag Sentinel

## Fichiers à Modifier (TOUS obligatoires)

Lors d'une nouvelle version, **4 fichiers** doivent être modifiés **simultanément** :

| Fichier | Chemin | Format |
|---------|--------|--------|
| tauri.conf.json | `src-tauri/tauri.conf.json` | `"version": "X.Y.Z"` |
| Cargo.toml | `src-tauri/Cargo.toml` | `version = "X.Y.Z"` |
| constants.ts | `src/constants.ts` | `APP_VERSION = 'X.Y.Z'` |
| config.rs | `src-tauri/src/config.rs` | `AGENT_VERSION: &str = "X.Y.Z"` |

---

## Procédure Complète

### 1. Vérifier la version actuelle

```bash
cd /opt/Microdiag/tauri-agent

# Afficher toutes les versions actuelles
grep -h "version" src-tauri/tauri.conf.json src-tauri/Cargo.toml | head -2
grep "APP_VERSION" src/constants.ts
grep "AGENT_VERSION" src-tauri/src/config.rs
```

### 2. Modifier les 4 fichiers

**Option A : Commandes sed (rapide)**
```bash
NEW_VERSION="2.9.0"

# tauri.conf.json
sed -i "s/\"version\": \"[0-9]*\.[0-9]*\.[0-9]*\"/\"version\": \"$NEW_VERSION\"/" src-tauri/tauri.conf.json

# Cargo.toml (ligne 3)
sed -i "s/^version = \"[0-9]*\.[0-9]*\.[0-9]*\"/version = \"$NEW_VERSION\"/" src-tauri/Cargo.toml

# constants.ts
sed -i "s/APP_VERSION = '[0-9]*\.[0-9]*\.[0-9]*'/APP_VERSION = '$NEW_VERSION'/" src/constants.ts

# config.rs
sed -i "s/AGENT_VERSION: \&str = \"[0-9]*\.[0-9]*\.[0-9]*\"/AGENT_VERSION: \&str = \"$NEW_VERSION\"/" src-tauri/src/config.rs
```

**Option B : Édition manuelle**
- Ouvrir chaque fichier et modifier la version

### 3. Vérifier les modifications

```bash
# Confirmer que toutes les versions sont identiques
echo "=== Vérification des versions ==="
grep '"version":' src-tauri/tauri.conf.json | head -1
grep '^version' src-tauri/Cargo.toml
grep 'APP_VERSION' src/constants.ts
grep 'AGENT_VERSION' src-tauri/src/config.rs
```

**Sortie attendue (exemple v2.9.0) :**
```
  "version": "2.9.0",
version = "2.9.0"
export const APP_VERSION = '2.9.0';
pub const AGENT_VERSION: &str = "2.9.0";
```

### 4. Commit et Push

```bash
# Stage les fichiers
git add src-tauri/tauri.conf.json \
        src-tauri/Cargo.toml \
        src/constants.ts \
        src-tauri/src/config.rs

# Commit avec message standardisé
git commit -m "chore(v$NEW_VERSION): bump version

- tauri.conf.json
- Cargo.toml
- constants.ts
- config.rs"

# Push vers GitHub
git push origin main
```

### 5. Vérifier le Build GitHub

```bash
# Suivre le build
gh run list --repo starterclic/microdiag --limit 3

# Attendre la fin (~6 minutes)
gh run watch $(gh run list --repo starterclic/microdiag --limit 1 --json databaseId -q '.[0].databaseId')
```

### 6. Vérifier le Déploiement

```bash
# Vérifier latest.json sur le serveur
cat /srv/microdiag/public/downloads/latest.json

# Vérifier les fichiers installeurs
ls -la /srv/microdiag/public/downloads/*$NEW_VERSION*
```

---

## Checklist Rapide

- [ ] `src-tauri/tauri.conf.json` → version mise à jour
- [ ] `src-tauri/Cargo.toml` → version mise à jour
- [ ] `src/constants.ts` → APP_VERSION mise à jour
- [ ] `src-tauri/src/config.rs` → AGENT_VERSION mise à jour
- [ ] Toutes les versions sont **identiques**
- [ ] Commit effectué
- [ ] Push sur main
- [ ] Build GitHub réussi
- [ ] Deploy GitHub réussi
- [ ] latest.json affiche la nouvelle version
- [ ] Fichiers .msi et .exe présents

---

## Erreurs Courantes

### Versions désynchronisées
**Symptôme:** Le site affiche une ancienne version
**Cause:** Un des 4 fichiers n'a pas été modifié
**Solution:** Vérifier et synchroniser tous les fichiers

### Build échoue
**Symptôme:** GitHub Actions en rouge
**Cause:** Erreur de syntaxe ou dépendance
**Solution:** `gh run view <run_id> --log-failed`

### Fichiers non déployés
**Symptôme:** latest.json correct mais pas de .msi/.exe
**Cause:** Workflow deploy n'a pas copié les fichiers
**Solution:** Vérifier `/srv/microdiag/public/downloads/`

---

## Script Automatique (optionnel)

Créer `scripts/bump-version.sh` :

```bash
#!/bin/bash
set -e

if [ -z "$1" ]; then
    echo "Usage: ./bump-version.sh X.Y.Z"
    exit 1
fi

NEW_VERSION="$1"
cd /opt/Microdiag/tauri-agent

echo "Mise à jour vers v$NEW_VERSION..."

sed -i "s/\"version\": \"[0-9]*\.[0-9]*\.[0-9]*\"/\"version\": \"$NEW_VERSION\"/" src-tauri/tauri.conf.json
sed -i "s/^version = \"[0-9]*\.[0-9]*\.[0-9]*\"/version = \"$NEW_VERSION\"/" src-tauri/Cargo.toml
sed -i "s/APP_VERSION = '[0-9]*\.[0-9]*\.[0-9]*'/APP_VERSION = '$NEW_VERSION'/" src/constants.ts
sed -i "s/AGENT_VERSION: \&str = \"[0-9]*\.[0-9]*\.[0-9]*\"/AGENT_VERSION: \&str = \"$NEW_VERSION\"/" src-tauri/src/config.rs

echo "=== Vérification ==="
grep '"version":' src-tauri/tauri.conf.json | head -1
grep '^version' src-tauri/Cargo.toml
grep 'APP_VERSION' src/constants.ts
grep 'AGENT_VERSION' src-tauri/src/config.rs

echo ""
echo "Prêt à commit. Exécuter :"
echo "git add -A && git commit -m 'chore(v$NEW_VERSION): bump version' && git push origin main"
```

---

## Architecture des Versions

```
GitHub Push (main)
       │
       ▼
┌──────────────────┐
│  Build Windows   │  ← Lit version depuis Cargo.toml
│  (GitHub Actions)│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Deploy to Server│  ← Copie artifacts + génère latest.json
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  /srv/microdiag/ │
│  └─ downloads/   │
│     ├─ latest.json        ← Version pour auto-update
│     ├─ *_X.Y.Z_*.msi      ← Installeur MSI
│     └─ *_X.Y.Z_*.exe      ← Installeur NSIS
└──────────────────┘
         │
         ▼
┌──────────────────┐
│  Site Public     │  ← Affiche "Télécharger vX.Y.Z"
│  microdiag.cybtek.fr
└──────────────────┘
```

---

*Dernière mise à jour: 2026-01-02*
