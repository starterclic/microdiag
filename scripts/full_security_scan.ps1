# ============================================
# MICRODIAG SENTINEL - Full Security Scan
# Analyse complete du systeme
# ============================================

$ErrorActionPreference = "SilentlyContinue"

$report = @{
    timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    hostname = $env:COMPUTERNAME
    username = $env:USERNAME
    osVersion = [System.Environment]::OSVersion.VersionString
    sections = @()
}

function Add-Section {
    param($title, $icon, $status, $items, $explanation, $action)
    $script:report.sections += @{
        title = $title
        icon = $icon
        status = $status
        items = $items
        explanation = $explanation
        action = $action
    }
}

# ============================================
# 1. ANALYSE DES LOGS WINDOWS
# ============================================
Write-Host "[1/8] Analyse des logs systeme..."
$logItems = @()
$errorLogs = Get-WinEvent -FilterHashtable @{LogName='System';Level=2;StartTime=(Get-Date).AddDays(-7)} -MaxEvents 20 2>$null
$warningLogs = Get-WinEvent -FilterHashtable @{LogName='System';Level=3;StartTime=(Get-Date).AddDays(-7)} -MaxEvents 10 2>$null

$criticalCount = ($errorLogs | Measure-Object).Count
$warningCount = ($warningLogs | Measure-Object).Count

if ($criticalCount -gt 0) {
    foreach ($log in $errorLogs | Select-Object -First 5) {
        $msgLen = if ($log.Message) { $log.Message.Length } else { 0 }
        $logItems += @{
            type = "error"
            message = if ($msgLen -gt 0) { $log.Message.Substring(0, [Math]::Min(150, $msgLen)) + "..." } else { "Erreur systeme" }
            date = $log.TimeCreated.ToString("dd/MM HH:mm")
            source = $log.ProviderName
        }
    }
}

$logStatus = if ($criticalCount -gt 10) { "critical" } elseif ($criticalCount -gt 0) { "warning" } else { "ok" }
Add-Section -title "Logs Systeme (7 jours)" -icon "logs" -status $logStatus -items @{
    summary = "$criticalCount erreurs, $warningCount avertissements"
    details = $logItems
} -explanation "Les journaux systeme enregistrent les evenements importants. Des erreurs frequentes peuvent indiquer des problemes materiels ou logiciels." `
  -action $(if ($criticalCount -gt 5) { "Verifiez les pilotes et effectuez une analyse antivirus." } else { "Continuez a surveiller les logs regulierement." })

# ============================================
# 2. ECRANS BLEUS (BSOD)
# ============================================
Write-Host "[2/8] Recherche d'ecrans bleus..."
$bsodItems = @()
$minidumpPath = "$env:SystemRoot\Minidump"
$bsodCount = 0

if (Test-Path $minidumpPath) {
    $dumps = Get-ChildItem $minidumpPath -Filter "*.dmp" | Sort-Object LastWriteTime -Descending | Select-Object -First 5
    $bsodCount = ($dumps | Measure-Object).Count
    foreach ($dump in $dumps) {
        $bsodItems += @{
            type = "crash"
            date = $dump.LastWriteTime.ToString("dd/MM/yyyy HH:mm")
            file = $dump.Name
        }
    }
}

$bsodStatus = if ($bsodCount -gt 2) { "critical" } elseif ($bsodCount -gt 0) { "warning" } else { "ok" }
Add-Section -title "Ecrans Bleus (BSOD)" -icon "bsod" -status $bsodStatus -items @{
    summary = if ($bsodCount -eq 0) { "Aucun ecran bleu detecte" } else { "$bsodCount crash(s) detecte(s)" }
    details = $bsodItems
} -explanation "Les ecrans bleus indiquent des erreurs critiques du systeme, souvent liees a des pilotes ou du materiel defaillant." `
  -action $(if ($bsodCount -gt 0) { "Mettez a jour vos pilotes et verifiez la memoire RAM." } else { "Aucune action requise." })

# ============================================
# 3. PROTECTION ANTIVIRUS
# ============================================
Write-Host "[3/8] Verification antivirus..."
$avStatus = Get-CimInstance -Namespace "root/SecurityCenter2" -ClassName "AntiVirusProduct" 2>$null
$avEnabled = $false
$avName = "Non detecte"

