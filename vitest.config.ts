import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    environment: "node",
    // Unit tests never call real services, even if the shell has keys set.
    env: { ANTHROPIC_API_KEY: "", DUFFEL_TOKEN: "", STRIPE_SECRET_KEY: "", EXPEDIA_RAPID_KEY: "", SMTP_URL: "" },
  },
});
