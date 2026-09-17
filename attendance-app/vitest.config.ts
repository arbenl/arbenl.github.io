import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: [
      "tests/integration/**",
      "tests/e2e/**",
      "tests/db/**",
      "**/*.sql",
      "node_modules/**",
      ".next/**",
    ],
  },
});
