import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL;
if (!baseURL || process.env.E2E_DISPOSABLE_DATABASE !== "1") {
  throw new Error("Run npm run test:e2e so the harness owns the server and disposable database.");
}
const url = new URL(baseURL);
const database = new URL(process.env.DATABASE_URL ?? "invalid:");
if (url.hostname !== "127.0.0.1" || database.hostname !== "127.0.0.1" ||
    database.pathname !== "/attendance_e2e") {
  throw new Error("E2E tests require the harness loopback server and attendance_e2e database.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL,
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
  },
});
