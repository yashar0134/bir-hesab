param(
  [string]$RemoteUrl = "https://github.com/yashar0134/bir-hesab.git",
  [string]$Branch = "main",
  [string]$CommitMessage = "Initial commit"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "git command not found. Install Git first, then run this script again."
}

if (-not (Test-Path ".git")) {
  git init
}

git checkout -B $Branch
git add .
git commit -m $CommitMessage

$remoteExists = git remote | Select-String -Pattern "^origin$" -Quiet
if ($remoteExists) {
  git remote set-url origin $RemoteUrl
} else {
  git remote add origin $RemoteUrl
}

git push -u origin $Branch

Write-Host "Repository connected and pushed to $RemoteUrl"
