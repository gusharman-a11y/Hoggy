import { defineConfig } from "@playwright/test";
import { E2E_INBOUND_SECRET } from "./e2e/inbound-secret";
import { prepareE2eEnv } from "./e2e/test-env";

// Fresh seeded temp DB + uploads dir for this run (exports DATABASE_PATH / UPLOADS_DIR).
prepareE2eEnv();

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: { executablePath: "/opt/pw-browsers/chromium" },
  },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      INBOUND_SECRET: E2E_INBOUND_SECRET,
      DATABASE_PATH: process.env.DATABASE_PATH!,
      UPLOADS_DIR: process.env.UPLOADS_DIR!,
    },
  },
});
