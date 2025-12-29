# Configuration des Secrets GitHub

Guide pour configurer les secrets nécessaires aux workflows CI/CD.

## Accès aux secrets

1. Va sur https://github.com/starterclic/microdiag/settings/secrets/actions
2. Clique "New repository secret" pour chaque secret ci-dessous

---

## Secrets Requis pour le Déploiement

### `SERVER_HOST`
```
vmi1467776.contaboserver.net
```

### `SERVER_USER`
```
root
```

### `SERVER_SSH_KEY`
Copie la clé privée complète (incluant BEGIN et END) :
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACDuxm9+b+c7aHDGkEAcu09FTraeuNeTSD/aDG9rsI0RRAAAAKhqNJS5ajSU
uQAAAAtzc2gtZWQyNTUxOQAAACDuxm9+b+c7aHDGkEAcu09FTraeuNeTSD/aDG9rsI0RRA
AAAEDyPBtku43kntWV+T0Wg56jzXrS8FqXgEKSWlPCXwnQkO7Gb35v5ztocMaQQBy7T0VO
tp6415NIP9oMb2uwjRFEAAAAH2dpdGh1Yi1hY3Rpb25zLWRlcGxveUBtaWNyb2RpYWcBAg
MEBQY=
-----END OPENSSH PRIVATE KEY-----
```

---

## Secrets Optionnels pour la Signature Windows

### `WINDOWS_CERTIFICATE`
Certificat de signature de code Windows encodé en Base64.

Pour encoder un certificat .pfx :
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pfx"))
```

### `WINDOWS_CERTIFICATE_PASSWORD`
Mot de passe du certificat .pfx

### Où obtenir un certificat de signature ?

**Options gratuites/peu coûteuses :**
- **Certum** (~$50/an) - Certificat Open Source
- **SignPath** - Gratuit pour projets open source

**Options professionnelles :**
- **DigiCert** (~$400/an)
- **Sectigo** (~$200/an)
- **GlobalSign** (~$300/an)

---

## Secrets Tauri (optionnel)

### `TAURI_SIGNING_PRIVATE_KEY`
Clé privée pour la signature des mises à jour Tauri.

Générer une clé :
```bash
npx @tauri-apps/cli signer generate -w ~/.tauri/myapp.key
```

### `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
Mot de passe de la clé Tauri.

---

## Vérification

Après avoir configuré les secrets, lance le workflow manuellement :
1. Va sur https://github.com/starterclic/microdiag/actions
2. Sélectionne "Deploy to Server"
3. Clique "Run workflow"

Les logs montreront si la connexion SSH fonctionne.
