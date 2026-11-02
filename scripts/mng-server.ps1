# MNG DAUNTLESS: start, stop, restart or check the local server (backend, Director and the game servers it launches).
#
#   powershell -ExecutionPolicy Bypass -File scripts\mng-server.ps1 start     # MongoDB check, events, backend, Director
#   powershell -ExecutionPolicy Bypass -File scripts\mng-server.ps1 stop      # closes the backend and Director windows
#   powershell -ExecutionPolicy Bypass -File scripts\mng-server.ps1 restart
#   powershell -ExecutionPolicy Bypass -File scripts\mng-server.ps1 status
#   powershell -ExecutionPolicy Bypass -File scripts\mng-server.ps1 runtime-update   # testing a new client runtime:
#       stops the Director and its game servers (they run from the game folder, so the launcher refuses to update while
#       they run, and the Director restarts any that are killed), keeps the backend up (the launcher downloads the
#       runtime from it), waits until the game folder has the newest published runtime, then starts the Director again.
#
# The backend and the Director each run in their own window ("MNG Backend", "MNG Director") and also write to
# logs\backend-run.log / logs\director-run.log beside the repository (the previous run is kept as *.prev.log).
# "npm start" rebuilds a service first when its compiled output is older than its source (ensure-build-fresh.cjs).
# Stop closes those two windows with their whole process tree, which includes the Ramsgate, Training Dojo and hunt
# servers the Director started; other node programs on the PC are not touched. MongoDB is a Windows service and is
# left running.
param([ValidateSet("start", "stop", "restart", "status", "runtime-update")][string]$Action = "start")

$ErrorActionPreference = "Stop"
$Repo = Split-Path -Parent $PSScriptRoot
# [MNG 2026-11-02] Logs live in a logs folder beside the repository (they were loose beside the .bat files).
$LogDir = Join-Path (Split-Path -Parent $Repo) "logs"
New-Item -ItemType Directory -Force $LogDir | Out-Null
$Services = @(
    @{ Name = "Backend";  Title = "MNG Backend";  Dir = Join-Path $Repo "ParadoxBackend";  Port = 3000; Log = Join-Path $LogDir "backend-run.log" },
    @{ Name = "Director"; Title = "MNG Director"; Dir = Join-Path $Repo "ParadoxDirector"; Port = 3001; Log = Join-Path $LogDir "director-run.log" }
)

