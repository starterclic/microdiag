-- ============================================
-- MICRODIAG - SECURISATION COMPLETE SUPABASE
-- Exécuter dans: Supabase Dashboard > SQL Editor
-- ============================================

-- ============================================
-- 0. NETTOYAGE URGENT - Supprimer compte test
-- ============================================
-- Supprimer le profil du hacker test
DELETE FROM profiles WHERE email = 'hacker@test.com';

-- Supprimer l'utilisateur auth (nécessite admin)
-- À faire dans Dashboard > Authentication > Users > Supprimer hacker@test.com
-- Ou exécuter: DELETE FROM auth.users WHERE email = 'hacker@test.com';

-- ============================================
-- 1. PROFILES (données utilisateurs)
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;

-- Utilisateurs voient leur propre profil
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Utilisateurs modifient leur propre profil
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admins peuvent tout faire
CREATE POLICY "profiles_admin_all" ON profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 2. DEVICES (appareils des utilisateurs)
-- ============================================
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "devices_select_own" ON devices;
DROP POLICY IF EXISTS "devices_insert_own" ON devices;
DROP POLICY IF EXISTS "devices_update_own" ON devices;
DROP POLICY IF EXISTS "devices_delete_own" ON devices;
DROP POLICY IF EXISTS "devices_agent_upsert" ON devices;
DROP POLICY IF EXISTS "devices_admin_all" ON devices;

-- Utilisateurs voient leurs propres devices
CREATE POLICY "devices_select_own" ON devices
  FOR SELECT USING (
    user_id = auth.uid() OR
    user_id IS NULL  -- Devices non liés (avant association)
  );

-- Agents peuvent s'enregistrer/mettre à jour via device_token
-- Note: L'agent utilise le heartbeat endpoint (Edge Function) qui a service_role
-- Donc on bloque l'accès direct anon pour les insertions
CREATE POLICY "devices_insert_authenticated" ON devices
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

