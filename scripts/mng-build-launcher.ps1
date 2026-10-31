# MNG DAUNTLESS: builds the launcher installer players download (Build-Launcher.bat). The server's address is built in and
# not shown to players; it must be HTTPS (a release launcher refuses plain HTTP): the name Set-Up-HTTPS.bat set up.
#
#   Build-Launcher.bat                         asks for the server name and the GitHub repository the first time
#   Build-Launcher.bat -Domain play.example.com -Repo owner/mng-dauntless
#
# Saved for the next build in DautlessReforged\release-server.txt and release-repo.txt. Builds with the runtime update key in
# ParadoxLauncher\.secrets (players' launchers only accept runtime files signed with it).
# [31 Oct] Self-update: the launcher checks https://github.com/<repo>/releases/latest/download/latest.json every 30 minutes
# and offers "Update now". The installer is signed with .secrets\mng-launcher-updater.key (its password beside it); the
# public half is built in. KEEP A COPY OF THAT KEY: without it no installed launcher accepts an update again.
# Output in DautlessReforged\Launcher-Releases\: MNG-DAUNTLESS-Launcher-<version>-setup.exe (+ .sha256.txt) and latest.json.
# Upload all of them to the GitHub release tagged launcher-v<version>.
param([string]$Domain = "", [string]$Repo = "", [string]$Notes = "")

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
# The MNG release is the official build of this launcher: no "UNOFFICIAL BUILD" tag.
$env:MYSTICPARADOX_BUILD_KIND = "official"

# Self-update: the signing key, its password and the public key built into the launcher.
$Secrets = Join-Path $Launcher ".secrets"
$UpdaterKey = Join-Path $Secrets "mng-launcher-updater.key"
foreach ($F in @($UpdaterKey, "$UpdaterKey.pub", (Join-Path $Secrets "mng-launcher-updater.password"))) {
    if (-not (Test-Path $F)) { throw "Missing $F (the launcher update signing key)." }
}
$env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content $UpdaterKey -Raw).Trim()
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = (Get-Content (Join-Path $Secrets "mng-launcher-updater.password") -Raw).Trim()
$UpdateFeed = "https://github.com/$Repo/releases/latest/download/latest.json"
$OverlayDoc = @{
    bundle = @{ createUpdaterArtifacts = $true; targets = @("nsis") }
    plugins = @{ updater = @{ pubkey = (Get-Content "$UpdaterKey.pub" -Raw).Trim(); endpoints = @($UpdateFeed); windows = @{ installMode = "passive" } } }
}
$Overlay = Join-Path ([IO.Path]::GetTempPath()) "mng-launcher-release.json"
[IO.File]::WriteAllText($Overlay, ($OverlayDoc | ConvertTo-Json -Depth 6), $Utf8)

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

# The update manifest: the version, and the signed installer's URL on the release (the signature covers its bytes).
$Sig = "$($Setup.FullName).sig"
if (-not (Test-Path $Sig)) { throw "No update signature ($Sig): was the installer signed?" }
# -Notes "one line for players" shows in the update pop-up.
$Manifest = [ordered]@{
    version = $Version
    notes = $Notes
    pub_date = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    platforms = [ordered]@{
        "windows-x86_64" = [ordered]@{
            signature = (Get-Content $Sig -Raw).Trim()
            url = "https://github.com/$Repo/releases/download/launcher-v$Version/$(Split-Path -Leaf $Out)"
        }
    }
}
[IO.File]::WriteAllText((Join-Path $OutDir "latest.json"), ($Manifest | ConvertTo-Json -Depth 5), $Utf8)

Write-Host ""
Write-Host "Installer: $Out" -ForegroundColor Green
Write-Host "SHA-256:   $Hash"
Write-Host "Upload the installer, its .sha256.txt and latest.json to a new release on https://github.com/$Repo/releases"
Write-Host "with the tag launcher-v$Version (exactly). Installed launchers then offer the update within 30 minutes."
