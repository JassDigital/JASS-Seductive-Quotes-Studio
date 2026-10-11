$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js is required. Install Node.js 20 or newer." }
if (-not (Test-Path "node_modules")) { npm install; if ($LASTEXITCODE -ne 0) { throw "npm install failed." } }
npm run check
if ($LASTEXITCODE -ne 0) { throw "Checks failed." }
npm run dev
