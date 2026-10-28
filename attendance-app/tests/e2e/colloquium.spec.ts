import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
async function api(page: Page, path: string, data?: unknown) {
 return page.evaluate(async ({ path, data }) => { const response = await fetch(path, { method: data === undefined ? 'GET' : 'POST', headers: data === undefined ? undefined : { 'content-type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) }); return { status: response.status, body: await response.json() }; }, { path, data });
}
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width); }
async function register(page: Page, link: string, firstName: string, lastName: string, id: string, screenshot?: string) {
 await page.goto(link);
 await expect(page.getByRole('form', { name: 'Hyr në kolokvium' })).toBeVisible();
 await expect(page).toHaveURL(/\/colloquium$/);
 if (screenshot) await page.screenshot({ path: screenshot, fullPage: true });
 await page.getByLabel('Emri', { exact: true }).fill(firstName);
 await page.getByLabel('Mbiemri', { exact: true }).fill(lastName);
 await page.getByLabel('Indeksi', { exact: true }).fill(id);
 await page.getByLabel('Emaili i fakultetit ose privat', { exact: true }).fill(`${id}@example.com`);
 await page.getByRole('button', { name: 'Hyr në grup', exact: true }).click();
 await expect(page.getByRole('heading', { name: 'Je në pritje të profesorit' })).toBeVisible();
}
async function setup(professor: Page) {
 await professor.goto('/');
 expect((await api(professor, '/api/test/session', { persona: 'professor' })).status).toBe(200);
 expect((await api(professor, '/api/admin/bootstrap', {})).status).toBe(201);
 expect((await api(professor, '/api/admin/course-setup', {})).status).toBe(200);
 await professor.goto('/staff/colloquium');
 const opened = professor.waitForResponse(response => response.url().endsWith('/api/staff/colloquium') && response.request().method() === 'POST');
 await professor.getByRole('button', { name: 'Hap pritjen për G1' }).click();
 const openResponse = await opened;
 expect(await openResponse.json()).toMatchObject({ rooms: expect.any(Array) });
 expect(openResponse.status()).toBe(200);
 const link = await professor.getByLabel('Lidhja për studentët').inputValue();
 expect(link).toContain('#room=');
 await professor.getByRole('button', { name: 'Hap pritjen për G2' }).click();
 await professor.reload();
 await expect(professor.getByLabel('Lidhja për studentët').first()).toHaveValue(link);
 await expect(professor.getByRole('img', { name: 'QR-ja e grupit për kolokviumin' })).toHaveCount(2);
 return link;
}
test.beforeEach(async () => { await sql`truncate users, semesters, request_limits restart identity cascade`; });
test.afterAll(async () => { await sql.end(); });
for (const width of [320, 375, 430]) {
 test(`registration, shared start, durable answers, early submit and deadline results at ${width}px`, async ({ browser, page: professor }, info) => {
  await professor.setViewportSize({ width, height: 900 });
  const link = await setup(professor);
  await noOverflow(professor);
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const student = await context.newPage();
  try {
   await register(student, link, 'Test', 'Student', `quiz-${width}`, width === 375 ? info.outputPath('colloquium-375-registration.png') : undefined);
   await noOverflow(student);
   expect((await api(student, '/api/colloquium/state', {})).body.questions).toEqual([]);
   await expect(professor.getByText('Test Student', { exact: true })).toBeVisible();
   if (width === 375) { await student.screenshot({ path: info.outputPath('colloquium-375-waiting.png'), fullPage: true }); await professor.screenshot({ path: info.outputPath('colloquium-375-teacher-lobby.png'), fullPage: true }); }
   const before = (await api(professor, '/api/staff/colloquium')).body;
   expect(before.rooms.every((room: { deadline: string | null }) => room.deadline === null)).toBe(true);
   await student.reload();
   await expect(student.getByRole('heading', { name: 'Je në pritje të profesorit' })).toBeVisible();
   await professor.getByRole('button', { name: 'Fillo G1 · 10 minuta' }).click();
   await expect(student.getByRole('radio')).toHaveCount(30);
   const state = (await api(student, '/api/colloquium/state', {})).body;
   expect(Date.parse(state.room.deadline) - Date.parse(state.room.startedAt)).toBe(600000);
   const staff = (await api(professor, '/api/staff/colloquium')).body;
   expect(staff.rooms.find((room: { groupName: string }) => room.groupName === 'G2').state).toBe('lobby');
   const displayedChoices = await student.locator('.cq-option').allTextContents();
   expect(displayedChoices.every((text, index) => text.startsWith(`${['A', 'B', 'C'][index % 3]}. `))).toBe(true);
   const choice = student.getByRole('radio').first();
   const optionId = await choice.getAttribute('value');
   await choice.check();
   await expect(student.getByText('Të gjitha përgjigjet u ruajtën')).toBeVisible();
   await student.reload();
   await expect(student.locator(`input[value="${optionId}"]`)).toBeChecked();
   expect(await student.locator(".cq-option").allTextContents()).toEqual(displayedChoices);
   await noOverflow(student);
   await student.screenshot({ path: info.outputPath(`colloquium-${width}-live.png`), fullPage: true });
   // Explicit failure and retry exercise real server recovery without losing the local click.
   await student.route('**/api/colloquium/answer', route => route.abort());
   await student.getByRole('radio').nth(1).check();
   await expect(student.getByText(/Ruajtja dështoi/)).toBeVisible();
   await student.waitForTimeout(2700);
   await expect(student.getByRole('radio').nth(1)).toBeChecked();
   await student.unroute('**/api/colloquium/answer');
   await student.getByRole('button', { name: 'Provo ruajtjen përsëri', exact: true }).click();
   await expect(student.getByText('Të gjitha përgjigjet u ruajtën')).toBeVisible();
   // Delay the last save: confirmation must flush it before expected-revision submit.
   await student.route('**/api/colloquium/answer', async route => { await new Promise(resolve => setTimeout(resolve, 400)); await route.continue(); });
   await student.getByRole('radio').nth(3).check();
   await student.getByRole('button', { name: 'Dorëzo para përfundimit' }).click();
   await student.getByRole('button', { name: 'Po, dorëzo përgjigjet' }).click();
   await expect(student.getByRole('heading', { name: 'Përgjigjet u dorëzuan' })).toBeVisible();
   const submitted = (await api(student, '/api/colloquium/state', {})).body;
   expect(submitted.attempt.revision).toBe(3);
   expect(submitted.results).toEqual([]);
   expect(submitted.questions).toEqual([]);
   // Accelerated expiration is confined to this disposable loopback database.
   await sql`update colloquium_rooms set started_at = now() - interval '601 seconds', deadline = now() - interval '1 second' where group_name = 'G1'`;
   await expect(student.getByRole('cell', { name: /\/10$/ })).toBeVisible();
   await expect(student.getByRole('rowheader', { name: 'Test Student' })).toBeVisible();
   await expect(professor.getByRole('rowheader', { name: 'Test Student' })).toBeVisible();
   await noOverflow(professor);
   await student.reload();
   await expect(student.getByRole('rowheader', { name: 'Test Student' })).toBeVisible();
   await noOverflow(student);
   await student.screenshot({ path: info.outputPath(`colloquium-${width}-results.png`), fullPage: true });
   expect(await student.locator('main').innerText()).not.toContain('@example.com');
   expect(await student.evaluate(() => localStorage.length)).toBe(0);
  } finally { await context.close(); }
 });
}
test('remembered canonical profile enters directly and results sort names after deadline', async ({ browser, page: professor }) => {
 const link = await setup(professor);
 const first = await browser.newContext({ viewport: { width: 375, height: 812 } });
 const second = await browser.newContext({ viewport: { width: 375, height: 812 } });
 try {
  const arta = await first.newPage(); const besa = await second.newPage();
  await register(arta, link, 'Arta', 'Test', 'arta');
  await register(besa, link, 'Besa', 'Test', 'besa');
  await arta.goto('/student');
  await arta.goto(link);
  await expect(arta.getByRole('heading', { name: 'Je në pritje të profesorit' })).toBeVisible();
  await expect(arta.getByRole('form')).toHaveCount(0);
  await professor.getByRole('button', { name: 'Fillo G1 · 10 minuta' }).click();
  await expect(arta.getByRole('radio')).toHaveCount(30);
  await arta.getByRole('radio').first().check();
  await expect(arta.getByText('Të gjitha përgjigjet u ruajtën')).toBeVisible();
  await sql`update colloquium_rooms set started_at = now() - interval '601 seconds', deadline = now() - interval '1 second' where group_name = 'G1'`;
  await expect(arta.getByRole('rowheader')).toHaveText(['Arta Test', 'Besa Test']);
  expect((await api(arta, '/api/colloquium/results')).body.every((row: object) => Object.keys(row).sort().join(',') === 'fullName,groupName,score')).toBe(true);
 } finally { await first.close(); await second.close(); }
});
