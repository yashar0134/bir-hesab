ALTER TABLE reminders ADD COLUMN reminder_time TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE reminders ADD COLUMN snooze_until TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_reminders_snooze_until
ON reminders(snooze_until);
