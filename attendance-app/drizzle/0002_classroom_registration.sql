-- Retain existing GitHub IDs, digit check, unique index and all historical rows.
ALTER TABLE users ALTER COLUMN github_id DROP NOT NULL;
ALTER TABLE users ALTER COLUMN github_username DROP NOT NULL;
CREATE TABLE IF NOT EXISTS classroom_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  roster_id uuid NOT NULL REFERENCES roster(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL REFERENCES class_sessions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classroom_registrations_roster_session_unique UNIQUE (roster_id, session_id)
);
