import { defineConfig } from "@playwright/test";
import { E2E_INBOUND_SECRET } from "./e2e/inbound-secret";

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: { executablePath: "/opt/pw-browsers/chromium" },
  },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { INBOUND_SECRET: E2E_INBOUND_SECRET },
  },
});
