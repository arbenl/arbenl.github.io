import { createHmac } from "node:crypto";

import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import type { Session } from "next-auth";

import { requireSessionIdentity } from "../auth/session";
import {
  attendanceRecords,
  auditLog,
  classSessions,
  qrChallenges,
  requestLimits,
  roster,
  semesters,
  staff,
  users,
} from "../db/schema";
import { getEnv } from "../env";
import { createChallengeToken, hashChallengeToken } from "./challenge";
import { issueRegistrationPermit, readRegistrationPermit } from "./registration";
import { CURRENT_COURSE, CURRENT_COURSE_SESSIONS, sessionIncludesGroup } from "./current-course";
import {
  normalizeAlbanianName,
  normalizeStudentId,
} from "./normalize";

type Database = (typeof import("../db/client"))["db"];
type Executor = Pick<
  Database,
  "delete" | "execute" | "insert" | "select" | "update"
>;

type SemesterState = "draft" | "active" | "archived";
type SessionState = "draft" | "open" | "closed" | "cancelled";
type AttendanceStatus = "present" | "rejected" | "excused";

interface Actor {
  userId: string;
  githubId: string;
  githubLogin: string;
}

interface StaffActor extends Actor {
  role: "professor" | "administrator";
}

interface RateLimitResult extends Record<string, unknown> {
  count: number;
  retryAfter: number;
}

const RATE_LIMITS = {
  activation: { limit: 5, windowSeconds: 600 },
  scan: { limit: 10, windowSeconds: 60 },
  challenge: { limit: 10, windowSeconds: 60 },
  live: { limit: 90, windowSeconds: 60 },
} as const;

export class AttendanceServiceError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 429,
    readonly code: string,
    message: string,
    readonly retryAfter?: number,
    readonly registrationPermit?: string,
  ) {
    super(message);
    this.name = "AttendanceServiceError";
  }
}

async function database(): Promise<Database> {
  return (await import("../db/client")).db;
}

function identityFromSession(session: Session | null) {
  try {
    return requireSessionIdentity(session);
  } catch {
    throw new AttendanceServiceError(
      401,
      "authentication_required",
      "Authentication required",
    );
  }
}

async function requireActor(
  executor: Executor,
  session: Session | null,
): Promise<Actor> {
  const identity = identityFromSession(session);
  const [actor] = await executor
    .select({ userId: users.id })
    .from(users)
    .where(eq(users.githubId, identity.githubId))
    .limit(1);

  if (!actor) {
    throw new AttendanceServiceError(
      401,
      "authentication_required",
      "Authentication required",
    );
  }

  return { ...identity, userId: actor.userId };
}

async function requireStaffActor(
  executor: Executor,
  session: Session | null,
): Promise<StaffActor> {
  const identity = identityFromSession(session);
  if (identity.githubId !== getEnv().PROFESSOR_GITHUB_ID) {
    throw new AttendanceServiceError(403, "staff_required", "Staff access required");
  }
  const [actor] = await executor
    .select({
      userId: users.id,
      role: staff.role,
    })
    .from(users)
    .innerJoin(staff, eq(staff.userId, users.id))
    .where(eq(users.githubId, identity.githubId))
    .limit(1);

  if (
    !actor ||
    (actor.role !== "professor" && actor.role !== "administrator")
  ) {
    throw new AttendanceServiceError(
      403,
      "staff_required",
      "Staff access required",
    );
  }

  return {
    ...identity,
    userId: actor.userId,
    role: actor.role,
  };
}

async function cleanExpiredRateLimits(executor: Executor): Promise<void> {
  await executor.delete(requestLimits).where(
    sql`${requestLimits.windowStart} < statement_timestamp() - interval '24 hours'`,
  );
}

async function audit(
  executor: Executor,
  actorUserId: string,
  action: string,
  subjectType: string,
  subjectId: string,
  reason: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await executor.insert(auditLog).values({
    actorUserId,
    action,
    subjectType,
    subjectId,
    reason,
    metadata,
  });
}

async function finalizeExpiredClassSessions(
  executor: Executor,
  sessionId?: string,
): Promise<void> {
  const sessionFilter = sessionId
    ? sql`and cs.id = ${sessionId}`
    : sql``;

  await executor.execute(sql`
    with expired as (
      update class_sessions as cs
      set
        state = 'closed',
        updated_at = statement_timestamp()
      where cs.state = 'open'
        and cs.checkin_ends_at is not null
        and cs.checkin_ends_at <= statement_timestamp()
        ${sessionFilter}
      returning
        cs.id,
        cs.created_by,
        cs.checkin_ends_at
    )
    insert into audit_log (
      actor_user_id,
      action,
      subject_type,
      subject_id,
      reason,
      metadata
    )
    select
      expired.created_by,
      'class_session.state',
      'class_session',
      expired.id,
      'Automatic closure at the server check-in deadline',
      jsonb_build_object(
        'actorKind', 'system',
        'actorAttribution', 'session_creator',
        'policy', 'checkin_deadline',
        'from', 'open',
        'to', 'closed',
        'checkinEndsAt', expired.checkin_ends_at
      )
    from expired
  `);
}

function rateLimitKey(secret: string, value: string): Buffer {
  return createHmac("sha256", secret).update(value).digest();
}

async function consumeRateLimit(
  action: keyof typeof RATE_LIMITS,
  githubId: string,
  ipAddress: string,
  sessionId?: string,
): Promise<void> {
  const { limit, windowSeconds } = RATE_LIMITS[action];
  const secret = getEnv().RATE_LIMIT_SECRET;
  const keyMaterial = sessionId
    ? `${githubId}|${ipAddress}|${sessionId}`
    : `${githubId}|${ipAddress}`;
  const keyHash = rateLimitKey(secret, keyMaterial).toString("hex");
  const db = await database();
  const result = await db.execute<RateLimitResult>(sql`
    insert into request_limits (
      action,
      key_hash,
      window_start,
      count,
      updated_at
    ) values (
      ${action},
      decode(${keyHash}, 'hex'),
      to_timestamp(
        floor(extract(epoch from statement_timestamp()) / ${windowSeconds})
        * ${windowSeconds}
      ),
      1,
      statement_timestamp()
    )
    on conflict (action, key_hash, window_start)
    do update set
      count = request_limits.count + 1,
      updated_at = statement_timestamp()
    returning
      count,
      greatest(
        1,
        ceil(extract(epoch from (
          window_start + make_interval(secs => ${windowSeconds})
          - statement_timestamp()
        )))::integer
      ) as retry_after
  `);
  const row = result[0] as unknown as {
    count: number;
    retry_after: number;
  };
  const rate = {
    count: Number(row.count),
    retryAfter: Number(row.retry_after),
  };

  if (rate.count > limit) {
    throw new AttendanceServiceError(
      429,
      "rate_limited",
      "Too many requests",
      rate.retryAfter,
    );
  }
}

