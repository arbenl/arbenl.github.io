import { randomUUID } from 'node:crypto';
import type { Session } from 'next-auth';
import postgres from 'postgres';
import { beforeEach, afterAll, expect, it, vi } from 'vitest';
import { sql as query } from 'drizzle-orm';
vi.mock('../../lib/colloquium/bank', () => ({ getQuestionBank: () => Array.from({ length: 10 }, (_, i) => ({ id: `q${i}`, prompt: `Pyetje ${i}`, source: 'Synthetic test only', correctOptionId: 'correct', options: [{ id: 'correct', text: 'A' }, { id: 'wrong1', text: 'B' }, { id: 'wrong2', text: 'C' }] })) }));
import { staffState, openLobby, startRoom, registerColloquiumStudent, joinRoom, studentState, saveAnswer, submitAttempt, results } from '../../lib/colloquium/service';
import { CURRENT_COURSE } from '../../lib/attendance/current-course';
import { db } from '../../lib/db/client';
import { ensureColloquiumSchema } from '../../lib/colloquium/schema';
import { requireColloquiumOrigin } from '../../lib/colloquium/http';
const sql = postgres(process.env.DATABASE_URL!, { max: 10, onnotice: () => {
  } });
const professor: Session = { expires: '2099-01-01', user: { githubId: '100', githubLogin: 'professor' } };
let semester: string;
beforeEach(async () => {
  await sql`truncate users,semesters restart identity cascade`;
  await sql`truncate request_limits`;
  const [u] = await sql`insert into users(github_id,github_username) values ('100','professor') returning id`;
  await sql`insert into staff(user_id,added_by) values (${u.id},${u.id})`;
  const [s] = await sql`insert into semesters(title,week_count,status) values (${CURRENT_COURSE.title},15,'active') returning id`;
  semester = s.id;
});
afterAll(() => sql.end());
async function lobby(groupName: 'G1' | 'G2' = 'G1') {
  return (await openLobby(professor, { groupName })).rooms.find(r => r.groupName === groupName)!;
}
async function enroll(token: string, n = 1) {
  const person = await registerColloquiumStudent({ token, email: `student${n}@example.test`, firstName: 'Arta', lastName: `Test ${n}`, studentId: `S-${n}` }, '192.0.2.1');
  const session: Session = { expires: '2099-01-01', user: { ...person, userId: person.id } };
  return { person, session };
}
async function expire(roomId: string) {
  await sql`update colloquium_rooms set started_at=statement_timestamp()-interval '601 seconds',deadline=statement_timestamp()-interval '1 second' where id=${roomId}`;
}
it('creates idempotent recoverable group lobby, never starts until explicit staff start, never resets', async () => {
  const r = await lobby();
  const again = await lobby();
  expect(again.id).toBe(r.id);
  expect(again.token).toBe(r.token);
  expect(r.state).toBe('lobby');
  expect(r.deadline).toBeNull();
  expect((await studentState(null, { roomId: r.id, token: r.token })).questions).toEqual([]);
  const before = Date.now();
  await startRoom(professor, r.id);
  const [row] = await sql`select started_at,deadline from colloquium_rooms where id=${r.id}`;
  expect(row.deadline - row.started_at).toBe(600000);
  expect(+row.started_at).toBeGreaterThanOrEqual(before - 1000);
  await startRoom(professor, r.id);
  expect((await sql`select started_at from colloquium_rooms where id=${r.id}`)[0].started_at).toEqual(row.started_at);
});
it('registers inline independent of QR/attendance, preserves existing linked canonical roster/group/marks', async () => {
  const r = await lobby();
  const { person, session } = await enroll(r.token);
  expect(await sql`select id from attendance_records`).toHaveLength(0);
  expect(await sql`select id from qr_challenges`).toHaveLength(0);
  await sql`update roster set group_name='G2' where id=${person.rosterId}`;
  expect((await enroll(r.token)).person.id).toBe(person.id);
  expect((await sql`select group_name from roster where id=${person.rosterId}`)[0].group_name).toBe('G2');
  const state = await joinRoom(session, { roomId: r.id, token: r.token });
  expect(state.attempt).not.toBeNull();
  expect(state.questions).toEqual([]);
  expect((await staffState(professor)).rooms[0].joinedCount).toBe(1);
});
it('exposes persistent opaque options only after start; enforces revisions and submit flush; grades offline without early result', async () => {
  const r = await lobby();
  const { session } = await enroll(r.token);
  await joinRoom(session, { roomId: r.id, token: r.token });
  await startRoom(professor, r.id);
  const state = await studentState(session, { roomId: r.id });
  expect(state.questions).toHaveLength(10);
  expect(JSON.stringify(state)).not.toContain('correct');
  expect(JSON.stringify(state)).not.toContain('Synthetic');
  expect((await studentState(session, { roomId: r.id })).questions).toEqual(state.questions);
  const [attempt] = await sql`select question_order from colloquium_attempts`;
  const q = attempt.question_order[0], answer = q.options.find((o: {
    semanticId: string;
  }) => o.semanticId === 'correct').id;
  await saveAnswer(session, { roomId: r.id, questionId: q.id, optionId: answer, revision: 0 });
  await expect(saveAnswer(session, { roomId: r.id, questionId: q.id, optionId: null, revision: 0 })).rejects.toMatchObject({ code: 'stale_answer' });
  await expect(submitAttempt(session, { roomId: r.id, revision: 0 })).rejects.toMatchObject({ code: 'stale_attempt' });
  await submitAttempt(session, { roomId: r.id, revision: 1 });
  expect(await results(session)).toEqual([]);
  expect((await studentState(session, { roomId: r.id })).attempt?.submitted).toBe(true);
  await expire(r.id);
  expect(await results(session)).toEqual([{ fullName: 'Arta Test 1', groupName: 'G1', score: 1 }]);
  expect((await sql`select score from colloquium_attempts`)[0].score).toBe(1);
});
it('rejects invalid options, duplicate crossgroup attempts, unjoined/signedout/staff mutations and expired room changes', async () => {
  const r = await lobby(), g2 = await lobby('G2'), { session } = await enroll(r.token);
  await expect(joinRoom(null, { roomId: r.id, token: r.token })).rejects.toMatchObject({ status: 401 });
  await expect(joinRoom(professor, { roomId: r.id, token: r.token })).rejects.toMatchObject({ status: 403 });
  await joinRoom(session, { roomId: r.id, token: r.token });
  await expect(joinRoom(session, { roomId: g2.id, token: g2.token })).rejects.toMatchObject({ code: 'attempt_exists' });
  await startRoom(professor, r.id);
  await expect(saveAnswer(session, { roomId: r.id, questionId: 'q0', optionId: randomUUID(), revision: 0 })).rejects.toMatchObject({ code: 'invalid_answer' });
  await expire(r.id);
  await expect(saveAnswer(session, { roomId: r.id, questionId: 'q0', optionId: null, revision: 0 })).rejects.toMatchObject({ code: 'attempt_closed' });
  expect((await results(session))[0].score).toBe(0);
  expect((await staffState(professor)).rooms.find(x => x.id === g2.id)?.state).toBe('lobby');
});
it('supports 70 concurrent students behind campus NAT, duplicatejoins, independent answer writes', async () => {
  const r = await lobby();
  const people = await Promise.all(Array.from({ length: 70 }, (_, i) => enroll(r.token, i)));
  await Promise.all(people.map(({ session }) => joinRoom(session, { roomId: r.id, token: r.token })));
  await Promise.all(Array.from({ length: 5 }, () => joinRoom(people[0].session, { roomId: r.id, token: r.token })));
  expect(await sql`select id from colloquium_attempts`).toHaveLength(70);
  await startRoom(professor, r.id);
  await Promise.all(people.map(async ({ session }) => {
    const state = await studentState(session, { roomId: r.id });
    await Promise.all(state.questions.map(q => saveAnswer(session, { roomId: r.id, questionId: q.id, optionId: q.options[0].id, revision: 0 })));
  }));
  expect((await sql`select count(*)::int as n from colloquium_attempts where revision=10`)[0].n).toBe(70);
  await expire(r.id);
  const output = await results(people[0].session);
  expect(output).toHaveLength(70);
  expect(output.map(x => x.fullName)).toEqual(output.map(x => x.fullName).sort((a, b) => a.localeCompare(b, 'sq', { sensitivity: 'base' })));
  expect(JSON.stringify(output)).not.toMatch(/email|student_id|roster/i);
}, 60000);
it('denies professor/staff enrollment and conflicting profiles', async () => {
  const r = await lobby();
  const [u] = await sql`select id from users where github_id='100'`;
  await sql`insert into roster(semester_id,student_id,full_name,email,group_name,user_id,activated_at) values (${semester},'S-1','Arta Test 1','student1@example.test','G1',${u.id},clock_timestamp())`;
  await expect(enroll(r.token)).rejects.toMatchObject({ code: 'staff_forbidden' });
  await sql`delete from roster`;
  await enroll(r.token);
  await expect(registerColloquiumStudent({ token: r.token, email: 'other@example.test', firstName: 'Arta', lastName: 'Test 1', studentId: 'S-1' }, '1')).rejects.toMatchObject({ code: 'profile_conflict' });
});
it('denies staff action without instructor identity and validates origin+host', async () => {
  await expect(openLobby(null, { groupName: 'G1' })).rejects.toMatchObject({ status: 401 });
  const r = await lobby(), { session } = await enroll(r.token);
  await expect(startRoom(session, r.id)).rejects.toMatchObject({ status: 403 });
  await expect(results(null)).rejects.toMatchObject({ status: 401 });
  const make = (origin: string, host: string, url = 'http://127.0.0.1:3000/api/colloquium/join') => new Request(url, { headers: { origin, host } });
  expect(() => requireColloquiumOrigin(make('https://evil.example', '127.0.0.1:3000'))).toThrow();
  expect(() => requireColloquiumOrigin(make('http://127.0.0.1:3000', 'evil.example'))).toThrow();
  expect(() => requireColloquiumOrigin(make('http://127.0.0.1:3000', '127.0.0.1:3000'))).not.toThrow();
  // Next.js may reconstruct an internal localhost URL behind the canonical host.
  expect(() => requireColloquiumOrigin(make('http://127.0.0.1:3000', '127.0.0.1:3000', 'http://localhost:3000/api/staff/colloquium'))).not.toThrow();
  expect(() => requireColloquiumOrigin(make('https://evil.example', '127.0.0.1:3000', 'http://localhost:3000/api/staff/colloquium'))).toThrow();
  expect(() => requireColloquiumOrigin(make('http://127.0.0.1:3000', 'evil.example', 'http://localhost:3000/api/staff/colloquium'))).toThrow();
});
it('schema helper is idempotent and avoids access-exclusive tablelocks after migration', async () => {
  await db.transaction(async (tx) => {
    await ensureColloquiumSchema(tx);
    await ensureColloquiumSchema(tx);
    expect(await tx.execute(query `select mode from pg_locks where pid=pg_backend_pid() and mode='AccessExclusiveLock' and relation in ('users'::regclass,'colloquium_rooms'::regclass,'colloquium_attempts'::regclass)`)).toHaveLength(0);
  });
});
it('rejects a late answer after waiting for the attempt rowlock', async () => {
  const r = await lobby(), { session } = await enroll(r.token);
  await joinRoom(session, { roomId: r.id, token: r.token });
  await startRoom(professor, r.id);
  let saving: ReturnType<typeof saveAnswer>;
  await sql.begin(async (tx) => {
    await tx `select id from colloquium_attempts where room_id=${r.id} for update`;
    saving = saveAnswer(session, { roomId: r.id, questionId: 'q0', optionId: null, revision: 0 });
    void saving.catch(() => {
    });
    for (let i = 0; i < 100; i++) {
      const waiting = await tx `select pid from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and pid<>pg_backend_pid()`;
      if (waiting.length)
        break;
      if (i === 99)
        throw new Error('Answer did not wait for lock');
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    await tx `update colloquium_rooms set started_at=statement_timestamp()-interval '601 seconds',deadline=statement_timestamp()-interval '1 second' where id=${r.id}`;
  });
  await expect(saving!).rejects.toMatchObject({ code: 'attempt_closed' });
  expect((await sql`select revision from colloquium_attempts`)[0].revision).toBe(0);
});
it('simultaneous stale requests for one question accept exactly one and keep later sequential edit', async () => {
  const r = await lobby(), { session } = await enroll(r.token);
  await joinRoom(session, { roomId: r.id, token: r.token });
  await startRoom(professor, r.id);
  const state = await studentState(session, { roomId: r.id });
  const q = state.questions[0];
  const response = await Promise.allSettled(q.options.map(o => saveAnswer(session, { roomId: r.id, questionId: q.id, optionId: o.id, revision: 0 })));
  expect(response.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  await saveAnswer(session, { roomId: r.id, questionId: q.id, optionId: q.options[2].id, revision: 1 });
  const refreshed = await studentState(session, { roomId: r.id });
  expect(refreshed.attempt?.answers[q.id]).toBe(q.options[2].id);
  expect(refreshed.attempt?.revision).toBe(2);
});
it('linked GitHub and classroom sessions resolve to the same attempt regardless of group', async () => {
  const r = await lobby(), { session, person } = await enroll(r.token);
  await sql`update users set github_id='200',github_username='old' where id=${person.id}`;
  await sql`update roster set group_name='G2' where id=${person.rosterId}`;
  const github: Session = { expires: '2099-01-01', user: { githubId: '200', githubLogin: 'old' } };
  const joined = await joinRoom(github, { roomId: r.id, token: r.token });
  expect((await studentState(session, {})).attempt?.id).toBe(joined.attempt?.id);
  expect(await sql`select id from roster`).toHaveLength(1);
});
it('serializes concurrent cold instructor schema setup without public DDL',async()=>{
 await sql`drop table colloquium_attempts`;await sql`drop table colloquium_rooms`;
 await expect(studentState(null,{})).rejects.toMatchObject({code:'colloquium_unavailable'});
 const states=await Promise.all([openLobby(professor,{groupName:'G1'}),openLobby(professor,{groupName:'G2'}),staffState(professor)]);expect(states).toHaveLength(3);expect((await staffState(professor)).rooms).toHaveLength(2);expect(await sql`select id from users`).toHaveLength(1);
});
it('publishes both groups under concurrent state and late-submit reads without lock-order cycles',async()=>{
 const one=await lobby(),two=await lobby('G2');const people=await Promise.all(Array.from({length:8},async(_,i)=>{const room=i%2?one:two;const p=await enroll(room.token,100+i);await joinRoom(p.session,{roomId:room.id,token:room.token});return {...p,room};}));
 await startRoom(professor,one.id);await startRoom(professor,two.id);await expire(one.id);await expire(two.id);
 const responses=await Promise.all(people.map(({session,room},i)=>i%2?submitAttempt(session,{roomId:room.id,revision:0}):studentState(session,{roomId:room.id})));expect(responses.every(r=>r.results.length===8)).toBe(true);expect(await results(people[0].session)).toHaveLength(8);
},30000);
it.each(['answer', 'submit'] as const)('denies %s mutation from another-semester classroom session for the same canonical user', async action => {
  const room = await lobby();
  const { session, person } = await enroll(room.token);
  const [otherSemester] = await sql`insert into semesters(title,week_count,status) values ('Earlier semester',15,'archived') returning id`;
  const [otherRoster] = await sql`insert into roster(semester_id,student_id,full_name,email,group_name,user_id,activated_at) values (${otherSemester.id},'S-1','Arta Test 1','student1@example.test','G1',${person.id},clock_timestamp()) returning id`;
  const oldSession: Session = { expires: '2099-01-01', user: { authMethod: 'classroom', userId: person.id, rosterId: otherRoster.id, semesterId: otherSemester.id, email: person.email } };
  await joinRoom(session, { roomId: room.id, token: room.token });
  await startRoom(professor, room.id);
  const state = await studentState(session, { roomId: room.id });
  const question = state.questions[0];
  await saveAnswer(session, { roomId: room.id, questionId: question.id, optionId: question.options[0].id, revision: 0 });
  const before = await sql`select answers,revisions,revision,submitted_at,score from colloquium_attempts where room_id=${room.id}`;
  const mutation = action === 'answer'
    ? saveAnswer(oldSession, { roomId: room.id, questionId: question.id, optionId: question.options[1].id, revision: 1 })
    : submitAttempt(oldSession, { roomId: room.id, revision: 1 });
  await expect(mutation).rejects.toMatchObject({ status: 403 });
  expect(await sql`select answers,revisions,revision,submitted_at,score from colloquium_attempts where room_id=${room.id}`).toEqual(before);
  // The linked current-course GitHub identity retains mutation access.
  await sql`update users set github_id='200',github_username='linked' where id=${person.id}`;
  const github: Session = { expires: '2099-01-01', user: { githubId: '200', githubLogin: 'linked' } };
  await saveAnswer(github, { roomId: room.id, questionId: question.id, optionId: question.options[2].id, revision: 1 });
  await submitAttempt(session, { roomId: room.id, revision: 2 });
  expect((await studentState(github, { roomId: room.id })).attempt?.submitted).toBe(true);
});
