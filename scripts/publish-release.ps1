param(
  [string]$Version = "",
  [switch]$Build
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

function Get-GitHubTokenFromCredentialManager {
  param(
    [Parameter(Mandatory = $true)]
    [string]$GitExe
  )

  $credentialInput = "protocol=https`nhost=github.com`n`n"
  $result = $credentialInput | & $GitExe credential fill
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to read git credentials for github.com."
  }

  $passwordLine = $result | Where-Object { $_ -like "password=*" } | Select-Object -First 1
  if (-not $passwordLine) {
    throw "GitHub token not found in git credential manager."
  }

  return ($passwordLine -replace "^password=", "")
}

function Upload-ReleaseAsset {
  param(
    [Parameter(Mandatory = $true)]
    [string]$UploadBaseUrl,
    [Parameter(Mandatory = $true)]
    [string]$Token,
    [Parameter(Mandatory = $true)]
    [System.IO.FileInfo]$File
  )

  $uploadHeaders = @{
    Authorization = "Bearer $Token"
    Accept = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
    "Content-Type" = "application/octet-stream"
  }

  $uploadUri = $UploadBaseUrl + "?name=" + [uri]::EscapeDataString($File.Name)
  Invoke-RestMethod -Method Post -Uri $uploadUri -Headers $uploadHeaders -InFile $File.FullName | Out-Null
}

$script:GitExe = Resolve-GitExecutable
$script:NpmExe = Resolve-NpmExecutable

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$packageVersion = [string]$packageJson.version
$targetVersion = if ($Version) { $Version.TrimStart("v") } else { $packageVersion }

if ($targetVersion -notmatch "^\d+\.\d+\.\d+([\-+][0-9A-Za-z\.-]+)?$") {
  throw "Invalid version format: '$targetVersion'. Use semver format like 1.2.3."
}

$tagName = "v$targetVersion"
$repo = ""
if ($packageJson.repository -and $packageJson.repository.url) {
  $repoUrl = [string]$packageJson.repository.url
  if ($repoUrl -match "github\.com[:/](?<owner>[^/]+)/(?<name>[^/.]+)(\.git)?$") {
    $repo = "$($Matches.owner)/$($Matches.name)"
  }
}

if (-not $repo) {
  throw "Unable to infer GitHub repository from package.json repository.url."
}

if ($Build) {
  Invoke-Npm @("run", "build:win")
}

$exe = Get-Item "dist/Bir-Hesab-Setup-$targetVersion.exe" -ErrorAction SilentlyContinue
if (-not $exe) {
  throw "Installer not found: dist/Bir-Hesab-Setup-$targetVersion.exe"
}

$hash = (Get-FileHash -Path $exe.FullName -Algorithm SHA256).Hash.ToLower()
$shaFilePath = Join-Path "dist" "SHA256SUMS.txt"
"$hash  $($exe.Name)" | Out-File -FilePath $shaFilePath -Encoding utf8
$shaFile = Get-Item $shaFilePath

$token = Get-GitHubTokenFromCredentialManager -GitExe $script:GitExe
$headers = @{
  Authorization = "Bearer $token"
  Accept = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
}

$release = $null
try {
  $release = Invoke-RestMethod -Method Get -Uri "https://api.github.com/repos/$repo/releases/tags/$tagName" -Headers $headers
} catch {
  if (-not $_.Exception.Response -or $_.Exception.Response.StatusCode.Value__ -ne 404) {
    throw
  }
}

if (-not $release) {
  $payload = @{
    tag_name = $tagName
    target_commitish = "main"
    name = $tagName
    generate_release_notes = $true
    draft = $false
    prerelease = $false
  } | ConvertTo-Json

  $release = Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/$repo/releases" -Headers $headers -Body $payload
}

$targetAssetNames = @($exe.Name, $shaFile.Name)
foreach ($asset in @($release.assets)) {
  if ($targetAssetNames -contains [string]$asset.name) {
    Invoke-RestMethod -Method Delete -Uri "https://api.github.com/repos/$repo/releases/assets/$($asset.id)" -Headers $headers | Out-Null
  }
}

$uploadBase = [string]$release.upload_url
if (-not $uploadBase) {
  throw "Release upload URL is missing."
}

$uploadBase = $uploadBase.Split("{")[0]
Upload-ReleaseAsset -UploadBaseUrl $uploadBase -Token $token -File $exe
Upload-ReleaseAsset -UploadBaseUrl $uploadBase -Token $token -File $shaFile

Write-Host "Release published successfully."
Write-Host "Tag: $tagName"
Write-Host "Release URL: $($release.html_url)"
Write-Host "Assets: $($exe.Name), $($shaFile.Name)"