if ($avStatus) {
    $avName = $avStatus.displayName | Select-Object -First 1
    $state = $avStatus.productState | Select-Object -First 1
    $avEnabled = ($state -band 0x1000) -ne 0
}

$avItems = @{
    summary = if ($avEnabled) { "$avName - Protection active" } else { "Protection desactivee ou absente" }
    antivirus = $avName
    enabled = $avEnabled
}

$avScanStatus = if (-not $avEnabled) { "critical" } else { "ok" }
Add-Section -title "Protection Antivirus" -icon "shield" -status $avScanStatus -items $avItems `
  -explanation "Un antivirus actif protege contre les logiciels malveillants. Windows Defender est integre a Windows 10/11." `
  -action $(if (-not $avEnabled) { "Activez Windows Defender ou installez un antivirus." } else { "Gardez votre antivirus a jour." })

# ============================================
# 4. APPLICATIONS A RISQUE
# ============================================
Write-Host "[4/8] Analyse des applications..."
$appItems = @()
$riskyApps = @("TeamViewer", "AnyDesk", "UltraViewer", "uTorrent", "BitTorrent", "CCleaner", "IObit")
$installedApps = Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*", "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*" 2>$null |
    Where-Object { $_.DisplayName } | Select-Object DisplayName, DisplayVersion

$riskyFound = @()
foreach ($app in $installedApps) {
    foreach ($risky in $riskyApps) {
        if ($app.DisplayName -like "*$risky*") {
            $riskyFound += @{ name = $app.DisplayName; version = $app.DisplayVersion }
        }
    }
}

$appStatus = if ($riskyFound.Count -gt 3) { "warning" } else { "ok" }
Add-Section -title "Applications a Risque" -icon "apps" -status $appStatus -items @{
    summary = "$($riskyFound.Count) application(s) a surveiller"
    details = $riskyFound
} -explanation "Certaines applications peuvent augmenter la surface d'attaque ou ralentir le systeme." `
  -action $(if ($riskyFound.Count -gt 0) { "Desinstallez les applications inutilisees." } else { "Aucune action requise." })

# ============================================
# 5. RDP (Bureau a Distance)
# ============================================
Write-Host "[5/8] Verification RDP..."
$rdpEnabled = (Get-ItemProperty "HKLM:\System\CurrentControlSet\Control\Terminal Server" -Name "fDenyTSConnections" -ErrorAction SilentlyContinue).fDenyTSConnections -eq 0
$rdpPort = (Get-ItemProperty "HKLM:\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp" -Name "PortNumber" -ErrorAction SilentlyContinue).PortNumber

$rdpStatus = if ($rdpEnabled) { "info" } else { "ok" }
Add-Section -title "Bureau a Distance (RDP)" -icon "rdp" -status $rdpStatus -items @{
    enabled = $rdpEnabled
    port = $rdpPort
    summary = if ($rdpEnabled) { "RDP actif sur port $rdpPort" } else { "RDP desactive" }
} -explanation "Le Bureau a Distance permet l'acces distant a votre PC. S'il n'est pas utilise, il est preferable de le desactiver." `
  -action $(if ($rdpEnabled) { "Desactivez RDP si vous ne l'utilisez pas." } else { "Aucune action requise." })

# ============================================
# 6. PORTS RESEAU
# ============================================
Write-Host "[6/8] Scan des ports..."
$openPorts = @()
$riskyPorts = @(21, 22, 23, 135, 139, 445, 3389, 5900)
$connections = Get-NetTCPConnection -State Listen 2>$null | Select-Object LocalPort, OwningProcess -Unique

foreach ($conn in $connections) {
    $processName = (Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue).ProcessName
    $isRisky = $conn.LocalPort -in $riskyPorts
    if ($isRisky) {
        $openPorts += @{ port = $conn.LocalPort; process = $processName; risky = $true }
    }
}

