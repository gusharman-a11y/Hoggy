import { DatabaseSync } from "node:sqlite";
import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { e2eDbPath } from "./test-env";

/*
 * The North star (CLAUDE.md): the whole v1 journey through the real UI, on the run's fresh
 * seeded temp database (playwright.config.ts). The only DB access is read-only asserting.
 */

const FINANCE = "finance@demo.test";
const SLUG = "sample-paediatrics-spring-symposium-2027"; // Brisbane, Apr 2027
// A real 1x1 PNG so it embeds as an image page in the claim pack.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
/** "AUD 1,234.50" / "-AUD 12.50" -> signed cents. */
const cents = (money: string) =>
  (money.includes("-") ? -1 : 1) * Math.round(Number(money.replace(/[^0-9.]/g, "")) * 100);

async function logIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: /^Hi / })).toBeVisible();
}

test("north star: sign up -> plan -> approve -> book -> receipts -> send claim -> budget spent", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const surname = `Northstar${id}`;
  const name = `Dr Nia ${surname}`;
  const email = `nia${id}@example.test`;

  // 1. Sign up and join the demo hospital with its org code
  await page.goto("/");
  await page.getByRole("link", { name: "Sign up" }).first().click();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password (8+ characters)").fill("password123");
  await page.getByLabel("Hospital join code").fill("DEMO2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText("Demo Hospital").first()).toBeVisible();

  // 2. Search conferences, open one, Plan trip
  await page.getByRole("link", { name: "Conferences" }).first().click();
  await expect(page.getByRole("heading", { name: "Conferences", level: 1 })).toBeVisible();
  await page.getByRole("searchbox").fill("paediatrics spring");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/q=paediatrics\+spring/);
  const cards = page.locator(".conf-card");
  await expect(cards).toHaveCount(1);
  await cards.first().getByRole("link").first().click();
  await expect(page).toHaveURL(new RegExp(`/conferences/${SLUG}$`));
  await page.getByRole("link", { name: "Plan trip" }).click();
  await expect(page).toHaveURL(/\/trips\/\d+$/);
  const tripUrl = page.url();
  const tripId = Number(new URL(tripUrl).pathname.split("/").pop());
  await expect(page.getByTestId("trip-status")).toHaveText("Draft");

  // 3. Submit for approval; a manager logs in and approves
  await page.getByLabel("Departure city").fill("Sydney");
  await page.getByLabel("Flights").fill("600");
  await page.getByRole("button", { name: "Save plan" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await expect(page.getByTestId("trip-status")).toHaveText("Awaiting approval");

  const mgr = await browser.newPage();
  await logIn(mgr, "manager@demo.test");
  await mgr.getByRole("link", { name: "Approvals" }).first().click();
  await expect(mgr.getByRole("heading", { name: "Approvals", level: 1 })).toBeVisible();
  const card = mgr.getByTestId(`approval-${tripId}`);
  await expect(card).toContainText(name);
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(mgr.getByRole("status")).toContainText(`Approved: ${name}`);
  await expect(mgr.getByTestId(`approval-${tripId}`)).toHaveCount(0);
  await mgr.close();

  // 4. Book a flight and a hotel (mock providers); a receipt for each appears
  await page.reload();
  await expect(page.getByTestId("trip-status")).toHaveText("Approved");
  await page.getByRole("link", { name: "Find flights" }).click();
  await expect(page.getByRole("heading", { name: "Find flights" })).toBeVisible();
  const flight = page.getByTestId("flight-offer").first();
  const flightCents = cents((await flight.getByTestId("offer-price").textContent())!);
  await flight.getByRole("button", { name: /Book flight 1/ }).click();
  await expect(page).toHaveURL(/\?booked=flight$/);
  await expect(page.getByTestId("trip-status")).toHaveText("Booked");
  await expect(page.getByTestId("booking-flight")).toHaveCount(1);
  await expect(page.getByTestId("receipt")).toHaveCount(1);

  await page.getByRole("link", { name: "Find hotels" }).click();
  await expect(page.getByRole("heading", { name: "Find hotels" })).toBeVisible();
  const hotel = page.getByTestId("hotel-offer").first();
  const hotelCents = cents((await hotel.getByTestId("offer-price").textContent())!);
  await hotel.getByRole("button", { name: /Book hotel 1/ }).click();
  await expect(page).toHaveURL(/\?booked=hotel$/);
  await expect(page.getByTestId("booking-hotel")).toHaveCount(1);
  await expect(page.getByTestId("receipt")).toHaveCount(2);

  // 5. Upload one extra receipt (a PNG taxi receipt)
  const form = page.getByTestId("upload-receipt");
  await form.getByLabel(/Receipt file/).setInputFiles({ name: "taxi.png", mimeType: "image/png", buffer: PNG });
  await form.getByLabel("What is it?").selectOption("taxi");
  await form.getByLabel("Description").fill("Taxi to venue");
  await form.getByLabel("Amount (AUD)").fill("42.50");
  await form.getByRole("button", { name: "Upload receipt" }).click();
  await expect(page).toHaveURL(/\?receipt=added$/);
  await expect(page.getByTestId("receipt")).toHaveCount(3);
  const totalCents = flightCents + hotelCents + 4250;

  // 6. Send claim -> finance gets ONE email with ONE PDF (cover + form + 3 receipts)
  const send = page.getByTestId("send-claim");
  await expect(send).toContainText(FINANCE);
  await send.getByRole("button", { name: "Send claim" }).click();
  await expect(page).toHaveURL(/\?claim=sent$/);
  await expect(page.getByTestId("trip-status")).toHaveText("Claimed");
  await expect(page.getByRole("status")).toHaveText(`Claim sent to ${FINANCE}. A copy went to you.`);
  await page.screenshot({ path: "scripts/ralph/shots/US-024-claim-sent.png", fullPage: true });

  // Read the outbox through the app, as finance
  const fin = await browser.newPage();
  await logIn(fin, FINANCE);
  await fin.goto("/outbox");
  await expect(fin.getByRole("heading", { name: "Outbox" })).toBeVisible();
  const emails = fin.locator(".outbox-email").filter({ hasText: `To: ${FINANCE}` }).filter({ hasText: name });
  await expect(emails).toHaveCount(1);
  const email1 = emails.first();
  await expect(email1.getByRole("heading")).toContainText(`Study leave claim: ${name}`);
  await expect(email1).toContainText(`Cc: ${email}`);
  const links = email1.locator(".outbox-attachments a");
  await expect(links).toHaveCount(1);
  await expect(links.first()).toHaveText(`claim-${SLUG}-${surname.toLowerCase()}.pdf`);
  await email1.scrollIntoViewIfNeeded();
  await fin.screenshot({ path: "scripts/ralph/shots/US-024-outbox.png" });
  const res = await fin.request.get((await links.first().getAttribute("href"))!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  const pdf = await PDFDocument.load(new Uint8Array(await res.body()));
  const COVER = 1;
  const FORM = 1;
  const RECEIPTS = 3; // flight + hotel + taxi PNG, one page each
  expect(pdf.getPageCount()).toBe(COVER + FORM + RECEIPTS);
  await fin.close();

  // Cross-check the stored records (read-only): exactly one email for this trip, matching claim
  const db = new DatabaseSync(e2eDbPath(), { readOnly: true });
  try {
    const rows = db
      .prepare("SELECT id FROM outbox WHERE to_addr = ? AND subject LIKE ?")
      .all(FINANCE, `%${name}%`) as { id: number }[];
    expect(rows).toHaveLength(1);
    const atts = db.prepare("SELECT content_type FROM outbox_attachments WHERE email_id = ?").all(rows[0].id) as {
      content_type: string;
    }[];
    expect(atts.map((a) => a.content_type)).toEqual(["application/pdf"]);
    const claim = db
      .prepare("SELECT email_id, page_count, receipt_count, total_cents FROM claims WHERE trip_id = ?")
      .get(tripId) as { email_id: number; page_count: number; receipt_count: number; total_cents: number };
    expect(claim).toMatchObject({ email_id: rows[0].id, page_count: 5, receipt_count: 3, total_cents: totalCents });
  } finally {
    db.close();
  }

  // 7. The study budget shows the trip as spent
  await page.getByRole("link", { name: "Dashboard" }).first().click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  const tab2027 = page.getByRole("navigation", { name: "Budget year" }).getByRole("link", { name: "2027" });
  if (await tab2027.count()) await tab2027.click();
  await expect(page.getByRole("heading", { name: "Study budget 2027" })).toBeVisible();
  await expect(page.getByTestId("budget-committed")).toHaveText("AUD 0.00");
  expect(cents((await page.getByTestId("budget-spent").textContent())!)).toBe(totalCents);
  expect(cents((await page.getByTestId("budget-remaining").textContent())!)).toBe(
    cents((await page.getByTestId("budget-allowance").textContent())!) - totalCents,
  );
  await expect(page.getByTestId("recent-trips").locator(".conf-card").first()).toContainText("Claimed");
  await page.screenshot({ path: "scripts/ralph/shots/US-024-budget.png", fullPage: true });
});
