# MNG DAUNTLESS: opens the launcher (development build, "npm run tauri dev") for the chosen server (Start-Launcher.bat).
#
# The server address is kept in launcher-server.txt beside Start-Launcher.bat (asked on the first start):
#   local                      this PC's own server (started first if it is not running)
#   http://100.80.1.2:3000     a server on another PC (Tailscale, home network or the internet)
# Edit or delete that file to switch servers. The launcher has its server built in, so the first start after a switch
# recompiles it (a few minutes).
# [31 Oct] -Server <address|local> uses that server for this start only (Start-Test.bat: -Server local).
param([switch]$ChangeServer, [string]$Server = "")

$ErrorActionPreference = "Stop"
$Repo = Split-Path -Parent $PSScriptRoot
$Root = Split-Path -Parent $Repo
$Launcher = Join-Path $Repo "ParadoxLauncher"
$ServerFile = Join-Path $Root "launcher-server.txt"

function Normalize([string]$Value) {
    $Value = $Value.Trim().Trim('"').TrimEnd("/")
    if (-not $Value -or $Value -eq "local" -or $Value -match "^(https?://)?(127\.0\.0\.1|localhost)(:3000)?$") { return "local" }
    if ($Value -notmatch "^[a-z]+://") { $Value = "http://$Value" }
    if ($Value -match "^http://[^/:]+$") { $Value = "${Value}:3000" }
    return $Value
}

if ($Server) { $Server = Normalize $Server }
if (-not $Server -and (Test-Path $ServerFile) -and -not $ChangeServer) {
    $Saved = Get-Content $ServerFile | Where-Object { $_.Trim() -and -not $_.StartsWith("#") } | Select-Object -First 1
    if ($Saved) { $Server = Normalize $Saved }
}
if (-not $Server) {
    Write-Host "Which MNG DAUNTLESS server should the launcher use?"
    Write-Host "  Press Enter for this PC's own server, or type the server PC's address"
    Write-Host "  (Set-Server-Address.bat on the server PC shows it, e.g. 100.80.1.2)."
    $Server = Normalize (Read-Host "Server")
    [IO.File]::WriteAllLines($ServerFile, @("# MNG DAUNTLESS launcher server: 'local' or an address like http://100.80.1.2:3000. Delete this file to be asked again.", $Server))
}

if ($Server -eq "local") {
    $Api = "http://127.0.0.1:3000"
    if (-not (Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue)) {
        Write-Host "The server is not running - starting it first..."
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "mng-server.ps1") start
    }
} else {
    $Api = $Server
    # [31 Oct] Players are on the live server: test changes on this PC's own server (Start-Test.bat), not on theirs.
    Write-Host "Note: this development launcher is connected to $Api. If that is the LIVE server, test there only what is" -ForegroundColor Yellow
    Write-Host "already released; try changes with Start-Test.bat (this PC's own server) first." -ForegroundColor Yellow
    try {
        Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 "$Api/launcher/v1/status" | Out-Null
        Write-Host "Server $Api answers."
    } catch {
        Write-Host "Warning: $Api does not answer right now (is the server started, is the address right?). Opening the launcher anyway." -ForegroundColor Yellow
    }
}

# Seasonal Ramsgate events (Halloween, Christmas, ...): the game on this PC reads them from its own Game.ini, so a
# player connecting to another PC's server needs them here too.
& node (Join-Path $PSScriptRoot "mng-seasonal-events.mjs")

$env:MYSTICPARADOX_API_BASE_URL = $Api
$KeyFile = Join-Path $Launcher ".secrets\selfhost-runtime-update.public.raw.b64"
if (Test-Path $KeyFile) { $env:MYSTICPARADOX_RUNTIME_PUBLIC_KEY_B64 = (Get-Content $KeyFile -Raw).Trim() }

Write-Host "Launcher server: $Api   (change it: Start-Launcher.bat change, or edit $ServerFile)"
Write-Host "Starting the launcher... (close this window to close the launcher)"
Set-Location $Launcher
& npm run tauri dev
