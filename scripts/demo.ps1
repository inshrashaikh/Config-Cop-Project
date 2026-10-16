# Config Cop demo launcher (Windows PowerShell)
# Starts the FastAPI backend and the Vite frontend, then opens the dashboard.
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\demo.ps1

$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $env:TEMP "configcop-logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

Write-Host "Starting backend on http://127.0.0.1:8000 ..."
Start-Process -FilePath "python" -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000") `
  -WorkingDirectory (Join-Path $root "backend") `
  -RedirectStandardOutput (Join-Path $logDir "backend.log") `
  -RedirectStandardError (Join-Path $logDir "backend.err.log") -WindowStyle Hidden

Start-Sleep -Seconds 3

Write-Host "Starting frontend on http://localhost:5173 ..."
Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", "npm run dev") `
  -WorkingDirectory (Join-Path $root "frontend") -WindowStyle Hidden

Start-Sleep -Seconds 5
Write-Host "Opened dashboard. Logs: $logDir"
Start-Process "http://localhost:5173"
