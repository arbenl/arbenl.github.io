CREATE TABLE IF NOT EXISTS student_submission_accounts(
 roster_id uuid NOT NULL REFERENCES roster(id) ON DELETE RESTRICT,
 semester_id uuid NOT NULL REFERENCES semesters(id) ON DELETE RESTRICT,
 github_id text NOT NULL,github_login text NOT NULL,source_issue integer NOT NULL,
 approved_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,reason text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(roster_id,github_id),UNIQUE(semester_id,github_id)
);
