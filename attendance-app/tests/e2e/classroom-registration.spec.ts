import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

// Shared config refuses any server/database outside the disposable loopback harness.
const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
async function api(page: Page, path: string, method = "GET", data?: unknown) {
  return page.evaluate(async ({ path, method, data }) => {
    const response = await fetch(path, { method, headers: data === undefined ? undefined : { "content-type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) });
    return { status: response.status, body: await response.json() };
  }, { path, method, data });
}
async function fill(page: Page, email: string, studentId: string, firstName = "Arta", lastName = "Kola") {
  await page.getByLabel("Emri", { exact: true }).fill(firstName);
  await page.getByLabel("Mbiemri", { exact: true }).fill(lastName);
  await page.getByLabel("Student ID", { exact: true }).fill(studentId);
  await page.getByLabel("Grupi i ushtrimeve", { exact: true }).selectOption("G1");
  await page.getByLabel("Emaili i fakultetit ose emaili privat", { exact: true }).fill(email);
}
async function scan(page: Page, token: string) {
  await page.goto(`/check-in#token=${token}`);
  await expect(page.getByRole("form", { name: "Regjistrohu me QR" })).toBeVisible();
  await expect(page).toHaveURL(/\/check-in$/);
}
async function submit(page: Page) {
  await page.getByRole("button", { name: "Regjistrohu dhe konfirmo vijueshmërinë", exact: true }).click();
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
}
async function setup(professor: Page) {
  await professor.goto("/");
  expect((await api(professor, "/api/test/session", "POST", { persona: "professor" })).status).toBe(200);
  expect((await api(professor, "/api/admin/bootstrap", "POST")).status).toBe(201);
  expect((await api(professor, "/api/admin/course-setup", "POST")).status).toBe(200);
  const sessions = (await api(professor, "/api/class-sessions")).body;
  const session = sessions.find((s: { weekNumber: number; kind: string; groupName: string }) => s.weekNumber === 3 && s.kind === "lab" && s.groupName === "G1");
  expect(session).toBeTruthy();
  expect((await api(professor, `/api/class-sessions/${session.id}/state`, "PATCH", { state: "open", reason: "Disposable classroom registration E2E" })).status).toBe(200);
  const challenge = await api(professor, `/api/class-sessions/${session.id}/challenge`, "POST");
  expect(challenge.status).toBe(201);
  expect((await api(professor, "/api/classroom/status")).body).toEqual({ enabled: true });
  return { sessionId: session.id as string, semesterId: session.semesterId as string, token: challenge.body.token as string };
}

test.beforeEach(async () => { await sql`truncate users, semesters, request_limits restart identity cascade`; });
test.afterAll(async () => { await sql.end(); });

for (const width of [320, 375, 430]) {
  test(`anonymous faculty/private email students register, check in and retain profile at ${width}px`, async ({ browser, page: professor }, testInfo) => {
    const { sessionId, semesterId, token } = await setup(professor);
    const [otherSemester] = await sql`insert into semesters (title, week_count, status) values ('Disposable other semester', 1, 'archived') returning id`;
    const [professorUser] = await sql`select id from users where github_id = '900000001'`;
    const [otherSession] = await sql`insert into class_sessions (semester_id, week_number, kind, group_name, title, state, checkin_ends_at, created_by)
      values (${otherSemester.id}, 1, 'lab', 'G1', 'Other scope', 'open', now() + interval '5 minutes', ${professorUser.id}) returning id`;
    const otherToken = 'f'.repeat(64);
    await sql`insert into qr_challenges (session_id, token_hash, expires_at)
      values (${otherSession.id}, ${createHash('sha256').update(otherToken).digest()}, now() + interval '5 minutes')`;
    const [legacyUser] = await sql`insert into users (github_id, github_username, name) values ('900000002', 'e2e-arta', 'Arta Kola') returning id`;
    const [legacyRoster] = await sql`insert into roster (semester_id, student_id, full_name, email, group_name, user_id, activated_at)
      values (${semesterId}, 'CLASS-LEGACY', 'Arta Kola', 'arta@universitetiaab.com', 'G1', ${legacyUser.id}, now()) returning id`;
    const [oldSession] = await sql`select id from class_sessions where semester_id = ${semesterId} and id <> ${sessionId} limit 1`;
    const [oldRecord] = await sql`insert into attendance_records (session_id, roster_id, status, scanned_at) values (${oldSession.id}, ${legacyRoster.id}, 'present', now()) returning *`;
    for (const [email, studentId, firstName, lastName] of [
      ["besa@gmail.com", "CLASS-NEW", "Besa", "Duka"],
      ["arta@universitetiaab.com", "CLASS-LEGACY", "Arta", "Kola"],
    ]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const student = await context.newPage();
      try {
        await student.goto("/student");
        await expect(student.getByText(/Për hyrjen e parë pa GitHub/)).toBeVisible();
        expect((await api(student, "/api/student/history")).status).toBe(401);
        await scan(student, token);
        await fill(student, email, studentId, firstName, lastName);
        if (width === 375 && studentId === "CLASS-NEW") {
          await student.screenshot({ path: testInfo.outputPath("classroom-email-registration.png"), fullPage: true });
        }
        await noOverflow(student);
        let checkedRegistrationOnly = false;
        await student.route("**/api/check-in", async route => {
          expect(await sql`select id from attendance_records where session_id = ${sessionId} and roster_id in (select id from roster where student_id = ${studentId})`).toHaveLength(0);
          checkedRegistrationOnly = true;
          await route.continue();
        });
        await submit(student);
        await expect(student.getByRole("heading", { name: "Vijueshmëria u konfirmua" })).toBeVisible();
        expect(checkedRegistrationOnly).toBe(true);
        await student.unroute("**/api/check-in");
        const identity = (await api(student, "/api/auth/session")).body.user;
        expect(identity).toMatchObject({ authMethod: "classroom", email, semesterId });
        expect(identity.githubId).toBeUndefined();
        expect(identity.githubLogin).toBeUndefined();
        const privateMaterial = await api(student, "/api/staff/materials/week-07/ushtrimet.html");
        expect(privateMaterial.status).toBe(403);
        expect(privateMaterial.body).toEqual({ error: "Hyrja lejohet vetëm për profesorin e autorizuar" });
        expect((await context.cookies()).find(c => c.name === "__Secure-next-auth.session-token")).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax" });
        expect(await student.evaluate(() => ({ local: localStorage.length, handoff: sessionStorage.getItem("attendance-check-in"), hash: location.hash }))).toEqual({ local: 0, handoff: null, hash: "" });
        await student.goto("/student");
        await expect(student.getByText(`${firstName} ${lastName} · G1`)).toBeVisible();
        await expect(student.getByText(/Profili yt është ruajtur/)).toBeVisible();
        const history = (await api(student, "/api/student/history")).body;
        expect(history.profile).toMatchObject({ fullName: `${firstName} ${lastName}`, studentId, email });
        expect(history.sessions.some((s: { id: string; status: string }) => s.id === sessionId && s.status === "present")).toBe(true);
        await noOverflow(student);
        expect((await api(student, "/api/semesters")).body.map((s: { id: string }) => s.id)).toEqual([semesterId]);
        expect((await api(student, "/api/check-in", "POST", { token: otherToken })).status).toBe(403);
        expect((await api(student, "/api/roster/activate", "POST", { semesterId, firstName, lastName, studentId, email, groupName: "G1", beforeClass: true })).status).toBe(403);
        await student.goto(`/check-in#token=${token}`);
        await expect(student.getByRole("heading", { name: "Vijueshmëria u konfirmua" })).toBeVisible();
        await expect(student.getByRole("form")).toHaveCount(0);
        expect(await sql`select id from attendance_records where session_id = ${sessionId} and roster_id = ${identity.rosterId}`).toHaveLength(1);
        for (const [path, method, data] of [
          ["/api/admin/bootstrap", "POST", undefined], ["/api/admin/course-setup", "POST", undefined],
          ["/api/semesters", "POST", { title: "Forbidden", weekCount: 1 }],
          [`/api/class-sessions/${sessionId}/challenge`, "POST", undefined],
        ] as const) expect((await api(student, path, method, data)).status).toBe(403);
        await student.goto("/report");
        await expect(student.getByRole("heading", { name: "Pjesëmarrja dhe detyrat sipas javëve" })).toBeVisible();
      } finally { await context.close(); }
    }
    expect((await sql`select * from attendance_records where id = ${oldRecord.id}`)[0]).toEqual(oldRecord);
    expect((await sql`select github_id, github_username from users where id = ${legacyUser.id}`)[0]).toEqual({ github_id: "900000002", github_username: "e2e-arta" });
    expect((await sql`select id, user_id from roster where student_id = 'CLASS-LEGACY'`)[0]).toEqual({ id: legacyRoster.id, user_id: legacyUser.id });
  });
}

test("expired classroom QR, profile conflicts and staff identity never establish student login", async ({ browser, page: professor }) => {
  const { token, sessionId, semesterId } = await setup(professor);
  const [professorUser] = await sql`select id from users where github_id = '900000001'`;
  await sql`insert into roster (semester_id, student_id, full_name, email, group_name, user_id, activated_at)
    values (${semesterId}, 'CLASS-STAFF', 'E2E Professor', 'professor@example.com', 'G1', ${professorUser.id}, now())`;
  await sql`insert into roster (semester_id, student_id, full_name, email, group_name)
    values (${semesterId}, 'CLASS-CONFLICT', 'Arta Kola', 'original@example.com', 'G1')`;
  for (const [email, studentId, firstName, lastName] of [
    ["wrong@example.com", "CLASS-CONFLICT", "Arta", "Kola"],
    ["professor@example.com", "CLASS-STAFF", "E2E", "Professor"],
    ["expired@example.com", "CLASS-EXPIRED", "Besa", "Duka"],
  ]) {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    try {
      await scan(page, token);
      await fill(page, email, studentId, firstName, lastName);
      if (studentId === "CLASS-EXPIRED") {
        const hash = createHash("sha256").update(token).digest();
        await sql`update qr_challenges set expires_at = now() - interval '1 second' where token_hash = ${hash}`;
      }
      await submit(page);
      await expect(page.getByRole("alert")).toBeVisible();
      expect((await api(page, "/api/auth/session")).body.user).toBeUndefined();
      expect((await api(page, "/api/student/history")).status).toBe(401);
      await expect(page.getByRole("heading", { name: "Vijueshmëria u konfirmua" })).toHaveCount(0);
    } finally { await context.close(); }
  }
  expect(await sql`select * from attendance_records where session_id = ${sessionId}`).toHaveLength(0);
  expect(await sql`select * from roster where student_id = 'CLASS-EXPIRED'`).toHaveLength(0);
  expect((await sql`select email from roster where student_id = 'CLASS-CONFLICT'`)[0].email).toBe("original@example.com");
});