function databaseErrorCode(error: unknown): string | undefined {
  let current: unknown = error;

  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    const candidate = current as Error & {
      code?: string;
      cause?: unknown;
    };
    if (candidate.code) {
      return candidate.code;
    }
    current = candidate.cause;
  }

  return undefined;
}

function genericRosterMismatch(): AttendanceServiceError {
  return new AttendanceServiceError(
    409,
    "roster_mismatch",
    "The supplied details do not match an available roster entry",
  );
}

function toIso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function dateMilliseconds(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/u.test(text)) {
    text = `'${text}`;
  }
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",");
}

async function createSemester(
  session: Session | null,
  input: { title: string; weekCount: number },
) {
  const db = await database();
  return db.transaction(async (transaction) => {
    const actor = await requireStaffActor(transaction, session);
    await cleanExpiredRateLimits(transaction);
    const [semester] = await transaction
      .insert(semesters)
      .values({ title: input.title, weekCount: input.weekCount })
      .returning();
    await audit(
      transaction,
      actor.userId,
      "semester.create",
      "semester",
      semester.id,
      "Semester created",
      { weekCount: input.weekCount },
    );
    return semester;
  });
}

async function listSemesters(session: Session | null) {
  const identity = identityFromSession(session);
  const db = await database();
  const [membership] = await db
    .select({ role: staff.role })
    .from(users)
    .innerJoin(staff, eq(staff.userId, users.id))
    .where(eq(users.githubId, identity.githubId))
    .limit(1);

  const query = db
    .select({
      id: semesters.id,
      title: semesters.title,
      weekCount: semesters.weekCount,
      status: semesters.status,
    })
    .from(semesters)
    .orderBy(asc(semesters.createdAt), asc(semesters.id));

  return membership ? query : query.where(eq(semesters.status, "active"));
}

