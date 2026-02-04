# Music Visualizer - Run locally
# Prerequisites: Node.js 18+, Python 3.9+, FFmpeg (for stem separation)
# Run from repo root: .\run-local.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

# Check prerequisites
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js not found. Install from https://nodejs.org/ and ensure it is in PATH." -ForegroundColor Red
    exit 1
}
if (-not (Get-Command python -ErrorAction SilentlyContinue) -and -not (Get-Command py -ErrorAction SilentlyContinue)) {
    Write-Host "Python not found. Install Python 3.9+ and ensure it is in PATH." -ForegroundColor Red
    exit 1
}

$py = if (Get-Command python -ErrorAction SilentlyContinue) { "python" } else { "py -3" }

# Backend: venv + deps + uvicorn
$serverDir = Join-Path $root "server"
$venv = Join-Path $serverDir "venv"
if (-not (Test-Path $venv)) {
    Write-Host "Creating Python venv in server/..." -ForegroundColor Cyan
    & $py -m venv $venv
}
$pip = Join-Path (Join-Path $venv "Scripts") "pip.exe"
$uvicorn = Join-Path (Join-Path $venv "Scripts") "uvicorn.exe"
if (-not (Test-Path $uvicorn)) {
    Write-Host "Installing backend dependencies (this may take several minutes for torch/demucs)..." -ForegroundColor Cyan
    & $pip install -r (Join-Path $serverDir "requirements.txt")
}
Write-Host "Starting backend on http://localhost:8000 ..." -ForegroundColor Green
$backendJob = Start-Job -ScriptBlock {
    param($venvPath, $serverPath)
    & (Join-Path (Join-Path $venvPath "Scripts") "Activate.ps1")
    Set-Location $serverPath
    uvicorn main:app --reload --port 8000
} -ArgumentList $venv, $serverDir

# Frontend: npm install + dev
$clientDir = Join-Path $root "client"
if (-not (Test-Path (Join-Path $clientDir "node_modules"))) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
    Set-Location $clientDir
    npm install
    Set-Location $root
}
Write-Host "Starting frontend on http://localhost:5173 ..." -ForegroundColor Green
Write-Host ""
Write-Host "Frontend: http://localhost:5173  |  Backend: http://localhost:8000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the frontend (backend keeps running; stop it with Stop-Job -Id $($backendJob.Id))." -ForegroundColor Gray
Write-Host ""
Set-Location $clientDir
npm run dev
