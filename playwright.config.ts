import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const isCI = !!process.env.CI;

/** E2E siempre en modo demo. En CI se usa el build ya generado (`next start`). */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
  },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: isCI ? `bun run start --port ${PORT}` : `bun run dev --port ${PORT}`,
    url: `http://localhost:${PORT}/bienvenida`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    env: { DEMO_MODE: "true", APP_URL: `http://localhost:${PORT}`, NEXT_TELEMETRY_DISABLED: "1" },
  },
});