async function ensureCurrentCourseSetup(session: Session | null) {
  const db = await database();
  return db.transaction(async (transaction) => {
    const actor = await requireStaffActor(transaction, session);
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended('aab-current-course-setup', 0))`,
    );
    // Additive release migration, staff-only and serialized with course setup.
    const column = await transaction.execute(sql`select 1 from information_schema.columns where table_schema = current_schema() and table_name = 'roster' and column_name = 'email'`);
    if (!column.length) await transaction.execute(sql`alter table roster add column email text`);
    const emailIndex = await transaction.execute(sql`select to_regclass('roster_semester_email_unique') as id`);
    if (!emailIndex[0]?.id) await transaction.execute(sql`create unique index roster_semester_email_unique on roster (semester_id, lower(email)) where email is not null`);


    const pilotSemesterIds: string[] = []; // Cleanup is not part of routine setup.

    let [semester] = await transaction
      .select()
      .from(semesters)
      .where(eq(semesters.title, CURRENT_COURSE.title))
      .limit(1);

    if (!semester) {
      [semester] = await transaction
        .insert(semesters)
        .values({
          title: CURRENT_COURSE.title,
          weekCount: CURRENT_COURSE.weekCount,
          status: "active",
        })
        .returning();
    } else if (semester.status === "draft") {
      [semester] = await transaction
        .update(semesters)
        .set({ status: "active", updatedAt: sql`statement_timestamp()` })
        .where(eq(semesters.id, semester.id))
        .returning();
    }

    const existing = await transaction
      .select({
        id: classSessions.id,
        state: classSessions.state,
        title: classSessions.title,
        weekNumber: classSessions.weekNumber,
        kind: classSessions.kind,
        groupName: classSessions.groupName,
      })
      .from(classSessions)
      .where(eq(classSessions.semesterId, semester.id));
    let updatedSessions = 0;
    if (semester.status === "active") {
      for (const item of existing) {
        const target = CURRENT_COURSE_SESSIONS.find((planned) =>
          planned.weekNumber === item.weekNumber && planned.kind === item.kind &&
          (planned.groupName === item.groupName || (item.kind === "lecture" && item.groupName === "G1")));
        if (!target || item.state !== "draft" ||
            (item.title === target.title && item.groupName === target.groupName)) continue;
        const updated = await transaction.update(classSessions)
          .set({ title: target.title, groupName: target.groupName, updatedAt: sql`statement_timestamp()` })
          .where(and(eq(classSessions.id, item.id), eq(classSessions.state, "draft")))
          .returning({ id: classSessions.id });
        updatedSessions += updated.length;
      }
    }
    // Old completed G1 lectures are historical records, not missing shared lectures.
    const existingKeys = new Set(
      existing.map(({ weekNumber, kind, groupName }) =>
        `${weekNumber}:${kind}:${kind === "lecture" && groupName === "G1" ? CURRENT_COURSE.groupName : groupName}`),
    );
    const missing = semester.status === "archived"
      ? []
      : CURRENT_COURSE_SESSIONS.filter(
          ({ weekNumber, kind, groupName }) =>
            !existingKeys.has(`${weekNumber}:${kind}:${groupName}`),
        );

    if (missing.length) {
      await transaction.insert(classSessions).values(
        missing.map((item) => ({
          semesterId: semester.id,
          weekNumber: item.weekNumber,
          kind: item.kind,
          groupName: item.groupName,
          title: item.title,
          createdBy: actor.userId,
        })),
      );
    }

    if (missing.length || updatedSessions || pilotSemesterIds.length) {
      await audit(
        transaction,
        actor.userId,
        "course.schedule.reconcile",
        "semester",
        semester.id,
        "Automatic setup of the current teaching schedule",
        {
          createdSessions: missing.length,
          updatedSessions,
          removedPilotSemesters: pilotSemesterIds.length,
          groupName: CURRENT_COURSE.groupName,
        },
      );
    }

    return {
      semesterId: semester.id,
      createdSessions: missing.length,
      removedPilotSemesters: pilotSemesterIds.length,
    };
  });
}

async function getStudentHistory(session: Session | null) {
  const db = await database();
  const actor = await requireActor(db, session);
  await finalizeExpiredClassSessions(db);
  const rows = await db
    .select({
      id: classSessions.id,
      semesterTitle: semesters.title,
      title: classSessions.title,
      weekNumber: classSessions.weekNumber,
      kind: classSessions.kind,
      state: classSessions.state,
      status: attendanceRecords.status,
      scannedAt: attendanceRecords.scannedAt,
      verifiedAt: attendanceRecords.verifiedAt,
    })
    .from(roster)
    .innerJoin(semesters, eq(semesters.id, roster.semesterId))
    .innerJoin(
      classSessions,
      and(
        eq(classSessions.semesterId, roster.semesterId),
        or(eq(classSessions.groupName, roster.groupName), and(
          eq(classSessions.kind, "lecture"), eq(classSessions.groupName, CURRENT_COURSE.groupName),
          inArray(roster.groupName, ["G1", "G2"]))),
      ),
    )
    .leftJoin(
      attendanceRecords,
      and(
        eq(attendanceRecords.sessionId, classSessions.id),
        eq(attendanceRecords.rosterId, roster.id),
      ),
    )
    .where(
      and(
        eq(roster.userId, actor.userId),
        inArray(classSessions.state, ["open", "closed"]),
      ),
    )
    .orderBy(
      asc(semesters.createdAt),
      asc(classSessions.weekNumber),
      asc(sql`case when ${classSessions.kind} = 'lecture' then 0 else 1 end`),
      asc(classSessions.createdAt),
      asc(classSessions.id),
    );

  const sessions = rows.map((row) => ({
    id: row.id,
    semesterTitle: row.semesterTitle,
    title: row.title,
    weekNumber: row.weekNumber,
    kind: row.kind as "lecture" | "lab",
    status: (row.status ?? (row.state === "open" ? "pending" : "absent")) as AttendanceStatus | "absent" | "pending",
    recordedAt:
      row.scannedAt || row.verifiedAt
        ? toIso(row.scannedAt ?? row.verifiedAt ?? "")
        : null,
  }));
  const totals = {
    sessions: sessions.filter(item => item.status !== "pending").length,
    pending: 0,
    present: 0,
    excused: 0,
    rejected: 0,
    absent: 0,
  };
  for (const item of sessions) {
    totals[item.status] += 1;
  }

  const [profile] = await db.select({ fullName: roster.fullName, studentId: roster.studentId, email: roster.email, groupName: roster.groupName })
    .from(roster).innerJoin(semesters, eq(semesters.id, roster.semesterId))
    .where(and(eq(roster.userId, actor.userId), eq(semesters.title, CURRENT_COURSE.title), eq(semesters.status, "active"))).limit(1);
  return { sessions, totals, profile: profile ?? null };
}

async function transitionSemester(
  session: Session | null,
  semesterId: string,
  input: { state: Exclude<SemesterState, "draft"> | SemesterState; reason: string },
) {
  const db = await database();
  return db.transaction(async (transaction) => {
    const actor = await requireStaffActor(transaction, session);
    await cleanExpiredRateLimits(transaction);
    const [current] = await transaction
      .select()
      .from(semesters)
      .where(eq(semesters.id, semesterId))
      .limit(1)
      .for("update");

    if (!current) {
      throw new AttendanceServiceError(404, "semester_not_found", "Semester not found");
    }

    const allowed =
      (current.status === "draft" && input.state === "active") ||
      (current.status === "active" && input.state === "archived");
    if (!allowed) {
      throw new AttendanceServiceError(
        409,
        "invalid_semester_transition",
        "Invalid semester state transition",
      );
    }

    const [updated] = await transaction
      .update(semesters)
      .set({ status: input.state, updatedAt: sql`statement_timestamp()` })
      .where(eq(semesters.id, semesterId))
      .returning();
    await audit(
      transaction,
      actor.userId,
      "semester.state",
      "semester",
      semesterId,
      input.reason,
      { from: current.status, to: input.state },
    );
    return updated;
  });
}

async function importRoster(
  session: Session | null,
  input: {
    semesterId: string;
    rows: Array<{ studentId: string; fullName: string; groupName: string }>;
  },
) {
  const db = await database();
  return db.transaction(async (transaction) => {
    const actor = await requireStaffActor(transaction, session);
    await cleanExpiredRateLimits(transaction);
    const [semester] = await transaction
      .select({ status: semesters.status })
      .from(semesters)
      .where(eq(semesters.id, input.semesterId))
      .limit(1)
      .for("update");
    if (!semester) {
      throw new AttendanceServiceError(404, "semester_not_found", "Semester not found");
    }
    if (semester.status === "archived") {
      throw new AttendanceServiceError(409, "semester_archived", "Semester is archived");
    }

    const inserted = await transaction
      .insert(roster)
      .values(
        input.rows.map((row) => ({
          semesterId: input.semesterId,
          studentId: normalizeStudentId(row.studentId),
          fullName: row.fullName.trim().replace(/\s+/gu, " ").normalize("NFC"),
          groupName: row.groupName.trim(),
        })),
      )
      .returning();
    await audit(
      transaction,
      actor.userId,
      "roster.import",
      "semester",
      input.semesterId,
      "Roster imported",
      { count: inserted.length },
    );
    return inserted;
  });
}

async function activateRoster(
  session: Session | null,
  input: {
    semesterId: string;
    studentId: string;
    email?: string;
    groupName?: "G1" | "G2";
    token?: string;
    registrationPermit?: string;
    beforeClass?: boolean;
    firstName: string;
    lastName: string;
  },
  ipAddress: string,
) {
  const identity = identityFromSession(session);
  await consumeRateLimit("activation", identity.githubId, ipAddress);
  const suppliedName = normalizeAlbanianName(
    `${input.firstName} ${input.lastName}`,
  );
  const suppliedStudentId = normalizeStudentId(input.studentId);
  const db = await database();

  try {
    return await db.transaction(async (transaction) => {
      const actor = await requireActor(transaction, session);
      const [semester] = await transaction
        .select({ status: semesters.status })
        .from(semesters)
        .where(eq(semesters.id, input.semesterId))
        .limit(1);
      if (!semester || semester.status !== "active") {
        throw genericRosterMismatch();
      }

      // Preparing a profile is separate from attendance; attendance always requires a live QR.
      const email = input.email?.trim().toLowerCase();
      if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email))) {
        throw new AttendanceServiceError(400, "invalid_email", "Shkruaj një email të vlefshëm.");
      }
      const [entry] = await transaction
        .select()
        .from(roster)
        .where(
          and(
            eq(roster.semesterId, input.semesterId),
            eq(roster.studentId, suppliedStudentId),
          ),
        )
        .limit(1)
        .for("update");
      if (!entry) {
        if (!email || !input.groupName) throw genericRosterMismatch();
        const permit = input.registrationPermit ? readRegistrationPermit(input.registrationPermit, getEnv().NEXTAUTH_SECRET) : null;
        const beforeClass = input.beforeClass === true && (await transaction.select({id:semesters.id}).from(semesters).where(and(eq(semesters.id,input.semesterId),eq(semesters.title,CURRENT_COURSE.title),eq(semesters.status,"active"))).limit(1)).length === 1;
        const allowed = beforeClass || permit && permit.githubId === actor.githubId && permit.semesterId === input.semesterId && sessionIncludesGroup(permit.kind, permit.groupName, input.groupName);
        if (!allowed && !input.token) throw genericRosterMismatch();
        const tokenHash = hashChallengeToken(input.token ?? "");
        const valid = await transaction.execute(sql`
          select cs.id from qr_challenges q
          join class_sessions cs on cs.id = q.session_id
          where q.token_hash = ${tokenHash} and cs.semester_id = ${input.semesterId}
          and q.expires_at > statement_timestamp() and cs.state = 'open'
          and cs.checkin_ends_at > statement_timestamp()
          and (cs.group_name = ${input.groupName}
            or (cs.kind = 'lecture' and cs.group_name = 'G1+G2'))
          for share of cs
        `);
        if (!allowed && !valid.length) throw new AttendanceServiceError(409, "registration_qr_expired", "Për regjistrimin e parë skano QR-në e re të profesorit.");
        const [created] = await transaction.insert(roster).values({
          semesterId: input.semesterId, studentId: suppliedStudentId,
          fullName: `${input.firstName.trim()} ${input.lastName.trim()}`.replace(/\s+/gu, " ").normalize("NFC"),
          email, groupName: input.groupName, userId: actor.userId,
          activatedAt: sql`statement_timestamp()`,
        }).returning();
        await audit(transaction, actor.userId, "roster.self_register", "roster", created.id,
          input.beforeClass ? "Student prepared profile before class; no attendance granted" : "Student supplied profile during active QR session", { semesterId: input.semesterId });
        return created;
      }
      if (
        normalizeAlbanianName(entry.fullName) !== suppliedName ||
        (entry.userId !== null && entry.userId !== actor.userId)
      ) {
        throw genericRosterMismatch();
      }

      if (entry.userId === actor.userId && (entry.email || !email)) return entry;

      const [updated] = await transaction
        .update(roster)
        .set({
          userId: actor.userId,
          email: entry.email ?? email ?? null,
          activatedAt: sql`statement_timestamp()`,
          updatedAt: sql`statement_timestamp()`,
        })
        .where(and(eq(roster.id, entry.id), or(isNull(roster.userId), eq(roster.userId, actor.userId))))
        .returning();
      if (!updated) {
        throw genericRosterMismatch();
      }
      return updated;
    });
  } catch (error) {
    if (
      error instanceof AttendanceServiceError ||
      databaseErrorCode(error) !== "23505"
    ) {
      throw error;
    }
    throw genericRosterMismatch();
  }
}

async function createClassSession(
  session: Session | null,
  input: {
    semesterId: string;
    weekNumber: number;
    kind: "lecture" | "lab";
    groupName: string;
    title: string;
  },
) {
  const db = await database();
  return db.transaction(async (transaction) => {
    const actor = await requireStaffActor(transaction, session);
    await cleanExpiredRateLimits(transaction);
    const [semester] = await transaction
      .select({ status: semesters.status, weekCount: semesters.weekCount })
      .from(semesters)
      .where(eq(semesters.id, input.semesterId))
      .limit(1);
    if (!semester) {
      throw new AttendanceServiceError(404, "semester_not_found", "Semester not found");
    }
    if (semester.status !== "active" || input.weekNumber > semester.weekCount) {
      throw new AttendanceServiceError(
        409,
        "semester_not_active",
        "Session requires an active semester and valid week",
      );
    }

    const [created] = await transaction
      .insert(classSessions)
      .values({ ...input, createdBy: actor.userId })
      .returning();
    await audit(
      transaction,
      actor.userId,
      "class_session.create",
      "class_session",
      created.id,
      "Class session created",
      { semesterId: input.semesterId },
    );
    return created;
  });
}

async function listClassSessions(
  session: Session | null,
  semesterId?: string,
) {
  const db = await database();
  await requireStaffActor(db, session);
  await finalizeExpiredClassSessions(db);
  const query = db
    .select({
      id: classSessions.id,
      semesterId: classSessions.semesterId,
      semesterTitle: semesters.title,
      title: classSessions.title,
      state: classSessions.state,
      weekNumber: classSessions.weekNumber,
      kind: classSessions.kind,
      groupName: classSessions.groupName,
      checkinEndsAt: classSessions.checkinEndsAt,
    })
    .from(classSessions)
    .innerJoin(semesters, eq(semesters.id, classSessions.semesterId))
    .orderBy(
      asc(semesters.createdAt),
      asc(classSessions.weekNumber),
      asc(classSessions.createdAt),
      asc(classSessions.id),
    );
  const rows = semesterId
    ? await query.where(eq(classSessions.semesterId, semesterId))
    : await query;

  return rows.map((row) => ({
    ...row,
    checkinEndsAt: row.checkinEndsAt ? toIso(row.checkinEndsAt) : null,
  }));
}

async function transitionClassSession(
  session: Session | null,
  sessionId: string,
  input: { state: SessionState; reason: string },
) {
  const db = await database();
  return db.transaction(async (transaction) => {
    const actor = await requireStaffActor(transaction, session);
    await cleanExpiredRateLimits(transaction);
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${sessionId}, 0))`,
    );
    await finalizeExpiredClassSessions(transaction, sessionId);
    const [current] = await transaction
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, sessionId))
      .limit(1)
      .for("update");
    if (!current) {
      throw new AttendanceServiceError(404, "session_not_found", "Class session not found");
    }
    const [semester] = await transaction.select().from(semesters)
      .where(eq(semesters.id, current.semesterId)).limit(1).for("share");
    if ((input.state === "open" || input.state === "draft") && semester?.status !== "active") {
      throw new AttendanceServiceError(409, "semester_inactive", "Semestri nuk është aktiv.");
    }
    if ((current.state === "closed" && input.state === "closed") ||
        (current.state === "open" && input.state === "open")) {
      return current;
    }
    const allowed =
      (current.state === "closed" && input.state === "draft") ||
      (current.state === "draft" && input.state === "open") ||
      (current.state === "open" && input.state === "closed") ||
      ((current.state === "draft" || current.state === "open") &&
        input.state === "cancelled");
    if (!allowed) {
      throw new AttendanceServiceError(
        409,
        "invalid_session_transition",
        "Invalid class session state transition",
      );
    }
    if (input.state === "draft") {
      const [record] = await transaction.select({ id: attendanceRecords.id })
        .from(attendanceRecords).where(eq(attendanceRecords.sessionId, sessionId)).limit(1);
      if (record) {
        throw new AttendanceServiceError(409, "session_has_records", "Ora ka regjistrime pjesëmarrjeje dhe nuk mund të rivendoset si test.");
      }
      await transaction.delete(qrChallenges).where(eq(qrChallenges.sessionId, sessionId));
    }
    const [updated] = await transaction
      .update(classSessions)
      .set({
        state: input.state,
        checkinEndsAt:
          input.state === "open"
            ? sql`statement_timestamp() + interval '5 minutes'`
            : input.state === "draft" ? null : current.checkinEndsAt,
        updatedAt: sql`statement_timestamp()`,
      })
      .where(eq(classSessions.id, sessionId))
      .returning();
    await audit(
      transaction,
      actor.userId,
      "class_session.state",
      "class_session",
      sessionId,
      input.reason,
      { from: current.state, to: input.state },
    );
    return updated;
  });
}

