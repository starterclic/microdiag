# MICRODIAG SENTINEL - Full Security Scan v2.0
$ErrorActionPreference = "SilentlyContinue"

function Clean-String {
    param([string]$text, [int]$maxLen = 150)
    if ([string]::IsNullOrEmpty($text)) { return "" }
    $text = $text -replace '[^\x20-\x7E]', ''
    $text = $text -replace '["\\/]', ' '
    $text = $text -replace '[\r\n\t]', ' '
    $text = $text -replace '\s+', ' '
    $text = $text.Trim()
    if ($text.Length -gt $maxLen) { $text = $text.Substring(0, $maxLen) }
    return $text
}

$sections = @()

# 1. LOGS WINDOWS
Write-Host "[1/10] Analyse logs systeme..."
$logItems = @()
try {
    $errorLogs = @(Get-WinEvent -FilterHashtable @{LogName='System';Level=2;StartTime=(Get-Date).AddDays(-7)} -MaxEvents 50 2>$null)
    $warningLogs = @(Get-WinEvent -FilterHashtable @{LogName='System';Level=3;StartTime=(Get-Date).AddDays(-7)} -MaxEvents 30 2>$null)
    $appErrors = @(Get-WinEvent -FilterHashtable @{LogName='Application';Level=2;StartTime=(Get-Date).AddDays(-7)} -MaxEvents 20 2>$null)
} catch {
    $errorLogs = @(); $warningLogs = @(); $appErrors = @()
}
$criticalCount = $errorLogs.Count
$warningCount = $warningLogs.Count
$appErrorCount = $appErrors.Count

foreach ($log in $errorLogs | Select-Object -First 5) {
    if ($log) {
        $logItems += @{
            type = "error"
            message = (Clean-String $log.Message)
            date = $log.TimeCreated.ToString("dd/MM HH:mm")
            source = (Clean-String $log.ProviderName)
        }
    }
}

$logStatus = if ($criticalCount -gt 20) { "critical" } elseif ($criticalCount -gt 5) { "warning" } else { "ok" }
$logExplain = if ($criticalCount -gt 20) { "Nombre eleve d erreurs systeme detectees. Cela peut indiquer un probleme materiel ou logiciel necessitant une attention." } elseif ($criticalCount -gt 5) { "Quelques erreurs detectees dans les logs. Surveillance recommandee." } else { "Les logs systeme sont sains. Aucune anomalie majeure detectee." }
$logAction = if ($criticalCount -gt 20) { "Nous recommandons un diagnostic approfondi par un technicien." } elseif ($criticalCount -gt 5) { "Continuez a surveiller. Contactez-nous si les problemes persistent." } else { "" }

$sections += @{
    title = "Journaux Systeme Windows"
    icon = "logs"
    status = $logStatus
    explanation = $logExplain
    action = $logAction
    items = @{
        summary = "$criticalCount erreurs systeme, $warningCount avertissements"
        details = $logItems
    }
}

# 2. BSOD
Write-Host "[2/10] Recherche ecrans bleus..."
$bsodItems = @()
$bsodCount = 0
$minidumpPath = "$env:SystemRoot\Minidump"
if (Test-Path $minidumpPath) {
    $dumps = @(Get-ChildItem $minidumpPath -Filter "*.dmp" 2>$null | Sort-Object LastWriteTime -Descending | Select-Object -First 10)
    $bsodCount = $dumps.Count
    foreach ($d in $dumps) {
        $bsodItems += @{ date = $d.LastWriteTime.ToString("dd/MM/yyyy HH:mm"); file = $d.Name }
    }
}

$bsodStatus = if ($bsodCount -gt 3) { "critical" } elseif ($bsodCount -gt 0) { "warning" } else { "ok" }
$bsodExplain = if ($bsodCount -gt 3) { "Plusieurs ecrans bleus detectes. Problemes de stabilite serieux pouvant etre lies au materiel ou pilotes." } elseif ($bsodCount -gt 0) { "Des ecrans bleus ont ete detectes. Merite attention." } else { "Excellent ! Aucun ecran bleu detecte. Systeme stable." }
$bsodAction = if ($bsodCount -gt 3) { "Intervention recommandee pour analyser les crashs." } elseif ($bsodCount -gt 0) { "Surveillez la situation." } else { "" }

$sections += @{
    title = "Stabilite Systeme (BSOD)"
    icon = "bsod"
    status = $bsodStatus
    explanation = $bsodExplain
    action = $bsodAction
    items = @{ summary = if ($bsodCount -eq 0) { "Aucun ecran bleu - Systeme stable" } else { "$bsodCount crash(s) detecte(s)" }; details = $bsodItems }
}

# 3. ANTIVIRUS
Write-Host "[3/10] Verification antivirus..."
$avEnabled = $false
$rtProtection = $false
$fwEnabled = $false

