# MNG DAUNTLESS: sets the server up on this PC from a server pack (started by Install-Server.bat in the pack folder).
# Safe to run again: every step checks first and skips what is already done.
#
#  1. Node.js            installed with winget if missing (20 or newer)
#  2. Packages           npm ci for the backend and the Director, only if the pack has none
#  3. MongoDB            installed with winget if missing, then made a one-member replica set "rs0" (the server needs
#                        transactions)
#  4. Dauntless 1.14.7   found, or downloaded with the game downloader; MysticParadox.dll + winmm.dll copied next to it
#  5. Settings           the .env paths updated to this PC (game exe, runtime update folder)
#  6. Saves              the database from the pack restored (asks first if this PC already has one, and backs it up)
#  7. Firewall           optional: opens the ports other players need
param([switch]$Elevated)

$ErrorActionPreference = "Stop"
$Repo = Split-Path -Parent $PSScriptRoot
$Root = Split-Path -Parent $Repo
$Backend = Join-Path $Repo "ParadoxBackend"
$Director = Join-Path $Repo "ParadoxDirector"
$Saves = Join-Path $Root "saves"
$BackendEnv = Join-Path $Backend ".env"
$DirectorEnv = Join-Path $Director ".env"
$ExeRelative = "Archon\Binaries\Win64\Dauntless-Win64-Shipping.exe"

