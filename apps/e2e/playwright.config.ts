import { defineConfig, devices } from "@playwright/test";

const WEB_URL = "http://localhost:3000";
const API_URL = "http://localhost:4000";

const API_ENV: Record<string, string> = {
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/construction_ops?schema=public",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? "e2e-access-secret-at-least-32-chars-long",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? "e2e-refresh-secret-at-least-32-chars-long",
  WEB_URL,
  PORT: "4000",
};

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./global-setup.ts",
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @construction-ops/api exec tsx src/index.ts",
      url: `${API_URL}/api/v1/health`,
      env: API_ENV,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @construction-ops/web exec next dev -p 3000",
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
