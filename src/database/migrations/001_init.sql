CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  pricing_model TEXT NOT NULL CHECK (pricing_model IN ('hourly', 'daily', 'weekly', 'monthly', 'project', 'per-minute')),
  rate REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'TOMAN',
  description TEXT DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  client_name TEXT NOT NULL,
  service_id INTEGER,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'done', 'cancelled')),
  start_date TEXT NOT NULL,
  end_date TEXT DEFAULT '',
  budget REAL NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS project_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  service_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(project_id, service_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  share_percent REAL NOT NULL DEFAULT 0,
  payment_model TEXT NOT NULL DEFAULT 'percent',
  salary_period TEXT NOT NULL DEFAULT 'monthly',
  salary_amount REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  settlement_type TEXT NOT NULL CHECK (settlement_type IN ('partner', 'client', 'personal')),
  related_id INTEGER,
  project_id INTEGER,
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  description TEXT NOT NULL DEFAULT '',
  settlement_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL CHECK (scope IN ('business', 'personal', 'shared')),
  paid_by TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  expense_date TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cashbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('in', 'out')),
  amount REAL NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  reference_type TEXT NOT NULL DEFAULT '',
  reference_id INTEGER,
  entry_date TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS personal_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_name TEXT NOT NULL CHECK (user_name IN ('Yashar', 'Farnaz')),
  txn_type TEXT NOT NULL CHECK (txn_type IN ('income', 'expense', 'transfer')),
  amount REAL NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  txn_date TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shared_budget (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_key TEXT NOT NULL UNIQUE,
  total_budget REAL NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

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
