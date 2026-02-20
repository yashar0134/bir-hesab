# Bir Hesab

Windows desktop accounting app for Birino, built with Electron + SQLite.

## Run

```bash
npm install
npm start
```

## Build Windows Installer

```bash
npm run build:win
```

## GitHub Repository

Project repository:

- `https://github.com/yashar0134/bir-hesab`

`package.json` is already configured with repository/bugs/homepage for this URL.

## Connect Project To GitHub (One-Time)

If you need to reconnect `origin` or push initial history:

```bash
npm run git:connect
```

Custom remote URL:

```bash
npm run git:connect -- -RemoteUrl https://github.com/<user>/<repo>.git
```

## Updater Source (GitHub)

Updater is configured to read latest version from GitHub Releases:

`updater/version.json`

```json
{
  "githubRepo": "yashar0134/bir-hesab",
  "updateUrl": ""
}
```

Flow:

1. App checks `https://api.github.com/repos/yashar0134/bir-hesab/releases/latest`
2. Finds latest `.exe` installer asset
3. Downloads and runs installer from inside app

Optional:

- If release contains `SHA256SUMS.txt` or `.sha256` asset, checksum is verified automatically.

## GitHub Actions Release Pipeline

Workflow file:

- `.github/workflows/release-win.yml`

Trigger:

- Push tag like `v1.0.1`
- Manual run (`workflow_dispatch`)

What it does:

1. Builds Windows installer
2. Creates `SHA256SUMS.txt`
3. Publishes GitHub Release with installer + checksum

## Release Process (Easy)

Recommended commands:

```bash
npm run release:patch
npm run release:minor
npm run release:major
```

What these scripts do:

1. Bump version in `package.json` and `package-lock.json`
2. Create release commit (`chore(release): vX.Y.Z`)
3. Create and push tag (`vX.Y.Z`)
4. Trigger GitHub Action to build and publish release assets

After GitHub Action finishes, clients receive update through app updater.

## Manual Publish (Fallback / Deterministic)

If GitHub Actions release build is unavailable, publish assets directly from your machine:

```bash
npm run release:publish
```

This command:

1. Builds Windows installer locally (`build:win`)
2. Generates `dist/SHA256SUMS.txt`
3. Creates release for current tag if missing
4. Uploads installer + checksum to the release
