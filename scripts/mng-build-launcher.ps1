# MNG DAUNTLESS: builds the launcher installer players download (Build-Launcher.bat). The server's address is built in and
# not shown to players; it must be HTTPS (a release launcher refuses plain HTTP): the name Set-Up-HTTPS.bat set up.
#
#   Build-Launcher.bat                         asks for the server name and the GitHub repository the first time
#   Build-Launcher.bat -Domain play.example.com -Repo owner/mng-dauntless
#
# Saved for the next build in DautlessReforged\release-server.txt and release-repo.txt. Builds with the runtime update key in
# ParadoxLauncher\.secrets (players' launchers only accept runtime files signed with it). No launcher self-update (no
# updater key yet): players download new versions from the GitHub release page.
# Output: DautlessReforged\Launcher-Releases\MNG-DAUNTLESS-Launcher-<version>-setup.exe (+ .sha256.txt).
param([string]$Domain = "", [string]$Repo = "")

$ErrorActionPreference = "Stop"
$MpRepo = Split-Path -Parent $PSScriptRoot
$Root = Split-Path -Parent $MpRepo
$Launcher = Join-Path $MpRepo "ParadoxLauncher"
$DomainFile = Join-Path $Root "release-server.txt"
$RepoFile = Join-Path $Root "release-repo.txt"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Saved([string]$File) { if (Test-Path $File) { (Get-Content $File -Raw).Trim() } else { "" } }

if (-not $Domain) { $Domain = Saved $DomainFile }
if (-not $Domain) { $Domain = (Read-Host "Server name players connect to (for example play.example.com)").Trim() }
$Domain = ($Domain -replace "^[a-z]+://", "" -replace "/.*$", "").ToLower()
if ($Domain -notmatch "^([a-z0-9-]+\.)+[a-z]{2,}$") { throw "'$Domain' is not a server name like play.example.com." }
if (-not $Repo) { $Repo = Saved $RepoFile }
if (-not $Repo) { $Repo = (Read-Host "GitHub repository the releases go to (owner/name, for example vector/mng-dauntless)").Trim() }
if ($Repo -notmatch "^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$") { throw "'$Repo' is not owner/name." }
[IO.File]::WriteAllText($DomainFile, $Domain, $Utf8)
[IO.File]::WriteAllText($RepoFile, $Repo, $Utf8)

$Api = "https://$Domain"
Write-Host "=== MNG DAUNTLESS - Build the launcher ==="
Write-Host "Server:  $Api"
Write-Host "Repo:    https://github.com/$Repo"

# The server must answer over HTTPS with a valid certificate: a launcher built for a name that does not work helps nobody.
try {
    $Status = Invoke-RestMethod -Uri "$Api/launcher/v1/status" -TimeoutSec 15
    Write-Host "The server answers on $Api (online: $($Status.online))."
} catch {
    Write-Host "WARNING: $Api/launcher/v1/status did not answer: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "The launcher is built anyway; players can only sign in once the server answers there (Set-Up-HTTPS.bat)." -ForegroundColor Yellow
}

$KeyFile = Join-Path $Launcher ".secrets\selfhost-runtime-update.public.raw.b64"
if (-not (Test-Path $KeyFile)) { throw "Missing $KeyFile (the runtime update public key)." }
$env:MYSTICPARADOX_API_BASE_URL = $Api
$env:MYSTICPARADOX_RUNTIME_ENDPOINT = "$Api/launcher/v1/runtime"
$env:MYSTICPARADOX_RUNTIME_PUBLIC_KEY_B64 = (Get-Content $KeyFile -Raw).Trim()
$env:MYSTICPARADOX_RELEASE_REPO = $Repo
Remove-Item Env:MYSTICPARADOX_BUILD_KIND -ErrorAction SilentlyContinue

# No updater artifacts (they need an updater signing key we do not have yet); the NSIS installer only.
$Overlay = Join-Path ([IO.Path]::GetTempPath()) "mng-launcher-release.json"
[IO.File]::WriteAllText($Overlay, '{ "bundle": { "createUpdaterArtifacts": false, "targets": ["nsis"] } }', $Utf8)

Push-Location $Launcher
try {
    if (-not (Test-Path "node_modules")) { & npm ci; if ($LASTEXITCODE -ne 0) { throw "npm ci failed" } }
    & npm run tauri -- build --config $Overlay
    if ($LASTEXITCODE -ne 0) { throw "The launcher build failed (see above)." }
} finally { Pop-Location }

$Version = (Get-Content (Join-Path $Launcher "package.json") -Raw | ConvertFrom-Json).version
$Setup = Get-ChildItem (Join-Path $Launcher "src-tauri\target\release\bundle\nsis") -Filter "*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $Setup) { throw "No installer found in src-tauri\target\release\bundle\nsis." }
$OutDir = Join-Path $Root "Launcher-Releases"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$Out = Join-Path $OutDir "MNG-DAUNTLESS-Launcher-$Version-setup.exe"
Copy-Item $Setup.FullName $Out -Force
$Hash = (Get-FileHash $Out -Algorithm SHA256).Hash.ToLower()
[IO.File]::WriteAllText("$Out.sha256.txt", "$Hash  $(Split-Path -Leaf $Out)`r`n", $Utf8)

Write-Host ""
Write-Host "Installer: $Out" -ForegroundColor Green
Write-Host "SHA-256:   $Hash"
Write-Host "Upload it to a new release on https://github.com/$Repo/releases (tag launcher-v$Version)."
