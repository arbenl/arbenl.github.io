import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import QRCode from "qrcode";

const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const semesterTitle = "Programimi për Pajisje Mobile · Semestri Dimëror 2026/27";

async function api(page: Page, path: string, method = "GET", data?: unknown) {
  return page.evaluate(async ({ path, method, data }) => {
    const response = await fetch(path, {
      method,
      headers: data === undefined ? undefined : { "content-type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return { status: response.status, body: await response.json() };
  }, { path, method, data });
}

async function signIn(page: Page, persona: "professor" | "studentOne" | "studentTwo") {
  await page.goto("/");
  const result = await api(page, "/api/test/session", "POST", { persona });
  expect(result.status).toBe(200);
  expect((await api(page, "/api/auth/session")).body.user.githubId).toBe(result.body.githubId);
  const cookie = (await page.context().cookies()).find(({ name }) => name === "__Secure-next-auth.session-token");
  expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax" });
}

async function noOverflow(page: Page) {
  const size = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(size.viewport).toBe(page.viewportSize()!.width);
  expect(size.document, "document-level horizontal overflow").toBeLessThanOrEqual(size.viewport);
  expect(size.body, "body-level horizontal overflow").toBeLessThanOrEqual(size.viewport);
}

async function activate(page: Page, firstName: string, lastName: string, studentId: string) {
  await page.getByRole("button", { name: "Aktivizo profilin", exact: true }).waitFor();
  await expect(page.locator('input[name="semesterId"]')).toHaveValue(/.+/);
  await page.getByLabel("Grupi i ushtrimeve", { exact: true }).selectOption("G1");
  await page.getByLabel("Emaili që përdor për Google Drive", { exact: true }).fill(`${studentId.toLowerCase()}@example.com`);
  await page.getByLabel("Shkruaje emailin përsëri", { exact: true }).fill(`${studentId.toLowerCase()}@example.com`);
  await page.getByLabel("Emri", { exact: true }).fill(firstName);
  await page.getByLabel("Mbiemri", { exact: true }).fill(lastName);
  await page.getByLabel("Student ID", { exact: true }).fill(studentId);
  await noOverflow(page);
  await page.getByRole("button", { name: "Aktivizo profilin", exact: true }).click();
}

async function scan(page: Page, token: string) {
  // A camera hands this exact QR fragment URL to the browser. Navigate away first
  // so repeat scans mount the component again instead of only changing the hash.
  await page.goto("/student");
  const response = page.waitForResponse((r) => r.url().endsWith("/api/check-in") && r.request().method() === "POST");
  await page.goto(`/check-in#token=${token}`);
  return response;
}

test.beforeEach(async () => {
  // Config refuses non-loopback/non-disposable databases; every test starts fresh.
  await sql`truncate users, semesters, request_limits restart identity cascade`;
});
test.afterAll(async () => { await sql.end(); });

for (const viewport of [
  { width: 320, height: 700 },
  { width: 375, height: 812 },
  { width: 430, height: 932 },
]) {
  test(`professor and two students: complete flow at ${viewport.width}×${viewport.height}`, async ({ browser, page: professor }) => {
    const studentContext = await browser.newContext({ viewport });
    const secondContext = await browser.newContext({ viewport });
    const student = await studentContext.newPage();
    const second = await secondContext.newPage();
    let projector: Page | undefined;
    try {
      await test.step("synthetic identities and professor bootstrap", async () => {
        await signIn(professor, "professor");
        await signIn(student, "studentOne");
        await signIn(second, "studentTwo");
        expect((await api(professor, "/api/admin/bootstrap", "POST")).status).toBe(201);
        expect((await api(second, "/api/test/session", "POST", { persona: "administrator" })).status).toBe(400);
      });
      let semesterId = "";
      let sessionId = "";
      await test.step("automatic calendar and one-time roster import", async () => {
        await professor.setViewportSize(viewport);
        await professor.goto("/staff");
        await expect(professor.getByRole("heading", { name: "Hap QR-në e orës" })).toBeVisible();
        await expect(professor.getByText("Duke ngarkuar panelin…")).toHaveCount(0);
        semesterId = (await api(professor, "/api/semesters")).body.find((s: { title: string }) => s.title === semesterTitle).id;
        sessionId = (await api(professor, "/api/class-sessions")).body.find((s: { semesterId: string; weekNumber: number; kind: string }) => s.semesterId === semesterId && s.weekNumber === 2 && s.kind === "lecture").id;
        await professor.getByText("Regjistri i studentëve, eksportet dhe administrimi", { exact: true }).click();
        await professor.getByLabel("Student ID, Emri i plotë, Grupi", { exact: true }).fill("E2E-001, Arta Kola, G1");
        await professor.getByRole("button", { name: "Importo të gjithë rreshtat" }).click();
        await expect(professor.getByRole("status")).toHaveText("1 studentë u importuan në një transaksion.");
      });
      let token = "";
      await test.step("authentic projected QR, activation during scan, rank 1 and total 1", async () => {
        const challenge = professor.context().waitForEvent("response", (r) =>
          r.url().endsWith(`/api/class-sessions/${sessionId}/challenge`));
        projector = await professor.context().newPage();
        await projector.setViewportSize(viewport);
        await projector.goto("/staff");
        await projector.locator('a[href="/staff/qr?week=2&kind=lecture"]').click();
        const response = await challenge;
        expect(response.status()).toBe(201);
        token = (await response.json()).token;
        const scanURL = `${process.env.E2E_BASE_URL}/check-in#token=${token}`;
        const qrImage = projector.getByRole("img", { name: "QR për check-in" });
        await expect(qrImage).toBeVisible();
        await noOverflow(projector);
        // Node and browser PNG encoders differ: compare actual QR module pixels.
        const expected = QRCode.create(scanURL, { errorCorrectionLevel: "M" }).modules;
        const actual = await qrImage.evaluate(async (element, size) => {
          const image = element as HTMLImageElement;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d")!;
          context.drawImage(image, 0, 0);
          const scale = canvas.width / (size + 4);
          return Array.from({ length: size * size }, (_, index) => {
            const x = Math.floor((index % size + 2.5) * scale);
            const y = Math.floor((Math.floor(index / size) + 2.5) * scale);
            return context.getImageData(x, y, 1, 1).data[0] < 128 ? 1 : 0;
          });
        }, expected.size);
        expect(actual, "projected QR encodes the issued token URL").toEqual(Array.from(expected.data));
        const unactivated = await scan(student, token);
        expect(unactivated.status()).toBe(409);
        expect((await unactivated.json()).error.code).toBe("roster_not_activated");
        await expect(student.getByRole("heading", { name: "Aktivizo profilin", exact: true })).toBeVisible();
        await expect(student).toHaveURL(/\/check-in$/);
        await activate(student, "Arta", "Kola", "E2E-001");
        await expect(student.getByRole("heading", { name: "Vijueshmëria u konfirmua" })).toBeVisible();
        await noOverflow(student);
        await expect(projector.getByText("Gjithsej", { exact: false })).toHaveText("Gjithsej 1");
        const rankedList = projector.getByRole("list");
        await expect(rankedList.getByRole("listitem")).toHaveCount(1);
        await expect(rankedList.getByRole("listitem").first()).toContainText("Arta K.");
        expect(await rankedList.evaluate((element) => ({
          tag: element.tagName, start: (element as HTMLOListElement).start,
          numbering: getComputedStyle(element).listStyleType,
        }))).toEqual({ tag: "OL", start: 1, numbering: "decimal" });
      });
      await test.step("repeat scan remains one persistent record and one live entry", async () => {
        const repeated = await scan(student, token);
        expect(repeated.status()).toBe(200);
        expect((await repeated.json()).duplicate).toBe(true);
        await expect(student.getByText("Check-in-i ishte regjistruar më parë.")).toBeVisible();
        await noOverflow(student);
        expect(await sql`select id from attendance_records where session_id = ${sessionId}`).toHaveLength(1);
        expect((await api(professor, `/api/class-sessions/${sessionId}/live`)).body.total).toBe(1);
        await expect(projector!.getByRole("listitem")).toHaveCount(1);
      });
      await test.step("second student activation and real server-side QR expiry", async () => {
        await second.goto("/student/activate");
        await activate(second, "Besa", "Duka", "E2E-002");
        await expect(second.getByRole("status")).toHaveText("Profili u aktivizua. Tani mund ta skanosh QR-në.");
        await noOverflow(second);
        // Change only this real token's expiry against the database clock, without sleeping.
        const hash = createHash("sha256").update(token).digest();
        expect(await sql`update qr_challenges set expires_at = statement_timestamp() - interval '1 second'
          where token_hash = ${hash} returning id`).toHaveLength(1);
        const response = await scan(second, token);
        expect(response.status()).toBe(409);
        expect((await response.json()).error.code).toBe("invalid_challenge");
        await expect(second.getByRole("main").getByRole("alert")).toHaveText("QR-ja ka skaduar. Skano kodin e ri në projektor; nëse ora është mbyllur, njofto profesorin.");
        await noOverflow(second);
        expect(await sql`select id from attendance_records where session_id = ${sessionId}`).toHaveLength(1);
      });
      await test.step("students denied staff pages and read/write APIs", async () => {
        for (const path of ["/staff", `/staff/project/${sessionId}`]) {
          await second.goto(path);
          await expect(second.getByRole("heading", { name: "Staff access required" })).toBeVisible();
          await expect(second.getByRole("img", { name: "QR për check-in" })).toHaveCount(0);
          await noOverflow(second);
        }
        for (const path of ["/api/class-sessions", `/api/class-sessions/${sessionId}/records`,
          `/api/class-sessions/${sessionId}/live`, `/api/semesters/${semesterId}/export`]) {
          expect((await api(second, path)).status, path).toBe(403);
        }
        expect((await api(second, "/api/course/launch", "POST", { week: 2, kind: "lecture" })).status).toBe(403);
        expect((await api(second, `/api/class-sessions/${sessionId}/challenge`, "POST")).status).toBe(403);
        expect((await api(second, `/api/class-sessions/${sessionId}/state`, "PATCH", {
          state: "closed", reason: "Unauthorized E2E request",
        })).status).toBe(403);
      });
      await test.step("live failure preserves total and real polling recovers", async () => {
        const livePath = `**/api/class-sessions/${sessionId}/live`;
        await projector!.route(livePath, (route) => route.abort("failed"));
        await expect(projector!.getByRole("status")).toHaveText("të dhënat mund të jenë të vjetruara");
        await expect(projector!.getByText("Gjithsej", { exact: false })).toHaveText("Gjithsej 1");
        await expect(projector!.getByRole("listitem")).toHaveCount(1);
        const recovery = projector!.waitForResponse((r) => r.url().endsWith(`/api/class-sessions/${sessionId}/live`) && r.status() === 200);
        await projector!.unroute(livePath);
        await recovery;
        await expect(projector!.getByText("të dhënat mund të jenë të vjetruara", { exact: true })).toHaveCount(0);
        await expect(projector!.getByText("Gjithsej", { exact: false })).toHaveText("Gjithsej 1");
      });
      await test.step("staff correction updates live/history and stores audit actor/reason/metadata", async () => {
        const [record] = await sql`select id from attendance_records where session_id = ${sessionId}`;
        expect((await api(second, `/api/records/${record.id}`, "PATCH", {
          status: "rejected", reason: "Unauthorized correction",
        })).status).toBe(403);
        await professor.goto(`/staff?sessionId=${sessionId}`);
        await professor.getByLabel("Statusi për Arta Kola", { exact: true }).selectOption("excused");
        await professor.getByLabel("Arsyeja për Arta Kola", { exact: true }).fill("Verified E2E correction");
        const corrected = professor.waitForResponse((r) => r.url().endsWith(`/api/records/${record.id}`) && r.request().method() === "PATCH");
        await professor.getByRole("button", { name: "Ruaj Arta Kola", exact: true }).click();
        expect((await corrected).status()).toBe(200);
        await expect(professor.getByRole("row").filter({ hasText: "Arta Kola" }).locator("span").filter({ hasText: /^I arsyetuar$/ })).toBeVisible();
        await expect(projector!.getByText("Gjithsej", { exact: false })).toHaveText("Gjithsej 0");
        await expect(projector!.getByRole("listitem")).toHaveCount(0);
        const audit = await sql`select a.reason, a.metadata, u.github_id, r.status, r.correction_reason,
            r.verified_by = a.actor_user_id as actor_matches
          from audit_log a join users u on u.id = a.actor_user_id
          join attendance_records r on r.id = a.subject_id
          where a.action = 'attendance.correct' and a.subject_id = ${record.id}`;
        expect(audit).toHaveLength(1);
        expect(audit[0]).toMatchObject({ reason: "Verified E2E correction", metadata: { status: "excused" },
          github_id: "900000001", status: "excused", correction_reason: "Verified E2E correction", actor_matches: true });
        await student.goto("/student");
        await expect(student.getByText("1 e arsyetuar", { exact: true })).toBeVisible();
        await expect(student.getByText("E arsyetuar", { exact: true })).toBeVisible();
        await noOverflow(student);
        await second.goto("/student");
        await expect(second.getByText("Regjistrimi është i hapur", { exact: true })).toBeVisible();
        expect((await api(professor, `/api/class-sessions/${sessionId}/state`, "PATCH", {
          state: "closed", reason: "E2E class ended",
        })).status).toBe(200);
        await second.reload();
        await expect(second.getByText("Mungesë", { exact: true })).toBeVisible();
        await expect(second.getByText("0 e arsyetuar", { exact: true })).toBeVisible();
        await noOverflow(second);
      });
    } finally {
      await projector?.close();
      await studentContext.close();
      await secondContext.close();
    }
  });
}
