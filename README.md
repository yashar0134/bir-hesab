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

## Release Process

1. Update version in `package.json` (example: `1.0.1`)
2. Commit and push to `main`
3. Create and push tag:

```bash
git tag v1.0.1
git push origin v1.0.1
```

After GitHub Action finishes, clients receive update through app updater.

