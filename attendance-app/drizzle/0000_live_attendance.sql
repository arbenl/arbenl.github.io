CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "github_id" text NOT NULL,
  "github_username" text NOT NULL,
  "name" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "users_github_id_unique" UNIQUE ("github_id"),
  CONSTRAINT "users_github_id_digits_check" CHECK ("github_id" ~ '^[0-9]+$')
);

CREATE TABLE "staff" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "role" text DEFAULT 'professor' NOT NULL,
  "added_by" uuid,
  "added_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "staff_role_check" CHECK ("role" IN ('professor', 'administrator')),
  CONSTRAINT "staff_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "staff_added_by_users_id_fk"
    FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX "staff_added_by_idx" ON "staff" ("added_by");

CREATE TABLE "bootstrap_state" (
  "singleton" boolean PRIMARY KEY DEFAULT TRUE NOT NULL,
  "completed_by" uuid NOT NULL,
  "completed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "bootstrap_state_singleton_check" CHECK ("singleton"),
  CONSTRAINT "bootstrap_state_completed_by_users_id_fk"
    FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX "bootstrap_state_completed_by_idx"
  ON "bootstrap_state" ("completed_by");

CREATE TABLE "semesters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "week_count" integer NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "semesters_week_count_check" CHECK ("week_count" > 0),
  CONSTRAINT "semesters_status_check" CHECK ("status" IN ('draft', 'active', 'archived'))
);

CREATE TABLE "roster" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "semester_id" uuid NOT NULL,
  "student_id" text NOT NULL,
  "full_name" text NOT NULL,
  "group_name" text NOT NULL,
  "user_id" uuid,
  "activated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "roster_semester_id_semesters_id_fk"
    FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE RESTRICT,
  CONSTRAINT "roster_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "roster_activation_check" CHECK (
    ("user_id" IS NULL AND "activated_at" IS NULL)
    OR ("user_id" IS NOT NULL AND "activated_at" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "roster_semester_student_id_unique"
  ON "roster" ("semester_id", "student_id");
CREATE UNIQUE INDEX "roster_semester_user_id_unique"
  ON "roster" ("semester_id", "user_id")
  WHERE "user_id" IS NOT NULL;
CREATE INDEX "roster_user_id_idx" ON "roster" ("user_id");

CREATE TABLE "class_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "semester_id" uuid NOT NULL,
  "week_number" integer NOT NULL,
  "kind" text NOT NULL,
  "group_name" text NOT NULL,
  "title" text NOT NULL,
  "state" text DEFAULT 'draft' NOT NULL,
  "checkin_ends_at" timestamp with time zone,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "class_sessions_week_number_check" CHECK ("week_number" > 0),
  CONSTRAINT "class_sessions_kind_check" CHECK ("kind" IN ('lecture', 'lab')),
  CONSTRAINT "class_sessions_state_check"
    CHECK ("state" IN ('draft', 'open', 'closed', 'cancelled')),
  CONSTRAINT "class_sessions_semester_id_semesters_id_fk"
    FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE RESTRICT,
  CONSTRAINT "class_sessions_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX "class_sessions_semester_id_idx"
  ON "class_sessions" ("semester_id");
CREATE INDEX "class_sessions_created_by_idx"
  ON "class_sessions" ("created_by");
CREATE INDEX "class_sessions_live_reads_idx"
  ON "class_sessions" ("state", "checkin_ends_at")
  WHERE "state" = 'open';

CREATE TABLE "qr_challenges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "token_hash" bytea NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "qr_challenges_token_hash_unique" UNIQUE ("token_hash"),
  CONSTRAINT "qr_challenges_token_hash_length_check"
    CHECK (octet_length("token_hash") = 32),
  CONSTRAINT "qr_challenges_session_id_class_sessions_id_fk"
    FOREIGN KEY ("session_id") REFERENCES "class_sessions"("id") ON DELETE CASCADE
);

CREATE INDEX "qr_challenges_session_id_idx"
  ON "qr_challenges" ("session_id");
CREATE INDEX "qr_challenges_expiry_idx"
  ON "qr_challenges" ("expires_at");

CREATE TABLE "attendance_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "roster_id" uuid NOT NULL,
  "status" text DEFAULT 'present' NOT NULL,
  "scanned_at" timestamp with time zone,
  "verified_at" timestamp with time zone,
  "verified_by" uuid,
  "correction_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "attendance_records_status_check"
    CHECK ("status" IN ('present', 'rejected', 'excused')),
  CONSTRAINT "attendance_records_recorded_at_check"
    CHECK ("scanned_at" IS NOT NULL OR "verified_at" IS NOT NULL),
  CONSTRAINT "attendance_records_verification_check" CHECK (
    ("verified_at" IS NULL AND "verified_by" IS NULL AND "correction_reason" IS NULL)
    OR ("verified_at" IS NOT NULL AND "verified_by" IS NOT NULL AND "correction_reason" IS NOT NULL)
  ),
  CONSTRAINT "attendance_records_session_id_class_sessions_id_fk"
    FOREIGN KEY ("session_id") REFERENCES "class_sessions"("id") ON DELETE RESTRICT,
  CONSTRAINT "attendance_records_roster_id_roster_id_fk"
    FOREIGN KEY ("roster_id") REFERENCES "roster"("id") ON DELETE RESTRICT,
  CONSTRAINT "attendance_records_verified_by_users_id_fk"
    FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "attendance_records_session_roster_unique"
  ON "attendance_records" ("session_id", "roster_id");
CREATE INDEX "attendance_records_roster_id_idx"
  ON "attendance_records" ("roster_id");
CREATE INDEX "attendance_records_verified_by_idx"
  ON "attendance_records" ("verified_by");
CREATE INDEX "attendance_records_live_order_idx"
  ON "attendance_records" (
    "session_id",
    COALESCE("scanned_at", "verified_at"),
    "roster_id"
  )
  WHERE "status" = 'present';

CREATE TABLE "request_limits" (
  "action" text NOT NULL,
  "key_hash" bytea NOT NULL,
  "window_start" timestamp with time zone NOT NULL,
  "count" integer DEFAULT 1 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "request_limits_pkey" PRIMARY KEY ("action", "key_hash", "window_start"),
  CONSTRAINT "request_limits_key_hash_length_check"
    CHECK (octet_length("key_hash") = 32),
  CONSTRAINT "request_limits_count_check" CHECK ("count" > 0)
);

CREATE INDEX "request_limits_window_start_idx"
  ON "request_limits" ("window_start");

CREATE TABLE "audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_user_id" uuid NOT NULL,
  "action" text NOT NULL,
  "subject_type" text NOT NULL,
  "subject_id" uuid NOT NULL,
  "reason" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "audit_log_actor_user_id_users_id_fk"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX "audit_log_actor_user_id_idx"
  ON "audit_log" ("actor_user_id");
CREATE INDEX "audit_log_subject_idx"
  ON "audit_log" ("subject_type", "subject_id", "created_at");
