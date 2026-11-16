import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
async function api(page: Page, path: string, method = "GET", data?: unknown) {
  return page.evaluate(
    async ({ path, method, data }) => {
      const r = await fetch(path, {
        method,
        headers: data ? { "content-type": "application/json" } : undefined,
        body: data ? JSON.stringify(data) : undefined,
      });
      return { status: r.status, body: await r.json() };
    },
    { path, method, data },
  );
}
async function setup(page: Page) {
  await page.goto("/");
  expect(
    (await api(page, "/api/test/session", "POST", { persona: "professor" }))
      .status,
  ).toBe(200);
  expect((await api(page, "/api/admin/bootstrap", "POST")).status).toBe(201);
  expect((await api(page, "/api/admin/course-setup", "POST")).status).toBe(200);
  const [hour] =
    await sql`select id,semester_id from class_sessions where week_number=10 and kind='lab' and group_name='G1'`;
  expect(
    (
      await api(page, `/api/class-sessions/${hour.id}/state`, "PATCH", {
        state: "open",
        reason: "Isolated student-entry audit",
      })
    ).status,
  ).toBe(200);
  const challenge = await api(
    page,
    `/api/class-sessions/${hour.id}/challenge`,
    "POST",
  );
  expect(challenge.status).toBe(201);
  return {
    token: challenge.body.token as string,
    semesterId: hour.semester_id as string,
    sessionId: hour.id as string,
  };
}
async function fill(page: Page, name: string, id: string, email: string) {
  await page.getByLabel("Emri", { exact: true }).fill(name);
  await page.getByLabel("Mbiemri", { exact: true }).fill("Prova");
  await page.getByLabel("Student ID", { exact: true }).fill(id);
  await page
    .getByLabel("Grupi i ushtrimeve", { exact: true })
    .selectOption("G2");
  await page
    .getByLabel("Emaili i fakultetit ose emaili privat", { exact: true })
    .fill(email);
}
async function fits(page: Page, width: number) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(width);
}
test.beforeEach(async () => {
  await sql`truncate users,semesters,request_limits restart identity cascade`;
});
test.afterAll(async () => {
  await sql.end();
});
for (const width of [320, 375, 430, 1280])
  test(`QR refresh, failure recovery, own card and shared-browser switching at ${width}px`, async ({
    browser,
    page: professor,
  }, info) => {
    const { token, sessionId } = await setup(professor);
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    const student = await context.newPage();
    const errors: string[] = [];
    student.on("pageerror", (e) => errors.push(e.message));
    try {
      await student.goto("/progress");
      await expect(
        student.getByRole("heading", {
          name: "Karta e studentit",
          exact: true,
        }),
      ).toBeVisible();
      await student.screenshot({
        path: info.outputPath(`01-student-entry-${width}.png`),
      });
      await student.route("**/api/classroom/status", (route) => route.abort());
      await student.goto(`/check-in#token=${token}`);
      await expect(
        student.getByRole("button", { name: "Provo përsëri", exact: true }),
      ).toBeVisible();
      await student.unroute("**/api/classroom/status");
      await student
        .getByRole("button", { name: "Provo përsëri", exact: true })
        .click();
      await expect(
        student.getByRole("form", { name: "Regjistrohu me QR" }),
      ).toBeVisible();
      await student.reload();
      await expect(
        student.getByRole("form", { name: "Regjistrohu me QR" }),
      ).toBeVisible();
      await fill(student, "Besa", "AUDIT-BESA", "besa.audit@gmail.com");
      await fits(student, width);
      await student.screenshot({
        path: info.outputPath(`02-qr-registration-${width}.png`),
      });
      await student
        .getByRole("button", { name: "Regjistrohu dhe konfirmo vijueshmërinë" })
        .click();
      await expect(
        student.getByRole("heading", { name: "Vijueshmëria u konfirmua" }),
      ).toBeVisible();
      await student.getByRole("link", { name: "Hap kartën time →" }).click();
      await expect(
        student.getByRole("heading", { name: "Besa Prova", exact: true }),
      ).toBeVisible();
      await expect(
        student.getByText("Karta jote", { exact: true }),
      ).toBeVisible();
      await student.screenshot({
        path: info.outputPath(`03-own-card-${width}.png`),
      });
      const ownCard=student.locator('.identity-card');
      await expect(ownCard.getByText('Lidh GitHub-in dhe repository-n tim',{exact:true})).toBeVisible();
      await fits(student, width);
      // A failed optional GitHub read must be recoverable without replacing the session.
      await student.route("**/api/student/github-link", (route) =>
        route.abort(),
      );
      await student.reload();
      await expect(
        student.getByRole("button", { name: "Provo ngarkimin përsëri" }),
      ).toBeVisible();
      await student.unroute("**/api/student/github-link");
      await student
        .getByRole("button", { name: "Provo ngarkimin përsëri" })
        .click();
      await expect(
        student.getByRole("button", { name: "Lidh GitHub-in tim" }),
      ).toBeEnabled();
      await student.goto("/student");
      await expect(student.getByText("Besa Prova · G2")).toBeVisible();
      await student.screenshot({
        path: info.outputPath(`04-student-history-${width}.png`),
      });
      expect((await student.getByRole('button',{name:'Dil / Ndërro llogarinë'}).boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await student
        .getByRole("button", { name: "Dil / Ndërro llogarinë" })
        .click();
      await expect(
        student.getByText(/Për hyrjen e parë pa GitHub/),
      ).toBeVisible();
      expect((await api(student, "/api/student/history")).status).toBe(401);
      await student.goto(`/check-in#token=${token}`);
      await fill(
        student,
        "Arta",
        "AUDIT-ARTA",
        "arta.audit@universitetiaab.com",
      );
      await student
        .getByRole("button", { name: "Regjistrohu dhe konfirmo vijueshmërinë" })
        .click();
      await expect(
        student.getByRole("heading", { name: "Vijueshmëria u konfirmua" }),
      ).toBeVisible();
      await student.goto("/progress");
      await expect(
        student.getByRole("heading", { name: "Arta Prova", exact: true }),
      ).toBeVisible();
      await expect(
        student.getByRole("heading", { name: "Besa Prova", exact: true }),
      ).toHaveCount(0);
      await student.goto("/student?userId=other");
      await expect(student.getByText("Arta Prova · G2")).toBeVisible();
      await expect(student.getByText("Besa Prova · G2")).toHaveCount(0);
      expect(await sql`select id from roster`).toHaveLength(2);
      expect(
        await sql`select id from attendance_records where session_id=${sessionId}`,
      ).toHaveLength(2);
      // A repeated scan must report the existing staff decision, not pretend presence.
      const [record]=await sql`select ar.id from attendance_records ar join roster r on r.id=ar.roster_id where ar.session_id=${sessionId} and r.student_id='AUDIT-ARTA'`;
      await sql`update attendance_records set status='rejected' where id=${record.id}`;
      await student.goto(`/check-in#token=${token}`);
      await expect(student.getByText('E refuzuar',{exact:true})).toBeVisible();
      await expect(student.getByRole('heading',{name:'Vijueshmëria u konfirmua'})).toHaveCount(0);
      expect((await sql`select status from attendance_records where id=${record.id}`)[0].status).toBe('rejected');
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
test("unregistered GitHub student can activate from the card and retain identity without another OAuth roundtrip", async ({
  browser,
  page: professor,
}, info) => {
  await setup(professor);
  await sql`insert into users(github_id,github_username,name) values ('900000002','e2e-arta','Arta Prova')`;
  const context = await browser.newContext({
    viewport: { width: 375, height: 900 },
  });
  const student = await context.newPage();
  try {
    await student.goto("/");
    expect(
      (
        await api(student, "/api/test/session", "POST", {
          persona: "studentOne",
        })
      ).status,
    ).toBe(200);
    await student.goto("/progress");
    await expect(student.getByText("e2e-arta", { exact: true })).toBeVisible();
    await student.screenshot({
      path: info.outputPath("05-github-activation-entry.png"),
    });
    await student.getByRole("link", { name: "Aktivizo profilin tim" }).click();
    await fill(student, "Arta", "AUDIT-GITHUB", "arta.audit@gmail.com");
    await student
      .getByRole("button", { name: "Aktivizo profilin", exact: true })
      .click();
    await expect(student.getByText(/Profili u aktivizua/)).toBeVisible();
    await student.goto("/progress");
    await expect(
      student.getByRole("heading", { name: "Arta Prova", exact: true }),
    ).toBeVisible();
    await expect(
      student.getByText("Karta jote", { exact: true }),
    ).toBeVisible();
    await student.reload();
    await expect(
      student.getByRole("heading", { name: "Arta Prova", exact: true }),
    ).toBeVisible();
    expect(await sql`select id from roster`).toHaveLength(1);
  } finally {
    await context.close();
  }
});
test("expired QR and missing QR have actionable exits and do not establish attendance", async ({
  browser,
  page: professor,
}, info) => {
  const { token, sessionId } = await setup(professor);
  const context = await browser.newContext({
    viewport: { width: 375, height: 900 },
  });
  const student = await context.newPage();
  try {
    await student.goto("/check-in");
    await expect(student.getByText(/Skano QR-në aktive/)).toBeVisible();
    await expect(
      student.getByRole("link", { name: "Hap vijueshmërinë time" }),
    ).toBeVisible();
    // Known GitHub account with no attendance; force the server-expired path.
    await sql`insert into users(github_id,github_username,name) values ('900000002','e2e-arta','Arta Prova')`;
    expect(
      (
        await api(student, "/api/test/session", "POST", {
          persona: "studentOne",
        })
      ).status,
    ).toBe(200);
    await sql`update qr_challenges set expires_at=now()-interval '1 second' where token_hash=${createHash("sha256").update(token).digest()}`;
    await student.goto(`/check-in#token=${token}`);
    await expect(
      student.getByRole("alert").filter({ hasText: "QR-ja ka skaduar" }),
    ).toBeVisible();
    await student.screenshot({ path: info.outputPath("06-expired-qr.png") });
    await expect(
      student.getByRole("link", { name: "Hap vijueshmërinë time" }),
    ).toBeVisible();
    expect(
      await sql`select id from attendance_records where session_id=${sessionId}`,
    ).toHaveLength(0);
  } finally {
    await context.close();
  }
});
test("student sign-in and sign-out recover from interrupted network requests", async ({
  browser,
  page: professor,
}, info) => {
  await setup(professor);
  const context = await browser.newContext({
    viewport: { width: 375, height: 900 },
  });
  const student = await context.newPage();
  const errors: string[] = [];
  student.on("pageerror", (e) => errors.push(e.message));
  try {
    await student.goto("/signin?callbackUrl=%2Fstudent");
    await student.route("**/api/auth/signin/github", (route) => route.abort());
    await student.getByRole("button", { name: "Hyr me GitHub" }).click();
    await expect(
      student.getByRole("alert").filter({ hasText: "Hyrja nuk filloi" }),
    ).toBeVisible();
    await expect(
      student.getByRole("button", { name: "Hyr me GitHub" }),
    ).toBeEnabled();
    await student.screenshot({
      path: info.outputPath("07-signin-recovery.png"),
    });
    await student.unroute("**/api/auth/signin/github");
    await sql`insert into users(github_id,github_username,name) values ('900000002','e2e-arta','Arta Prova')`;
    expect(
      (
        await api(student, "/api/test/session", "POST", {
          persona: "studentOne",
        })
      ).status,
    ).toBe(200);
    await student.goto("/student");
    await expect(
      student.getByRole("button", { name: "Dil / Ndërro llogarinë" }),
    ).toBeVisible();
    await student.route("**/api/auth/signout", (route) => route.abort());
    await student
      .getByRole("button", { name: "Dil / Ndërro llogarinë" })
      .click();
    await expect(
      student.getByRole("alert").filter({ hasText: "Dalja nuk përfundoi" }),
    ).toBeVisible();
    expect((await api(student, "/api/auth/session")).body.user.githubId).toBe(
      "900000002",
    );
    await student.unroute("**/api/auth/signout");
    await student
      .getByRole("button", { name: "Dil / Ndërro llogarinë" })
      .click();
    await expect(
      student.getByText(/Për hyrjen e parë pa GitHub/),
    ).toBeVisible();
    expect((await api(student, "/api/auth/session")).body.user).toBeUndefined();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
