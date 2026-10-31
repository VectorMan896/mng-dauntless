# MNG DAUNTLESS: makes an UPDATE pack for a server that is already installed (Make-Update-Pack.bat).
# Unlike the full server pack it has no settings (.env), keys, packages or database, so the other PC keeps its own
# address, accounts and saves. It holds the latest code and tools:
#   Mystic-Paradox\ParadoxBackend, ParadoxDirector   source, build output and game data (no .env, no node_modules)
#   Mystic-Paradox\scripts, CHANGELOG-MNG.md, TODO-MNG.md
#   server-data\                                     the runtime update feed (what players' launchers download)
#   saves\game-runtime\                              the newest MysticParadox.dll + winmm.dll for the game servers
#   the .bat files and MNG-Game-Downloader
# On the server PC: Stop-Server.bat, unzip over the MNG-Server folder (replace files), Install-Server.bat (puts the new
# runtime next to the game; answer "no" to replacing the database), Start-Server.bat.
param([string]$OutDir = "")

$ErrorActionPreference = "Stop"
$Repo = Split-Path -Parent $PSScriptRoot
$Root = Split-Path -Parent $Repo
if (-not $OutDir) { $OutDir = Join-Path $Root "Server-Packs" }
$Stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$Stage = Join-Path ([IO.Path]::GetTempPath()) "mng-update-pack-$Stamp"
$Pack = Join-Path $Stage "MNG-Server"
$Zip = Join-Path $OutDir "MNG-Server-Update-$Stamp.zip"

function Copy-Tree([string]$From, [string]$To, [string[]]$ExcludeDirs = @(), [string[]]$ExcludeFiles = @()) {
    $RoboArgs = @($From, $To, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/R:1", "/W:1")
    if ($ExcludeDirs.Count) { $RoboArgs += "/XD"; $RoboArgs += $ExcludeDirs }
    if ($ExcludeFiles.Count) { $RoboArgs += "/XF"; $RoboArgs += $ExcludeFiles }
    & robocopy.exe @RoboArgs | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Copying $From failed (robocopy code $LASTEXITCODE)." }
}

Write-Host "=== MNG DAUNTLESS - Make Update Pack ==="
if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
New-Item -ItemType Directory -Force -Path $Pack, $OutDir | Out-Null

Write-Host "[1/4] Server code and game data (no settings, keys or packages)..."
foreach ($Part in @("ParadoxBackend", "ParadoxDirector")) {
    Copy-Tree (Join-Path $Repo $Part) (Join-Path $Pack "Mystic-Paradox\$Part") @("node_modules", "debug") @(".env", "*.log")
}
Copy-Tree (Join-Path $Repo "scripts") (Join-Path $Pack "Mystic-Paradox\scripts")
foreach ($F in @("CHANGELOG-MNG.md", "TODO-MNG.md")) { Copy-Item (Join-Path $Repo $F) (Join-Path $Pack "Mystic-Paradox") }

Write-Host "[2/4] Runtime update feed..."
Copy-Tree (Join-Path $Root "server-data") (Join-Path $Pack "server-data")

Write-Host "[3/4] Newest runtime for the game servers..."
$Feed = Join-Path $Root "server-data\updates\runtime\client\stable\windows-x86_64"
$Latest = Get-Content (Join-Path $Feed "latest.json") -Raw | ConvertFrom-Json
$RuntimeOut = Join-Path $Pack "saves\game-runtime"
New-Item -ItemType Directory -Force -Path $RuntimeOut | Out-Null
Copy-Item (Join-Path $Feed "$($Latest.version)\$($Latest.file)") (Join-Path $RuntimeOut "MysticParadox.dll")
Copy-Item (Join-Path $Feed "$($Latest.version)\winmm.dll") (Join-Path $RuntimeOut "winmm.dll")
[IO.File]::WriteAllText((Join-Path $RuntimeOut "mystic_loader.ini"), "; Extra DLLs the winmm.dll loader loads at game start (none).`r`n", [Text.Encoding]::ASCII)

Write-Host "[4/4] Start files, downloader, zip..."
foreach ($F in @("Start-Server.bat", "Stop-Server.bat", "Restart-Server.bat", "Server-Status.bat", "Make-Server-Pack.bat", "Make-Update-Pack.bat", "Set-Server-Address.bat", "Player-Currency.bat", "Set-Up-HTTPS.bat")) {
    if (Test-Path (Join-Path $Root $F)) { Copy-Item (Join-Path $Root $F) $Pack }
}
Copy-Item (Join-Path $PSScriptRoot "pack\Install-Server.bat") $Pack
Copy-Item (Join-Path $PSScriptRoot "pack\README.txt") $Pack
if (Test-Path (Join-Path $Root "MNG-Game-Downloader")) { Copy-Tree (Join-Path $Root "MNG-Game-Downloader") (Join-Path $Pack "MNG-Game-Downloader") }
$Info = @(
    "MNG DAUNTLESS UPDATE pack (no settings, keys or database)",
    "Made:    $(Get-Date -Format 'yyyy-MM-dd HH:mm') on $env:COMPUTERNAME",
    "Runtime: $($Latest.version)",
    "",
    "On the server PC:",
    "  1. Stop-Server.bat",
    "  2. Unzip this over the MNG-Server folder (replace the files)",
    "  3. Install-Server.bat - answer NO when it asks to replace the database",
    "  4. Start-Server.bat"
)
[IO.File]::WriteAllLines((Join-Path $Pack "UPDATE-README.txt"), $Info)
if (Test-Path $Zip) { Remove-Item -Force $Zip }
& tar.exe -a -c -f $Zip -C $Stage "MNG-Server"
if ($LASTEXITCODE -ne 0) { throw "Making the zip failed." }
Remove-Item -Recurse -Force $Stage

Write-Host ""
Write-Host ("Update pack ready: {0} ({1:N0} MB), runtime {2}" -f $Zip, ((Get-Item $Zip).Length / 1MB), $Latest.version)
Write-Host "On the server PC: Stop-Server.bat, unzip over MNG-Server, Install-Server.bat (database: NO), Start-Server.bat."