# --- Administrator (MongoDB install, its config file in Program Files, the service and the firewall need it) ---
$IsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $IsAdmin) {
    Write-Host "Asking Windows for administrator permission... the setup continues in a new window."
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`"", "-Elevated"
    exit 0
}

function Step([string]$Text) { Write-Host ""; Write-Host "== $Text" -ForegroundColor Cyan }
function Ok([string]$Text) { Write-Host "   $Text" -ForegroundColor Green }
function Info([string]$Text) { Write-Host "   $Text" }
function Ask-YesNo([string]$Question, [bool]$Default) {
    $Hint = if ($Default) { "[Y/n]" } else { "[y/N]" }
    $A = (Read-Host "   $Question $Hint").Trim().ToLower()
    if (-not $A) { return $Default }
    return $A.StartsWith("y")
}
function Update-PathFromRegistry {
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
}
function Read-EnvValue([string]$File, [string]$Name) {
    $Line = Get-Content $File | Where-Object { $_ -match "^\s*$Name\s*=" } | Select-Object -First 1
    if (-not $Line) { return "" }
    return ($Line -replace "^\s*$Name\s*=\s*", "").Trim().Trim('"')
}
function Set-EnvValue([string]$File, [string]$Name, [string]$Value) {
    $Text = [IO.File]::ReadAllText($File)
    $Pattern = "(?m)^\s*" + [Regex]::Escape($Name) + "\s*=.*$"
    $Line = "$Name=$Value"
    if ([Regex]::IsMatch($Text, $Pattern)) {
        $Text = [Regex]::Replace($Text, $Pattern, [Text.RegularExpressions.MatchEvaluator]{ param($M) $Line }, 1)
    } else {
        $Text = $Text.TrimEnd() + "`r`n" + $Line + "`r`n"
    }
    [IO.File]::WriteAllText($File, $Text, [Text.UTF8Encoding]::new($false))   # no BOM: node cannot read .env with one
}
function Install-WithWinget([string]$Id, [string]$Name, [string]$ManualUrl) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "$Name is missing and winget is not available. Install $Name from $ManualUrl, then run Install-Server.bat again."
    }
    Info "Installing $Name with winget (this can take a few minutes)..."
    & winget install -e --id $Id --accept-source-agreements --accept-package-agreements
    Update-PathFromRegistry
}

function Main {
    Write-Host "=== MNG DAUNTLESS - Install Server ===" -ForegroundColor Yellow
    Write-Host "Server folder: $Root"
    if (-not (Test-Path $BackendEnv) -or -not (Test-Path $DirectorEnv)) {
        throw "This folder has no server settings (ParadoxBackend\.env / ParadoxDirector\.env). Use a pack made with Make-Server-Pack.bat."
    }
    if ($Root -match "\\(Downloads|Desktop|Temp|AppData)\\") {
        Write-Host ""
        Write-Host "   This folder is in $($Matches[1]). The server will run from here, so it is better to move the" -ForegroundColor Yellow
        Write-Host "   MNG-Server folder to a place it can stay (for example C:\MNG-Server) and run Install-Server.bat there." -ForegroundColor Yellow
        if (-not (Ask-YesNo "Install here anyway?" $false)) { return }
    }

    # 1. Node.js
    Step "1/7 Node.js"
    $NodeOk = $false
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $NodeOk = [int](((& node -v) -replace "^v", "") -split "\.")[0] -ge 20
    }
    if (-not $NodeOk) {
        Install-WithWinget "OpenJS.NodeJS.LTS" "Node.js" "https://nodejs.org"
        if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js was installed but is not found yet. Close this window and run Install-Server.bat again." }
    }
    Ok "Node.js $(& node -v)"

    # 2. Packages
    Step "2/7 Server packages"
    foreach ($Dir in @($Backend, $Director)) {
        # [31 Oct] An update pack has no node_modules but may need new packages: reinstall when package-lock.json is newer than
        # what is installed (npm writes node_modules\.package-lock.json at each install).
        $Installed = Join-Path $Dir "node_modules\.package-lock.json"
        $Wanted = Join-Path $Dir "package-lock.json"
        $Current = (Test-Path $Installed) -and -not ((Test-Path $Wanted) -and (Get-Item $Wanted).LastWriteTime -gt (Get-Item $Installed).LastWriteTime)
        if ($Current) { Ok "$(Split-Path -Leaf $Dir): packages up to date"; continue }
        Info "$(Split-Path -Leaf $Dir): installing packages (npm ci)..."
        Push-Location $Dir
        try { & npm ci; if ($LASTEXITCODE -ne 0) { throw "npm ci failed in $Dir" } } finally { Pop-Location }
        Ok "$(Split-Path -Leaf $Dir): installed"
    }

    # 3. MongoDB
    Step "3/7 MongoDB (the database)"
    $Service = Get-CimInstance Win32_Service -Filter "Name = 'MongoDB'" -ErrorAction SilentlyContinue
    if (-not $Service) {
        Install-WithWinget "MongoDB.Server" "MongoDB" "https://www.mongodb.com/try/download/community (choose 'Install as a Service')"
        $Service = Get-CimInstance Win32_Service -Filter "Name = 'MongoDB'" -ErrorAction SilentlyContinue
        if (-not $Service) { throw "MongoDB was installed without its Windows service. Install it again from https://www.mongodb.com/try/download/community with 'Install MongoDB as a Service' ticked." }
    }
    if ($Service.PathName -notmatch '--config\s+"?([^"]+?\.cfg)"?(\s|$)') { throw "Could not find MongoDB's config file in: $($Service.PathName)" }
    $Cfg = $Matches[1]
    $CfgText = [IO.File]::ReadAllText($Cfg)
    if ($CfgText -notmatch '(?m)^replication:') {
        Copy-Item $Cfg "$Cfg.bak" -Force
        if ($CfgText -match '(?m)^#replication:\s*$') {
            $CfgText = $CfgText -replace '(?m)^#replication:\s*$', "replication:`r`n  replSetName: rs0"
        } else {
            $CfgText = $CfgText.TrimEnd() + "`r`n`r`nreplication:`r`n  replSetName: rs0`r`n"
        }
        [IO.File]::WriteAllText($Cfg, $CfgText, [Text.Encoding]::ASCII)
        Info "Turned on the replica set in $Cfg (backup: mongod.cfg.bak)"
        Restart-Service MongoDB
    } elseif ((Get-Service MongoDB).Status -ne "Running") {
        Start-Service MongoDB
    }
    Set-Service MongoDB -StartupType Automatic
    & node (Join-Path $Backend "scripts\mng-database.cjs") init-replica
    if ($LASTEXITCODE -ne 0) { throw "Setting up MongoDB's replica set failed (see the message above)." }
    Ok "MongoDB is running and set up"

    # 4. The game
    Step "4/7 Dauntless 1.14.7"
    $OldExe = Read-EnvValue $DirectorEnv "GAMESERVER_BINARY_PATH"
    $Default = if ($OldExe -and (Test-Path $OldExe)) { (Resolve-Path (Join-Path (Split-Path -Parent $OldExe) "..\..\..")).Path } else { "C:\Games\Dauntless" }
    $GameDir = (Read-Host "   Where is (or where should go) the game? Press Enter for $Default").Trim().Trim('"')
    if (-not $GameDir) { $GameDir = $Default }
    $GameDir = [IO.Path]::GetFullPath($GameDir)
    $Exe = Join-Path $GameDir $ExeRelative
    if (-not (Test-Path $Exe)) {
        Info "The game is not in $GameDir."
        $Downloader = Join-Path $Root "MNG-Game-Downloader\files\download-game.ps1"
        if ((Test-Path $Downloader) -and (Ask-YesNo "Download it there now (about 15.4 GB)?" $true)) {
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Downloader -InstallDir $GameDir
            if ($LASTEXITCODE -ne 0) { throw "The game download did not finish. Run Install-Server.bat again to continue it." }
        } else {
            throw "Put Dauntless 1.14.7 in $GameDir (or run MNG-Game-Downloader\Download-Game.bat), then run Install-Server.bat again."
        }
    }
    $Approved = Read-EnvValue $BackendEnv "APPROVED_EXECUTABLE_SHA256"
    $Hash = (Get-FileHash $Exe -Algorithm SHA256).Hash.ToLower()
    if ($Approved -and ($Approved -split "[,\s]+") -notcontains $Hash) {
        Write-Warning "The game exe in $GameDir is not the version this server expects (1.14.7). Players' sessions may be refused."
    } else { Ok "Game found: $Exe" }
    $Win64 = Split-Path -Parent $Exe
    foreach ($F in @(Get-ChildItem (Join-Path $Saves "game-runtime") -File -ErrorAction SilentlyContinue)) {
        $Target = Join-Path $Win64 $F.Name
        if ((Test-Path $Target) -and (Get-FileHash $Target).Hash -eq (Get-FileHash $F.FullName).Hash) { continue }
        try { Copy-Item $F.FullName $Target -Force; Info "Copied $($F.Name) next to the game" }
        catch { throw "Could not copy $($F.Name) into $Win64 (is the game running?). Close it and run Install-Server.bat again." }
    }
    Ok "Runtime files are in place"

    # 5. Settings
    Step "5/7 Settings"
    Set-EnvValue $DirectorEnv "GAMESERVER_BINARY_PATH" $Exe
    $Updates = Join-Path $Root "server-data\updates"
    New-Item -ItemType Directory -Force -Path $Updates | Out-Null
    Set-EnvValue $BackendEnv "LAUNCHER_UPDATE_ROOT" $Updates
    Ok "Game exe and update folder set to this PC"

    # 6. Saves
    Step "6/7 Saves (database)"
    $SavedDb = Join-Path $Saves "database"
    if (-not (Test-Path (Join-Path $SavedDb "_collections.json"))) {
        Info "The pack has no database copy; the server starts with an empty one."
    } else {
        $Count = (& node (Join-Path $Backend "scripts\mng-database.cjs") count) | ConvertFrom-Json
        $Restore = $true
        if ($Count.documents -gt 0) {
            Info "This PC already has a server database ($($Count.accounts) accounts)."
            $Restore = Ask-YesNo "Replace it with the one from the pack? (the current one is backed up first)" $false
            if ($Restore) {
                $Backup = Join-Path $Saves ("database-before-install-" + (Get-Date -Format "yyyy-MM-dd_HHmm"))
                & node (Join-Path $Backend "scripts\mng-database.cjs") export $Backup
                if ($LASTEXITCODE -ne 0) { throw "Backing up the current database failed; nothing was replaced." }
            }
        }
        if ($Restore) {
            if (Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue) {
                throw "The server is running. Close it (Stop-Server.bat) and run Install-Server.bat again."
            }
            & node (Join-Path $Backend "scripts\mng-database.cjs") import $SavedDb
            if ($LASTEXITCODE -ne 0) { throw "Restoring the database failed (see the message above)." }
            Ok "Saves restored"
        } else { Ok "Kept this PC's database" }
    }

    # 7. Firewall
    Step "7/7 Firewall"
    if (Ask-YesNo "Will players on other PCs connect to this server? (opens TCP 3000 and UDP 8780-8790)" $false) {
        $Begin = Read-EnvValue $DirectorEnv "PORT_RANGE_BEGIN"; if (-not $Begin) { $Begin = "8780" }
        $End = Read-EnvValue $DirectorEnv "PORT_RANGE_END"; if (-not $End) { $End = "8790" }
        $ApiPort = Read-EnvValue $BackendEnv "PORT"; if (-not $ApiPort) { $ApiPort = "3000" }
        Get-NetFirewallRule -DisplayName "MNG DAUNTLESS*" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
        New-NetFirewallRule -DisplayName "MNG DAUNTLESS backend (TCP $ApiPort)" -Direction Inbound -Protocol TCP -LocalPort $ApiPort -Action Allow | Out-Null
        New-NetFirewallRule -DisplayName "MNG DAUNTLESS game servers (UDP $Begin-$End)" -Direction Inbound -Protocol UDP -LocalPort "$Begin-$End" -Action Allow | Out-Null
        Ok "Ports opened in Windows Firewall"
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "mng-set-address.ps1")
    } else { Ok "Skipped (only this PC can play)" }

    Write-Host ""
    Write-Host "=== Done. Double-click Start-Server.bat to start the server. ===" -ForegroundColor Yellow
}

try { Main }
catch {
    Write-Host ""
    Write-Host "Setup stopped: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to close"
