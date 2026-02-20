const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, "migrations");
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }
  return fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

function runMigrations(db) {
  db.prepare(
    `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL
      )
    `
  ).run();

  const inserted = db.prepare(
    "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)"
  );
  const alreadyApplied = db.prepare(
    "SELECT 1 FROM schema_migrations WHERE name = ? LIMIT 1"
  );

  const migrationFiles = getMigrationFiles();
  for (const fileName of migrationFiles) {
    const exists = alreadyApplied.get(fileName);
    if (exists) {
      continue;
    }
    const sql = fs.readFileSync(path.join(__dirname, "migrations", fileName), "utf8");
    const applyNow = db.transaction(() => {
      // Execute statement-by-statement so legacy schema overlaps do not crash startup.
      const statements = sql
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean);

      for (const statement of statements) {
        try {
          db.prepare(statement).run();
        } catch (error) {
          const msg = String(error?.message || "");
          const ignorable =
            /duplicate column name/i.test(msg) ||
            /already exists/i.test(msg);
          if (!ignorable) {
            throw error;
          }
        }
      }

      inserted.run(fileName, new Date().toISOString());
    });
    applyNow();
  }
}

function initializeDatabase(electronApp) {
  const dataDir = electronApp.getPath("userData");
  const dbPath = path.join(dataDir, "bir-hesab.db");
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  runMigrations(db);

  return db;
}

module.exports = {
  initializeDatabase
};
