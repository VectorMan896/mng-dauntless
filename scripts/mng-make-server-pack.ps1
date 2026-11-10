# MNG DAUNTLESS: makes a server pack - one zip with everything needed to set the server up on another PC, including
# this PC's saves. Started by Make-Server-Pack.bat (in the folder above the repository).
#
# The pack holds:
#   Mystic-Paradox\        the server code with its settings (.env files), game data, keys (.secrets) and packages
#                          (build outputs of the launcher, runtime and tools are left out: about 11 GB)
#   server-data\           the runtime update feed the backend serves to launchers
#   saves\database\        a copy of the database: accounts, characters, inventories, progress, ...
#   saves\game-runtime\    MysticParadox.dll + winmm.dll that the game servers load
#   MNG-Game-Downloader\   the game downloader
#   Install-Server.bat, Start/Stop/Restart/Server-Status/Make-Server-Pack .bat files, README.txt
#
# The zip contains passwords and signing keys: keep it private.
param([string]$OutDir = "")

$ErrorActionPreference = "Stop"
$Repo = Split-Path -Parent $PSScriptRoot
$Root = Split-Path -Parent $Repo
if (-not $OutDir) { $OutDir = Join-Path $Root "Server-Packs" }
$Stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$Stage = Join-Path ([IO.Path]::GetTempPath()) "mng-server-pack-$Stamp"
$Pack = Join-Path $Stage "MNG-Server"
$Zip = Join-Path $OutDir "MNG-Server-$Stamp.zip"

function Read-EnvValue([string]$File, [string]$Name) {
    if (-not (Test-Path $File)) { return "" }
    $Line = Get-Content $File | Where-Object { $_ -match "^\s*$Name\s*=" } | Select-Object -First 1
    if (-not $Line) { return "" }
    return ($Line -replace "^\s*$Name\s*=\s*", "").Trim().Trim('"')
}

function Copy-Tree([string]$From, [string]$To, [string[]]$ExcludeDirs = @(), [string[]]$ExcludeFiles = @()) {
    $RoboArgs = @($From, $To, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/R:1", "/W:1")
    if ($ExcludeDirs.Count) { $RoboArgs += "/XD"; $RoboArgs += $ExcludeDirs }
    if ($ExcludeFiles.Count) { $RoboArgs += "/XF"; $RoboArgs += $ExcludeFiles }
    & robocopy.exe @RoboArgs | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Copying $From failed (robocopy code $LASTEXITCODE)." }
}

Write-Host "=== MNG DAUNTLESS - Make Server Pack ==="
if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
New-Item -ItemType Directory -Force -Path $Pack, $OutDir | Out-Null

Write-Host "[1/6] Server code, settings, game data and keys..."
$Skip = @(
    "ParadoxLauncher\node_modules", "ParadoxLauncher\src-tauri\target", "ParadoxLauncher\dist",
    "ParadoxRuntime\x64", "ParadoxRuntime\MysticParadox\x64", "tools\CatalogExporter\x64", "tools\RuntimeLoader\target",
    "debug"
) | ForEach-Object { Join-Path $Repo $_ }
Copy-Tree $Repo (Join-Path $Pack "Mystic-Paradox") ($Skip + @(".vs")) @("*.log")

Write-Host "[2/6] Runtime update feed..."
if (Test-Path (Join-Path $Root "server-data")) { Copy-Tree (Join-Path $Root "server-data") (Join-Path $Pack "server-data") }

Write-Host "[3/6] Database..."
$Backend = Join-Path $Repo "ParadoxBackend"
& node (Join-Path $Backend "scripts\mng-database.cjs") export (Join-Path $Pack "saves\database")
if ($LASTEXITCODE -ne 0) { throw "Saving the database failed. Is MongoDB running?" }

Write-Host "[4/6] Game runtime files..."
$Exe = Read-EnvValue (Join-Path $Repo "ParadoxDirector\.env") "GAMESERVER_BINARY_PATH"
$Win64 = if ($Exe) { Split-Path -Parent $Exe } else { "" }
$RuntimeOut = Join-Path $Pack "saves\game-runtime"
New-Item -ItemType Directory -Force -Path $RuntimeOut | Out-Null
foreach ($F in @("MysticParadox.dll", "winmm.dll")) {
    $P = Join-Path $Win64 $F
    if ($Win64 -and (Test-Path $P)) { Copy-Item $P $RuntimeOut } else { Write-Warning "$F not found in $Win64 - the installer cannot add it." }
}
# A clean loader list (this PC's may name the CatalogExporter or Dumper-7, which the server does not need).
[IO.File]::WriteAllText((Join-Path $RuntimeOut "mystic_loader.ini"), "; Extra DLLs the winmm.dll loader loads at game start (none).`r`n", [Text.Encoding]::ASCII)

Write-Host "[5/6] Tools and start files..."
foreach ($F in @("Start-Server.bat", "Stop-Server.bat", "Restart-Server.bat", "Server-Status.bat", "Make-Server-Pack.bat", "Make-Update-Pack.bat", "Set-Server-Address.bat", "Player-Currency.bat", "Set-Up-HTTPS.bat", "Enable-Log-Sync.bat")) {
    if (Test-Path (Join-Path $Root $F)) { Copy-Item (Join-Path $Root $F) $Pack }
}
Copy-Item (Join-Path $PSScriptRoot "pack\Install-Server.bat") $Pack
Copy-Item (Join-Path $PSScriptRoot "pack\README.txt") $Pack
if (Test-Path (Join-Path $Root "MNG-Game-Downloader")) { Copy-Tree (Join-Path $Root "MNG-Game-Downloader") (Join-Path $Pack "MNG-Game-Downloader") }
$LauncherVersion = (Get-Content (Join-Path $Repo "ParadoxLauncher\package.json") -Raw | ConvertFrom-Json).version
$Info = @(
    "MNG DAUNTLESS server pack",
    "Made:     $(Get-Date -Format 'yyyy-MM-dd HH:mm') on $env:COMPUTERNAME",
    "Launcher: $LauncherVersion",
    "Database: $(Read-EnvValue (Join-Path $Backend '.env') 'MONGODB_DB')"
)
[IO.File]::WriteAllLines((Join-Path $Pack "pack-info.txt"), $Info)

Write-Host "[6/6] Zipping..."
if (Test-Path $Zip) { Remove-Item -Force $Zip }
& tar.exe -a -c -f $Zip -C $Stage "MNG-Server"
if ($LASTEXITCODE -ne 0) { throw "Making the zip failed." }
Remove-Item -Recurse -Force $Stage

Write-Host ""
Write-Host ("Server pack ready: {0} ({1:N0} MB)" -f $Zip, ((Get-Item $Zip).Length / 1MB))
Write-Host "It contains passwords and signing keys: keep it private (do not post it publicly)."
Write-Host "On the other PC: unzip it, open the MNG-Server folder and double-click Install-Server.bat."
