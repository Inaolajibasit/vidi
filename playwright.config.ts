import { defineConfig, devices } from "@playwright/test";

const runE2E = process.env.VIDI_RUN_E2E === "true";
const baseURL = process.env.VIDI_E2E_BASE_URL ?? "http://127.0.0.1:3100";

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  outputDir: "test-results/playwright",
  reporter: process.env.CI ? "github" : "list",
  retries: process.env.CI ? 1 : 0,
  testDir: "./tests/e2e",
  timeout: 120_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer:
    runE2E && !process.env.VIDI_E2E_BASE_URL
      ? {
          command: "npm run start -- --port 3100",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          url: baseURL,
        }
      : undefined,
});
