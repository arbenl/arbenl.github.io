import { createHmac } from "node:crypto";

import {
  and,
  asc,
  eq,
  inArray,
  isNull,
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
import {
  maskDisplayName,
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

async function getStudentHistory(session: Session | null) {
  const db = await database();
  const actor = await requireActor(db, session);
  const rows = await db
    .select({
      id: classSessions.id,
      semesterTitle: semesters.title,
      title: classSessions.title,
      weekNumber: classSessions.weekNumber,
      kind: classSessions.kind,
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
        eq(classSessions.groupName, roster.groupName),
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
      asc(classSessions.createdAt),
      asc(classSessions.id),
    );

  const sessions = rows.map((row) => ({
    id: row.id,
    semesterTitle: row.semesterTitle,
    title: row.title,
    weekNumber: row.weekNumber,
    kind: row.kind as "lecture" | "lab",
    status: (row.status ?? "absent") as AttendanceStatus | "absent",
    recordedAt:
      row.scannedAt || row.verifiedAt
        ? toIso(row.scannedAt ?? row.verifiedAt ?? "")
        : null,
  }));
  const totals = {
    sessions: sessions.length,
    present: 0,
    excused: 0,
    rejected: 0,
    absent: 0,
  };
  for (const item of sessions) {
    totals[item.status] += 1;
  }

  return { sessions, totals };
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
      if (
        !entry ||
        normalizeAlbanianName(entry.fullName) !== suppliedName ||
        (entry.userId !== null && entry.userId !== actor.userId)
      ) {
        throw genericRosterMismatch();
      }

      if (entry.userId === actor.userId) {
        return entry;
      }

      const [updated] = await transaction
        .update(roster)
        .set({
          userId: actor.userId,
          activatedAt: sql`statement_timestamp()`,
          updatedAt: sql`statement_timestamp()`,
        })
        .where(and(eq(roster.id, entry.id), isNull(roster.userId)))
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
  input: { state: Exclude<SessionState, "draft">; reason: string },
) {
  const db = await database();
  return db.transaction(async (transaction) => {
    const actor = await requireStaffActor(transaction, session);
    await cleanExpiredRateLimits(transaction);
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${sessionId}, 0))`,
    );
    const [current] = await transaction
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, sessionId))
      .limit(1)
      .for("update");
    if (!current) {
      throw new AttendanceServiceError(404, "session_not_found", "Class session not found");
    }
    const allowed =
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
    const [updated] = await transaction
      .update(classSessions)
      .set({
        state: input.state,
        checkinEndsAt:
          input.state === "open"
            ? sql`statement_timestamp() + interval '2 minutes'`
            : current.checkinEndsAt,
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

    await transaction.delete(qrChallenges).where(eq(qrChallenges.sessionId, sessionId));
    const inserted = await transaction.execute(sql`
      insert into qr_challenges (session_id, token_hash, expires_at)
      values (
        ${sessionId},
        ${tokenHash},
        least(statement_timestamp() + interval '40 seconds', ${row.checkinEndsAt})
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

  return db.transaction(async (transaction) => {
    const actor = await requireActor(transaction, session);
    const initial = await transaction.execute(sql`
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

    await transaction.execute(
      sql`select pg_advisory_xact_lock_shared(hashtextextended(${initialChallenge.sessionId}, 0))`,
    );
    const result = await transaction.execute(sql`
      select
        q.session_id as "sessionId",
        q.expires_at as "expiresAt",
        cs.semester_id as "semesterId",
        cs.group_name as "groupName",
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
    if (!entry) {
      throw new AttendanceServiceError(
        409,
        "roster_not_activated",
        "Activate your roster profile before checking in",
      );
    }
    if (entry.groupName !== challenge.groupName) {
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
}

async function getLiveSession(
  session: Session | null,
  sessionId: string,
  ipAddress: string,
) {
  const db = await database();
  const actor = await requireStaffActor(db, session);
  await consumeRateLimit("live", actor.githubId, ipAddress, sessionId);
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
    displayName: maskDisplayName(row.fullName),
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
        eq(roster.groupName, classSession.groupName),
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
      target.sessionGroup !== target.rosterGroup
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
          eq(roster.groupName, classSessions.groupName),
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
      { error: { code: error.code, message: error.message } },
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
  getSessionRecords,
  getStudentHistory,
  getLiveSession,
  importRoster,
  listClassSessions,
  listSemesters,
  transitionClassSession,
  transitionSemester,
};
