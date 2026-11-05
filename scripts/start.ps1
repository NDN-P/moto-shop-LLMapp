param([switch]$Production, [switch]$Open)
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$nodePath = (Get-Command node -ErrorAction Stop).Source
Push-Location -LiteralPath $projectRoot
try {
  if (-not (Test-Path -LiteralPath ".env")) { throw "Create .env from .env.example and set local credentials first." }
  if (-not (Test-Path -LiteralPath "node_modules")) { throw "Install dependencies with npm ci first." }
  if ($Open) {
    # Pin a free port so the browser opens this server, not another app already on the default port.
    $port = $env:PORT
    if (-not $port) { $port = (Get-Content -LiteralPath ".env" | Where-Object { $_ -match '^\s*PORT\s*=' } | Select-Object -First 1) -replace '^\s*PORT\s*=\s*', '' }
    $port = if ($port -match '^\d+$') { [int]$port } else { 3000 }
    function Test-PortInUse($p) {
      $client = New-Object Net.Sockets.TcpClient
      try { $client.Connect("127.0.0.1", $p); $true } catch { $false } finally { $client.Close() }
    }
    while (Test-PortInUse $port) { $port++ }
    $env:PORT = "$port"
    $url = "http://localhost:$port/"
    # Wait in a hidden helper until the server answers, then open Chrome (or the default browser).
    $opener = "for (`$i = 0; `$i -lt 120; `$i++) { `$c = New-Object Net.Sockets.TcpClient; try { `$c.Connect('127.0.0.1', $port); `$c.Close(); break } catch { Start-Sleep -Milliseconds 500 } }; " +
              "try { Start-Process chrome '$url' } catch { Start-Process '$url' }"
    Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoProfile", "-Command", $opener
    Write-Host "Opening $url in Chrome when the server is ready..."
  }
  if ($Production) {
    if (-not (Test-Path -LiteralPath "dist/index.js")) { throw "Build first with npm run build." }
    $env:NODE_ENV = "production"
    & $nodePath dist/index.js
  } else {
    $env:NODE_ENV = "development"
    & $nodePath node_modules/tsx/dist/cli.mjs server/_core/index.ts
  }
  if ($LASTEXITCODE -ne 0) { throw "The shop process stopped with an error." }
} finally { Pop-Location }
