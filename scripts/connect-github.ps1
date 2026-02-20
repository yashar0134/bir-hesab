param(
  [string]$RemoteUrl = "https://github.com/yashar0134/bir-hesab.git",
  [string]$Branch = "main",
  [string]$CommitMessage = "Initial commit"
)

$ErrorActionPreference = "Stop"

function Resolve-GitExecutable {
  $gitCommand = Get-Command git -ErrorAction SilentlyContinue
  if ($gitCommand -and $gitCommand.Source) {
    return $gitCommand.Source
  }

  $candidates = @(
    "C:\Program Files\Git\cmd\git.exe",
    "C:\Program Files\Git\bin\git.exe",
    "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe",
    "$env:LOCALAPPDATA\Programs\Git\bin\git.exe"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  throw "git command not found. Install Git first, then run this script again."
}

$git = Resolve-GitExecutable

function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )

  & $git @Args
  if ($LASTEXITCODE -ne 0) {
    throw "Git command failed: git $($Args -join ' ')"
  }
}

if (-not (Test-Path ".git")) {
  Invoke-Git @("init")
}

Invoke-Git @("checkout", "-B", $Branch)

$workingTreeStatus = & $git status --porcelain
if ($LASTEXITCODE -ne 0) {
  throw "Unable to read git status."
}

if ($workingTreeStatus) {
  Invoke-Git @("add", "-A")
  Invoke-Git @("commit", "-m", $CommitMessage)
} else {
  Write-Host "No local changes to commit."
}

$remoteExists = (& $git remote) -contains "origin"
if ($LASTEXITCODE -ne 0) {
  throw "Unable to check git remotes."
}

if ($remoteExists) {
  Invoke-Git @("remote", "set-url", "origin", $RemoteUrl)
} else {
  Invoke-Git @("remote", "add", "origin", $RemoteUrl)
}

Invoke-Git @("push", "-u", "origin", $Branch)

Write-Host "Repository connected and pushed to $RemoteUrl"