CREATE POLICY "devices_update_own" ON devices
  FOR UPDATE USING (
    user_id = auth.uid() OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

CREATE POLICY "devices_delete_own" ON devices
  FOR DELETE USING (user_id = auth.uid());

-- Admins peuvent tout voir
CREATE POLICY "devices_admin_all" ON devices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 3. SCRIPTS (scripts de maintenance)
-- ============================================
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scripts_public_read" ON scripts;
DROP POLICY IF EXISTS "scripts_admin_manage" ON scripts;

-- Lecture publique des scripts actifs (nécessaire pour l'agent)
CREATE POLICY "scripts_public_read" ON scripts
  FOR SELECT USING (is_active = true);

-- Seuls les admins peuvent créer/modifier/supprimer
CREATE POLICY "scripts_admin_manage" ON scripts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 4. AI_API_KEYS (clés API sensibles)
-- ============================================
ALTER TABLE ai_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_api_keys_admin_only" ON ai_api_keys;

-- UNIQUEMENT les admins - AUCUN accès public
CREATE POLICY "ai_api_keys_admin_only" ON ai_api_keys
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 5. AI_MODELS (modèles IA)
-- ============================================
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_models_public_read" ON ai_models;
DROP POLICY IF EXISTS "ai_models_admin_manage" ON ai_models;

-- Lecture publique des modèles actifs
CREATE POLICY "ai_models_public_read" ON ai_models
  FOR SELECT USING (is_active = true);

-- Admins gèrent
CREATE POLICY "ai_models_admin_manage" ON ai_models
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 6. AI_PROMPTS (prompts IA)
-- ============================================
ALTER TABLE ai_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_prompts_public_read" ON ai_prompts;
DROP POLICY IF EXISTS "ai_prompts_admin_manage" ON ai_prompts;

-- Lecture publique des prompts actifs
CREATE POLICY "ai_prompts_public_read" ON ai_prompts
  FOR SELECT USING (is_active = true);

-- Admins gèrent
CREATE POLICY "ai_prompts_admin_manage" ON ai_prompts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 7. APP_VERSIONS (versions de l'app)
-- ============================================
ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_versions_public_read" ON app_versions;
DROP POLICY IF EXISTS "app_versions_admin_manage" ON app_versions;

-- Lecture publique (nécessaire pour auto-update)
CREATE POLICY "app_versions_public_read" ON app_versions
  FOR SELECT USING (true);

-- Seuls admins peuvent publier des versions
CREATE POLICY "app_versions_admin_manage" ON app_versions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 8. AGENT_COMMANDS (commandes vers agents)
-- ============================================
ALTER TABLE agent_commands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_commands_device_read" ON agent_commands;
DROP POLICY IF EXISTS "agent_commands_admin_manage" ON agent_commands;

-- Les agents lisent leurs propres commandes (via device_id match)
-- Note: Nécessite que l'agent s'authentifie ou passe par Edge Function
CREATE POLICY "agent_commands_device_read" ON agent_commands
  FOR SELECT USING (
    device_id IN (SELECT device_token FROM devices WHERE user_id = auth.uid())
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- Admins peuvent créer/gérer les commandes
CREATE POLICY "agent_commands_admin_manage" ON agent_commands
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 9. SECURITY_LOGS (logs de sécurité)
-- ============================================
-- Vérifier si la table existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'security_logs') THEN
    ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;

    -- Supprimer policies existantes
    DROP POLICY IF EXISTS "security_logs_insert" ON security_logs;
    DROP POLICY IF EXISTS "security_logs_select_own" ON security_logs;
    DROP POLICY IF EXISTS "security_logs_admin_read" ON security_logs;

    -- Insertion via service_role uniquement (Edge Functions)
    EXECUTE 'CREATE POLICY "security_logs_insert" ON security_logs
      FOR INSERT WITH CHECK (
        current_setting(''request.jwt.claims'', true)::json->>''role'' = ''service_role''
      )';

    -- Utilisateurs voient leurs propres logs
    EXECUTE 'CREATE POLICY "security_logs_select_own" ON security_logs
      FOR SELECT USING (
        device_token IN (SELECT device_token FROM devices WHERE user_id = auth.uid())
      )';

    -- Admins voient tout
    EXECUTE 'CREATE POLICY "security_logs_admin_read" ON security_logs
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ''admin'')
      )';
  END IF;
END $$;

-- ============================================
-- 10. SUBSCRIPTIONS (abonnements)
-- ============================================
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_select_own" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_admin_manage" ON subscriptions;

-- Utilisateurs voient leur abonnement
CREATE POLICY "subscriptions_select_own" ON subscriptions
  FOR SELECT USING (user_id = auth.uid());

-- Admins gèrent (et webhooks Stripe via service_role)
CREATE POLICY "subscriptions_admin_manage" ON subscriptions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- ============================================
-- 11. SUPPORT_REQUESTS (demandes support)
-- ============================================
ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_requests_select_own" ON support_requests;
DROP POLICY IF EXISTS "support_requests_insert_own" ON support_requests;
DROP POLICY IF EXISTS "support_requests_admin_manage" ON support_requests;

-- Utilisateurs voient leurs demandes
CREATE POLICY "support_requests_select_own" ON support_requests
  FOR SELECT USING (user_id = auth.uid());

-- Utilisateurs créent leurs demandes
CREATE POLICY "support_requests_insert_own" ON support_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Admins gèrent tout
CREATE POLICY "support_requests_admin_manage" ON support_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 12. TICKET_MESSAGES (messages tickets)
-- ============================================
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ticket_messages_select_related" ON ticket_messages;
DROP POLICY IF EXISTS "ticket_messages_insert_own" ON ticket_messages;
DROP POLICY IF EXISTS "ticket_messages_admin_manage" ON ticket_messages;

-- Utilisateurs voient les messages de leurs tickets
CREATE POLICY "ticket_messages_select_related" ON ticket_messages
  FOR SELECT USING (
    ticket_id IN (SELECT id FROM support_requests WHERE user_id = auth.uid())
    OR author_id = auth.uid()
  );

-- Utilisateurs peuvent ajouter des messages
CREATE POLICY "ticket_messages_insert_own" ON ticket_messages
  FOR INSERT WITH CHECK (author_id = auth.uid());

-- Admins gèrent tout
CREATE POLICY "ticket_messages_admin_manage" ON ticket_messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 13. SECURISER LES FONCTIONS RPC
-- ============================================

-- Révoquer l'accès public aux fonctions sensibles
REVOKE EXECUTE ON FUNCTION generate_device_token FROM anon;
REVOKE EXECUTE ON FUNCTION generate_device_token FROM authenticated;

-- Seuls les service_role peuvent générer des tokens
GRANT EXECUTE ON FUNCTION generate_device_token TO service_role;

-- get_user_role reste accessible (utile pour l'UI)
-- check_update reste accessible (nécessaire pour auto-update)

-- ============================================
-- 14. MISE A JOUR VERSION APP
-- ============================================

-- Insérer la nouvelle version 2.2.0
INSERT INTO app_versions (version, release_notes, download_url, is_mandatory, platform, published_at)
VALUES (
  '2.2.0',
  'Corrections: scan sécurité, auto-update, fenêtre premier plan, scripts permissions',
  'https://app.microdiag.cybtek.fr/downloads/Microdiag.Sentinel_2.2.0_x64-setup.exe',
  false,
  'windows',
  NOW()
)
ON CONFLICT (version) DO UPDATE SET
  release_notes = EXCLUDED.release_notes,
  download_url = EXCLUDED.download_url,
  published_at = NOW();

-- ============================================
-- 14b. MISE A JOUR SCRIPTS (permissions admin)
-- ============================================

-- Script Réparation Imprimante - Version PowerShell avec élévation
UPDATE scripts SET
  language = 'powershell',
  code = '$ErrorActionPreference = "SilentlyContinue"

function Test-Admin {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

Write-Host "=== Reparation du service d''impression ===" -ForegroundColor Cyan

if (-not (Test-Admin)) {
    Write-Host "[ERREUR] Ce script necessite des droits administrateur." -ForegroundColor Red
    Write-Host "Veuillez relancer l''application en tant qu''administrateur:" -ForegroundColor Yellow
    Write-Host "  - Clic droit sur Microdiag Sentinel" -ForegroundColor White
    Write-Host "  - Executer en tant qu''administrateur" -ForegroundColor White
    exit 1
}

Write-Host "[OK] Droits administrateur confirmes" -ForegroundColor Green

Write-Host "[1/4] Arret du service Spooler..." -ForegroundColor White
Stop-Service -Name Spooler -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "[2/4] Nettoyage des travaux bloques..." -ForegroundColor White
$spoolPath = "$env:SystemRoot\System32\spool\PRINTERS"
if (Test-Path $spoolPath) {
    $files = Get-ChildItem -Path $spoolPath -ErrorAction SilentlyContinue
    $count = ($files | Measure-Object).Count
    $files | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Host "   $count fichier(s) supprime(s)" -ForegroundColor Gray
}

Write-Host "[3/4] Nettoyage du cache..." -ForegroundColor White
$shadowPath = "$env:SystemRoot\System32\spool\SERVERS"
if (Test-Path $shadowPath) {
    Get-ChildItem -Path $shadowPath -Recurse -ErrorAction SilentlyContinue | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
}

Write-Host "[4/4] Redemarrage du service Spooler..." -ForegroundColor White
Start-Service -Name Spooler -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$spoolerStatus = Get-Service -Name Spooler -ErrorAction SilentlyContinue
if ($spoolerStatus.Status -eq "Running") {
    Write-Host ""
    Write-Host "=== SUCCES ===" -ForegroundColor Green
    Write-Host "Le service d''impression a ete repare!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "=== ATTENTION ===" -ForegroundColor Yellow
    Write-Host "Le service n''a pas redemarre. Essayez de redemarrer votre PC." -ForegroundColor Yellow
}',
  updated_at = NOW()
WHERE slug = 'fix_printer';

-- Script Réparation Réseau - Version PowerShell avec meilleure gestion
UPDATE scripts SET
  language = 'powershell',
  code = '$ErrorActionPreference = "SilentlyContinue"

function Test-Admin {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

Write-Host "=== Reparation Reseau WiFi/DNS ===" -ForegroundColor Cyan

$isAdmin = Test-Admin
if (-not $isAdmin) {
    Write-Host "[!] Mode limite (sans droits admin)" -ForegroundColor Yellow
}

Write-Host "[1/5] Vidage du cache DNS..." -ForegroundColor White
ipconfig /flushdns | Out-Null
Write-Host "   Cache DNS vide" -ForegroundColor Gray

Write-Host "[2/5] Renouvellement IP..." -ForegroundColor White
ipconfig /release | Out-Null
Start-Sleep -Seconds 2
ipconfig /renew | Out-Null
Write-Host "   Adresse IP renouvelee" -ForegroundColor Gray

if ($isAdmin) {
    Write-Host "[3/5] Reset du catalogue Winsock..." -ForegroundColor White
    netsh winsock reset | Out-Null
    Write-Host "   Winsock reinitialise" -ForegroundColor Gray

    Write-Host "[4/5] Reset de la stack IP..." -ForegroundColor White
    netsh int ip reset | Out-Null
    Write-Host "   Stack IP reinitialisee" -ForegroundColor Gray
} else {
    Write-Host "[3/5] Reset Winsock (ignore - necessite admin)" -ForegroundColor DarkGray
    Write-Host "[4/5] Reset IP (ignore - necessite admin)" -ForegroundColor DarkGray
}

Write-Host "[5/5] Test de connectivite..." -ForegroundColor White
$test = Test-NetConnection -ComputerName "8.8.8.8" -Port 53 -WarningAction SilentlyContinue
if ($test.TcpTestSucceeded) {
    Write-Host ""
    Write-Host "=== SUCCES ===" -ForegroundColor Green
    Write-Host "Connexion Internet OK!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "=== ATTENTION ===" -ForegroundColor Yellow
    Write-Host "Pas de connexion Internet detectee." -ForegroundColor Yellow
    Write-Host "Verifiez votre cable ou connexion WiFi." -ForegroundColor White
}

if (-not $isAdmin) {
    Write-Host ""
    Write-Host "[i] Pour une reparation complete, relancez en tant qu''administrateur." -ForegroundColor Cyan
}',
  updated_at = NOW()
WHERE slug = 'fix_network';

-- ============================================
-- 15. NETTOYER LES POLICIES CONFLICTUELLES
-- ============================================

-- S'assurer qu'il n'y a pas de policy "allow all" résiduelle
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
    AND policyname LIKE '%allow%all%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    RAISE NOTICE 'Dropped policy: % on %', pol.policyname, pol.tablename;
  END LOOP;
END $$;

-- ============================================
-- VERIFICATION FINALE
-- ============================================
SELECT
  schemaname,
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Lister toutes les policies actives
SELECT
  tablename,
  policyname,
  cmd as operation,
  qual as "using_clause"
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
