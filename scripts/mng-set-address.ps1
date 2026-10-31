# MNG DAUNTLESS: sets the address players use to reach this server (run on the server PC; Set-Server-Address.bat).
#   mng-set-address.ps1                 shows this PC's addresses and asks
#   mng-set-address.ps1 -Address 100.80.1.2
#   mng-set-address.ps1 -Address local  back to "this PC only" (127.0.0.1)
# Writes three settings, then the server needs a restart (Restart-Server.bat):
#   ParadoxDirector\.env  MY_IP                        where the game connects to Ramsgate, the Dojo and hunts
#   ParadoxBackend\.env   UPDATE_PUBLIC_BASE_URL       where launchers download the runtime files from
#   ParadoxBackend\.env   REALTIME_XMPP_ALLOWED_HOSTS  addresses accepted for chat and friends
param([string]$Address = "")

$ErrorActionPreference = "Stop"
$Repo = Split-Path -Parent $PSScriptRoot
$BackendEnv = Join-Path $Repo "ParadoxBackend\.env"
$DirectorEnv = Join-Path $Repo "ParadoxDirector\.env"

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
    [IO.File]::WriteAllText($File, $Text, [Text.UTF8Encoding]::new($false))
}

Write-Host "=== MNG DAUNTLESS - Server Address ==="
Write-Host "Now: $(Read-EnvValue $DirectorEnv 'MY_IP')"
if (-not $Address) {
    Write-Host ""
    Write-Host "This PC's addresses:"
    foreach ($Ip in Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notmatch "^(127\.|169\.254\.)" }) {
        $Kind = if ($Ip.IPAddress -match "^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.") { "Tailscale - players on Tailscale use this one" }
                elseif ($Ip.IPAddress -match "^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)") { "home network - players in this house" }
                else { "" }
        Write-Host ("  {0,-16} {1}  {2}" -f $Ip.IPAddress, $Ip.InterfaceAlias, $Kind)
    }
    Write-Host "  For players over the internet without Tailscale: this connection's public address or a domain"
    Write-Host "  (the router must forward TCP 3000 and UDP 8780-8790 to this PC)."
    Write-Host ""
    $Address = (Read-Host "Address players should use (or 'local' for this PC only)").Trim()
}
$Address = $Address -replace "^[a-z]+://", "" -replace "[:/].*$", ""
if (-not $Address) { throw "No address given; nothing changed." }
if ($Address -eq "local") { $Address = "127.0.0.1" }
if ($Address -notmatch "^[A-Za-z0-9.-]+$") { throw "'$Address' is not an address (expected something like 100.80.1.2 or play.example.com)." }

$Port = Read-EnvValue $BackendEnv "PORT"; if (-not $Port) { $Port = "3000" }
Set-EnvValue $DirectorEnv "MY_IP" $Address
# [31 Oct] Once HTTPS is set up (Set-Up-HTTPS.bat: MNG_DOMAIN), launchers download from https://<domain>: keep that.
$Domain = Read-EnvValue $BackendEnv "MNG_DOMAIN"
if ($Domain) { Set-EnvValue $BackendEnv "UPDATE_PUBLIC_BASE_URL" "https://$Domain" }
else { Set-EnvValue $BackendEnv "UPDATE_PUBLIC_BASE_URL" "http://${Address}:$Port" }
$Hosts = @("localhost", "127.0.0.1") + @($Address) + @($Domain | Where-Object { $_ }) | Select-Object -Unique
Set-EnvValue $BackendEnv "REALTIME_XMPP_ALLOWED_HOSTS" ($Hosts -join ",")

Write-Host ""
Write-Host "Done. Players connect to: $Address" -ForegroundColor Green
Write-Host "In their launcher folder they put this in launcher-server.txt (Start-Launcher.bat asks for it):"
Write-Host "  http://${Address}:$Port"
Write-Host "Restart the server for it to take effect (Restart-Server.bat)."
