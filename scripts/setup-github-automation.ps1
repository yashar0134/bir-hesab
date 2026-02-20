param(
  [string]$Remote = "origin",
  [switch]$SkipUpstreamSetup
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

function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )

  & $script:GitExe @Args
  if ($LASTEXITCODE -ne 0) {
    throw "Git command failed: git $($Args -join ' ')"
  }
}

$script:GitExe = Resolve-GitExecutable

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

if (-not (Test-Path ".git")) {
  throw "This folder is not a git repository."
}

$remotes = (& $script:GitExe remote)
if ($LASTEXITCODE -ne 0) {
  throw "Unable to list git remotes."
}
$remoteExists = ($remotes | ForEach-Object { $_.Trim() }) -contains $Remote
if (-not $remoteExists) {
  throw "Remote '$Remote' not found. Use npm run git:connect first."
}

Invoke-Git @("config", "--local", "core.hooksPath", "githooks")
$hooksPath = (& $script:GitExe config --local --get core.hooksPath).Trim()
if ($hooksPath -ne "githooks") {
  throw "Unable to set core.hooksPath to githooks."
}

$currentBranch = (& $script:GitExe rev-parse --abbrev-ref HEAD).Trim()
if ($LASTEXITCODE -ne 0) {
  throw "Unable to detect current branch."
}

if ($currentBranch -ne "HEAD" -and -not $SkipUpstreamSetup) {
  $upstream = & $script:GitExe rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace([string]$upstream)) {
    Write-Host "No upstream configured for '$currentBranch'. Setting upstream to '$Remote/$currentBranch'..."
    & $script:GitExe push -u $Remote $currentBranch
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to set upstream branch."
    }
  }
}

Write-Host "GitHub automation is enabled."
Write-Host "Hooks path: githooks"
Write-Host "Auto-push after commit: enabled (post-commit hook)"
Write-Host "Pre-push syntax checks: enabled (pre-push hook)"
Write-Host "Disable auto-push for one command: set BIR_HESAB_AUTO_PUSH=0"
Write-Host "Disable pre-push checks for one command: set BIR_HESAB_SKIP_PUSH_CHECKS=1"
