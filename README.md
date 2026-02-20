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

## Enable GitHub Auto Sync (One-Time)

To push every new commit automatically to GitHub and block broken pushes:

```bash
npm run git:setup:auto
```

This setup enables:

1. `post-commit` hook: pushes current branch to `origin` after every commit
2. `pre-push` hook: runs syntax checks before any push
3. shared hook path via local git config (`core.hooksPath=githooks`)

Temporary disable examples (PowerShell):

```powershell
$env:BIR_HESAB_AUTO_PUSH='0'; git commit -m "local only"; Remove-Item Env:BIR_HESAB_AUTO_PUSH
$env:BIR_HESAB_SKIP_PUSH_CHECKS='1'; git push; Remove-Item Env:BIR_HESAB_SKIP_PUSH_CHECKS
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

## GitHub Actions

Workflow file:

- `.github/workflows/ci.yml` (runs on every push and pull request)
- `.github/workflows/release-win.yml`

Trigger:

- Any branch push / pull request (CI syntax check)
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

## Automatic Backup

Inside app topbar:

- `پشتیبان‌گیری`: manual backup to chosen path
- `بازیابی پشتیبان`: restore selected backup and restart app
- `تنظیم بکاپ خودکار`: set daily/weekly schedule + keep last N backups

Automatic backups are stored in app data folder under:

- `backups/`
