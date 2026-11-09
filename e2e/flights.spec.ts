import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";

test.beforeAll(() => {
  execSync("npx tsx scripts/seed.ts", { stdio: "ignore" });
});

const SLUG = "sample-paediatrics-spring-symposium-2027"; // Brisbane, 12–14 Apr 2027
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

test("doctor books a flight on an approved trip: booking + receipt, trip booked", async ({ page, browser }) => {
  const name = `Dr Flyer ${unique()}`;
  const email = `flyer${unique()}@example.test`;
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password (8+ characters)").fill("password123");
  await page.getByLabel("Hospital join code").fill("DEMO2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.goto(`/conferences/${SLUG}`);
  await page.getByRole("button", { name: "Plan trip" }).click();
  await expect(page).toHaveURL(/\/trips\/\d+$/);
  const tripUrl = page.url();
  await page.getByLabel("Departure city").fill("Sydney");
  await page.getByLabel("Flights").fill("600");
  await page.getByRole("button", { name: "Save plan" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");

  // Not possible before approval
  await expect(page.getByRole("link", { name: "Find flights" })).toHaveCount(0);
  await page.goto(`${tripUrl}/flights`);
  await expect(page.getByText("once your manager has approved")).toBeVisible();
  await expect(page.getByTestId("flight-offer")).toHaveCount(0);

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
  await expect(mgr.getByRole("link", { name: "Find flights" })).toHaveCount(0); // only the doctor books
  await mgr.close();

  await page.goto(tripUrl);
  await page.getByRole("link", { name: "Find flights" }).click();
  await expect(page.getByRole("heading", { name: "Find flights" })).toBeVisible();
  await expect(page.getByLabel("From (city or airport code)")).toHaveValue("SYD");
  await expect(page.getByLabel("To (city or airport code)")).toHaveValue("BNE");
  await expect(page.getByLabel("Depart")).toHaveValue("2027-04-11");
  await expect(page.getByLabel("Return (leave blank for one way)")).toHaveValue("2027-04-15");
  const offers = page.getByTestId("flight-offer");
  await expect(offers).toHaveCount(3);
  await page.screenshot({ path: "scripts/ralph/shots/US-016-offers.png", fullPage: true });
  const price = (await offers.first().getByTestId("offer-price").textContent())!;
  await offers.first().getByRole("button", { name: /Book flight 1/ }).click();

  await expect(page).toHaveURL(/\/trips\/\d+\?booked=flight$/);
  await expect(page.getByRole("status")).toContainText("Flight booked");
  await expect(page.getByTestId("trip-status")).toHaveText("Booked");
  const booking = page.getByTestId("booking-flight");
  await expect(booking).toHaveCount(1);
  await expect(booking).toContainText(price);
  await expect(booking).toContainText("SYD");
  await expect(booking.getByTestId("booking-reference")).toHaveText(/^[A-Z0-9]{6}$/);
  const receipt = page.getByTestId("receipt");
  await expect(receipt).toHaveCount(1);
  await expect(receipt).toContainText(price);
  await page.screenshot({ path: "scripts/ralph/shots/US-016-booked.png", fullPage: true });

  const href = (await receipt.getByRole("link", { name: "View" }).getAttribute("href"))!;
  const res = await page.request.get(href);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // Other users can't fetch the receipt
  const stranger = await browser.newPage();
  expect((await stranger.request.get(href)).status()).toBe(401);
  await stranger.close();
});
