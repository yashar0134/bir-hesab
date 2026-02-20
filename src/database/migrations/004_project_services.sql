CREATE TABLE IF NOT EXISTS project_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  service_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(project_id, service_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO project_services (project_id, service_id, created_at)
SELECT id, service_id, COALESCE(created_at, datetime('now'))
FROM projects
WHERE service_id IS NOT NULL;
