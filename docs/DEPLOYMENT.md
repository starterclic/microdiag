# Microdiag Sentinel - Guide de Déploiement

## Vue d'ensemble

Ce document décrit le processus complet de build et déploiement de Microdiag Sentinel.

## Architecture de déploiement

```
GitHub Actions (Build)
        ↓
   Artifacts (.exe, .msi, .zip, .sig)
        ↓
   Serveur Production
   /srv/microdiag/public/downloads/
        ↓
   nginx (microdiag-public container)
        ↓
   https://app.microdiag.cybtek.fr/downloads/
```

## 1. Build (GitHub Actions)

### Déclenchement automatique
Le workflow `build-windows.yml` se déclenche sur:
- Push sur `main`
- Pull request sur `main`
- Déclenchement manuel (workflow_dispatch)

### Artifacts générés

| Fichier | Description |
|---------|-------------|
| `Microdiag Sentinel_X.Y.Z_x64-setup.exe` | Installateur NSIS |
| `Microdiag Sentinel_X.Y.Z_x64-setup.nsis.zip` | ZIP pour auto-update NSIS |
| `Microdiag Sentinel_X.Y.Z_x64-setup.nsis.zip.sig` | Signature Tauri |
| `Microdiag Sentinel_X.Y.Z_x64_en-US.msi` | Installateur MSI |
| `Microdiag Sentinel_X.Y.Z_x64_en-US.msi.zip` | ZIP pour auto-update MSI |
| `Microdiag Sentinel_X.Y.Z_x64_en-US.msi.zip.sig` | Signature Tauri |

### Variables d'environnement requises (GitHub Secrets)
```
TAURI_SIGNING_PRIVATE_KEY      # Clé privée Tauri pour signer les updates
TAURI_SIGNING_PRIVATE_KEY_PASSWORD  # Mot de passe de la clé
```

## 2. Téléchargement des artifacts

```bash
# Se positionner dans le répertoire de téléchargement
cd /opt/Microdiag/downloads

# Télécharger les artifacts du dernier run réussi
gh run download <RUN_ID> --repo starterclic/microdiag

# Lister les runs récents
gh run list --repo starterclic/microdiag --limit 3
```

## 3. Renommage des fichiers

**IMPORTANT**: Les noms de fichiers générés par Tauri contiennent des espaces.
Il faut les renommer avec des points pour être compatibles avec le serveur web.

```bash
# Exemple pour v2.3.0
mv "Microdiag Sentinel_2.3.0_x64_en-US.msi" "Microdiag.Sentinel_2.3.0_x64_en-US.msi"
mv "Microdiag Sentinel_2.3.0_x64_en-US.msi.zip" "Microdiag.Sentinel_2.3.0_x64_en-US.msi.zip"
mv "Microdiag Sentinel_2.3.0_x64_en-US.msi.zip.sig" "Microdiag.Sentinel_2.3.0_x64_en-US.msi.zip.sig"
mv "Microdiag Sentinel_2.3.0_x64-setup.exe" "Microdiag.Sentinel_2.3.0_x64-setup.exe"
mv "Microdiag Sentinel_2.3.0_x64-setup.nsis.zip" "Microdiag.Sentinel_2.3.0_x64-setup.nsis.zip"
mv "Microdiag Sentinel_2.3.0_x64-setup.nsis.zip.sig" "Microdiag.Sentinel_2.3.0_x64-setup.nsis.zip.sig"
```

## 4. Copie vers le serveur de production

```bash
# Copier vers le répertoire servi par nginx
cp Microdiag.Sentinel_X.Y.Z* /srv/microdiag/public/downloads/

# Mettre à jour les symlinks "latest"
cd /srv/microdiag/public/downloads
rm -f MicrodiagSentinel_latest_setup.exe MicrodiagSentinel_latest.msi
ln -s Microdiag.Sentinel_X.Y.Z_x64-setup.exe MicrodiagSentinel_latest_setup.exe
ln -s Microdiag.Sentinel_X.Y.Z_x64_en-US.msi MicrodiagSentinel_latest.msi
```

## 5. Mise à jour de latest.json

Le fichier `latest.json` est utilisé par Tauri pour l'auto-update.

```bash
# Lire la signature du fichier .sig
cat "Microdiag.Sentinel_X.Y.Z_x64_en-US.msi.zip.sig"
cat "Microdiag.Sentinel_X.Y.Z_x64-setup.nsis.zip.sig"
```

Éditer `/srv/microdiag/public/downloads/latest.json`:

