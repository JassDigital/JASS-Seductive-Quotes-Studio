$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
Write-Host "`nJASS Seductive Quotes Studio v1.1 - pre-publish checks" -ForegroundColor Cyan
if (-not (Test-Path "node_modules")) { npm install; if ($LASTEXITCODE -ne 0) { throw "npm install failed." } }
npm run check
if ($LASTEXITCODE -ne 0) { throw "Tests failed. Nothing was published." }
npm run build
if ($LASTEXITCODE -ne 0) { throw "Production build failed. Nothing was published." }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "Git is not installed." }
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw "GitHub CLI (gh) is not installed." }
gh auth status
if ($LASTEXITCODE -ne 0) { throw "Please authenticate with: gh auth login" }
if (-not (Test-Path ".git")) { git init }
git add .gitignore LICENSE README.md data electron index.html package.json publish-github.ps1 run-dev.ps1 src tests vite.config.js
if ($LASTEXITCODE -ne 0) { throw "git add failed." }
Write-Host "`nReview staged changes before proceeding:" -ForegroundColor Yellow
git diff --cached --stat
git status --short
$answer = Read-Host "Commit these files and create/push JassDigital/JASS-Seductive-Quotes-Studio if needed? Type YES to continue"
if ($answer -cne "YES") { Write-Host "Cancelled. Files remain local and staged."; exit 0 }
git commit -m "feat: release JASS Seductive Quotes Studio v1.1"
if ($LASTEXITCODE -ne 0) { throw "Commit failed. Review git status." }
gh repo view JassDigital/JASS-Seductive-Quotes-Studio *> $null
if ($LASTEXITCODE -ne 0) { gh repo create JassDigital/JASS-Seductive-Quotes-Studio --public --source . --remote origin --push }
else { $remote = git remote get-url origin 2>$null; if (-not $remote) { git remote add origin "https://github.com/JassDigital/JASS-Seductive-Quotes-Studio.git" }; git push -u origin HEAD }
if ($LASTEXITCODE -ne 0) { throw "GitHub publishing failed. The local commit remains available." }
Write-Host "`nPublished: https://github.com/JassDigital/JASS-Seductive-Quotes-Studio" -ForegroundColor Green
