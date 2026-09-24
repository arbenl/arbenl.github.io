ALTER TABLE roster ADD COLUMN IF NOT EXISTS email text;
CREATE UNIQUE INDEX IF NOT EXISTS roster_semester_email_unique ON roster (semester_id, lower(email)) WHERE email IS NOT NULL;
