/** Shared secret for POST /api/inbound in e2e; playwright.config.ts passes it to the dev server. */
export const E2E_INBOUND_SECRET = process.env.INBOUND_SECRET ?? "e2e-inbound-secret";