```json
{
  "version": "X.Y.Z",
  "notes": "## Microdiag Sentinel vX.Y.Z\n\n### Nouveautés\n- ...\n\n---\nBuild automatique via GitHub Actions",
  "pub_date": "2025-12-30T12:00:00.000Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<CONTENU_DU_FICHIER_MSI.ZIP.SIG>",
      "url": "https://app.microdiag.cybtek.fr/downloads/Microdiag.Sentinel_X.Y.Z_x64_en-US.msi.zip"
    },
    "windows-x86_64-msi": {
      "signature": "<CONTENU_DU_FICHIER_MSI.ZIP.SIG>",
      "url": "https://app.microdiag.cybtek.fr/downloads/Microdiag.Sentinel_X.Y.Z_x64_en-US.msi.zip"
    },
    "windows-x86_64-nsis": {
      "signature": "<CONTENU_DU_FICHIER_NSIS.ZIP.SIG>",
      "url": "https://app.microdiag.cybtek.fr/downloads/Microdiag.Sentinel_X.Y.Z_x64-setup.nsis.zip"
    }
  }
}
```

## 6. Vérification

```bash
# Vérifier l'accessibilité des fichiers
curl -sI "https://app.microdiag.cybtek.fr/downloads/Microdiag.Sentinel_X.Y.Z_x64_en-US.msi.zip" | grep -E "(HTTP|content-length)"

# Vérifier latest.json
curl -s "https://app.microdiag.cybtek.fr/downloads/latest.json" | python3 -m json.tool

# Vérifier le symlink latest
curl -sI "https://app.microdiag.cybtek.fr/downloads/MicrodiagSentinel_latest_setup.exe" | grep -E "(HTTP|content-length)"
```

## Configuration Nginx

Le fichier `/srv/microdiag/public/nginx.conf` doit contenir:

```nginx
# Serve download files directly (installers, signatures, etc.)
location /downloads/ {
    try_files $uri =404;
    types {
        application/octet-stream exe msi zip sig;
        application/json json;
    }
    default_type application/octet-stream;
    add_header Content-Disposition "attachment";
}
```

Après modification:
```bash
docker exec microdiag-public nginx -t && docker exec microdiag-public nginx -s reload
```

## Structure des répertoires

```
/opt/Microdiag/
├── downloads/           # Téléchargement temporaire des artifacts
├── tauri-agent/         # Code source Tauri
│   ├── .github/workflows/build-windows.yml
│   └── docs/DEPLOYMENT.md
└── app/downloads/       # Backup local

/srv/microdiag/public/
├── downloads/           # Servi par nginx
│   ├── latest.json
│   ├── Microdiag.Sentinel_*.exe
│   ├── Microdiag.Sentinel_*.msi
│   ├── Microdiag.Sentinel_*.zip
│   ├── Microdiag.Sentinel_*.sig
│   └── MicrodiagSentinel_latest_* (symlinks)
└── nginx.conf           # Config nginx
```

## Script de déploiement rapide

```bash
#!/bin/bash
# deploy-version.sh X.Y.Z

VERSION=$1
if [ -z "$VERSION" ]; then
    echo "Usage: $0 X.Y.Z"
    exit 1
fi

cd /opt/Microdiag/downloads

# 1. Télécharger le dernier run
RUN_ID=$(gh run list --repo starterclic/microdiag --status success --limit 1 --json databaseId -q '.[0].databaseId')
gh run download $RUN_ID --repo starterclic/microdiag

# 2. Renommer et copier
for f in MicrodiagSentinel-*/*; do
    newname=$(basename "$f" | sed 's/Microdiag Sentinel/Microdiag.Sentinel/g')
    cp "$f" "/srv/microdiag/public/downloads/$newname"
done

# 3. Mettre à jour les symlinks
cd /srv/microdiag/public/downloads
rm -f MicrodiagSentinel_latest_setup.exe MicrodiagSentinel_latest.msi
ln -s "Microdiag.Sentinel_${VERSION}_x64-setup.exe" MicrodiagSentinel_latest_setup.exe
ln -s "Microdiag.Sentinel_${VERSION}_x64_en-US.msi" MicrodiagSentinel_latest.msi

# 4. Afficher les signatures pour latest.json
echo "=== MSI Signature ==="
cat "Microdiag.Sentinel_${VERSION}_x64_en-US.msi.zip.sig"
echo ""
echo "=== NSIS Signature ==="
cat "Microdiag.Sentinel_${VERSION}_x64-setup.nsis.zip.sig"

echo ""
echo "N'oubliez pas de mettre à jour latest.json avec les signatures ci-dessus!"
```

## Troubleshooting

### Les fichiers .zip renvoient une page HTML
- Vérifier que la config nginx inclut la section `/downloads/`
- Recharger nginx: `docker exec microdiag-public nginx -s reload`

### L'auto-update échoue avec "signature verification failed"
- Vérifier que la signature dans latest.json correspond au fichier .sig
- Vérifier que l'URL pointe vers le fichier .zip (pas le .msi ou .exe directement)

### Fichiers non trouvés (404)
- Vérifier que les fichiers sont dans `/srv/microdiag/public/downloads/`
- Vérifier les noms (pas d'espaces, utiliser des points)
