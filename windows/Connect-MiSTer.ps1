[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$MiSTerAddress,
    [ValidateRange(1024,65535)][int]$ListenPort = 8110,
    [switch]$KeepConnected
)
$ErrorActionPreference = 'Stop'
$address = $null
if (-not [Net.IPAddress]::TryParse($MiSTerAddress, [ref]$address) -or
    $address.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) {
    throw 'Enter the MiSTer IPv4 address shown on your home network.'
}
$bytes = $address.GetAddressBytes()
$privateAddress = $bytes[0] -eq 10 -or
    ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) -or
    ($bytes[0] -eq 192 -and $bytes[1] -eq 168)
if (-not $privateAddress) { throw 'Use the MiSTer home-network address, not a public or Tailscale address.' }
$tailscale = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
if (-not (Test-Path -LiteralPath $tailscale)) { throw 'Install Tailscale from https://tailscale.com/download/windows and sign in first.' }
function Invoke-Tailscale {
    param([string[]]$Arguments)
    $result = & $tailscale @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Tailscale command failed: $($Arguments[0])" }
    return $result
}
$status = Invoke-Tailscale -Arguments @('status','--json') | ConvertFrom-Json
if ($status.BackendState -ne 'Running') { throw 'Sign in to Tailscale on this PC, then run this script again.' }
$state = Invoke-RestMethod -Uri "http://${MiSTerAddress}:8110/api/state" -TimeoutSec 10
if (-not $state.state) { throw 'The target did not return MiSTer Control status.' }
$config = Invoke-Tailscale -Arguments @('serve','status','--json') | ConvertFrom-Json
$existing = $config.TCP."$ListenPort"
$target = "${MiSTerAddress}:8110"
if ($existing -and $existing.TCPForward -ne $target) {
    throw "Port $ListenPort already serves something else. Choose another -ListenPort."
}
Invoke-Tailscale -Arguments @('serve','--bg',"--tcp=$ListenPort","tcp://$target") | Write-Host
if ($KeepConnected) {
    Invoke-Tailscale -Arguments @('set','--unattended=true') | Write-Host
}
$ip = @($status.TailscaleIPs | Where-Object { $_ -notmatch ':' })[0]
Write-Host "`nOpen http://${ip}:$ListenPort/ on your phone with Tailscale connected."
Write-Host 'The PC and MiSTer must stay on. Leave the phone exit node set to None.'
Write-Host "To stop forwarding: & '$tailscale' serve --tcp=$ListenPort off"
