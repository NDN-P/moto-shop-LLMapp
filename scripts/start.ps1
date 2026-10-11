param([switch]$Production)
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$nodePath = (Get-Command node -ErrorAction Stop).Source
Push-Location -LiteralPath $projectRoot
try {
  if (-not (Test-Path -LiteralPath ".env")) { throw "Create .env from .env.example and set local credentials first." }
  if (-not (Test-Path -LiteralPath "node_modules")) { throw "Install dependencies with npm ci first." }
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
