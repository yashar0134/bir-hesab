param(
  [ValidateSet("patch", "minor", "major")]
  [string]$Increment = "patch",
  [string]$Version = "",
  [string]$Branch = "main"
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

function Resolve-NpmExecutable {
  $npmCmdCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($npmCmdCommand -and $npmCmdCommand.Source) {
    return $npmCmdCommand.Source
  }

  $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
  if ($npmCommand -and $npmCommand.Source) {
    if ($npmCommand.Source -like "*.ps1") {
      $npmCmdSibling = [System.IO.Path]::ChangeExtension($npmCommand.Source, ".cmd")
      if (Test-Path $npmCmdSibling) {
        return $npmCmdSibling
      }
    }
    return $npmCommand.Source
  }

  $candidates = @(
    "C:\Program Files\nodejs\npm.cmd",
    "$env:LOCALAPPDATA\Programs\nodejs\npm.cmd"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  throw "npm command not found. Install Node.js first, then run this script again."
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

function Invoke-Npm {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )

  & $script:NpmExe @Args
  if ($LASTEXITCODE -ne 0) {
    throw "npm command failed: npm $($Args -join ' ')"
  }
}

function Get-IncrementedVersion {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BaseVersion,
    [Parameter(Mandatory = $true)]
    [ValidateSet("patch", "minor", "major")]
    [string]$IncrementType
  )

  if ($BaseVersion -notmatch "^(\d+)\.(\d+)\.(\d+)$") {
    throw "Current package.json version '$BaseVersion' is not plain semver (X.Y.Z)."
  }

  $major = [int]$Matches[1]
  $minor = [int]$Matches[2]
  $patch = [int]$Matches[3]

  switch ($IncrementType) {
    "patch" { $patch += 1 }
    "minor" { $minor += 1; $patch = 0 }
    "major" { $major += 1; $minor = 0; $patch = 0 }
  }

  return "$major.$minor.$patch"
}

$script:GitExe = Resolve-GitExecutable
$script:NpmExe = Resolve-NpmExecutable

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

if (-not (Test-Path ".git")) {
  throw "This folder is not a git repository."
}

$workingTreeStatus = & $GitExe status --porcelain
if ($LASTEXITCODE -ne 0) {
  throw "Unable to read git status."
}
if ($workingTreeStatus) {
  throw "Working tree is not clean. Commit or stash local changes first."
}

$currentBranch = (& $GitExe rev-parse --abbrev-ref HEAD).Trim()
if ($LASTEXITCODE -ne 0) {
  throw "Unable to detect current git branch."
}
if ($currentBranch -ne $Branch) {
  throw "Current branch is '$currentBranch'. Switch to '$Branch' before releasing."
}

Invoke-Git @("fetch", "origin", $Branch, "--tags")

$currentPackage = Get-Content "package.json" -Raw | ConvertFrom-Json
$currentVersion = [string]$currentPackage.version

$targetVersion = ""
if ($Version) {
  $normalizedVersion = $Version.TrimStart("v")
  if ($normalizedVersion -notmatch "^\d+\.\d+\.\d+([\-+][0-9A-Za-z\.-]+)?$") {
    throw "Invalid version format: '$Version'. Use semver format like 1.2.3."
  }
  $targetVersion = $normalizedVersion
} else {
  $targetVersion = Get-IncrementedVersion -BaseVersion $currentVersion -IncrementType $Increment
}

$tagName = "v$targetVersion"

$localTagOutput = & $GitExe tag --list $tagName
if ($LASTEXITCODE -ne 0) {
  throw "Unable to check local tags."
}
$localTag = [string]$localTagOutput
if (-not [string]::IsNullOrWhiteSpace($localTag)) {
  throw "Tag '$tagName' already exists locally."
}

$remoteTagOutput = & $GitExe ls-remote --tags origin "refs/tags/$tagName"
if ($LASTEXITCODE -ne 0) {
  throw "Unable to check remote tags."
}
$remoteTag = [string]$remoteTagOutput
if (-not [string]::IsNullOrWhiteSpace($remoteTag)) {
  throw "Tag '$tagName' already exists on origin."
}

Invoke-Npm @("version", $targetVersion, "--no-git-tag-version")

$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$newVersion = [string]$packageJson.version

Invoke-Git @("add", "package.json")
if (Test-Path "package-lock.json") {
  Invoke-Git @("add", "package-lock.json")
}

Invoke-Git @("commit", "-m", "chore(release): v$newVersion")
Invoke-Git @("tag", $tagName)
Invoke-Git @("push", "origin", $Branch)
Invoke-Git @("push", "origin", $tagName)

Write-Host "Release prepared and pushed."
Write-Host "Version: $newVersion"
Write-Host "Tag: $tagName"
Write-Host "GitHub Actions will build and publish this release automatically."