async function launchCourseSession(session: Session | null, weekNumber: number, kind: "lecture" | "lab", group?: "G1" | "G2") {
  const db = await database();
  await requireStaffActor(db, session);
  const groupName = kind === "lecture" ? CURRENT_COURSE.groupName : group;
  if (!CURRENT_COURSE_SESSIONS.some((item) => item.weekNumber === weekNumber && item.kind === kind && item.groupName === groupName)) {
    throw new AttendanceServiceError(400, "invalid_course_session", "Kjo orë nuk është në kalendar.");
  }
  const { semesterId } = await ensureCurrentCourseSetup(session);
  const matches = (await listClassSessions(session, semesterId)).filter((item) =>
    item.weekNumber === weekNumber && item.kind === kind && (item.groupName === groupName || (kind === "lecture" && item.groupName === "G1")));
  if (matches.length !== 1) {
    throw new AttendanceServiceError(409, "ambiguous_session", "Kalendari kërkon kontroll nga stafi.");
  }
  const selected = matches[0];
  if (selected.state === "closed" || selected.state === "cancelled") {
    throw new AttendanceServiceError(409, "session_finished", "Kjo orë ka përfunduar. Regjistri ruhet në panel; QR-ja nuk rihapet.");
  }
  return transitionClassSession(session, selected.id, {
    state: "open", reason: "Profesori hapi QR-në nga lidhja e orës së planifikuar.",
  });
}