$portStatus = if ($openPorts.Count -gt 3) { "warning" } elseif ($openPorts.Count -gt 0) { "info" } else { "ok" }
Add-Section -title "Ports Reseau" -icon "network" -status $portStatus -items @{
    summary = "$($openPorts.Count) port(s) sensible(s) ouvert(s)"
    details = $openPorts
} -explanation "Les ports ouverts peuvent etre exploites par des attaquants. Fermez ceux qui ne sont pas necessaires." `
  -action $(if ($openPorts.Count -gt 0) { "Verifiez que ces ports sont necessaires." } else { "Configuration reseau securisee." })

# ============================================
# 7. PROGRAMMES AU DEMARRAGE
# ============================================
Write-Host "[7/8] Analyse du demarrage..."
$startupItems = @()
$startupPaths = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run"
)

foreach ($path in $startupPaths) {
    $items = Get-ItemProperty $path 2>$null
    if ($items) {
        $items.PSObject.Properties | Where-Object { $_.Name -notlike "PS*" } | ForEach-Object {
            $cmdLen = if ($_.Value) { $_.Value.Length } else { 0 }
            $startupItems += @{
                name = $_.Name
                command = if ($cmdLen -gt 0) { $_.Value.Substring(0, [Math]::Min(60, $cmdLen)) } else { "" }
            }
        }
    }
}

$startupCount = $startupItems.Count
$startupStatus = if ($startupCount -gt 15) { "warning" } elseif ($startupCount -gt 8) { "info" } else { "ok" }
Add-Section -title "Programmes au Demarrage" -icon "startup" -status $startupStatus -items @{
    summary = "$startupCount programme(s) au demarrage"
    details = $startupItems | Select-Object -First 10
} -explanation "Trop de programmes au demarrage ralentissent le PC. Desactivez ceux qui ne sont pas essentiels." `
  -action $(if ($startupCount -gt 10) { "Desactivez les programmes inutiles au demarrage." } else { "Nombre raisonnable de programmes." })

# ============================================
# 8. MISES A JOUR WINDOWS
# ============================================
Write-Host "[8/8] Verification des mises a jour..."
$lastUpdate = (Get-HotFix | Sort-Object InstalledOn -Descending -ErrorAction SilentlyContinue | Select-Object -First 1).InstalledOn
$daysSinceUpdate = if ($lastUpdate) { ((Get-Date) - $lastUpdate).Days } else { 999 }

$updateStatus = if ($daysSinceUpdate -gt 60) { "critical" } elseif ($daysSinceUpdate -gt 30) { "warning" } else { "ok" }
Add-Section -title "Mises a Jour Windows" -icon "update" -status $updateStatus -items @{
    summary = if ($lastUpdate) { "Derniere MAJ: il y a $daysSinceUpdate jours" } else { "Date inconnue" }
    last_update = if ($lastUpdate) { $lastUpdate.ToString("dd/MM/yyyy") } else { "Inconnue" }
    days_since = $daysSinceUpdate
} -explanation "Les mises a jour corrigent des failles de securite. Un systeme non mis a jour est vulnerable." `
  -action $(if ($daysSinceUpdate -gt 30) { "Installez les mises a jour Windows pendantes." } else { "Systeme a jour." })

# ============================================
# CALCUL DU SCORE
# ============================================
$criticalSections = ($report.sections | Where-Object { $_.status -eq "critical" }).Count
$warningSections = ($report.sections | Where-Object { $_.status -eq "warning" }).Count
$infoSections = ($report.sections | Where-Object { $_.status -eq "info" }).Count
$okSections = ($report.sections | Where-Object { $_.status -eq "ok" }).Count

$globalScore = 100
$globalScore -= ($criticalSections * 25)
$globalScore -= ($warningSections * 10)
$globalScore -= ($infoSections * 3)
$globalScore = [Math]::Max(0, [Math]::Min(100, $globalScore))

$report.score = $globalScore
$report.status = if ($globalScore -lt 50) { "critical" } elseif ($globalScore -lt 75) { "warning" } else { "ok" }

$report.message = switch ($report.status) {
    "critical" { "Votre PC necessite une attention immediate" }
    "warning" { "Quelques points meritent votre attention" }
    default { "Votre PC est en bonne sante" }
}

$report.advice = switch ($report.status) {
    "critical" { "Nous vous recommandons de corriger les problemes critiques rapidement pour proteger vos donnees." }
    "warning" { "Prenez le temps de verifier les elements signales pour optimiser la securite de votre systeme." }
    default { "Continuez a maintenir votre systeme a jour et a effectuer des scans reguliers." }
}

$report.summary = @{
    critical = $criticalSections
    warning = $warningSections
    info = $infoSections
    ok = $okSections
    total = $report.sections.Count
}

# Output JSON (une seule ligne)
$report | ConvertTo-Json -Depth 10 -Compress
