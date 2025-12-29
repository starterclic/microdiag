# ============================================
# MICRODIAG SENTINEL - Full Security Scan
# Analyse complete du systeme
# ============================================

$ErrorActionPreference = "SilentlyContinue"

$report = @{
    timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    hostname = $env:COMPUTERNAME
    sections = @()
}

function Add-Section {
    param($title, $icon, $status, $items)
    $script:report.sections += @{
        title = $title
        icon = $icon
        status = $status
        items = $items
    }
}

# ============================================
# 1. ANALYSE DES LOGS WINDOWS (Erreurs recentes)
# ============================================
Write-Host "[1/8] Analyse des logs systeme..."
$logItems = @()
$errorLogs = Get-WinEvent -FilterHashtable @{LogName='System';Level=2;StartTime=(Get-Date).AddDays(-7)} -MaxEvents 20 2>$null
$warningLogs = Get-WinEvent -FilterHashtable @{LogName='System';Level=3;StartTime=(Get-Date).AddDays(-7)} -MaxEvents 10 2>$null

$criticalCount = ($errorLogs | Measure-Object).Count
$warningCount = ($warningLogs | Measure-Object).Count

if ($criticalCount -gt 0) {
    foreach ($log in $errorLogs | Select-Object -First 5) {
        $logItems += @{
            type = "error"
            message = $log.Message.Substring(0, [Math]::Min(150, $log.Message.Length)) + "..."
            date = $log.TimeCreated.ToString("dd/MM HH:mm")
            source = $log.ProviderName
        }
    }
}

$logStatus = if ($criticalCount -gt 10) { "critical" } elseif ($criticalCount -gt 0) { "warning" } else { "ok" }
Add-Section -title "Logs Systeme (7 derniers jours)" -icon "📋" -status $logStatus -items @{
    summary = "$criticalCount erreurs, $warningCount avertissements"
    details = $logItems
}

# ============================================
# 2. ECRANS BLEUS (BSOD Analysis)
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

# Check BlueScreen events in Event Log
$bsodEvents = Get-WinEvent -FilterHashtable @{LogName='System';ProviderName='Microsoft-Windows-WER-SystemErrorReporting'} -MaxEvents 5 2>$null
foreach ($evt in $bsodEvents) {
    $bsodItems += @{
        type = "bsod_event"
        date = $evt.TimeCreated.ToString("dd/MM/yyyy HH:mm")
        message = "Crash systeme detecte"
    }
}

$bsodStatus = if ($bsodCount -gt 2) { "critical" } elseif ($bsodCount -gt 0) { "warning" } else { "ok" }
Add-Section -title "Ecrans Bleus (BSOD)" -icon "💀" -status $bsodStatus -items @{
    summary = if ($bsodCount -eq 0) { "Aucun ecran bleu detecte" } else { "$bsodCount crash(s) detecte(s)" }
    details = $bsodItems
}

# ============================================
# 3. APPLICATIONS INSTALLEES (Risques)
# ============================================
Write-Host "[3/8] Analyse des applications installees..."
$appItems = @()
$riskyApps = @("TeamViewer", "AnyDesk", "UltraViewer", "LogMeIn", "uTorrent", "BitTorrent", "qBittorrent", "CCleaner", "IObit", "Avast", "AVG", "360 Total Security", "Baidu", "WinRAR", "7-Zip")
$installedApps = Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*", "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*" 2>$null |
    Where-Object { $_.DisplayName } |
    Select-Object DisplayName, DisplayVersion, Publisher, InstallDate

$riskyFound = @()
foreach ($app in $installedApps) {
    foreach ($risky in $riskyApps) {
        if ($app.DisplayName -like "*$risky*") {
            $riskyFound += @{
                name = $app.DisplayName
                version = $app.DisplayVersion
                risk = "Surface d'attaque augmentee"
            }
        }
    }
}

$appStatus = if ($riskyFound.Count -gt 3) { "warning" } else { "ok" }
Add-Section -title "Applications a Risque" -icon "📦" -status $appStatus -items @{
    summary = "$($riskyFound.Count) application(s) augmentant la surface de vulnerabilite"
    total_apps = $installedApps.Count
    details = $riskyFound
}

# ============================================
# 4. RDP ACTIF
# ============================================
Write-Host "[4/8] Verification RDP..."
$rdpEnabled = (Get-ItemProperty "HKLM:\System\CurrentControlSet\Control\Terminal Server" -Name "fDenyTSConnections" -ErrorAction SilentlyContinue).fDenyTSConnections -eq 0
$rdpPort = (Get-ItemProperty "HKLM:\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp" -Name "PortNumber" -ErrorAction SilentlyContinue).PortNumber

$rdpSessions = @()
$sessions = qwinsta 2>$null | Select-Object -Skip 1
foreach ($session in $sessions) {
    if ($session -match "rdp" -or $session -match "Active") {
        $rdpSessions += $session.Trim()
    }
}

$rdpStatus = if ($rdpEnabled -and $rdpSessions.Count -gt 0) { "warning" } elseif ($rdpEnabled) { "info" } else { "ok" }
Add-Section -title "Bureau a Distance (RDP)" -icon "🖥️" -status $rdpStatus -items @{
    enabled = $rdpEnabled
    port = $rdpPort
    summary = if ($rdpEnabled) { "RDP actif sur port $rdpPort" } else { "RDP desactive" }
    active_sessions = $rdpSessions.Count
    details = $rdpSessions
}

# ============================================
# 5. PORTS RESEAU OUVERTS
# ============================================
Write-Host "[5/8] Scan des ports reseau..."
$openPorts = @()
$riskyPorts = @(21, 22, 23, 25, 135, 139, 445, 1433, 3306, 3389, 5900, 5985, 5986)
$connections = Get-NetTCPConnection -State Listen 2>$null | Select-Object LocalPort, OwningProcess -Unique

