import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { E2E_INBOUND_SECRET } from "./inbound-secret";

test.beforeAll(() => {
  execSync("npx tsx scripts/seed.ts", { stdio: "ignore" });
});

const SLUG = "sample-paediatrics-spring-symposium-2027";
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

test("a receipt forwarded by email from the doctor lands on their trip", async ({ page }) => {
  const email = `fwd${unique()}@example.test`;
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(`Dr Forward ${unique()}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password (8+ characters)").fill("password123");
  await page.getByLabel("Hospital join code").fill("DEMO2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.goto(`/conferences/${SLUG}`);
  await page.getByRole("button", { name: "Plan trip" }).click();
  await expect(page).toHaveURL(/\/trips\/\d+$/);
  const address = (await page.getByTestId("inbound-address").locator("code").textContent())!.trim();
  expect(address).toMatch(/^trip-[a-f0-9]{12}@in\.studyleave\.app$/);

  const payload = {
    to: address,
    from: `Dr Forward <${email.toUpperCase()}>`,
    subject: "Fwd: Airport shuttle receipt",
    attachments: [{ filename: "shuttle.pdf", contentType: "application/pdf", base64: PDF.toString("base64") }],
  };
  // No secret / wrong secret: rejected, nothing stored
  expect((await page.request.post("/api/inbound", { data: payload })).status()).toBe(401);
  expect(
    (await page.request.post("/api/inbound", { data: payload, headers: { "x-inbound-secret": "wrong" } })).status(),
  ).toBe(401);
  // Someone else's address as sender: ignored
  const stranger = await page.request.post("/api/inbound", {
    data: { ...payload, from: "stranger@example.test" },
    headers: { "x-inbound-secret": E2E_INBOUND_SECRET },
  });
  expect(stranger.status()).toBe(404);

  const ok = await page.request.post("/api/inbound", { data: payload, headers: { "x-inbound-secret": E2E_INBOUND_SECRET } });
  expect(ok.status()).toBe(201);

  await page.reload();
  const receipt = page.getByTestId("receipt").filter({ hasText: "Airport shuttle receipt" });
  await expect(receipt).toHaveCount(1);
  await expect(receipt).toContainText("emailed");
  await expect(page.getByTestId("receipt")).toHaveCount(1);
  const href = (await receipt.getByRole("link", { name: "View" }).getAttribute("href"))!;
  const view = await page.request.get(href);
  expect(view.headers()["content-type"]).toBe("application/pdf");
  expect(Buffer.compare(await view.body(), PDF)).toBe(0);
  await page.screenshot({ path: "scripts/ralph/shots/US-019-inbound.png", fullPage: true });
});
