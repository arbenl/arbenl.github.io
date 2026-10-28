// Real 600-second rehearsal; refuses every non-disposable/non-loopback target.
import assert from 'node:assert/strict';
import { createDecipheriv } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import postgres from 'postgres';
import { encode } from 'next-auth/jwt';

const base = process.env.NEXTAUTH_URL;
const target = new URL(base ?? 'invalid:');
const dbTarget = new URL(process.env.DATABASE_URL ?? 'invalid:');
assert.equal(process.env.COLLOQUIUM_LOAD_DISPOSABLE, '1');
assert.equal(target.hostname, '127.0.0.1');
assert.equal(dbTarget.hostname, '127.0.0.1');
assert.equal(dbTarget.pathname, '/attendance_e2e');
assert.equal(process.env.VERCEL, undefined);
assert.equal(process.env.E2E_TEST_AUTH, undefined, 'Use the actual encrypted assessment, never the synthetic E2E bank');
assert.ok(process.env.COLLOQUIUM_LOAD_REPORT);
const sql = postgres(process.env.DATABASE_URL, { max: 2, onnotice() {} });
const count = 70;
const requests = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const progress = (event, details = {}) => console.log(JSON.stringify({ time: new Date().toISOString(), event, ...details }));

class Client {
  cookies = new Map();
  revision = 0;
  async request(path, { method = 'GET', data, form, expected = 200 } = {}) {
    const started = performance.now();
    const response = await fetch(new URL(path, base), {
      method, redirect: 'manual',
      headers: { origin: target.origin, cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '), ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : data !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: form ? new URLSearchParams(form) : data !== undefined ? JSON.stringify(data) : undefined,
    });
    for (const value of response.headers.getSetCookie()) {
      const pair = value.split(';')[0];
      const at = pair.indexOf('=');
      const key = pair.slice(0, at), cookie = pair.slice(at + 1);
      if (cookie) this.cookies.set(key, cookie); else this.cookies.delete(key);
    }
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { throw new Error(`${method} ${path}: non-JSON response ${response.status}`); }
    requests.push({ path, status: response.status, expected, ms: Math.round(performance.now() - started) });
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(body)}`);
    return body;
  }
}

try {
  // Fixture authority exists only in this disposable database with its own secret.
  await sql`insert into users(github_id,github_username,name) values (${process.env.PROFESSOR_GITHUB_ID},'load-professor','Load Professor')`;
  const teacher = new Client();
  teacher.cookies.set('__Secure-next-auth.session-token', await encode({ secret: process.env.NEXTAUTH_SECRET, maxAge: 3600, token: { githubId: process.env.PROFESSOR_GITHUB_ID, githubLogin: 'load-professor', name: 'Load Professor' } }));
  await teacher.request('/api/admin/bootstrap', { method: 'POST', expected: 201 });
  await teacher.request('/api/admin/course-setup', { method: 'POST' });
  const lobby = await teacher.request('/api/staff/colloquium', { method: 'POST', data: { groupName: 'G1' } });
  const room = lobby.rooms.find(r => r.groupName === 'G1');
  assert.equal(room.state, 'lobby');
  await teacher.request('/api/staff/colloquium', { method: 'POST', data: { groupName: 'G2' } });

  // Decrypt only in this test process to calculate exact expected scores. Never log keys or answers.
  const encrypted = JSON.parse(await readFile(new URL('../private-materials/colloquium-01.encrypted.json', import.meta.url), 'utf8'));
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(process.env.COLLOQUIUM_BANK_KEY, 'hex'), Buffer.from(encrypted.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
  const bank = JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted.data, 'base64')), decipher.final()]).toString());
  assert.equal(bank.length, 10);
  const people = Array.from({ length: count }, (_, i) => ({ client: new Client(), firstName: ['Arta', 'Besa', 'Çlirim', 'Drita', 'Ëndrra', 'Genti', 'Lira'][i % 7], lastName: `Test ${String(i + 1).padStart(3, '0')}`, expectedScore: i % 11 }));
  const enterStarted = performance.now();
  await Promise.all(people.map(async (person, i) => {
    const csrf = await person.client.request('/api/auth/csrf');
    const login = await person.client.request('/api/auth/callback/colloquium', { method: 'POST', form: { csrfToken: csrf.csrfToken, json: 'true', callbackUrl: `${base}/colloquium`, token: room.token, firstName: person.firstName, lastName: person.lastName, studentId: `LOAD-${i + 1}`, email: `load-${i + 1}@example.test` } });
    assert.equal(new URL(login.url).searchParams.get('error'), null, `Student ${i + 1} login failed`);
    const identity = await person.client.request('/api/auth/session');
    assert.equal(identity.user.authMethod, 'classroom');
    assert.ok(identity.user.rosterId);
    const state = await person.client.request('/api/colloquium/join', { method: 'POST', data: { roomId: room.id, token: room.token } });
    assert.equal(state.room.state, 'lobby');
    assert.deepEqual(state.questions, []);
    assert.deepEqual(state.results, []);
  }));
  const lobbyState = await teacher.request('/api/staff/colloquium');
  assert.equal(lobbyState.rooms.find(r => r.id === room.id).joinedCount, count);
  const entryMs = Math.round(performance.now() - enterStarted);
  progress('70_authenticated_and_joined', { count, entryMs });

  const started = await teacher.request(`/api/staff/colloquium/${room.id}/start`, { method: 'POST' });
  const live = started.rooms.find(r => r.id === room.id);
  const deadline = Date.parse(live.deadline);
  assert.equal(deadline - Date.parse(live.startedAt), 600000);
  assert.equal(started.rooms.find(r => r.groupName === 'G2').state, 'lobby');
  progress('real_timer_started', { startedAt: live.startedAt, deadline: live.deadline, durationSeconds: 600 });
  const correctPositions = [0, 0, 0];
  await Promise.all(people.map(async person => {
    const state = await person.client.request('/api/colloquium/state', { method: 'POST', data: {} });
    assert.equal(state.questions.length, 10);
    assert.equal(state.room.deadline, live.deadline);
    assert.ok(!JSON.stringify(state).includes('correctOptionId'));
    assert.ok(!JSON.stringify(state).includes('semanticId'));
    person.questions = state.questions;
    person.answers = {};
    state.questions.forEach((q, j) => {
      const original = bank.find(item => item.id === q.id);
      const correctText = original.options.find(o => o.id === original.correctOptionId).text;
      const correct = q.options.findIndex(o => o.text === correctText);
      correctPositions[correct]++;
      person.answers[q.id] = q.options[j < person.expectedScore ? correct : (correct + 1) % 3].id;
    });
  }));
  for (let questionIndex = 0; questionIndex < 10; questionIndex++) {
    await Promise.all(people.map(async person => {
      const q = person.questions[questionIndex];
      const saved = await person.client.request('/api/colloquium/answer', { method: 'POST', data: { roomId: room.id, questionId: q.id, optionId: person.answers[q.id], revision: 0 } });
      person.client.revision = Math.max(person.client.revision, saved.revision);
      assert.equal(saved.questionRevision, 1);
    }));
    await sleep(500);
  }
  await Promise.all(people.map(async person => {
    const state = await person.client.request('/api/colloquium/state', { method: 'POST', data: {} });
    assert.deepEqual(state.questions, person.questions, 'Refresh reordered choices');
    assert.deepEqual(state.attempt.answers, person.answers, 'Refresh lost answers');
    assert.equal(state.attempt.revision, 10);
  }));
  // Half submit early; the other half leave and are graded automatically after the deadline.
  await Promise.all(people.slice(0, 35).map(person => person.client.request('/api/colloquium/submit', { method: 'POST', data: { roomId: room.id, revision: person.client.revision } })));
  assert.deepEqual(await people[0].client.request('/api/colloquium/results'), []);
  assert.ok(correctPositions.every(n => n > 0));
  progress('700_answers_saved_and_refreshed', { count, answers: 700, earlySubmissions: 35, automaticSubmissions: 35, correctPositions });

  while (deadline - Date.now() > 4000) {
    assert.deepEqual(await people[0].client.request('/api/colloquium/results'), [], 'Scores published before deadline');
    progress('waiting_real_deadline', { secondsRemaining: Math.ceil((deadline - Date.now()) / 1000) });
    await sleep(Math.min(30000, Math.max(1, deadline - Date.now() - 4000)));
  }
  const beforeDeadline = await people[0].client.request('/api/colloquium/state', { method: 'POST', data: {} });
  assert.ok(Date.parse(beforeDeadline.serverTime) < deadline);
  assert.deepEqual(beforeDeadline.results, []);
  await sleep(Math.max(0, deadline - Date.now() + 100));
  const scores = await people[0].client.request('/api/colloquium/results');
  const publishedAt = new Date().toISOString();
  assert.equal(scores.length, count);
  assert.equal(new Set(scores.map(r => r.fullName)).size, count);
  assert.deepEqual(scores.map(r => r.fullName), scores.map(r => r.fullName).sort((a, b) => a.localeCompare(b, 'sq', { sensitivity: 'base' })));
  const expected = new Map(people.map(p => [`${p.firstName} ${p.lastName}`, p.expectedScore]));
  for (const score of scores) {
    assert.deepEqual(Object.keys(score).sort(), ['fullName', 'groupName', 'score']);
    assert.equal(score.groupName, 'G1');
    assert.equal(score.score, expected.get(score.fullName));
  }
  await Promise.all(people.map(async person => assert.deepEqual(await person.client.request('/api/colloquium/results'), scores)));
  const last = people.at(-1), q = last.questions[0];
  await last.client.request('/api/colloquium/answer', { method: 'POST', expected: 409, data: { roomId: room.id, questionId: q.id, optionId: q.options[0].id, revision: 1 } });
  const finalStaff = await teacher.request('/api/staff/colloquium');
  assert.equal(finalStaff.rooms.find(r => r.groupName === 'G2').state, 'lobby');
  const [stored] = await sql`select count(*)::int as count, count(score)::int as scored, count(submitted_at)::int as submitted from colloquium_attempts`;
  assert.deepEqual(stored, { count, scored: count, submitted: count });
  const [attendance] = await sql`select count(*)::int as count from attendance_records`;
  assert.equal(attendance.count, 0, 'Colloquium unexpectedly created attendance');
  const latencies = requests.map(r => r.ms).sort((a, b) => a - b);
  const report = { passed: true, assessment: 'Colloquium I, week 7', sourceCommit: process.env.COLLOQUIUM_LOAD_COMMIT, actualEncryptedBank: true, clientType: '70 independent HTTP clients using real NextAuth Credentials, separate mobile-browser coverage', count, answersSaved: 700, durationSeconds: 600, entryMs, startedAt: live.startedAt, deadline: live.deadline, publishedAt, observedElapsedMs: Date.parse(publishedAt) - Date.parse(live.startedAt), scoresHiddenBeforeDeadline: true, stableOptionsAfterRefresh: true, exactScores: true, earlySubmissions: 35, automaticSubmissions: 35, correctPositions, group2RemainedWaiting: true, attendanceCreated: 0, requests: requests.length, unexpectedStatusCount: requests.filter(r => r.status !== r.expected).length, latencyMs: { p50: latencies[Math.floor(latencies.length * .5)], p95: latencies[Math.floor(latencies.length * .95)], max: latencies.at(-1) }, results: scores };
  await writeFile(process.env.COLLOQUIUM_LOAD_REPORT, JSON.stringify(report, null, 2));
  progress('PASS_70_exact_scores_after_real_600_seconds', { count, requests: report.requests, observedElapsedMs: report.observedElapsedMs, report: process.env.COLLOQUIUM_LOAD_REPORT });
} finally { await sql.end(); }
