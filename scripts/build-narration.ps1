param([string]$FfmpegExecutable = "")
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$scriptPath = Join-Path $projectRoot "docs/demo-script.md"
$tempDirectory = Join-Path $projectRoot "tmp/narration"
$outputDirectory = Join-Path $projectRoot "output/demo"
$wavePath = Join-Path $tempDirectory "narration-guide.wav"
$mp3Path = Join-Path $outputDirectory "narration-guide.mp3"

if (-not $FfmpegExecutable) {
  $bundledFfmpeg = Join-Path $projectRoot "tmp/tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"
  $FfmpegExecutable = if (Test-Path -LiteralPath $bundledFfmpeg) { $bundledFfmpeg } else { (Get-Command ffmpeg -ErrorAction Stop).Source }
}
$pythonPath = Join-Path $projectRoot ".venv/Scripts/python.exe"
if (-not (Test-Path -LiteralPath $pythonPath)) { $pythonPath = (Get-Command python -ErrorAction Stop).Source }
$text = Get-Content -LiteralPath $scriptPath -Raw -Encoding UTF8
$successSection = [regex]::Split($text, '(?m)^## Replacement\b')[0]
$paragraphs = [regex]::Matches($successSection, '(?m)^> (.+)$') | ForEach-Object { $_.Groups[1].Value.Trim() }
if ($paragraphs.Count -ne 7) { throw "Expected seven narration paragraphs before the failure replacement; review the script." }
New-Item -ItemType Directory -Path $tempDirectory, $outputDirectory -Force | Out-Null

Add-Type -AssemblyName System.Speech
$narrator = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $narrator.SelectVoice("Microsoft Zira Desktop")
  $narrator.Rate = -1
  $prompt = New-Object System.Speech.Synthesis.PromptBuilder
  for ($index = 0; $index -lt $paragraphs.Count; $index++) {
    $prompt.AppendText($paragraphs[$index])
    if ($index -lt $paragraphs.Count - 1) { $prompt.AppendBreak([TimeSpan]::FromSeconds(3)) }
  }
  $narrator.SetOutputToWaveFile($wavePath)
  $narrator.Speak($prompt)
} finally { $narrator.Dispose() }

$duration = [double](& $pythonPath -c 'import sys, wave; w=wave.open(sys.argv[1]); print(w.getnframes()/w.getframerate()); w.close()' $wavePath)
if ($LASTEXITCODE -ne 0 -or $duration -lt 180 -or $duration -gt 360) { throw "Narration duration is $duration seconds; expected 180 to 360. Review the script or speech rate." }
$encodingLog = Join-Path $tempDirectory "ffmpeg.log"
$arguments = @('-y', '-hide_banner', '-loglevel', 'error', '-i', ('"' + $wavePath + '"'), '-codec:a', 'libmp3lame', '-b:a', '128k', ('"' + $mp3Path + '"'))
$encoder = Start-Process -FilePath $FfmpegExecutable -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardError $encodingLog
if ($encoder.ExitCode -ne 0) { throw "MP3 encoding failed; inspect $encodingLog" }
Write-Output ("Guide only: {0} ({1:N1} seconds). This audio does not demonstrate a live app or API result." -f $mp3Path, $duration)
