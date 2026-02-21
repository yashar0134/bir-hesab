ALTER TABLE reminders ADD COLUMN repeat_type TEXT NOT NULL DEFAULT 'none';
ALTER TABLE reminders ADD COLUMN repeat_until TEXT NOT NULL DEFAULT '';
ALTER TABLE reminders ADD COLUMN project_id INTEGER;
ALTER TABLE reminders ADD COLUMN partner_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_reminders_repeat_type
ON reminders(repeat_type);

CREATE INDEX IF NOT EXISTS idx_reminders_project_id
ON reminders(project_id);

CREATE INDEX IF NOT EXISTS idx_reminders_partner_id
ON reminders(partner_id);
