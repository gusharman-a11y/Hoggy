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

async function logIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: /^Hi / })).toBeVisible();
}

test("finance sees the sent claim, downloads the pack and marks it paid; the doctor is emailed", async ({
  page,
  browser,
}) => {
  const id = unique();
  const name = `Dr Paid ${id}`;
  const email = `paid${id}@example.test`;

  // Doctor joins the demo hospital, plans and submits
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password (8+ characters)").fill("password123");
  await page.getByLabel("Hospital join code").fill("DEMO2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("link", { name: "Claims" })).toHaveCount(0);
  await page.goto("/claims");
  await expect(page).toHaveURL(/\/\?denied=1$/); // doctors can't open /claims
  await page.goto(`/conferences/${SLUG}`);
  await page.getByRole("link", { name: "Plan trip" }).click();
  await expect(page).toHaveURL(/\/trips\/\d+$/);
  const tripUrl = page.url();
  const tripId = Number(tripUrl.split("/").pop());
  await page.getByLabel("Departure city").fill("Sydney");
  await page.getByRole("button", { name: "Save plan" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await expect(page.getByTestId("trip-status")).toHaveText("Awaiting approval");

  // Manager approves
  const mgr = await browser.newPage();
  await logIn(mgr, "manager@demo.test");
  await mgr.goto(tripUrl);
  await mgr.getByRole("button", { name: "Approve" }).click();
  await expect(mgr.getByTestId("trip-status")).toHaveText("Approved");
  await mgr.goto("/claims");
  await expect(mgr).toHaveURL(/\/\?denied=1$/); // managers aren't finance
  await mgr.close();

  // Doctor books a flight and sends the claim
  await page.goto(`${tripUrl}/flights`);
  await page.getByTestId("flight-offer").first().getByRole("button", { name: /Book flight 1/ }).click();
  await expect(page.getByTestId("trip-status")).toHaveText("Booked");
  await page.getByTestId("send-claim").getByRole("button", { name: "Send claim" }).click();
  await expect(page.getByTestId("trip-status")).toHaveText("Claimed");

  // Finance opens /claims
  const fin = await browser.newPage();
  await logIn(fin, "finance@demo.test");
  await fin.getByRole("link", { name: "Claims" }).click();
  await expect(fin.getByRole("heading", { name: "Claims", exact: true })).toBeVisible();
  const card = fin.getByTestId(`claim-${tripId}`);
  await expect(card.getByTestId("claim-status")).toHaveText("Claimed");
  await expect(card.getByTestId("claim-doctor")).toHaveText(name);
  await expect(card).toContainText("Paediatrics Spring Symposium");
  const total = (await card.getByTestId("claim-total").textContent())!;
  expect(total).toMatch(/^AUD [\d,]+\.\d\d$/);
  await expect(card.getByTestId("claim-sent-date")).not.toBeEmpty();

  // Download pack = the exact PDF finance was emailed
  const href = (await card.getByTestId("claim-pack").getAttribute("href"))!;
  const res = await fin.request.get(href);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-disposition"]).toContain(`claim-${SLUG}-${id}.pdf`);
  const pdf = await PDFDocument.load(await res.body());
  const db = new DatabaseSync(e2eDbPath());
  const claim = db.prepare("SELECT page_count FROM claims WHERE trip_id = ?").get(tripId) as { page_count: number };
  db.close();
  expect(pdf.getPageCount()).toBe(claim.page_count);
  expect((await page.request.get(href)).status()).toBe(404); // the doctor can't use the finance link

  await card.scrollIntoViewIfNeeded();
  await fin.screenshot({ path: "scripts/ralph/shots/US-023-claims.png", fullPage: true });

  // Mark paid
  await card.getByRole("button", { name: `Mark paid: ${name}` }).click();
  await expect(fin).toHaveURL(new RegExp(`/claims\\?paid=${tripId}$`));
  await expect(fin.getByRole("status")).toContainText(`Marked paid: ${name}`);
  await expect(card.getByTestId("claim-status")).toHaveText("Paid");
  await expect(card.getByTestId("claim-paid-date")).not.toBeEmpty();
  await expect(card.getByRole("button", { name: /Mark paid/ })).toHaveCount(0);
  await card.scrollIntoViewIfNeeded();
  await fin.screenshot({ path: "scripts/ralph/shots/US-023-paid.png", fullPage: true });
  await fin.close();

  // The doctor sees Paid and has an email
  await page.goto(tripUrl);
  await expect(page.getByTestId("trip-status")).toHaveText("Paid");
  await expect(page.getByTestId("claim-sent")).toContainText("paid on");
  await page.goto("/outbox");
  const mail = page.locator(".outbox-email", { hasText: `To: ${email}` }).filter({ hasText: "Claim paid:" });
  await expect(mail).toHaveCount(1);
  await expect(mail).toContainText(total);
});
