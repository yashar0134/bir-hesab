const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createHash } = require("node:crypto");
const { Readable, Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");

const FALLBACK_VERSION = "1.0.0";
const GITHUB_API_ROOT = "https://api.github.com";
const GITHUB_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "bir-hesab-updater"
};

let downloadedUpdate = null;
let activeDownloadPromise = null;

function parseVersionParts(version) {
  const normalized = String(version || "")
    .trim()
    .replace(/^v/i, "")
    .split(/[+-]/)[0];
  return normalized
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

function compareVersions(currentVersion, latestVersion) {
  const currentParts = parseVersionParts(currentVersion);
  const latestParts = parseVersionParts(latestVersion);
  const maxLength = Math.max(currentParts.length, latestParts.length);

  for (let i = 0; i < maxLength; i += 1) {
    const a = currentParts[i] || 0;
    const b = latestParts[i] || 0;
    if (a < b) return -1;
    if (a > b) return 1;
  }
  return 0;
}

function resolveLocalConfigPath() {
  return [
    path.join(__dirname, "..", "..", "updater", "version.json"),
    path.join(process.resourcesPath || "", "updater", "version.json"),
    path.join(process.cwd(), "updater", "version.json")
  ];
}

function readLocalConfig(electronApp) {
  const base = {
    version: electronApp.getVersion?.() || FALLBACK_VERSION,
    updateUrl: "",
    githubRepo: ""
  };
  const configPath = resolveLocalConfigPath().find((item) => item && fs.existsSync(item));
  if (!configPath) return base;

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...base,
      ...parsed,
      version: base.version
    };
  } catch {
    return base;
  }
}

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    headers
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json();
}

async function fetchText(url, headers = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    headers
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.text();
}

function normalizeReleaseVersion(tagOrName, fallbackVersion) {
  const raw = String(tagOrName || "").trim().replace(/^v/i, "");
  const match = raw.match(/\d+(?:\.\d+){1,3}/);
  if (match) return match[0];
  return raw || fallbackVersion;
}

function extractReleaseNotes(text) {
  if (!text) return [];
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*•]\s*/, ""))
    .filter(Boolean)
    .slice(0, 12);
}

function selectInstallerAsset(assets) {
  if (!Array.isArray(assets) || !assets.length) return null;
  const exes = assets.filter((item) => /\.exe$/i.test(item.name || ""));
  if (!exes.length) return null;
  return exes.find((item) => /setup/i.test(item.name || "")) || exes[0];
}

async function resolveSha256FromReleaseAssets(assets, installerAsset) {
  if (!installerAsset || !installerAsset.name) return "";
  const installerName = installerAsset.name;
  const checksumAsset = assets.find(
    (item) =>
      /\.sha256$/i.test(item.name || "") ||
      /sha256sums\.txt$/i.test(item.name || "")
  );
  if (!checksumAsset?.browser_download_url) return "";

  try {
    const checksumText = await fetchText(checksumAsset.browser_download_url, GITHUB_HEADERS);
    const lines = checksumText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      const hashFirst = line.match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/);
      if (hashFirst && path.basename(hashFirst[2].trim()) === installerName) {
        return hashFirst[1].toLowerCase();
      }

      const nameFirst = line.match(/^(.+?)\s*:\s*([a-fA-F0-9]{64})$/);
      if (nameFirst && path.basename(nameFirst[1].trim()) === installerName) {
        return nameFirst[2].toLowerCase();
      }
    }
  } catch {
    return "";
  }

  return "";
}

async function fetchRemoteManifest(manifestUrl) {
  return fetchJson(manifestUrl);
}

async function fetchLatestGitHubRelease(githubRepo, currentVersion) {
  const releaseUrl = `${GITHUB_API_ROOT}/repos/${githubRepo}/releases/latest`;
  const release = await fetchJson(releaseUrl, GITHUB_HEADERS);
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const installerAsset = selectInstallerAsset(assets);
  if (!installerAsset?.browser_download_url) {
    throw new Error("No .exe installer found in latest GitHub release.");
  }

  const latestVersion = normalizeReleaseVersion(
    release.tag_name || release.name,
    currentVersion
  );
  const sha256 = await resolveSha256FromReleaseAssets(assets, installerAsset);

  return {
    source: "github",
    githubRepo,
    latestVersion,
    downloadUrl: installerAsset.browser_download_url,
    releaseNotes: extractReleaseNotes(release.body),
    sha256
  };
}

async function checkForUpdates(electronApp) {
  const local = readLocalConfig(electronApp);
  const currentVersion = local.version || FALLBACK_VERSION;
  const updateUrl = process.env.BIR_HESAB_UPDATE_URL || local.updateUrl || "";
  const githubRepo = process.env.BIR_HESAB_GITHUB_REPO || local.githubRepo || "";

  if (!updateUrl && !githubRepo) {
    return {
      hasUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
      message: "No updater source configured (updateUrl/githubRepo)."
    };
  }

  let remote;
  if (githubRepo) {
    remote = await fetchLatestGitHubRelease(githubRepo, currentVersion);
  } else {
    const manifest = await fetchRemoteManifest(updateUrl);
    remote = {
      source: "manifest",
      updateUrl,
      latestVersion: manifest.version || currentVersion,
      downloadUrl: manifest.downloadUrl || "",
      releaseNotes: Array.isArray(manifest.releaseNotes) ? manifest.releaseNotes : [],
      sha256: manifest.sha256 || ""
    };
  }

  const latestVersion = remote.latestVersion || currentVersion;
  const hasUpdate = compareVersions(currentVersion, latestVersion) < 0;

  return {
    hasUpdate,
    currentVersion,
    latestVersion,
    downloadUrl: remote.downloadUrl,
    releaseNotes: remote.releaseNotes,
    sha256: remote.sha256,
    source: remote.source,
    updateUrl: remote.updateUrl || "",
    githubRepo: remote.githubRepo || ""
  };
}