try {
    $defender = Get-MpComputerStatus 2>$null
    if ($defender) {
        $avEnabled = $defender.AntivirusEnabled
        $rtProtection = $defender.RealTimeProtectionEnabled
    }
} catch {}

try {
    $fw = Get-NetFirewallProfile -Profile Domain,Public,Private 2>$null
    $fwEnabled = ($fw | Where-Object { $_.Enabled -eq $true }).Count -gt 0
} catch {}

$avDetails = @()
$avDetails += @{ name = "Antivirus actif"; value = if ($avEnabled) { "Oui" } else { "Non" }; status = if ($avEnabled) { "ok" } else { "critical" } }
$avDetails += @{ name = "Protection temps reel"; value = if ($rtProtection) { "Activee" } else { "Desactivee" }; status = if ($rtProtection) { "ok" } else { "critical" } }
$avDetails += @{ name = "Pare-feu Windows"; value = if ($fwEnabled) { "Actif" } else { "Inactif" }; status = if ($fwEnabled) { "ok" } else { "warning" } }

$securityScore = 0
if ($avEnabled) { $securityScore += 40 }
if ($rtProtection) { $securityScore += 40 }
if ($fwEnabled) { $securityScore += 20 }

$avStatus = if ($securityScore -lt 50) { "critical" } elseif ($securityScore -lt 80) { "warning" } else { "ok" }
$avExplain = if ($securityScore -ge 80) { "Protection antivirus optimale. Windows Defender protege activement votre PC." } elseif ($securityScore -ge 50) { "Certaines protections desactivees. PC partiellement protege." } else { "ALERTE: Protections insuffisantes. PC vulnerable." }
$avAction = if ($securityScore -lt 80) { "Activez toutes les protections Windows immediatement." } else { "" }

$sections += @{
    title = "Protection Antivirus"
    icon = "shield"
    status = $avStatus
    explanation = $avExplain
    action = $avAction
    items = @{ summary = "Score securite: $securityScore%"; details = $avDetails; score = $securityScore }
}

