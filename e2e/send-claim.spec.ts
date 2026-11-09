import { execSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { e2eDbPath } from "./test-env";
import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

test.beforeAll(() => {
  execSync("npx tsx scripts/seed.ts", { stdio: "ignore" });
});

const SLUG = "sample-paediatrics-spring-symposium-2027";
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const cents = (money: string) => Math.round(Number(money.replace(/[^0-9.]/g, "")) * 100);

async function fill(page: Page, name: string, email: string) {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password (8+ characters)").fill("password123");
}

test("admin sets the finance email; doctor sends the claim pack; trip claimed and budget spent", async ({ page, browser }) => {
  const id = unique();
  const financeEmail = `claims${id}@example.test`;

  // Admin creates a hospital and changes its finance address on /settings
  const admin = await browser.newPage();
  await fill(admin, "Ada Admin", `admin${id}@example.test`);
  await admin.getByLabel("Create a new hospital").check();
  await admin.getByLabel("Hospital name").fill(`Claim Hospital ${id}`);
  await admin.getByLabel("Finance email (where claims are sent)").fill(`old${id}@example.test`);
  await admin.getByRole("button", { name: "Create account" }).click();
  const code = (await admin.getByTestId("join-code").textContent())!.trim();
  await admin.getByRole("link", { name: "Settings" }).click();
  await expect(admin.getByRole("heading", { name: "Hospital settings" })).toBeVisible();
  await expect(admin.getByLabel("Finance email")).toHaveValue(`old${id}@example.test`);
  await admin.getByLabel("Finance email").fill("not-an-email");
  await admin.getByLabel("Finance email").evaluate((el: HTMLInputElement) => (el.type = "text"));
  await admin.getByRole("button", { name: "Save settings" }).click();
  await expect(admin.locator("p.error")).toHaveText("Please enter a valid email address.");
  await admin.getByLabel("Finance email").fill(financeEmail);
  await admin.getByRole("button", { name: "Save settings" }).click();
  await expect(admin.getByRole("status")).toHaveText("Saved.");
  await admin.screenshot({ path: "scripts/ralph/shots/US-022-settings.png", fullPage: true });
  await admin.reload();
  await expect(admin.getByLabel("Finance email")).toHaveValue(financeEmail);

  // Doctor joins, plans, submits
  const surname = `Claimer${id}`;
  const docEmail = `doc${id}@example.test`;
  await fill(page, `Dr Cam ${surname}`, docEmail);
  await page.getByLabel("Hospital join code").fill(code);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.goto("/settings");
  await expect(page).toHaveURL(/denied=1/); // doctors can't open settings
  await page.goto(`/conferences/${SLUG}`);
  await page.getByRole("button", { name: "Plan trip" }).click();
  await expect(page).toHaveURL(/\/trips\/\d+$/);
  const tripUrl = page.url();
  const tripId = Number(tripUrl.split("/").pop());
  await page.getByLabel("Departure city").fill("Sydney");
  await page.getByLabel("Flights").fill("600");
  await page.getByRole("button", { name: "Save plan" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
  await expect(page.getByTestId("send-claim")).toHaveCount(0);
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await expect(page.getByTestId("trip-status")).toHaveText("Awaiting approval");

  // The admin approves (no managers in this hospital)
  await admin.goto(tripUrl);
  await admin.getByRole("button", { name: "Approve" }).click();
  await expect(admin.getByTestId("trip-status")).toHaveText("Approved");

  // Doctor books a flight and adds a taxi receipt
  await page.goto(`${tripUrl}/flights`);
  const offer = page.getByTestId("flight-offer").first();
  const price = cents((await offer.getByTestId("offer-price").textContent())!);
  await offer.getByRole("button", { name: /Book flight 1/ }).click();
  await expect(page.getByTestId("trip-status")).toHaveText("Booked");
  const form = page.getByTestId("upload-receipt");
  await form.getByLabel(/Receipt file/).setInputFiles({ name: "taxi.png", mimeType: "image/png", buffer: PNG });
  await form.getByLabel("What is it?").selectOption("taxi");
  await form.getByLabel("Description").fill("Taxi to venue");
  await form.getByLabel("Amount (AUD)").fill("42.50");
  await form.getByRole("button", { name: "Upload receipt" }).click();
  await expect(page.getByTestId("receipt")).toHaveCount(2);

  const send = page.getByTestId("send-claim");
  await expect(send).toContainText(financeEmail);
  await send.getByRole("button", { name: "Send claim" }).click();
  await expect(page).toHaveURL(/\?claim=sent$/);
  await expect(page.getByTestId("trip-status")).toHaveText("Claimed");
  await expect(page.getByRole("status")).toHaveText(`Claim sent to ${financeEmail}. A copy went to you.`);
  await expect(page.getByTestId("claim-sent")).toContainText(financeEmail);
  await expect(page.getByTestId("send-claim")).toHaveCount(0);
  await expect(page.getByTestId("upload-receipt")).toHaveCount(0); // receipts locked once claimed
  await page.getByTestId("claim-sent").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "scripts/ralph/shots/US-022-claim-sent.png", fullPage: true });

  // ONE email to finance, cc the doctor, ONE PDF named claim-<slug>-<surname>.pdf
  const db = new DatabaseSync(e2eDbPath());
  const emails = db
    .prepare("SELECT id, cc_addr FROM outbox WHERE to_addr = ?")
    .all(financeEmail) as { id: number; cc_addr: string }[];
  const claim = db.prepare("SELECT page_count, total_cents FROM claims WHERE trip_id = ?").get(tripId) as {
    page_count: number;
    total_cents: number;
  };
  const atts =
    emails.length === 1
      ? (db.prepare("SELECT id, filename FROM outbox_attachments WHERE email_id = ?").all(emails[0].id) as {
          id: number;
          filename: string;
        }[])
      : [];
  db.close();
  expect(emails).toHaveLength(1);
  expect(emails[0].cc_addr).toBe(docEmail);
  expect(atts.map((a) => a.filename)).toEqual([`claim-${SLUG}-${surname.toLowerCase()}.pdf`]);
  expect(claim.total_cents).toBe(price + 4250);
  const res = await page.request.get(`/outbox/attachments/${atts[0].id}`);
  expect(res.status()).toBe(200);
  const pdf = await PDFDocument.load(await res.body());
  expect(pdf.getPageCount()).toBe(claim.page_count);
  expect(pdf.getPageCount()).toBeGreaterThanOrEqual(4); // cover + form + flight receipt + taxi

  // The outbox shows the cc
  await page.goto("/outbox");
  await expect(page.getByText(`Cc: ${docEmail}`).first()).toBeVisible();

  // Budget: spent = the actual receipts
  await page.goto("/dashboard?year=2027");
  await expect(page.getByTestId("budget-committed")).toHaveText("AUD 0.00");
  expect(cents((await page.getByTestId("budget-spent").textContent())!)).toBe(price + 4250);
  await admin.close();
});