async function createChallenge(
  session: Session | null,
  sessionId: string,
  ipAddress: string,
) {
  const db = await database();
  const actor = await requireStaffActor(db, session);
  await consumeRateLimit("challenge", actor.githubId, ipAddress, sessionId);
  const token = createChallengeToken();
  const tokenHash = hashChallengeToken(token);

  return db.transaction(async (transaction) => {
    await requireStaffActor(transaction, session);
    await cleanExpiredRateLimits(transaction);
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${sessionId}, 0))`,
    );
    await finalizeExpiredClassSessions(transaction, sessionId);
    const result = await transaction.execute(sql`
      select
        state,
        checkin_ends_at as "checkinEndsAt",
        statement_timestamp() as "serverTime"
      from class_sessions
      where id = ${sessionId}
      for update
    `);
    const row = result[0] as unknown as {
      state: string;
      checkinEndsAt: Date | null;
      serverTime: Date;
    } | undefined;
    if (!row) {
      throw new AttendanceServiceError(404, "session_not_found", "Class session not found");
    }
    if (
      row.state !== "open" ||
      !row.checkinEndsAt ||
      dateMilliseconds(row.checkinEndsAt) <= dateMilliseconds(row.serverTime)
    ) {
      throw new AttendanceServiceError(409, "checkin_closed", "Check-in is closed");
    }

    await transaction.delete(qrChallenges).where(and(
      eq(qrChallenges.sessionId, sessionId),
      sql`${qrChallenges.expiresAt} <= statement_timestamp()`,
    ));
    const inserted = await transaction.execute(sql`
      insert into qr_challenges (session_id, token_hash, expires_at)
      values (
        ${sessionId},
        ${tokenHash},
        ${row.checkinEndsAt}
      )
      returning expires_at as "expiresAt", statement_timestamp() as "serverTime"
    `);
    const challenge = inserted[0] as unknown as {
      expiresAt: Date;
      serverTime: Date;
    };
    return {
      token,
      expiresAt: toIso(challenge.expiresAt),
      serverTime: toIso(challenge.serverTime),
    };
  });
}

async function checkIn(
  session: Session | null,
  input: { token: string },
  ipAddress: string,
) {
  const tokenHash = hashChallengeToken(input.token);
  const identity = identityFromSession(session);
  await consumeRateLimit("scan", identity.githubId, ipAddress);
  const db = await database();

  await requireActor(db, session);
  const initial = await db.execute(sql`
    select session_id as "sessionId"
    from qr_challenges
    where token_hash = ${tokenHash}
  `);
  const initialChallenge = initial[0] as unknown as {
    sessionId: string;
  } | undefined;
  if (!initialChallenge) {
    throw new AttendanceServiceError(
      409,
      "invalid_challenge",
      "This QR code is no longer valid",
    );
  }

  await finalizeExpiredClassSessions(db, initialChallenge.sessionId);

  try {
    return await db.transaction(async (transaction) => {
      const actor = await requireActor(transaction, session);
      await transaction.execute(
        sql`select pg_advisory_xact_lock_shared(hashtextextended(${initialChallenge.sessionId}, 0))`,
      );
      const result = await transaction.execute(sql`
        select
          q.session_id as "sessionId",
          q.expires_at as "expiresAt",
          cs.semester_id as "semesterId",
          cs.group_name as "groupName",
          cs.kind,
          cs.title,
          cs.state,
          cs.checkin_ends_at as "checkinEndsAt",
          statement_timestamp() as "serverTime"
        from qr_challenges q
        inner join class_sessions cs on cs.id = q.session_id
        where q.token_hash = ${tokenHash}
          and q.session_id = ${initialChallenge.sessionId}
      `);
      const challenge = result[0] as unknown as {
        sessionId: string;
        expiresAt: Date;
        semesterId: string;
        groupName: string;
        kind: string;
        title: string;
        state: string;
        checkinEndsAt: Date | null;
        serverTime: Date;
      } | undefined;
      if (!challenge) {
        throw new AttendanceServiceError(
          409,
          "invalid_challenge",
          "This QR code is no longer valid",
        );
      }
      if (
        challenge.state !== "open" ||
        !challenge.checkinEndsAt ||
        dateMilliseconds(challenge.checkinEndsAt) <=
          dateMilliseconds(challenge.serverTime)
      ) {
        throw new AttendanceServiceError(409, "checkin_closed", "Check-in is closed");
      }
      if (
        dateMilliseconds(challenge.expiresAt) <=
        dateMilliseconds(challenge.serverTime)
      ) {
        throw new AttendanceServiceError(
          409,
          "invalid_challenge",
          "This QR code is no longer valid",
        );
      }

      const [entry] = await transaction
        .select()
        .from(roster)
        .where(
          and(
            eq(roster.semesterId, challenge.semesterId),
            eq(roster.userId, actor.userId),
          ),
        )
        .limit(1);
      if (!entry || !entry.email) {
        throw new AttendanceServiceError(
          409,
          "roster_not_activated",
          "Plotëso profilin një herë për këtë lëndë.",
          undefined,
          issueRegistrationPermit({ githubId: actor.githubId, semesterId: challenge.semesterId, groupName: challenge.groupName, kind: challenge.kind }, getEnv().NEXTAUTH_SECRET),
        );
      }
      if (!sessionIncludesGroup(challenge.kind, challenge.groupName, entry.groupName)) {
        throw new AttendanceServiceError(
          403,
          "wrong_group",
          "This session is for another group",
        );
      }

      const accepted = await transaction.execute(sql`
        with accepted as (
          select q.session_id, statement_timestamp() as scanned_at
          from qr_challenges q
          inner join class_sessions cs on cs.id = q.session_id
          where q.token_hash = ${tokenHash}
            and q.session_id = ${challenge.sessionId}
            and q.expires_at > statement_timestamp()
            and cs.state = 'open'
            and cs.checkin_ends_at > statement_timestamp()
        ), inserted as (
          insert into attendance_records (
            session_id,
            roster_id,
            status,
            scanned_at
          )
          select session_id, ${entry.id}, 'present', scanned_at
          from accepted
          on conflict (session_id, roster_id) do nothing
          returning
            id,
            status,
            scanned_at as "scannedAt",
            verified_at as "verifiedAt",
            created_at as "createdAt"
        )
        select
          id,
          status,
          "scannedAt",
          "verifiedAt",
          "createdAt",
          false as duplicate
        from inserted
        union all
        select
          null::uuid as id,
          null::text as status,
          null::timestamp with time zone as "scannedAt",
          null::timestamp with time zone as "verifiedAt",
          null::timestamp with time zone as "createdAt",
          true as duplicate
        from accepted
        where not exists (select 1 from inserted)
        limit 1
      `);
      let record = accepted[0] as unknown as {
        id: string | null;
        status: string | null;
        scannedAt: Date | string | null;
        verifiedAt: Date | string | null;
        createdAt: Date | string | null;
        duplicate: boolean;
      } | undefined;
      if (record?.duplicate && !record.id) {
        const [existing] = await transaction
          .select()
          .from(attendanceRecords)
          .where(
            and(
              eq(attendanceRecords.sessionId, challenge.sessionId),
              eq(attendanceRecords.rosterId, entry.id),
            ),
          )
          .limit(1);
        record = existing ? { ...existing, duplicate: true } : undefined;
      }
      if (!record) {
        const latest = await transaction.execute(sql`
          select
            q.expires_at as "expiresAt",
            cs.state,
            cs.checkin_ends_at as "checkinEndsAt",
            statement_timestamp() as "serverTime"
          from qr_challenges q
          inner join class_sessions cs on cs.id = q.session_id
          where q.token_hash = ${tokenHash}
            and q.session_id = ${challenge.sessionId}
        `);
        const current = latest[0] as unknown as {
          expiresAt: Date | string;
          state: string;
          checkinEndsAt: Date | string | null;
          serverTime: Date | string;
        } | undefined;
        if (
          current &&
          (current.state !== "open" ||
            !current.checkinEndsAt ||
            dateMilliseconds(current.checkinEndsAt) <=
              dateMilliseconds(current.serverTime))
        ) {
          throw new AttendanceServiceError(
            409,
            "checkin_closed",
            "Check-in is closed",
          );
        }
        throw new AttendanceServiceError(
          409,
          "invalid_challenge",
          "This QR code is no longer valid",
        );
      }
      if (!record.id || !record.status) {
        throw new Error("Attendance insert returned an incomplete record");
      }

      return {
        recordId: record.id,
        sessionId: challenge.sessionId,
        sessionTitle: challenge.title,
        status: record.status,
        recordedAt: toIso(
          record.scannedAt ?? record.verifiedAt ?? record.createdAt ?? challenge.serverTime,
        ),
        duplicate: record.duplicate,
      };
    });
  } catch (error) {
    if (
      error instanceof AttendanceServiceError &&
      error.code === "checkin_closed"
    ) {
      await finalizeExpiredClassSessions(db, initialChallenge.sessionId);
    }
    throw error;
  }
}

async function getLiveSession(
  session: Session | null,
  sessionId: string,
  ipAddress: string,
) {
  const db = await database();
  const actor = await requireStaffActor(db, session);
  await consumeRateLimit("live", actor.githubId, ipAddress, sessionId);
  await finalizeExpiredClassSessions(db, sessionId);
  const clock = await db.execute(sql`
    select
      id,
      state,
      checkin_ends_at as "checkinEndsAt",
      statement_timestamp() as "serverTime"
    from class_sessions where id = ${sessionId}
  `);
  const classSession = clock[0] as unknown as {
    id: string;
    state: string;
    checkinEndsAt: Date | null;
    serverTime: Date;
  } | undefined;
  if (!classSession) {
    throw new AttendanceServiceError(404, "session_not_found", "Class session not found");
  }

  const rows = await db
    .select({
      rosterId: roster.id,
      fullName: roster.fullName,
      scannedAt: attendanceRecords.scannedAt,
      verifiedAt: attendanceRecords.verifiedAt,
    })
    .from(attendanceRecords)
    .innerJoin(roster, eq(roster.id, attendanceRecords.rosterId))
    .where(
      and(
        eq(attendanceRecords.sessionId, sessionId),
        eq(attendanceRecords.status, "present"),
      ),
    )
    .orderBy(
      asc(sql`coalesce(${attendanceRecords.scannedAt}, ${attendanceRecords.verifiedAt})`),
      asc(roster.id),
    );
  const entries = rows.map((row) => ({
    rosterId: row.rosterId,
    displayName: row.fullName,
    recordedAt: toIso(row.scannedAt ?? row.verifiedAt ?? classSession.serverTime),
  }));
  return {
    sessionId,
    state: classSession.state,
    serverTime: toIso(classSession.serverTime),
    checkinEndsAt: classSession.checkinEndsAt
      ? toIso(classSession.checkinEndsAt)
      : null,
    entries,
    total: entries.length,
  };
}

async function getSessionRecords(
  session: Session | null,
  sessionId: string,
) {
  const db = await database();
  await requireStaffActor(db, session);
  await finalizeExpiredClassSessions(db, sessionId);
  const [classSession] = await db
    .select({
      id: classSessions.id,
      title: classSessions.title,
      state: classSessions.state,
      weekNumber: classSessions.weekNumber,
      kind: classSessions.kind,
      groupName: classSessions.groupName,
      checkinEndsAt: classSessions.checkinEndsAt,
    })
    .from(classSessions)
    .where(eq(classSessions.id, sessionId))
    .limit(1);
  if (!classSession) {
    throw new AttendanceServiceError(404, "session_not_found", "Class session not found");
  }

  const rows = await db
    .select({
      id: attendanceRecords.id,
      rosterId: roster.id,
      fullName: roster.fullName,
      studentId: roster.studentId,
      githubUsername: users.githubUsername,
      status: attendanceRecords.status,
      scannedAt: attendanceRecords.scannedAt,
      verifiedAt: attendanceRecords.verifiedAt,
    })
    .from(roster)
    .leftJoin(users, eq(users.id, roster.userId))
    .leftJoin(
      attendanceRecords,
      and(
        eq(attendanceRecords.rosterId, roster.id),
        eq(attendanceRecords.sessionId, sessionId),
      ),
    )
    .where(
      and(
        eq(roster.semesterId, sql`(select semester_id from class_sessions where id = ${sessionId})`),
        classSession.kind === "lecture" && classSession.groupName === CURRENT_COURSE.groupName
          ? inArray(roster.groupName, ["G1", "G2"])
          : eq(roster.groupName, classSession.groupName),
      ),
    )
    .orderBy(asc(roster.studentId), asc(roster.id));

  return {
    session: {
      ...classSession,
      checkinEndsAt: classSession.checkinEndsAt
        ? toIso(classSession.checkinEndsAt)
        : null,
    },
    records: rows.map((row) => ({
      id: row.id,
      rosterId: row.rosterId,
      fullName: row.fullName,
      studentId: row.studentId,
      githubUsername: row.githubUsername,
      status: row.status ?? "absent",
      recordedAt:
        row.scannedAt || row.verifiedAt
          ? toIso(row.scannedAt ?? row.verifiedAt ?? "")
          : null,
    })),
  };
}

async function createManualRecord(
  session: Session | null,
  sessionId: string,
  input: { rosterId: string; status: AttendanceStatus; reason: string },
) {
  const db = await database();
  return db.transaction(async (transaction) => {
    const actor = await requireStaffActor(transaction, session);
    await cleanExpiredRateLimits(transaction);
    const [target] = await transaction
      .select({
        semesterId: classSessions.semesterId,
        sessionGroup: classSessions.groupName,
        sessionKind: classSessions.kind,
        rosterSemesterId: roster.semesterId,
        rosterGroup: roster.groupName,
      })
      .from(classSessions)
      .innerJoin(roster, eq(roster.id, input.rosterId))
      .where(eq(classSessions.id, sessionId))
      .limit(1);
    if (!target) {
      throw new AttendanceServiceError(404, "record_target_not_found", "Record target not found");
    }
    if (
      target.semesterId !== target.rosterSemesterId ||
      !sessionIncludesGroup(target.sessionKind, target.sessionGroup, target.rosterGroup)
    ) {
      throw new AttendanceServiceError(409, "wrong_group", "Roster entry is not in this session");
    }

    try {
      const [record] = await transaction
        .insert(attendanceRecords)
        .values({
          sessionId,
          rosterId: input.rosterId,
          status: input.status,
          verifiedAt: sql`statement_timestamp()`,
          verifiedBy: actor.userId,
          correctionReason: input.reason,
        })
        .returning();
      await audit(
        transaction,
        actor.userId,
        "attendance.manual",
        "attendance_record",
        record.id,
        input.reason,
        { status: input.status },
      );
      return record;
    } catch (error) {
      if (databaseErrorCode(error) === "23505") {
        throw new AttendanceServiceError(
          409,
          "record_exists",
          "Attendance record already exists",
        );
      }
      throw error;
    }
  });
}

async function correctRecord(
  session: Session | null,
  recordId: string,
  input: { status: AttendanceStatus; reason: string },
) {
  const db = await database();
  return db.transaction(async (transaction) => {
    const actor = await requireStaffActor(transaction, session);
    await cleanExpiredRateLimits(transaction);
    const [record] = await transaction
      .update(attendanceRecords)
      .set({
        status: input.status,
        verifiedAt: sql`statement_timestamp()`,
        verifiedBy: actor.userId,
        correctionReason: input.reason,
        updatedAt: sql`statement_timestamp()`,
      })
      .where(eq(attendanceRecords.id, recordId))
      .returning();
    if (!record) {
      throw new AttendanceServiceError(404, "record_not_found", "Attendance record not found");
    }
    await audit(
      transaction,
      actor.userId,
      "attendance.correct",
      "attendance_record",
      record.id,
      input.reason,
      { status: input.status },
    );
    return record;
  });
}

async function exportRoster(session: Session | null, semesterId: string) {
  const db = await database();
  await requireStaffActor(db, session);
  const rows = await db.select({ studentId: roster.studentId, fullName: roster.fullName, groupName: roster.groupName, email: roster.email }).from(roster).where(eq(roster.semesterId, semesterId)).orderBy(asc(roster.fullName));
  return { filename: `roster-${semesterId}.csv`, csv: [csvRow(["Student ID", "Full Name", "Group", "Email (student supplied)"]), ...rows.map(row => csvRow([row.studentId, row.fullName, row.groupName, row.email ?? ""]))].join("\r\n") + "\r\n" };
}

async function getWeeklyAttendanceReport(session: Session | null) {
  const db = await database();
  await requireStaffActor(db, session);
  await finalizeExpiredClassSessions(db);
  const [semester] = await db
    .select({ id: semesters.id, title: semesters.title })
    .from(semesters)
    .where(and(eq(semesters.title, CURRENT_COURSE.title), eq(semesters.status, "active")))
    .limit(1);
  if (!semester) {
    throw new AttendanceServiceError(404, "semester_not_found", "Semestri aktual nuk u gjet.");
  }
  const rows = await db
    .select({
      sessionId: classSessions.id,
      sessionTitle: classSessions.title,
      weekNumber: classSessions.weekNumber,
      kind: classSessions.kind,
      sessionGroup: classSessions.groupName,
      state: classSessions.state,
      studentId: roster.studentId,
      fullName: roster.fullName,
      studentGroup: roster.groupName,
      status: attendanceRecords.status,
      scannedAt: attendanceRecords.scannedAt,
      verifiedAt: attendanceRecords.verifiedAt,
    })
    .from(classSessions)
    .innerJoin(roster, and(
      eq(roster.semesterId, classSessions.semesterId),
      or(eq(classSessions.groupName, roster.groupName), and(
        eq(classSessions.kind, "lecture"),
        eq(classSessions.groupName, CURRENT_COURSE.groupName),
        inArray(roster.groupName, ["G1", "G2"]),
      )),
      sql`${roster.createdAt} <= case when ${classSessions.state} = 'closed' then least(${classSessions.checkinEndsAt}, ${classSessions.updatedAt}) else ${classSessions.checkinEndsAt} end`,
    ))
    .leftJoin(attendanceRecords, and(
      eq(attendanceRecords.sessionId, classSessions.id),
      eq(attendanceRecords.rosterId, roster.id),
    ))
    .where(and(
      eq(classSessions.semesterId, semester.id),
      inArray(classSessions.state, ["open", "closed"]),
    ))
    .orderBy(
      asc(classSessions.weekNumber),
      asc(classSessions.title),
      asc(roster.groupName),
      asc(roster.fullName),
      asc(roster.studentId),
    );
  return {
    semesterId: semester.id,
    semesterTitle: semester.title,
    rows: rows.map((row) => ({
      sessionId: row.sessionId,
      sessionTitle: row.sessionTitle,
      weekNumber: row.weekNumber,
      kind: row.kind,
      sessionGroup: row.sessionGroup,
      state: row.state,
      studentId: row.studentId,
      fullName: row.fullName,
      studentGroup: row.studentGroup,
      status: row.status ?? (row.state === "open" ? "pending" : "absent"),
      present: row.status === "present" ? "Po" : row.status ? "Jo" : row.state === "open" ? "Në pritje" : "Jo",
      recordedAt: row.scannedAt || row.verifiedAt
        ? toIso(row.scannedAt ?? row.verifiedAt ?? "")
        : null,
    })),
  };
}

async function exportSemester(session: Session | null, semesterId: string) {
  const db = await database();
  return db.transaction(async (transaction) => {
    const actor = await requireStaffActor(transaction, session);
    await cleanExpiredRateLimits(transaction);
    const [semester] = await transaction
      .select({ id: semesters.id, title: semesters.title })
      .from(semesters)
      .where(eq(semesters.id, semesterId))
      .limit(1);
    if (!semester) {
      throw new AttendanceServiceError(404, "semester_not_found", "Semester not found");
    }
    const rows = await transaction
      .select({
        studentId: roster.studentId,
        fullName: roster.fullName,
        groupName: roster.groupName,
        sessionTitle: classSessions.title,
        weekNumber: classSessions.weekNumber,
        kind: classSessions.kind,
        status: attendanceRecords.status,
        scannedAt: attendanceRecords.scannedAt,
        verifiedAt: attendanceRecords.verifiedAt,
        reason: attendanceRecords.correctionReason,
      })
      .from(classSessions)
      .innerJoin(
        roster,
        and(
          eq(roster.semesterId, classSessions.semesterId),
          or(eq(classSessions.groupName, roster.groupName), and(
          eq(classSessions.kind, "lecture"), eq(classSessions.groupName, CURRENT_COURSE.groupName),
          inArray(roster.groupName, ["G1", "G2"]))),
          sql`${roster.createdAt} <= least(${classSessions.checkinEndsAt}, ${classSessions.updatedAt})`,
        ),
      )
      .leftJoin(
        attendanceRecords,
        and(
          eq(attendanceRecords.sessionId, classSessions.id),
          eq(attendanceRecords.rosterId, roster.id),
        ),
      )
      .where(
        and(
          eq(classSessions.semesterId, semesterId),
          eq(classSessions.state, "closed"),
        ),
      )
      .orderBy(
        asc(roster.groupName),
        asc(roster.studentId),
        asc(classSessions.weekNumber),
        asc(classSessions.kind),
        asc(classSessions.id),
      );
    const lines = [
      csvRow([
        "Student ID",
        "Full Name",
        "Group",
        "Session",
        "Week",
        "Kind",
        "Status",
        "Recorded At",
        "Reason",
        "Prezent (Po/Jo)",
      ]),
      ...rows.map((row) =>
        csvRow([
          row.studentId,
          row.fullName,
          row.groupName,
          row.sessionTitle,
          row.weekNumber,
          row.kind,
          row.status ?? "absent",
          row.scannedAt || row.verifiedAt
            ? toIso(row.scannedAt ?? row.verifiedAt ?? "")
            : "",
          row.reason,
          row.status === "present" ? "Po" : "Jo",
        ]),
      ),
    ];
    await audit(
      transaction,
      actor.userId,
      "semester.export",
      "semester",
      semesterId,
      "CSV export",
      { rows: rows.length },
    );
    return {
      filename: `attendance-${semesterId}.csv`,
      csv: `${lines.join("\r\n")}\r\n`,
    };
  });
}

export function firstForwardedIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",", 1)[0]?.trim();
  return first || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function attendanceServiceErrorResponse(error: unknown): Response {
  if (error instanceof AttendanceServiceError) {
    const messages: Record<string,string> = {
      invalid_challenge: "QR-ja ka skaduar. Skano kodin e ri në projektor; nëse ora është mbyllur, njofto profesorin.",
      checkin_closed: "Regjistrimi për këtë orë është mbyllur. Nëse ishe i pranishëm, njofto profesorin.",
      wrong_group: "Ky QR është për grupin tjetër. Skano kodin e grupit tënd.",
      staff_required: "Kjo hapësirë është vetëm për profesorin.",
      rate_limited: "Ke provuar disa herë radhazi. Prit pak dhe provo përsëri.",
    };
    if (messages[error.code]) error.message = messages[error.code];
  }
  if (error instanceof SyntaxError) {
    return Response.json(
      { error: { code: "invalid_request", message: "Invalid request" } },
      { status: 400 },
    );
  }
  if (error instanceof AttendanceServiceError) {
    const headers = new Headers();
    if (error.retryAfter !== undefined) {
      headers.set("Retry-After", String(error.retryAfter));
    }
    return Response.json(
      { error: { code: error.code, message: error.message, ...(error.registrationPermit ? { registrationPermit: error.registrationPermit } : {}) } },
      { status: error.status, headers },
    );
  }
  return Response.json(
    { error: { code: "internal_error", message: "Internal server error" } },
    { status: 500 },
  );
}

export const attendanceService = {
  activateRoster,
  checkIn,
  correctRecord,
  createChallenge,
  createClassSession,
  createManualRecord,
  createSemester,
  exportSemester,
  getWeeklyAttendanceReport,
  exportRoster,
  ensureCurrentCourseSetup,
  launchCourseSession,
  getSessionRecords,
  getStudentHistory,
  getLiveSession,
  importRoster,
  listClassSessions,
  listSemesters,
  transitionClassSession,
  transitionSemester,
};
