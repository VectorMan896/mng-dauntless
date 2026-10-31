# MNG DAUNTLESS: sets up HTTPS for the server once (Set-Up-HTTPS.bat). Before running it, point the server's name at this PC:
# at the domain provider (Hostinger: hPanel > Domains > DNS / Nameservers) add an "A" record, for example name "play", value
# = this PC's public address, TTL 300. On the router, forward TCP 443 and TCP 80 to this PC (80 is the region-ping port, usually
# forwarded already).
# This script: stops the server, opens TCP 443 and 80 in Windows' firewall, gets a Let's Encrypt certificate for the name
# (ParadoxBackend\scripts\mng-https.cjs) and switches the backend to HTTPS on 443. Start-Server renews the certificate later.
param([switch]$Elevated)

$ErrorActionPreference = "Stop"
$Repo = Split-Path -Parent $PSScriptRoot

$IsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $IsAdmin) {
    Write-Host "Asking Windows for administrator permission (firewall rules)... the setup continues in a new window."
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`"", "-Elevated"
    exit 0
}

try {
    Write-Host "=== MNG DAUNTLESS - Set up HTTPS ==="
    Write-Host ""
    Write-Host "Before this: your domain's DNS has an A record for the server's name pointing at this PC's public address,"
    Write-Host "and the router forwards TCP 443 and TCP 80 to this PC."
    Write-Host ""

    Write-Host "Stopping the server (the certificate check needs port 80 for a minute)..."
    & (Join-Path $PSScriptRoot "mng-server.ps1") stop

    foreach ($Port in 443, 80) {
        $Name = "MNG DAUNTLESS HTTPS (TCP $Port)"
        if (-not (Get-NetFirewallRule -DisplayName $Name -ErrorAction SilentlyContinue)) {
            New-NetFirewallRule -DisplayName $Name -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow | Out-Null
            Write-Host "Opened TCP $Port in Windows' firewall."
        }
    }

    Push-Location (Join-Path $Repo "ParadoxBackend")
    try { & node "scripts\mng-https.cjs" setup } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw "The certificate was not issued (see the message above). Nothing else changed; fix it and run this again." }

    Write-Host ""
    Write-Host "Done. Start the server with Start-Server.bat. Players' launchers must be built for this name (Build-Launcher.bat)."
} catch {
    Write-Host ""
    Write-Host "Setup stopped: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to close"
