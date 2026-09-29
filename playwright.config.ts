import { defineConfig, devices } from "@playwright/test";

const PORT = 3210;

// Smoke tests run against the in-memory mock repository: SUPABASE_URL is blanked
// (an existing empty variable wins over .env.local) and the password gate is off.
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "uk-UA",
    timezoneId: "Europe/Kyiv",
    viewport: { width: 1366, height: 900 },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } } }],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/robots.txt`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: { SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", APP_ACCESS_PASSWORD: "", APP_COOKIE_SECRET: "" },
  },
});
