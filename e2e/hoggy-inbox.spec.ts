import { expect, test } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { E2E_INBOUND_SECRET } from "./inbound-secret";

// SAMPLE – Paediatrics Spring Symposium, Brisbane, 12–14 Apr 2027 (seeded)
const SLUG = "sample-paediatrics-spring-symposium-2027";
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function textPdf(lines: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([400, 400]);
  lines.forEach((l, i) => page.drawText(l, { x: 20, y: 370 - i * 14, size: 10, font }));
  return Buffer.from(await doc.save());
}

test("receipts forwarded to the personal inbox are read, matched to the trip, or kept unfiled", async ({ page, browser, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const email = `hoggy${unique()}@example.test`;
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(`Dr Inbox ${unique()}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password (8+ characters)").fill("password123");
  await page.getByLabel("Hospital join code").fill("DEMO2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.goto(`/conferences/${SLUG}`);
  await page.getByRole("button", { name: "Plan trip" }).click();
  await expect(page).toHaveURL(/\/trips\/\d+$/);
  const tripUrl = page.url();
  // Trip page: personal address (with help) and the trip's own address both shown
  const onTrip = page.getByTestId("hoggy-inbox");
  const address = (await onTrip.getByTestId("hoggy-inbox-address").textContent())!.trim();
  expect(address).toMatch(/^inbox-[a-f0-9]{12}@in\.studyleave\.app$/);
  await expect(page.getByTestId("inbound-address").locator("code")).toHaveText(/^trip-[a-f0-9]{12}@/);

  // Dashboard: same address, copy button, how-to
  await page.goto("/dashboard");
  const box = page.getByTestId("hoggy-inbox");
  await expect(box.getByTestId("hoggy-inbox-address")).toHaveText(address);
  await box.getByRole("button", { name: `Copy ${address}` }).click();
  await expect(box.getByRole("button", { name: `Copy ${address}` })).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(address);
  await box.getByText("How to forward").click();
  await expect(box.getByText("your account email")).toBeVisible();
  await expect(page.getByTestId("unfiled-receipts")).toContainText("Nothing unfiled.");

  const post = (data: unknown, secret = E2E_INBOUND_SECRET) =>
    page.request.post("/api/inbound", { data, headers: { "x-inbound-secret": secret } });

  // 1) A taxi receipt PDF during the conference -> on the trip, needs review
  const taxi = await textPdf(["SAMPLE Riverside Cabs", "Tax invoice", "Date: 13/04/2027", "Total $38.50", "GST $3.50"]);
  const taxiMail = {
    to: address,
    from: `Dr Inbox <${email}>`,
    subject: "Fwd: Your trip receipt",
    attachments: [{ filename: "cab.pdf", contentType: "application/pdf", base64: taxi.toString("base64") }],
  };
  expect((await post(taxiMail, "wrong")).status()).toBe(401);
  expect((await post({ ...taxiMail, from: "stranger@example.test" })).status()).toBe(404);
  const filed = await post(taxiMail);
  expect(filed.status()).toBe(201);
  expect(await filed.json()).toMatchObject({ filed: [{ description: "SAMPLE Riverside Cabs" }], unfiled: [] });

  // 2) A personal holiday, no attachment (body only) -> Unfiled
  const holiday = await post({
    to: address,
    from: email,
    subject: "Fwd: Booking confirmed",
    text: "SAMPLE Noosa Surf Hire\nDate: 05/01/2027\nBoard hire, 2 hours\nTotal $60.00",
    attachments: [],
  });
  expect(holiday.status()).toBe(201);
  const { unfiled } = (await holiday.json()) as { unfiled: { id: number }[] };
  expect(unfiled).toHaveLength(1);

  await page.goto(tripUrl);
  const card = page.getByTestId("check-receipt");
  await expect(card).toHaveCount(1);
  await expect(card.getByLabel("Supplier")).toHaveValue("SAMPLE Riverside Cabs");
  await expect(card.getByLabel("Amount (AUD)")).toHaveValue("38.50");
  await expect(card.getByLabel("Date")).toHaveValue("2027-04-13");
  await expect(page.getByTestId("receipt").filter({ hasText: "SAMPLE Riverside Cabs" })).toContainText("Needs review");
  await page.screenshot({ path: "scripts/ralph/shots/US-029-trip-inbox.png", fullPage: true });

  await page.goto("/dashboard");
  const list = page.getByTestId("unfiled-receipt");
  await expect(list).toHaveCount(1);
  await expect(list).toContainText("SAMPLE Noosa Surf Hire");
  await expect(list).toContainText("AUD 60.00");
  await expect(list).toContainText("Didn't match a trip");
  const href = (await list.getByRole("link", { name: "View" }).getAttribute("href"))!;
  expect(href).toBe(`/receipts/unfiled/${unfiled[0].id}`);
  const view = await page.request.get(href);
  expect(view.status()).toBe(200);
  expect(view.headers()["content-type"]).toBe("application/pdf");
  await page.screenshot({ path: "scripts/ralph/shots/US-029-dashboard.png", fullPage: true });

  // Unfiled receipts are private: another user of the same hospital gets 404
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto("/login");
  await otherPage.getByLabel("Email").fill("manager@demo.test");
  await otherPage.getByLabel("Password").fill("password123");
  await otherPage.getByRole("button", { name: "Log in" }).click();
  await expect(otherPage).not.toHaveURL(/\/login/);
  expect((await otherPage.request.get(href)).status()).toBe(404);
  await otherPage.goto("/dashboard");
  await expect(otherPage.getByText("SAMPLE Noosa Surf Hire")).toHaveCount(0);
  await other.close();
});
