CREATE TABLE IF NOT EXISTS colloquium_rooms (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 semester_id uuid NOT NULL REFERENCES semesters(id) ON DELETE RESTRICT,
 week_number integer NOT NULL DEFAULT 7 CHECK (week_number = 7),
 group_name text NOT NULL CHECK (group_name IN ('G1','G2')),
 bank_version text NOT NULL DEFAULT 'mobile-01-v1' CHECK (bank_version='mobile-01-v1'),
 token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash)=32),
 created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 started_at timestamptz,
 deadline timestamptz,
 CHECK ((started_at IS NULL AND deadline IS NULL) OR (started_at IS NOT NULL AND deadline=started_at+interval '600 seconds')),
 UNIQUE(semester_id,week_number,group_name)
);
CREATE TABLE IF NOT EXISTS colloquium_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 room_id uuid NOT NULL REFERENCES colloquium_rooms(id) ON DELETE RESTRICT,
 semester_id uuid NOT NULL REFERENCES semesters(id) ON DELETE RESTRICT,
 week_number integer NOT NULL DEFAULT 7 CHECK (week_number=7),
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 roster_id uuid NOT NULL REFERENCES roster(id) ON DELETE RESTRICT,
 question_order jsonb NOT NULL,
 answers jsonb NOT NULL DEFAULT '{}'::jsonb,
 revisions jsonb NOT NULL DEFAULT '{}'::jsonb,
 revision integer NOT NULL DEFAULT 0,
 joined_at timestamptz NOT NULL DEFAULT now(),
 submitted_at timestamptz,
 score integer CHECK (score BETWEEN 0 AND 10),
 UNIQUE(semester_id,week_number,user_id),
 UNIQUE(semester_id,week_number,roster_id)
);
CREATE INDEX IF NOT EXISTS colloquium_attempts_room_idx ON colloquium_attempts(room_id);
