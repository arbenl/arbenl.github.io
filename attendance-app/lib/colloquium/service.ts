import { createHash, createHmac, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Session } from 'next-auth';
import { z } from 'zod';
import { getEnv } from '../env';
import { getSessionIdentity, requireStaff } from '../auth/session';
import { CURRENT_COURSE } from '../attendance/current-course';
import { normalizeStudentId, registrationNamesMatch } from '../attendance/normalize';
import type { ClassroomStudent } from '../attendance/classroom-registration';
import { ensureColloquiumSchema } from './schema';
import { getQuestionBank } from './bank';
import { publicQuestions, scoreAnswers, shuffleQuestions, type QuestionOrder } from './core';
import type { ColloquiumRoom, ColloquiumState, ColloquiumResult, ColloquiumStaffState } from './types';
type DB = (typeof import('../db/client'))['db'];
type Executor = Pick<DB, 'execute'>;
const database = async () => (await import('../db/client')).db;
export class ColloquiumError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}
function fail(status: number, code: string): never {
  throw new ColloquiumError(status, code);
}
const hash = (token: string) => createHash('sha256').update(token).digest();
export const roomToken = (id: string) => createHmac('sha256', getEnv().NEXTAUTH_SECRET).update(`colloquium-room-v1:${id}`).digest('base64url');
function bankFor(version: string) {
  try {
    return getQuestionBank(version);
  }
  catch {
    return fail(503, 'question_bank_unavailable');
  }
}
const iso = (x: Date | string) => new Date(x).toISOString();
const milliseconds = (x: Date | string) => new Date(x).getTime();
interface Room {
  id: string;
  semester_id: string;
  group_name: 'G1' | 'G2';
  started_at: Date | null;
  deadline: Date | null;
  bank_version: string;
}
interface Attempt {
  id: string;
  room_id: string;
  question_order: QuestionOrder[];
  answers: Record<string, string | null>;
  revisions: Record<string, number>;
  revision: number;
  submitted_at: Date | null;
  score: number | null;
}
function roomView(r: Room, now: Date): ColloquiumRoom {
  return { id: r.id, groupName: r.group_name, weekNumber: 7, state: !r.started_at ? 'lobby' : milliseconds(r.deadline!) <= milliseconds(now) ? 'finished' : 'live', startedAt: r.started_at ? iso(r.started_at) : null, deadline: r.deadline ? iso(r.deadline) : null };
}
async function currentSemester(db: Executor) {
  const rows = await db.execute(sql`select id from semesters where title=${CURRENT_COURSE.title} and status='active'`);
  if (rows.length !== 1)
    fail(409, 'course_unavailable');
  return rows[0].id as string;
}
async function ready(db: Executor) {
  const rows = await db.execute(sql`select to_regclass('public.colloquium_attempts') is not null as ready`);
  if (!rows[0]?.ready)
    fail(409, 'colloquium_unavailable');
}
async function clock(db: Executor) {
  const rows = await db.execute(sql`select clock_timestamp() as now`);
  return new Date(rows[0].now as string);
}
async function actor(db: Executor, session: Session | null) {
  const identity = getSessionIdentity(session);
  if (!identity)
    return fail(401, 'authentication_required');
  const rows = identity.authMethod === 'classroom' ? await db.execute(sql`select r.id,r.user_id,r.semester_id,u.github_id,st.user_id as staff_id from roster r join users u on u.id=r.user_id left join staff st on st.user_id=u.id where r.id=${identity.rosterId} and r.user_id=${identity.userId} and r.semester_id=${identity.semesterId} and lower(trim(r.email))=${identity.email}`) : await db.execute(sql`select r.id,r.user_id,r.semester_id,u.github_id,st.user_id as staff_id from users u left join roster r on r.user_id=u.id and r.semester_id=(select id from semesters where title=${CURRENT_COURSE.title} and status='active' limit 1) left join staff st on st.user_id=u.id where u.github_id=${identity.githubId}`);
  const row = rows[0];
  if (!row)
    return fail(401, 'authentication_required');
  if (row.staff_id || row.github_id === getEnv().PROFESSOR_GITHUB_ID)
    return fail(403, 'student_required');
  return { userId: row.user_id as string | undefined, rosterId: row.id as string | undefined, semesterId: row.semester_id as string | undefined };
}
async function loadRoom(db: Executor, id: string, lock = false) {
  if (!z.uuid().safeParse(id).success)
    fail(400, 'invalid_request');
  const rows = await db.execute(sql`select * from colloquium_rooms where id=${id} ${lock ? sql`for update` : sql``}`);
  if (!rows.length)
    fail(404, 'room_not_found');
  return rows[0] as unknown as Room;
}
async function validToken(db: Executor, r: Room, token: unknown) {
  if (typeof token !== 'string' || token.length > 256)
    fail(403, 'invalid_room');
  const rows = await db.execute(sql`select id from colloquium_rooms where id=${r.id} and token_hash=${hash(token)}`);
  if (!rows.length)
    fail(403, 'invalid_room');
}
async function finalize(db: Executor, room: Room, now: Date) {
  if (!room.deadline || milliseconds(room.deadline) > milliseconds(now))
    return;
  const bank = bankFor(room.bank_version);
  const rows = await db.execute(sql`select * from colloquium_attempts where room_id=${room.id} and score is null order by id for update`);
  for (const row of rows) {
    const a = row as unknown as Attempt;
    await db.execute(sql`update colloquium_attempts set score=${scoreAnswers(a.question_order, a.answers, bank)},submitted_at=coalesce(submitted_at,${room.deadline}) where id=${a.id} and score is null`);
  }
}
export async function staffState(session: Session | null): Promise<ColloquiumStaffState> {
  await requireStaff(session);
  const db = await database();
  await db.transaction(async (tx) => {
    await ensureColloquiumSchema(tx);
  });
  const semester = await currentSemester(db);
  const now = await clock(db);
  const rooms = await db.execute(sql`select * from colloquium_rooms where semester_id=${semester} order by group_name`);
  const output = [];
  for (const row of rooms) {
    const r = row as unknown as Room;
    const people = await db.execute(sql`select r.full_name,a.submitted_at from colloquium_attempts a join roster r on r.id=a.roster_id where a.room_id=${r.id} order by r.full_name`);
    output.push({ ...roomView(r, now), token: roomToken(r.id), joinedCount: people.length, participants: people.map(p => ({ fullName: p.full_name as string, submitted: !!p.submitted_at })) });
  }
  return { serverTime: iso(now), rooms: output };
}
export async function openLobby(session: Session | null, input: unknown) {
  const owner = await requireStaff(session);
  const parsed = z.object({ groupName: z.enum(['G1', 'G2']) }).safeParse(input);
  if (!parsed.success)
    fail(400, 'invalid_request');
  const db = await database();
  await db.transaction(async (tx) => {
    await ensureColloquiumSchema(tx);
    const semester = await currentSemester(tx);
    const id = randomUUID();
    await tx.execute(sql`insert into colloquium_rooms(id,semester_id,group_name,token_hash,created_by) values (${id},${semester},${parsed.data.groupName},${hash(roomToken(id))},${owner.userId}) on conflict(semester_id,week_number,group_name) do nothing`);
  });
  return staffState(session);
}
export async function startRoom(session: Session | null, id: string) {
  await requireStaff(session);
  const db = await database();
  await ready(db);
  await db.transaction(async (tx) => {
    const r = await loadRoom(tx, id, true);
    bankFor(r.bank_version);
    if (r.semester_id !== await currentSemester(tx))
      fail(409, 'wrong_semester');
    await tx.execute(sql`update colloquium_rooms set started_at=statement_timestamp(),deadline=statement_timestamp()+interval '600 seconds' where id=${id} and started_at is null`);
  });
  return staffState(session);
}
export async function registerColloquiumStudent(input: unknown, ip: string): Promise<ClassroomStudent> {
  void ip;
  // Do not rate-limit a shared campus NAT address.
  const parsed = z.object({ token: z.string().min(32).max(256), email: z.string().trim().toLowerCase().email().max(254), firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100), studentId: z.string().trim().min(1).max(100) }).safeParse(input);
  if (!parsed.success)
    fail(400, 'invalid_registration');
  const data = parsed.data;
  const db = await database();
  await ready(db);
  const tokenRooms = await db.execute(sql`select * from colloquium_rooms where token_hash=${hash(data.token)}`);
  if (!tokenRooms.length)
    fail(403, 'invalid_room');
  const room = tokenRooms[0] as unknown as Room;
  // Independent per-identity bucket permits a whole classroom sharing one campus address.
  const key = createHmac('sha256', getEnv().RATE_LIMIT_SECRET).update(JSON.stringify([room.semester_id, normalizeStudentId(data.studentId), data.email])).digest();
  const limits = await db.execute(sql`insert into request_limits(action,key_hash,window_start,count) values ('colloquium_identity',${key},to_timestamp(floor(extract(epoch from clock_timestamp())/600)*600),1) on conflict(action,key_hash,window_start) do update set count=request_limits.count+1 returning count`);
  if (Number(limits[0].count) > 20)
    fail(429, 'rate_limited');
  const name = `${data.firstName} ${data.lastName}`.replace(/\s+/gu, ' ').normalize('NFC');
  const studentId = normalizeStudentId(data.studentId);
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['classroom-enroll', room.semester_id, studentId])},0))`);
      const r = await loadRoom(tx, room.id);
      if (r.semester_id !== await currentSemester(tx) || r.deadline && milliseconds(r.deadline) <= milliseconds(await clock(tx)))
        fail(409, 'room_finished');
      const entries = await tx.execute(sql`select id,full_name,email,user_id from roster where semester_id=${r.semester_id} and student_id=${studentId} for update`);
      let entry = entries[0];
      const protectedRows = await tx.execute(sql`select u.id from users u left join staff st on st.user_id=u.id where (st.user_id is not null or u.github_id=${getEnv().PROFESSOR_GITHUB_ID}) and (u.id=${entry?.user_id ?? null}::uuid or exists(select 1 from roster rr where rr.user_id=u.id and lower(trim(rr.email))=${data.email}))`);
      if (protectedRows.length)
        fail(403, 'staff_forbidden');
      if (entry && (!registrationNamesMatch(entry.full_name as string, name) || (entry.email && String(entry.email).trim().toLowerCase() !== data.email)))
        fail(409, 'profile_conflict');
      const duplicates = await tx.execute(sql`select id from roster where semester_id=${r.semester_id} and lower(trim(email))=${data.email} and student_id<>${studentId}`);
      if (duplicates.length)
        fail(409, 'profile_conflict');
      let userId = entry?.user_id as string | undefined;
      if (!userId) {
        const created = await tx.execute(sql`insert into users(name) values (${entry?.full_name ?? name}) returning id`);
        userId = created[0].id as string;
      }
      if (entry) {
        await tx.execute(sql`update roster set user_id=${userId},activated_at=coalesce(activated_at,clock_timestamp()),email=coalesce(email,${data.email}),updated_at=clock_timestamp() where id=${entry.id}`);
      }
      else {
        const created = await tx.execute(sql`insert into roster(semester_id,student_id,full_name,email,group_name,user_id,activated_at) values (${r.semester_id},${studentId},${name},${data.email},${r.group_name},${userId},clock_timestamp()) returning id,full_name`);
        entry = created[0];
      }
      const latest = await loadRoom(tx, r.id);
      if (latest.deadline && milliseconds(latest.deadline) <= milliseconds(await clock(tx)))
        fail(409, 'room_finished');
      return { id: userId, name: entry.full_name as string, email: data.email, authMethod: 'classroom', semesterId: r.semester_id, rosterId: entry.id as string };
    });
  }
  catch (error) {
    const cause = error instanceof Error && 'cause' in error ? error.cause : error;
    if (cause && typeof cause === 'object' && 'code' in cause && cause.code === '23505')
      fail(409, 'profile_conflict');
    throw error;
  }
}
export async function joinRoom(session: Session | null, input: unknown) {
  const parsed = z.object({ roomId: z.uuid(), token: z.string().min(32).max(256) }).safeParse(input);
  if (!parsed.success)
    fail(400, 'invalid_request');
  const db = await database();
  await ready(db);
  await db.transaction(async (tx) => {
    const who = await actor(tx, session);
    const r = await loadRoom(tx, parsed.data.roomId);
    await validToken(tx, r, parsed.data.token);
    if (r.semester_id !== await currentSemester(tx))
      fail(409, 'wrong_semester');
    if (!who.userId || !who.rosterId || who.semesterId !== r.semester_id)
      fail(409, 'registration_required');
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['colloquium-attempt', r.semester_id, who.userId])},0))`);
    const previous = await tx.execute(sql`select room_id from colloquium_attempts where semester_id=${r.semester_id} and week_number=7 and user_id=${who.userId}`);
    if (previous.length) {
      if (previous[0].room_id !== r.id)
        fail(409, 'attempt_exists');
      return;
    }
    const latest = await loadRoom(tx, r.id);
    if (latest.deadline && milliseconds(latest.deadline) <= milliseconds(await clock(tx)))
      fail(409, 'room_finished');
    await tx.execute(sql`insert into colloquium_attempts(room_id,semester_id,user_id,roster_id,question_order) values (${r.id},${r.semester_id},${who.userId},${who.rosterId},${JSON.stringify(shuffleQuestions(bankFor(r.bank_version)))}::jsonb)`);
  });
  return studentState(session, { roomId: parsed.data.roomId });
}
async function studentResults(db: Executor, semester: string): Promise<ColloquiumResult[]> {
  const now = await clock(db);
  const rooms = await db.execute(sql`select * from colloquium_rooms where semester_id=${semester} order by id`);
  for (const row of rooms)
    await finalize(db, row as unknown as Room, now);
  const rows = await db.execute(sql`select r.full_name,c.group_name,a.score from colloquium_attempts a join roster r on r.id=a.roster_id join colloquium_rooms c on c.id=a.room_id where a.semester_id=${semester} and c.deadline<=clock_timestamp() and a.score is not null`);
  return rows.map(r => ({ fullName: r.full_name as string, groupName: r.group_name as 'G1' | 'G2', score: Number(r.score) })).sort((a, b) => a.fullName.localeCompare(b.fullName, 'sq', { sensitivity: 'base' }));
}
export async function results(session: Session | null) {
  const db = await database();
  await ready(db);
  let semester: string;
  try {
    await requireStaff(session);
    semester = await currentSemester(db);
  }
  catch {
    const who = await actor(db, session);
    if (!who.rosterId || !who.semesterId)
      fail(403, 'registration_required');
    semester = await currentSemester(db);
    if (who.semesterId !== semester)
      fail(403, 'wrong_semester');
  }
  return db.transaction(tx => studentResults(tx, semester));
}
export async function studentState(session: Session | null, input: unknown = {}): Promise<ColloquiumState> {
  const parsed = z.object({ roomId: z.uuid().optional(), token: z.string().max(256).optional() }).safeParse(input);
  if (!parsed.success)
    fail(400, 'invalid_request');
  const db = await database();
  await ready(db);
  return db.transaction(async (tx) => {
    const identity = getSessionIdentity(session);
    const who = identity ? await actor(tx, session) : null;
    const semester = await currentSemester(tx);
    const now = await clock(tx);
    const registered = !!who?.rosterId && who.semesterId === semester;
    const allRooms = await tx.execute(sql`select * from colloquium_rooms where semester_id=${semester} order by group_name`);
    let id = parsed.data.roomId;
    let attempt: Attempt | undefined;
    if (registered && who?.userId) {
      const rows = await tx.execute(sql`select * from colloquium_attempts where semester_id=${semester} and user_id=${who.userId} and week_number=7`);
      attempt = rows[0] as unknown as Attempt | undefined;
      if (!id)
        id = attempt?.room_id;
    }
    const r = id ? await loadRoom(tx, id) : undefined;
    if (r && r.semester_id !== semester)
      fail(403, 'wrong_semester');
    const own = attempt && r && attempt.room_id === r.id ? attempt : undefined;
    if (r && !own)
      await validToken(tx, r, parsed.data.token);
    // All group finalization uses one deterministic lock order. Do not finalize
    // the participant's room first: concurrent G1/G2 reads could deadlock.
    const publishedResults = registered ? await studentResults(tx, semester) : [];
    const view = r ? roomView(r, now) : null;
    return { serverTime: iso(now), room: view, authenticated: !!who, registered, rooms: registered ? allRooms.map(row => roomView(row as unknown as Room, now)) : [], attempt: own ? { id: own.id, submitted: !!own.submitted_at || view?.state === 'finished', answers: own.answers, revisions: own.revisions, revision: own.revision } : null, questions: own && view?.state === 'live' && !own.submitted_at ? publicQuestions(own.question_order, bankFor(r!.bank_version)) : [], results: publishedResults };
  });
}
export async function saveAnswer(session: Session | null, input: unknown) {
  const parsed = z.object({ roomId: z.uuid(), questionId: z.string().min(1).max(100), optionId: z.uuid().nullable(), revision: z.number().int().min(0) }).safeParse(input);
  if (!parsed.success)
    fail(400, 'invalid_request');
  const data = parsed.data;
  const db = await database();
  await ready(db);
  return db.transaction(async (tx) => {
    const who = await actor(tx, session);
    const rows = await tx.execute(sql`select * from colloquium_attempts where room_id=${data.roomId} and user_id=${who.userId ?? null} and roster_id=${who.rosterId ?? null} and semester_id=${who.semesterId ?? null} for update`);
    const a = rows[0] as unknown as Attempt | undefined;
    if (!a)
      fail(403, 'join_required');
    const r = await loadRoom(tx, data.roomId);
    if (r.semester_id !== await currentSemester(tx) || r.semester_id !== who.semesterId)
      fail(403, 'wrong_semester');
    const now = await clock(tx);
    if (!r.started_at)
      fail(409, 'room_not_started');
    if (!r.deadline || milliseconds(now) >= milliseconds(r.deadline) || a.submitted_at)
      fail(409, 'attempt_closed');
    const q = a.question_order.find(x => x.id === data.questionId);
    if (!q || data.optionId !== null && !q.options.some(o => o.id === data.optionId))
      fail(400, 'invalid_answer');
    if ((a.revisions[data.questionId] ?? 0) !== data.revision)
      fail(409, 'stale_answer');
    const revisions = { ...a.revisions, [data.questionId]: data.revision + 1 };
    const answers = { ...a.answers, [data.questionId]: data.optionId };
    // The clock is tested in the UPDATE as well, after any transaction/row lock wait.
    const updated = await tx.execute(sql`update colloquium_attempts set answers=${JSON.stringify(answers)}::jsonb,revisions=${JSON.stringify(revisions)}::jsonb,revision=revision+1 where id=${a.id} and (select deadline from colloquium_rooms where id=${r.id})>clock_timestamp() returning revision`);
    if (!updated.length)
      fail(409, 'attempt_closed');
    return { saved: true, questionId: data.questionId, optionId: data.optionId, questionRevision: revisions[data.questionId], revision: Number(updated[0].revision), serverTime: iso(await clock(tx)) };
  });
}
export async function submitAttempt(session: Session | null, input: unknown) {
  const parsed = z.object({ roomId: z.uuid(), revision: z.number().int().min(0) }).safeParse(input);
  if (!parsed.success)
    fail(400, 'invalid_request');
  const db = await database();
  await ready(db);
  await db.transaction(async (tx) => {
    const who = await actor(tx, session);
    const rows = await tx.execute(sql`select * from colloquium_attempts where room_id=${parsed.data.roomId} and user_id=${who.userId ?? null} and roster_id=${who.rosterId ?? null} and semester_id=${who.semesterId ?? null} for update`);
    const a = rows[0] as unknown as Attempt | undefined;
    if (!a)
      fail(403, 'join_required');
    const r = await loadRoom(tx, parsed.data.roomId);
    if (r.semester_id !== await currentSemester(tx) || r.semester_id !== who.semesterId)
      fail(403, 'wrong_semester');
    if (a.submitted_at)
      return;
    if (!r.started_at)
      fail(409, 'room_not_started');
    if (a.revision !== parsed.data.revision)
      fail(409, 'stale_attempt');
    if (r.deadline && milliseconds(r.deadline) <= milliseconds(await clock(tx))) {
      // This transaction already holds this attempt. Finalize only this row;
      // the subsequent state read safely finalizes all others in a fixed order.
      await tx.execute(sql`update colloquium_attempts set score=${scoreAnswers(a.question_order,a.answers,bankFor(r.bank_version))},submitted_at=coalesce(submitted_at,${r.deadline}) where id=${a.id}`);
      return;
    }
    await tx.execute(sql`update colloquium_attempts set submitted_at=clock_timestamp() where id=${a.id}`);
  });
  return studentState(session, { roomId: parsed.data.roomId });
}
