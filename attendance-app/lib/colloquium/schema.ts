import { sql } from "drizzle-orm";
import { ensureClassroomRegistrationSchema } from "../attendance/classroom-registration";
type Executor = Pick<(typeof import("../db/client"))["db"], "execute">;
// Only authenticated instructor setup may call this migration.
export async function ensureColloquiumSchema(db: Executor) {
  const rows = await db.execute(sql`select to_regclass('public.colloquium_attempts') is not null as ready`);
  if (rows[0]?.ready === true)
    return;
  // Serialize concurrent first-time instructor setup, then recheck after waiting.
  await db.execute(sql`select pg_advisory_xact_lock(hashtextextended('colloquium-schema-v1',0))`);
  const current = await db.execute(sql`select to_regclass('public.colloquium_attempts') is not null as ready`);
  if (current[0]?.ready === true)
    return;
  await ensureClassroomRegistrationSchema(db);
  await db.execute(sql.raw("CREATE TABLE IF NOT EXISTS colloquium_rooms (\n id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n semester_id uuid NOT NULL REFERENCES semesters(id) ON DELETE RESTRICT,\n week_number integer NOT NULL DEFAULT 7 CHECK (week_number = 7),\n group_name text NOT NULL CHECK (group_name IN ('G1','G2')),\n bank_version text NOT NULL DEFAULT 'mobile-01-v1' CHECK (bank_version='mobile-01-v1'),\n token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash)=32),\n created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,\n created_at timestamptz NOT NULL DEFAULT now(),\n started_at timestamptz,\n deadline timestamptz,\n CHECK ((started_at IS NULL AND deadline IS NULL) OR (started_at IS NOT NULL AND deadline=started_at+interval '600 seconds')),\n UNIQUE(semester_id,week_number,group_name)\n);\nCREATE TABLE IF NOT EXISTS colloquium_attempts (\n id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n room_id uuid NOT NULL REFERENCES colloquium_rooms(id) ON DELETE RESTRICT,\n semester_id uuid NOT NULL REFERENCES semesters(id) ON DELETE RESTRICT,\n week_number integer NOT NULL DEFAULT 7 CHECK (week_number=7),\n user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,\n roster_id uuid NOT NULL REFERENCES roster(id) ON DELETE RESTRICT,\n question_order jsonb NOT NULL,\n answers jsonb NOT NULL DEFAULT '{}'::jsonb,\n revisions jsonb NOT NULL DEFAULT '{}'::jsonb,\n revision integer NOT NULL DEFAULT 0,\n joined_at timestamptz NOT NULL DEFAULT now(),\n submitted_at timestamptz,\n score integer CHECK (score BETWEEN 0 AND 10),\n UNIQUE(semester_id,week_number,user_id),\n UNIQUE(semester_id,week_number,roster_id)\n);\nCREATE INDEX IF NOT EXISTS colloquium_attempts_room_idx ON colloquium_attempts(room_id);\n"));
}
