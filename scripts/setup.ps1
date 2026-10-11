param(
  [string]$PythonExecutable = "",
  [switch]$Check
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $projectRoot ".venv\Scripts\python.exe"

if (-not $PythonExecutable) {
  $PythonExecutable = if (Test-Path -LiteralPath $venvPython) { $venvPython } else { "python" }
}
$pythonCommand = Get-Command $PythonExecutable -ErrorAction Stop
$nodeCommand = Get-Command node -ErrorAction Stop
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCommand) { $npmCommand = Get-Command npm -ErrorAction SilentlyContinue }
if (-not $npmCommand) { throw "npm was not found. Install Node.js with npm and reopen PowerShell." }

Push-Location -LiteralPath $projectRoot
try {
  foreach ($required in @("package-lock.json", "requirements.txt", ".env.example", "assistant\data\catalog.json")) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Missing project file: $required" }
  }
  $nodeVersion = [version](& $nodeCommand.Source -p "process.versions.node")
  if ($LASTEXITCODE -ne 0 -or $nodeVersion -lt [version]"22.12.0") { throw "Node.js 22.12 or newer is required; Node.js 24 is the tested version." }
  & $pythonCommand.Source -c 'import sys; print("Python " + sys.version.split()[0]); raise SystemExit(sys.version_info < (3, 10))'
  if ($LASTEXITCODE -ne 0) { throw "Python 3.10 or newer is required. Use -PythonExecutable with its full executable path." }
  & $pythonCommand.Source -c 'import json, pathlib; d=json.loads(pathlib.Path("assistant/data/catalog.json").read_text(encoding="utf-8")); assert isinstance(d, dict) and d.get("synthetic") is True and d.get("parts"), "An invented sample catalog is required"'
  if ($LASTEXITCODE -ne 0) { throw "The sample catalog check failed." }
  & $npmCommand.Source --version
  if ($LASTEXITCODE -ne 0) { throw "npm could not run." }
  if ($Check) {
    Write-Host "Setup checks passed. No installs or configuration changes were made."
    return
  }

  if (-not (Test-Path -LiteralPath $venvPython)) {
    & $pythonCommand.Source -m venv (Join-Path $projectRoot ".venv")
    if ($LASTEXITCODE -ne 0) { throw "Could not create the Python environment." }
  }
  & $venvPython -m pip install -r requirements.txt
  if ($LASTEXITCODE -ne 0) { throw "Python dependency installation failed." }
  & $npmCommand.Source ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed. Check the lock file and installation output." }
  if (-not (Test-Path -LiteralPath ".env")) {
    Copy-Item -LiteralPath ".env.example" -Destination ".env"
    Write-Host "Created .env. Set ADMIN_USERNAME, ADMIN_PASSWORD and OPENAI_API_KEY locally."
  } else {
    Write-Host "Existing .env was kept."
  }
  Write-Host "Setup complete. Create demo.db with .\.venv\Scripts\python.exe scripts\seed-demo.py, then run npm run dev."
} finally {
  Pop-Location
}
