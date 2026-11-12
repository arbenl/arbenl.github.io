CREATE TABLE IF NOT EXISTS student_access_keys (
 roster_id uuid PRIMARY KEY REFERENCES roster(id) ON DELETE RESTRICT,
 key_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
