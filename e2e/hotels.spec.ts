import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";

test.beforeAll(() => {
  execSync("npx tsx scripts/seed.ts", { stdio: "ignore" });
});

const SLUG = "sample-paediatrics-spring-symposium-2027"; // Brisbane, 12–14 Apr 2027
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

test("doctor books a hotel on an approved trip: nights + total, receipt, trip booked", async ({ page, browser }) => {
  const email = `sleeper${unique()}@example.test`;
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(`Dr Sleeper ${unique()}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password (8+ characters)").fill("password123");
  await page.getByLabel("Hospital join code").fill("DEMO2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.goto(`/conferences/${SLUG}`);
  await page.getByRole("button", { name: "Plan trip" }).click();
  await expect(page).toHaveURL(/\/trips\/\d+$/);
  const tripUrl = page.url();

  // Not possible before approval
  await expect(page.getByRole("link", { name: "Find hotels" })).toHaveCount(0);
  await page.goto(`${tripUrl}/hotels`);
  await expect(page.getByText("once your manager has approved")).toBeVisible();
  await expect(page.getByTestId("hotel-offer")).toHaveCount(0);

  await page.goto(tripUrl);
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await expect(page.getByTestId("trip-status")).toHaveText("Awaiting approval");

  const mgr = await browser.newPage();
  await mgr.goto("/login");
  await mgr.getByLabel("Email").fill("manager@demo.test");
  await mgr.getByLabel("Password").fill("password123");
  await mgr.getByRole("button", { name: "Log in" }).click();
  await expect(mgr.getByRole("heading", { name: /^Hi / })).toBeVisible();
  await mgr.goto(tripUrl);
  await mgr.getByRole("button", { name: "Approve" }).click();
  await expect(mgr.getByTestId("trip-status")).toHaveText("Approved");
  await expect(mgr.getByRole("link", { name: "Find hotels" })).toHaveCount(0);
  await mgr.close();

  await page.goto(tripUrl);
  await page.getByRole("link", { name: "Find hotels" }).click();
  await expect(page.getByRole("heading", { name: "Find hotels" })).toBeVisible();
  await expect(page.getByLabel("City")).toHaveValue("Brisbane");
  await expect(page.getByLabel("Check in")).toHaveValue("2027-04-11");
  await expect(page.getByLabel("Check out")).toHaveValue("2027-04-15");
  const offers = page.getByTestId("hotel-offer");
  await expect(offers).toHaveCount(3);
  await expect(offers.first()).toContainText("× 4 nights");
  await expect(offers.first().getByTestId("offer-distance")).toHaveText(/^[\d.]+ km$/);
  await page.screenshot({ path: "scripts/ralph/shots/US-017-hotels.png", fullPage: true });

  // Changing the dates re-searches
  await page.getByLabel("Check out").fill("2027-04-14");
  await page.getByRole("button", { name: "Search hotels" }).click();
  await expect(page).toHaveURL(/checkOut=2027-04-14/);
  await expect(offers.first()).toContainText("× 3 nights");

  const price = (await offers.nth(1).getByTestId("offer-price").textContent())!;
  await offers.nth(1).getByRole("button", { name: /Book hotel 2/ }).click();

  await expect(page).toHaveURL(/\/trips\/\d+\?booked=hotel$/);
  await expect(page.getByRole("status")).toContainText("Hotel booked");
  await expect(page.getByTestId("trip-status")).toHaveText("Booked");
  const booking = page.getByTestId("booking-hotel");
  await expect(booking).toHaveCount(1);
  await expect(booking).toContainText(price);
  await expect(booking).toContainText("Nights: 3");
  await expect(booking).toContainText("Stay: 2027-04-11 to 2027-04-14");
  await expect(booking.getByTestId("booking-reference")).toHaveText(/^H-[A-Z0-9]{6}$/);
  const receipt = page.getByTestId("receipt");
  await expect(receipt).toHaveCount(1);
  await expect(receipt).toContainText(price);
  await expect(receipt).toContainText("Hotel");
  await page.screenshot({ path: "scripts/ralph/shots/US-017-booked.png", fullPage: true });

  const href = (await receipt.getByRole("link", { name: "View" }).getAttribute("href"))!;
  const res = await page.request.get(href);
  expect(res.status()).toBe(200);
  expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // Still bookable once booked (e.g. a flight too)
  await expect(page.getByRole("link", { name: "Find flights" })).toBeVisible();
});
