import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const endpoint = '/api/staff/colloquium/preview';
async function api(page: Page, path: string, data: unknown) {
 return page.evaluate(async ({ path, data }) => {
  const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
  return { status: response.status, body: await response.json() };
 }, { path, data });
}
async function officialSnapshot() {
 const tables = await sql<{ table_name: string }[]>`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`;
 const snapshot: Record<string, unknown> = {};
 for (const { table_name } of tables) {
  const rows = await sql`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]'::jsonb) as rows from ${sql(table_name)} as t`;
  snapshot[table_name] = rows[0].rows;
 }
 return snapshot;
}
test.beforeEach(async () => { await sql`truncate users, semesters, request_limits restart identity cascade`; });
test.afterAll(async () => { await sql.end(); });
test('private mobile professor trial accepts GABIM, grades and restarts with every official table unchanged', async ({ browser, page: professor }, info) => {
 await professor.setViewportSize({ width: 375, height: 812 });
 await professor.clock.install();
 await professor.goto('/');
 expect((await api(professor, '/api/test/session', { persona: 'professor' })).status).toBe(200);
 expect((await api(professor, '/api/admin/bootstrap', {})).status).toBe(201);
 expect((await api(professor, '/api/admin/course-setup', {})).status).toBe(200);
 for (const groupName of ['G1', 'G2']) expect((await api(professor, '/api/staff/colloquium', { groupName })).status).toBe(200);
 const anonymousContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
 const studentContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
 try {
  const anonymous = await anonymousContext.newPage(); const student = await studentContext.newPage();
  await anonymous.goto('/'); await student.goto('/');
  expect((await api(student, '/api/test/session', { persona: 'studentOne' })).status).toBe(200);
  const before = await officialSnapshot();
  for (const [page, status] of [[anonymous, 401], [student, 403]] as const) {
   for (const body of [{ action: 'start', studentId: 'GABIM' }, { action: 'grade', proof: 'untrusted', answers: {} }]) expect((await api(page, endpoint, body)).status).toBe(status);
   await page.goto('/staff/colloquium/preview');
   await expect(page.getByRole('heading', { name: 'Hyrja e profesorit' })).toBeVisible();
   await expect(page.getByRole('radio')).toHaveCount(0);
  }
  await professor.goto('/staff/colloquium');
  await professor.getByRole('link', { name: 'Hap provën private · pa ndikim në G1/G2' }).click();
  await expect(professor.getByRole('heading', { name: 'Provë private e profesorit' })).toBeVisible();
  await professor.getByLabel('Indeksi i provës').fill('GABIM');
  const started = professor.waitForResponse(response => response.url().endsWith(endpoint));
  await professor.getByRole('button', { name: 'Fillo provën private', exact: true }).click();
  const run = await (await started).json();
  expect(Date.parse(run.deadline) - Date.parse(run.serverTime)).toBe(600000);
  expect(run.studentId).toBe('GABIM');
  expect(run.private).toBe(true);
  expect(JSON.stringify(run)).not.toContain('testonly-');
  expect(JSON.stringify(run)).not.toContain('semanticId');
  expect(JSON.stringify(run)).not.toContain('correctOptionId');
  await expect(professor.getByRole('radio')).toHaveCount(30);
  await expect(professor.getByLabel('Koha e mbetur')).toHaveText(/^(10:00|09:59)$/);
  expect(await professor.locator('.cq-option').allTextContents()).toEqual(expect.arrayContaining([expect.stringMatching(/^A\. /), expect.stringMatching(/^B\. /), expect.stringMatching(/^C\. /)]));
  for (const choice of await professor.getByRole('radio', { name: /Përgjigjja e provës/ }).all()) await choice.check();
  expect(await professor.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await professor.getByRole('button', { name: 'Përfundo provën' }).click();
  await expect(professor.getByText('10/10', { exact: true })).toBeVisible();
  await professor.screenshot({ path: info.outputPath('private-preview-375-result.png'), fullPage: true });
  const restarted = professor.waitForResponse(response => response.url().endsWith(endpoint));
  await professor.getByRole('button', { name: 'Rifillo provën' }).click();
  const next = await (await restarted).json();
  expect(next.proof).not.toBe(run.proof);
  expect(next.questions.map((q: { id: string }) => q.id)).not.toEqual(run.questions.map((q: { id: string }) => q.id));
  expect(Date.parse(next.deadline)).toBeGreaterThan(Date.parse(run.deadline));
  await expect(professor.getByRole('radio')).toHaveCount(30);
  await expect(professor.locator('input[type=radio]:checked')).toHaveCount(0);
  await expect(professor.getByText('10/10', { exact: true })).toHaveCount(0);
  await professor.screenshot({ path: info.outputPath('private-preview-375-restarted.png'), fullPage: true });
  // Advance only the disposable browser clock; server time and official exam rooms stay unchanged.
  await professor.clock.fastForward(601000);
  await expect(professor.getByText('0/10', { exact: true })).toBeVisible();
  expect(await professor.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  await professor.reload();
  await expect(professor.getByLabel('Indeksi i provës')).toHaveValue('PROVE-001');
  await expect(professor.getByRole('radio')).toHaveCount(0);
  expect(await officialSnapshot()).toEqual(before);
 } finally { await anonymousContext.close(); await studentContext.close(); }
});
