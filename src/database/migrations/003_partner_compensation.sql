ALTER TABLE partners ADD COLUMN payment_model TEXT NOT NULL DEFAULT 'percent';
ALTER TABLE partners ADD COLUMN salary_period TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE partners ADD COLUMN salary_amount REAL NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS partner_project_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  payment_model TEXT NOT NULL CHECK (payment_model IN ('percent', 'salary_weekly', 'salary_monthly')),
  percent_value REAL NOT NULL DEFAULT 0,
  salary_amount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(partner_id, project_id),
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
