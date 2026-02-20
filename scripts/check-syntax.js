"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const sourceDirs = ["src", "scripts", "updater"]
  .map((dir) => path.join(projectRoot, dir))
  .filter((dir) => fs.existsSync(dir));

const ignoredDirs = new Set(["node_modules", ".git", "dist"]);
const jsFiles = [];

function walk(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        walk(fullPath);
      }
      continue;
    }

    if (entry.isFile() && path.extname(entry.name) === ".js") {
      jsFiles.push(fullPath);
    }
  }
}

for (const dir of sourceDirs) {
  walk(dir);
}

jsFiles.sort();

let failed = false;
for (const filePath of jsFiles) {
  const result = spawnSync(process.execPath, ["--check", filePath], {
    encoding: "utf8"
  });
  if (result.status !== 0) {
    failed = true;
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    process.stderr.write(
      `[check:syntax] Failed: ${path.relative(projectRoot, filePath)}\n`
    );
  }
}

if (failed) {
  process.exit(1);
}

process.stdout.write(`[check:syntax] Checked ${jsFiles.length} file(s).\n`);
