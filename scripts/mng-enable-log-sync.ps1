# MNG DAUNTLESS (2026-11-10): run once on the SERVER PC (Enable-Log-Sync.bat). Puts the log sync token into the backend's .env
# (LAUNCHER_LOG_SYNC_TOKEN), so the development PC can read this server's logs with Get-Server-Logs.bat (read-only: the
# backend, Director and game server logs, and players' uploaded logs). Then restart the server (Restart-Server.bat).
param([string]$Token = "")

$ErrorActionPreference = "Stop"
$Repo = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $Repo "ParadoxBackend\.env"
if (-not (Test-Path $EnvFile)) { throw "No backend settings at $EnvFile - is this the server PC's MNG-Server folder?" }
if (-not $Token) { $Token = Read-Host "Paste the log sync token (from the development PC's live-log-sync-token.txt)" }
$Token = $Token.Trim()
if ($Token -notmatch '^[A-Za-z0-9_-]{32,128}$') { throw "That does not look like the token (32-128 letters, digits, - or _)." }

$Lines = [System.Collections.Generic.List[string]](Get-Content $EnvFile)
$Index = -1
for ($i = 0; $i -lt $Lines.Count; $i++) { if ($Lines[$i] -match '^\s*LAUNCHER_LOG_SYNC_TOKEN\s*=') { $Index = $i } }
$Line = "LAUNCHER_LOG_SYNC_TOKEN=$Token"
if ($Index -ge 0) { $Lines[$Index] = $Line } else { $Lines.Add("# [MNG] Read-only log access for the development PC (Get-Server-Logs.bat)."); $Lines.Add($Line) }
Copy-Item $EnvFile "$EnvFile.before-log-sync" -Force
[IO.File]::WriteAllLines($EnvFile, $Lines)
Write-Host "Log sync enabled in $EnvFile (previous copy: .env.before-log-sync)."
Write-Host "Restart the server now (Restart-Server.bat) for it to take effect."