function sendToRenderer(getMainWindow, channel, payload) {
  getMainWindow()?.webContents.send(channel, payload);
}

function resolveTargetInstallerPath(electronApp, latestVersion, downloadUrl) {
  const targetDir = path.join(electronApp.getPath("userData"), "updates");
  fs.mkdirSync(targetDir, { recursive: true });
  let extension = ".exe";
  try {
    const urlObj = new URL(downloadUrl);
    const ext = path.extname(urlObj.pathname);
    if (ext) extension = ext;
  } catch {
    extension = path.extname(downloadUrl || "") || ".exe";
  }
  return path.join(targetDir, `Bir-Hesab-Setup-${latestVersion}${extension}`);
}

async function downloadFile(downloadUrl, targetFilePath, onProgress) {
  const response = await fetch(downloadUrl, { cache: "no-store" });
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download update (${response.status})`);
  }

  const totalBytes = Number(response.headers.get("content-length") || 0);
  let downloadedBytes = 0;

  const tracker = new Transform({
    transform(chunk, _, callback) {
      downloadedBytes += chunk.length;
      onProgress(downloadedBytes, totalBytes);
      callback(null, chunk);
    }
  });

  await pipeline(
    Readable.fromWeb(response.body),
    tracker,
    fs.createWriteStream(targetFilePath)
  );
}

async function hashFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

async function downloadLatestUpdate(electronApp, getMainWindow) {
  if (activeDownloadPromise) return activeDownloadPromise;

  activeDownloadPromise = (async () => {
    const update = await checkForUpdates(electronApp);
    if (!update.hasUpdate) {
      throw new Error("No update available.");
    }
    if (!update.downloadUrl) {
      throw new Error("Update available but no download URL was provided.");
    }

    const targetFilePath = resolveTargetInstallerPath(
      electronApp,
      update.latestVersion,
      update.downloadUrl
    );

    sendToRenderer(getMainWindow, "update:download-progress", {
      version: update.latestVersion,
      percent: 0
    });

    await downloadFile(update.downloadUrl, targetFilePath, (downloadedBytes, totalBytes) => {
      const percent = totalBytes
        ? Math.max(0, Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)))
        : null;
      sendToRenderer(getMainWindow, "update:download-progress", {
        version: update.latestVersion,
        downloadedBytes,
        totalBytes,
        percent
      });
    });

    if (update.sha256) {
      const checksum = await hashFileSha256(targetFilePath);
      if (checksum.toLowerCase() !== String(update.sha256).toLowerCase()) {
        fs.unlinkSync(targetFilePath);
        throw new Error("Downloaded update checksum mismatch.");
      }
    }

    downloadedUpdate = {
      version: update.latestVersion,
      filePath: targetFilePath
    };

    const payload = {
      ...update,
      filePath: targetFilePath
    };
    sendToRenderer(getMainWindow, "update:downloaded", payload);
    return payload;
  })();

  try {
    return await activeDownloadPromise;
  } finally {
    activeDownloadPromise = null;
  }
}

async function installDownloadedUpdate(electronApp, getMainWindow) {
  if (!downloadedUpdate || !downloadedUpdate.filePath || !fs.existsSync(downloadedUpdate.filePath)) {
    throw new Error("No downloaded update found.");
  }

  sendToRenderer(getMainWindow, "update:installing", {
    version: downloadedUpdate.version
  });

  const installerPath = downloadedUpdate.filePath;
  const child = spawn(installerPath, [], {
    detached: true,
    stdio: "ignore"
  });
  child.unref();

  setTimeout(() => {
    electronApp.quit();
  }, 400);

  return {
    started: true,
    version: downloadedUpdate.version,
    filePath: installerPath
  };
}

function registerUpdaterHandlers(ipcMain, getMainWindow, electronApp) {
  ipcMain.handle("updater:check", async () => {
    try {
      const result = await checkForUpdates(electronApp);
      if (result.hasUpdate) {
        sendToRenderer(getMainWindow, "update:available", result);
      } else {
        sendToRenderer(getMainWindow, "update:none", result);
      }
      return result;
    } catch (error) {
      const payload = { message: error.message };
      sendToRenderer(getMainWindow, "update:error", payload);
      throw error;
    }
  });

  ipcMain.handle("updater:download", async () => {
    try {
      return await downloadLatestUpdate(electronApp, getMainWindow);
    } catch (error) {
      const payload = { message: error.message };
      sendToRenderer(getMainWindow, "update:error", payload);
      throw error;
    }
  });

  ipcMain.handle("updater:install", async () => {
    try {
      return await installDownloadedUpdate(electronApp, getMainWindow);
    } catch (error) {
      const payload = { message: error.message };
      sendToRenderer(getMainWindow, "update:error", payload);
      throw error;
    }
  });
}

module.exports = {
  registerUpdaterHandlers
};
