<#
.SYNOPSIS
  GangNiagaBot Zero-Cost Cloudflare Tunnel Exposer
.DESCRIPTION
  Exposes GangNiagaBot (port 3001) and OpenMuse (port 8787) to the public internet
  using Cloudflare Tunnel (100% Free / RM0, no VPS needed).
#>

param(
    [ValidateSet('gangniagabot', 'openmuse', 'both')]
    [string]$Target = 'gangniagabot',
    [int]$Port = 3001
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   GANGNIAGABOT ZERO-COST CLOUDFLARE TUNNEL (RM0)         " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# Check if cloudflared is installed
$cloudflaredCmd = Get-Command cloudflared -ErrorAction SilentlyContinue

if (-not $cloudflaredCmd) {
    Write-Host "[!] cloudflared not found. Installing via winget..." -ForegroundColor Yellow
    winget install --id Cloudflare.cloudflared --exact --silent --accept-source-agreements --accept-package-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

if ($Target -eq 'gangniagabot') {
    Write-Host "[*] Starting Cloudflare Quick Tunnel for GangNiagaBot (port 3001)..." -ForegroundColor Green
    Write-Host "[*] Public HTTPS URL will appear below:" -ForegroundColor Cyan
    cloudflared tunnel --url http://localhost:3001
} elseif ($Target -eq 'openmuse') {
    Write-Host "[*] Starting Cloudflare Quick Tunnel for OpenMuse (port 8787)..." -ForegroundColor Green
    Write-Host "[*] Public HTTPS URL will appear below:" -ForegroundColor Cyan
    cloudflared tunnel --url http://localhost:8787
}