function Test-Port([int]$Port) {
    return $null -ne (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Get-GameServers {
    # Dedicated game servers: the shipping exe with a /Game/Maps/ map argument (the game client has none).
    return @(Get-CimInstance Win32_Process -Filter "Name = 'Dauntless-Win64-Shipping.exe'" |
        Where-Object { $_.CommandLine -match "/Game/Maps/" })
}

function Show-Status {
    $Mongo = Get-Service MongoDB -ErrorAction SilentlyContinue
    Write-Host ("MongoDB   : " + $(if ($Mongo) { $Mongo.Status } else { "not installed as a service" }))
    foreach ($S in $Services) {
        Write-Host ("{0,-9} : {1} (port {2})" -f $S.Name, $(if (Test-Port $S.Port) { "running" } else { "stopped" }), $S.Port)
    }
    $Games = Get-GameServers
    Write-Host ("Game servers: " + $Games.Count)
    foreach ($G in $Games) {
        $Parts = $G.CommandLine -split " "
        Write-Host ("  pid {0}  port {1}  {2}" -f $G.ProcessId, $Parts[2], ($Parts[3] -replace ".*/", ""))
    }
}

function Stop-Server {
    foreach ($S in $Services) {
        # taskkill /T takes the window's whole tree: cmd -> powershell -> npm -> node -> game servers.
        & taskkill.exe /FI "WINDOWTITLE eq $($S.Title)*" /T /F 2>&1 | Out-Null
    }
    Start-Sleep -Seconds 2
    # A server started some other way (an older session, a hand-run "npm start") is not in those windows: stop what
    # still holds the two ports, and any game server left behind.
    foreach ($S in $Services) {
        foreach ($C in @(Get-NetTCPConnection -State Listen -LocalPort $S.Port -ErrorAction SilentlyContinue)) {
            & taskkill.exe /PID $C.OwningProcess /T /F 2>&1 | Out-Null
        }
    }
    foreach ($G in Get-GameServers) { Stop-Process -Id $G.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
    Write-Host "Server stopped."
}

function Start-Server {
    if ((Test-Port 3000) -or (Test-Port 3001)) {
        Write-Host "The server is already running (port 3000 or 3001 is in use). Use restart, or stop first."
        Show-Status
        return
    }
    $Mongo = Get-Service MongoDB -ErrorAction SilentlyContinue
    if ($Mongo -and $Mongo.Status -ne "Running") {
        Write-Host "Starting MongoDB..."
        try { Start-Service MongoDB } catch { throw "MongoDB is not running and could not be started (run this as administrator once, or start the MongoDB service)." }
    }

    # [31 Oct] HTTPS (Set-Up-HTTPS.bat): renew the certificate when it has under 30 days left. Before the backend starts: the
    # renewal answers Let's Encrypt on port 80, which the backend's region-ping listener uses once it runs.
    Push-Location (Join-Path $Repo "ParadoxBackend")
    try { & node "scripts\mng-https.cjs" renew } finally { Pop-Location }

    # [31 Oct] Seasonal Ramsgate events: the runtime switches the running event on by itself ([EventCalendar]) on the game
    # servers and the players' PCs; the Game.ini block (mng-seasonal-events.mjs) is no longer needed or written.

    foreach ($S in $Services) {
        if (Test-Path $S.Log) { Move-Item -Force $S.Log ($S.Log -replace "\.log$", ".prev.log") }
        # The window shows the output and appends each line to the log (UTF-8).
        # UTF-8 console encoding, or node's output is read in the OEM code page ("→" became "ΓåÆ" in the log).
        $Command = "`$Host.UI.RawUI.WindowTitle = '$($S.Title)'; [Console]::OutputEncoding = [Text.Encoding]::UTF8; Set-Location '$($S.Dir)'; " +
            "npm start 2>&1 | ForEach-Object { `$Line = `"`$_`"; Write-Host `$Line; Add-Content -Path '$($S.Log)' -Value `$Line -Encoding UTF8 }; " +
            "Write-Host ''; Write-Host '$($S.Name) stopped. Press Enter to close this window.'; Read-Host"
        Start-Process powershell.exe -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $Command
        Write-Host "Starting $($S.Name) (port $($S.Port))..."
        $Deadline = (Get-Date).AddSeconds(180)   # a first start after a code change rebuilds first
        while (-not (Test-Port $S.Port)) {
            if ((Get-Date) -gt $Deadline) { throw "$($S.Name) did not open port $($S.Port) within 3 minutes; see its window or $($S.Log)." }
            Start-Sleep -Seconds 1
        }
        Write-Host "$($S.Name) is up."
    }
    Write-Host "Server started. The Director starts Ramsgate and the Training Dojo; give them about a minute before you press Play."
}

function Get-GameClients {
    return @(Get-CimInstance Win32_Process -Filter "Name = 'Dauntless-Win64-Shipping.exe'" |
        Where-Object { $_.CommandLine -notmatch "/Game/Maps/" })
}

# The Director and its game servers only, as Stop-Server does for both windows.
function Stop-Director {
    & taskkill.exe /FI "WINDOWTITLE eq MNG Director*" /T /F 2>&1 | Out-Null
    Start-Sleep -Seconds 2
    foreach ($C in @(Get-NetTCPConnection -State Listen -LocalPort 3001 -ErrorAction SilentlyContinue)) {
        & taskkill.exe /PID $C.OwningProcess /T /F 2>&1 | Out-Null
    }
    foreach ($G in Get-GameServers) { Stop-Process -Id $G.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
}

function Start-Director {
    $S = $Services | Where-Object { $_.Name -eq "Director" }
    if (Test-Path $S.Log) { Move-Item -Force $S.Log ($S.Log -replace "\.log$", ".prev.log") }
    $Command = "`$Host.UI.RawUI.WindowTitle = '$($S.Title)'; [Console]::OutputEncoding = [Text.Encoding]::UTF8; Set-Location '$($S.Dir)'; " +
        "npm start 2>&1 | ForEach-Object { `$Line = `"`$_`"; Write-Host `$Line; Add-Content -Path '$($S.Log)' -Value `$Line -Encoding UTF8 }; " +
        "Write-Host ''; Write-Host '$($S.Name) stopped. Press Enter to close this window.'; Read-Host"
    Start-Process powershell.exe -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $Command
    $Deadline = (Get-Date).AddSeconds(180)
    while (-not (Test-Port $S.Port)) {
        if ((Get-Date) -gt $Deadline) { throw "The Director did not open port $($S.Port) within 3 minutes; see its window or $($S.Log)." }
        Start-Sleep -Seconds 1
    }
}

# [MNG 2026-11-02] runtime-update: see the header.
function Update-Runtime {
    $Root = Split-Path -Parent $Repo
    $Manifest = Join-Path $Root "server-data\updates\runtime\client\stable\windows-x86_64\latest.json"
    if (-not (Test-Path $Manifest)) { throw "No published client runtime ($Manifest). Publish one first (publish-runtime-update.mjs)." }
    $Latest = Get-Content $Manifest -Raw | ConvertFrom-Json
    $Exe = ""
    $DirectorEnv = Join-Path $Repo "ParadoxDirector\.env"
    if (Test-Path $DirectorEnv) {
        $Line = Get-Content $DirectorEnv | Where-Object { $_ -match "^\s*GAMESERVER_BINARY_PATH\s*=" } | Select-Object -First 1
        if ($Line) { $Exe = ($Line -replace "^\s*GAMESERVER_BINARY_PATH\s*=\s*", "").Trim().Trim('"') }
    }
    if (-not $Exe) { $Exe = "C:\Games\Dauntless\Archon\Binaries\Win64\Dauntless-Win64-Shipping.exe" }
    $Dll = Join-Path (Split-Path -Parent $Exe) "MysticParadox.dll"

    Write-Host "Newest published runtime: $($Latest.version)"
    if ((Get-InstalledHash $Dll) -eq $Latest.sha256) { Write-Host "The game folder already has it. Nothing to do."; return }

    if (Get-GameClients) {
        Write-Host "Close the game first (the launcher cannot replace the runtime while it runs). Waiting..." -ForegroundColor Yellow
        while (Get-GameClients) { Start-Sleep -Seconds 2 }
    }
    if (-not (Test-Port 3000)) {
        Write-Host "The backend is not running: starting the whole server first..."
        Start-Server
    }
    Write-Host "Stopping the Director and its game servers..."
    Stop-Director
    Write-Host ""
    Write-Host "Now press Play in the test launcher (Start-Test.bat). It downloads runtime $($Latest.version) and starts the game." -ForegroundColor Cyan
    Write-Host "Waiting for the new runtime in $Dll ..."
    while ((Get-InstalledHash $Dll) -ne $Latest.sha256) {
        foreach ($G in Get-GameServers) { Stop-Process -Id $G.ProcessId -Force -ErrorAction SilentlyContinue }
        Start-Sleep -Seconds 2
    }
    Write-Host "Runtime $($Latest.version) installed. Starting the Director (Ramsgate and the Dojo are up in about a minute)..."
    Start-Director
    Write-Host "Done. The game connects once Ramsgate is ready." -ForegroundColor Green
}

function Get-InstalledHash([string]$Path) {
    if (-not (Test-Path $Path)) { return "" }
    try { return (Get-FileHash $Path -Algorithm SHA256).Hash.ToLower() } catch { return "" }   # locked while being replaced
}

switch ($Action) {
    "start"   { Start-Server }
    "stop"    { Stop-Server }
    "restart" { Stop-Server; Start-Server }
    "status"  { Show-Status }
    "runtime-update" { Update-Runtime }
}
exit 0