foreach ($conn in $connections) {
    $processName = (Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue).ProcessName
    $isRisky = $conn.LocalPort -in $riskyPorts
    $openPorts += @{
        port = $conn.LocalPort
        process = $processName
        risky = $isRisky
    }
}

$riskyOpenCount = ($openPorts | Where-Object { $_.risky }).Count
$portStatus = if ($riskyOpenCount -gt 3) { "critical" } elseif ($riskyOpenCount -gt 0) { "warning" } else { "ok" }
Add-Section -title "Ports Reseau Ouverts" -icon "🔌" -status $portStatus -items @{
    summary = "$($openPorts.Count) port(s) en ecoute, $riskyOpenCount potentiellement risque(s)"
    details = $openPorts | Sort-Object { $_.risky } -Descending | Select-Object -First 15
}

# ============================================
# 6. EXTENSIONS CHROME SUSPECTES
# ============================================
Write-Host "[6/8] Analyse extensions Chrome..."
$chromeExtensions = @()
$chromePath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Extensions"

if (Test-Path $chromePath) {
    $extensions = Get-ChildItem $chromePath -Directory
    foreach ($ext in $extensions) {
        $manifestPath = Get-ChildItem $ext.FullName -Recurse -Filter "manifest.json" | Select-Object -First 1
        if ($manifestPath) {
            try {
                $manifest = Get-Content $manifestPath.FullName -Raw | ConvertFrom-Json
                $permissions = $manifest.permissions -join ", "
                $isSuspicious = $permissions -match "tabs|webRequest|cookies|history|<all_urls>|http://\*|https://\*"
                $chromeExtensions += @{
                    name = $manifest.name
                    version = $manifest.version
                    permissions = $permissions.Substring(0, [Math]::Min(100, $permissions.Length))
                    suspicious = $isSuspicious
                }
            } catch {}
        }
    }
}

$suspiciousCount = ($chromeExtensions | Where-Object { $_.suspicious }).Count
$chromeStatus = if ($suspiciousCount -gt 2) { "warning" } else { "ok" }
Add-Section -title "Extensions Chrome" -icon "🧩" -status $chromeStatus -items @{
    summary = "$($chromeExtensions.Count) extension(s), $suspiciousCount avec permissions etendues"
    details = $chromeExtensions | Where-Object { $_.suspicious } | Select-Object -First 10
}

# ============================================
# 7. PROGRAMMES AU DEMARRAGE
# ============================================
Write-Host "[7/8] Analyse du demarrage..."
$startupItems = @()
$startupPaths = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run"
)

foreach ($path in $startupPaths) {
    $items = Get-ItemProperty $path 2>$null
    if ($items) {
        $items.PSObject.Properties | Where-Object { $_.Name -notlike "PS*" } | ForEach-Object {
            $startupItems += @{
                name = $_.Name
                command = $_.Value.Substring(0, [Math]::Min(80, $_.Value.Length))
                location = $path.Split("\")[-1]
            }
        }
    }
}

$startupCount = $startupItems.Count
$startupStatus = if ($startupCount -gt 15) { "warning" } elseif ($startupCount -gt 10) { "info" } else { "ok" }
Add-Section -title "Programmes au Demarrage" -icon "🚀" -status $startupStatus -items @{
    summary = "$startupCount programme(s) au demarrage"
    details = $startupItems | Select-Object -First 15
}

# ============================================
# 8. MISES A JOUR WINDOWS
# ============================================
Write-Host "[8/8] Verification des mises a jour..."
$updateSession = New-Object -ComObject Microsoft.Update.Session
$updateSearcher = $updateSession.CreateUpdateSearcher()
try {
    $pendingUpdates = $updateSearcher.Search("IsInstalled=0 and Type='Software'").Updates
    $pendingCount = $pendingUpdates.Count
    $criticalUpdates = ($pendingUpdates | Where-Object { $_.MsrcSeverity -eq "Critical" }).Count
} catch {
    $pendingCount = -1
    $criticalUpdates = 0
}

$lastUpdate = (Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 1).InstalledOn
$daysSinceUpdate = if ($lastUpdate) { ((Get-Date) - $lastUpdate).Days } else { 999 }

$updateStatus = if ($criticalUpdates -gt 0 -or $daysSinceUpdate -gt 30) { "critical" } elseif ($pendingCount -gt 5) { "warning" } else { "ok" }
Add-Section -title "Mises a Jour Windows" -icon "🔄" -status $updateStatus -items @{
    summary = if ($pendingCount -ge 0) { "$pendingCount mise(s) a jour en attente" } else { "Impossible de verifier" }
    critical = $criticalUpdates
    last_update = if ($lastUpdate) { $lastUpdate.ToString("dd/MM/yyyy") } else { "Inconnue" }
    days_since = $daysSinceUpdate
}

# ============================================
# SCORE GLOBAL
# ============================================
$criticalSections = ($report.sections | Where-Object { $_.status -eq "critical" }).Count
$warningSections = ($report.sections | Where-Object { $_.status -eq "warning" }).Count

$globalScore = 100
$globalScore -= ($criticalSections * 20)
$globalScore -= ($warningSections * 10)
$globalScore = [Math]::Max(0, $globalScore)

$report.score = $globalScore
$report.status = if ($globalScore -lt 50) { "critical" } elseif ($globalScore -lt 75) { "warning" } else { "ok" }
$report.summary = @{
    critical = $criticalSections
    warning = $warningSections
    ok = ($report.sections | Where-Object { $_.status -eq "ok" }).Count
}

# Output JSON
$report | ConvertTo-Json -Depth 10 -Compress