# 4. APPLICATIONS RISQUE
Write-Host "[4/10] Analyse applications..."
$riskyAppsList = @("TeamViewer", "AnyDesk", "UltraViewer", "LogMeIn", "uTorrent", "BitTorrent", "qBittorrent", "CCleaner", "IObit")
$apps = @(Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*", "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*" 2>$null | Where-Object { $_.DisplayName })
$totalApps = $apps.Count

$riskyFound = @()
foreach ($app in $apps) {
    foreach ($r in $riskyAppsList) {
        if ($app.DisplayName -like "*$r*") {
            $riskyFound += @{ name = (Clean-String $app.DisplayName 50); version = (Clean-String $app.DisplayVersion 20) }
        }
    }
}

$appStatus = if ($riskyFound.Count -gt 3) { "warning" } else { "ok" }
$appExplain = if ($riskyFound.Count -gt 0) { "Certaines applications presentent des risques. Souvent exploitees par des pirates." } else { "Aucune application a risque majeur detectee." }
$appAction = if ($riskyFound.Count -gt 0) { "Evaluez si ces applications sont necessaires." } else { "" }

$sections += @{
    title = "Applications a Risque"
    icon = "apps"
    status = $appStatus
    explanation = $appExplain
    action = $appAction
    items = @{ summary = "$($riskyFound.Count) app(s) risque sur $totalApps"; details = $riskyFound; total = $totalApps }
}

# 5. RDP
Write-Host "[5/10] Verification RDP..."
$rdpEnabled = $false
try {
    $rdpReg = Get-ItemProperty "HKLM:\System\CurrentControlSet\Control\Terminal Server" -Name "fDenyTSConnections" 2>$null
    if ($rdpReg) { $rdpEnabled = $rdpReg.fDenyTSConnections -eq 0 }
} catch {}

$rdpStatus = if ($rdpEnabled) { "warning" } else { "ok" }
$rdpExplain = if ($rdpEnabled) { "Bureau a distance actif. Cible frequente des ransomwares." } else { "Bureau a distance desactive. Configuration securisee." }
$rdpAction = if ($rdpEnabled) { "Desactivez RDP si non necessaire." } else { "" }

$sections += @{
    title = "Bureau a Distance (RDP)"
    icon = "rdp"
    status = $rdpStatus
    explanation = $rdpExplain
    action = $rdpAction
    items = @{ summary = if ($rdpEnabled) { "RDP actif - Attention" } else { "RDP desactive - OK" }; details = @(); enabled = $rdpEnabled }
}

# 6. PORTS RESEAU
Write-Host "[6/10] Scan ports reseau..."
$openPorts = @()
$riskyPortsMap = @{ 21="FTP"; 22="SSH"; 23="Telnet"; 135="RPC"; 139="NetBIOS"; 445="SMB"; 1433="SQL"; 3306="MySQL"; 3389="RDP"; 5900="VNC" }
$conns = @(Get-NetTCPConnection -State Listen 2>$null | Select-Object LocalPort, OwningProcess -Unique | Select-Object -First 30)
foreach ($c in $conns) {
    $pname = ""
    try { $pname = (Get-Process -Id $c.OwningProcess 2>$null).ProcessName } catch {}
    $isRisky = $riskyPortsMap.ContainsKey($c.LocalPort)
    $desc = if ($isRisky) { $riskyPortsMap[$c.LocalPort] } else { "" }
    $openPorts += @{ port = $c.LocalPort; process = (Clean-String $pname 30); risky = $isRisky; desc = $desc }
}
$riskyCount = @($openPorts | Where-Object { $_.risky }).Count
$portStatus = if ($riskyCount -gt 3) { "critical" } elseif ($riskyCount -gt 0) { "warning" } else { "ok" }
$portExplain = if ($riskyCount -gt 3) { "Plusieurs ports sensibles ouverts. Cibles frequentes des attaquants." } elseif ($riskyCount -gt 0) { "Certains ports risques ouverts." } else { "Configuration reseau saine." }
$portAction = if ($riskyCount -gt 0) { "Fermez les ports inutiles via le pare-feu." } else { "" }

$sections += @{
    title = "Ports Reseau"
    icon = "network"
    status = $portStatus
    explanation = $portExplain
    action = $portAction
    items = @{ summary = "$($openPorts.Count) ports, $riskyCount sensible(s)"; details = @($openPorts | Where-Object { $_.risky }); total = $openPorts.Count }
}

# 7. EXTENSIONS CHROME
Write-Host "[7/10] Analyse extensions..."
$chromeExt = @()
$suspCount = 0
$chromePath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Extensions"
if (Test-Path $chromePath) {
    $exts = @(Get-ChildItem $chromePath -Directory 2>$null | Select-Object -First 20)
    foreach ($e in $exts) {
        $mf = Get-ChildItem $e.FullName -Recurse -Filter "manifest.json" 2>$null | Select-Object -First 1
        if ($mf) {
            try {
                $m = Get-Content $mf.FullName -Raw 2>$null | ConvertFrom-Json
                $perms = if ($m.permissions) { $m.permissions -join "," } else { "" }
                $isSuspicious = $perms -match "tabs|webRequest|cookies|<all_urls>|clipboardRead|history"
                if ($m.name -notmatch "^__MSG" -and $m.name) {
                    if ($isSuspicious) { $suspCount++ }
                    $chromeExt += @{ name = (Clean-String $m.name 60); suspicious = $isSuspicious }
                }
            } catch {}
        }
    }
}

$chromeStatus = if ($suspCount -gt 5) { "warning" } elseif ($suspCount -gt 2) { "info" } else { "ok" }
$chromeExplain = if ($suspCount -gt 5) { "Plusieurs extensions avec permissions etendues. Peuvent voir vos donnees sensibles." } elseif ($suspCount -gt 0) { "Certaines extensions ont des permissions sensibles." } else { "Extensions sous controle." }
$chromeAction = if ($suspCount -gt 2) { "Supprimez les extensions inutiles ou inconnues." } else { "" }

$sections += @{
    title = "Extensions Chrome"
    icon = "browser"
    status = $chromeStatus
    explanation = $chromeExplain
    action = $chromeAction
    items = @{ summary = "$($chromeExt.Count) extensions, $suspCount sensibles"; details = @($chromeExt | Where-Object { $_.suspicious }) }
}

# 8. PROGRAMMES DEMARRAGE
Write-Host "[8/10] Analyse demarrage..."
$startItems = @()
$paths = @("HKCU:\Software\Microsoft\Windows\CurrentVersion\Run", "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run")
foreach ($p in $paths) {
    try {
        $items = Get-ItemProperty $p 2>$null
        if ($items) {
            $items.PSObject.Properties | Where-Object { $_.Name -notlike "PS*" } | ForEach-Object {
                $startItems += @{ name = (Clean-String $_.Name 40); command = (Clean-String $_.Value 80) }
            }
        }
    } catch {}
}
$startCount = $startItems.Count
$startStatus = if ($startCount -gt 20) { "warning" } elseif ($startCount -gt 12) { "info" } else { "ok" }
$startExplain = if ($startCount -gt 20) { "Trop de programmes au demarrage. Ralentit votre PC." } elseif ($startCount -gt 12) { "Nombre modere. Optimisation possible." } else { "Demarrage optimise." }
$startAction = if ($startCount -gt 12) { "Desactivez les programmes inutiles via Gestionnaire des taches." } else { "" }

$sections += @{
    title = "Programmes Demarrage"
    icon = "startup"
    status = $startStatus
    explanation = $startExplain
    action = $startAction
    items = @{ summary = "$startCount programmes"; details = @($startItems | Select-Object -First 10); total = $startCount }
}

# 9. ESPACE DISQUE
Write-Host "[9/10] Verification espace disque..."
$diskItems = @()
$diskWarning = $false
$diskCritical = $false

$disks = Get-WmiObject Win32_LogicalDisk -Filter "DriveType=3" 2>$null
foreach ($disk in $disks) {
    $freeGB = [math]::Round($disk.FreeSpace / 1GB, 1)
    $totalGB = [math]::Round($disk.Size / 1GB, 1)
    $usedPercent = [math]::Round((($disk.Size - $disk.FreeSpace) / $disk.Size) * 100, 0)
    $status = "ok"
    if ($usedPercent -gt 95) { $status = "critical"; $diskCritical = $true }
    elseif ($usedPercent -gt 85) { $status = "warning"; $diskWarning = $true }
    $diskItems += @{ drive = $disk.DeviceID; freeGB = $freeGB; totalGB = $totalGB; usedPercent = $usedPercent; status = $status }
}

$diskStatus = if ($diskCritical) { "critical" } elseif ($diskWarning) { "warning" } else { "ok" }
$diskExplain = if ($diskCritical) { "ALERTE: Espace disque critique. PC peut devenir instable." } elseif ($diskWarning) { "Espace limite. Pensez a faire du menage." } else { "Espace disque suffisant." }
$diskAction = if ($diskCritical -or $diskWarning) { "Liberez de l espace: supprimez fichiers inutiles, videz corbeille." } else { "" }

$sections += @{
    title = "Espace Disque"
    icon = "disk"
    status = $diskStatus
    explanation = $diskExplain
    action = $diskAction
    items = @{ summary = "Analyse de $($diskItems.Count) lecteur(s)"; details = $diskItems }
}

# 10. MISES A JOUR
Write-Host "[10/10] Verification mises a jour..."
$days = 0
$lastUpdateDate = "Inconnue"
try {
    $last = (Get-HotFix 2>$null | Sort-Object InstalledOn -Descending | Select-Object -First 1)
    if ($last -and $last.InstalledOn) {
        $days = ((Get-Date) - $last.InstalledOn).Days
        $lastUpdateDate = $last.InstalledOn.ToString("dd/MM/yyyy")
    }
} catch { $days = 999 }

$upStatus = if ($days -gt 60) { "critical" } elseif ($days -gt 30) { "warning" } else { "ok" }
$upExplain = if ($days -gt 60) { "ALERTE: PC non mis a jour depuis 2 mois. Vulnerable aux failles recentes." } elseif ($days -gt 30) { "Mises a jour en retard. Correctifs importants manquants." } else { "Mises a jour a jour. Derniers correctifs installes." }
$upAction = if ($days -gt 30) { "Lancez Windows Update immediatement." } else { "" }

$sections += @{
    title = "Mises a Jour Windows"
    icon = "update"
    status = $upStatus
    explanation = $upExplain
    action = $upAction
    items = @{ summary = "Derniere MAJ: $lastUpdateDate ($days jours)"; details = @(); days = $days; lastDate = $lastUpdateDate }
}

# SCORE GLOBAL
$crit = @($sections | Where-Object { $_.status -eq "critical" }).Count
$warn = @($sections | Where-Object { $_.status -eq "warning" }).Count
$info = @($sections | Where-Object { $_.status -eq "info" }).Count
$okc = @($sections | Where-Object { $_.status -eq "ok" }).Count

$score = 100 - ($crit * 15) - ($warn * 8) - ($info * 3)
if ($score -lt 0) { $score = 0 }

$globalStatus = "ok"
$globalMessage = "Votre PC est en bonne sante"
$globalAdvice = "Continuez les bonnes pratiques de securite"

if ($score -lt 40) {
    $globalStatus = "critical"
    $globalMessage = "Votre PC necessite une attention immediate"
    $globalAdvice = "Contactez un technicien Microdiag pour une intervention rapide"
} elseif ($score -lt 70) {
    $globalStatus = "warning"
    $globalMessage = "Votre PC presente des points d attention"
    $globalAdvice = "Suivez les recommandations ou contactez-nous pour un diagnostic"
}

# Infos systeme
$osInfo = ""
try { $osInfo = (Get-WmiObject Win32_OperatingSystem).Caption -replace '[^\x20-\x7E]', '' } catch {}

$report = @{
    timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    hostname = $env:COMPUTERNAME
    username = $env:USERNAME
    osVersion = $osInfo
    score = $score
    status = $globalStatus
    message = $globalMessage
    advice = $globalAdvice
    summary = @{ critical = $crit; warning = $warn; info = $info; ok = $okc; total = $sections.Count }
    sections = $sections
}

$report | ConvertTo-Json -Depth 10 -Compress
