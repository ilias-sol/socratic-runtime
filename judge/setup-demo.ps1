$ErrorActionPreference = "Stop"

$bundleRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$demoRoot = Join-Path $bundleRoot "binary-search-demo"
$venvRoot = Join-Path $demoRoot ".venv"
$requirements = Join-Path $demoRoot "requirements.txt"

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  throw "Python 3.10 or newer is required and was not found on PATH."
}

python -m venv $venvRoot
$python = if ($IsWindows -or $env:OS -eq "Windows_NT") {
  Join-Path $venvRoot "Scripts\python.exe"
} else {
  Join-Path $venvRoot "bin/python"
}
& $python -m pip install -r $requirements

$codex = Get-Command codex -ErrorAction SilentlyContinue
if ($codex) {
  & $codex.Source login status
} else {
  Write-Warning "Codex CLI was not found on PATH. Install it and sign in before starting the session."
}

Write-Host ""
Write-Host "Demo setup complete."
Write-Host "1. Install socratic-runtime-0.2.0.vsix in VS Code."
Write-Host "2. Open binary-search-demo and open binary_search.py."
Write-Host "3. Run 'Socratic Runtime: Start Session'."
