import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
const base = new URL(baseURL);
const loopback = new Set(["127.0.0.1", "localhost", "::1"]);

if (base.protocol !== "http:" || !loopback.has(base.hostname) || base.port !== "3100") {
  throw new Error("E2E_BASE_URL must use a loopback hostname on port 3100. E2E tests never target hosted deployments.");
}

const supabaseURL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const supabase = new URL(supabaseURL);
if (supabase.protocol !== "http:" || !loopback.has(supabase.hostname)) {
  throw new Error("E2E requires a local Supabase URL. Hosted Supabase projects are blocked.");
}

const appPort = String(base.port || "3100");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: base.origin,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${appPort}`,
    url: `${base.origin}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      E2E_ISOLATED_DEV: "1",
      NEXT_PUBLIC_SUPABASE_URL: supabase.origin,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "local-e2e-public-key",
      SUPABASE_SERVICE_ROLE_KEY: "local-e2e-placeholder-service-role-key",
      NEXT_PUBLIC_SITE_URL: base.origin,
      MIDTRANS_SERVER_KEY: "",
      MIDTRANS_SIGNATURE_SECRET_KEY: "",
      MIDTRANS_IS_PRODUCTION: "false",
      RESEND_API_KEY: "",
      RESEND_FROM_EMAIL: "",
    },
  },
});
