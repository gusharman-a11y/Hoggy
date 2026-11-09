import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

test.beforeAll(() => {
  execSync("npx tsx scripts/seed.ts", { stdio: "ignore" });
});

const SLUG = "sample-heart-rhythm-masterclass-2027"; // GBP 890 fee
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function signUpDoctor(page: Page, name: string): Promise<string> {
  const email = `trip${unique()}@example.test`;
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password (8+ characters)").fill("password123");
  await page.getByLabel("Hospital join code").fill("DEMO2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);
  return email;
}

test("Plan trip creates a draft, the plan saves with a total, and /trips lists it", async ({ page, browser }) => {
  await signUpDoctor(page, "Dr Tripp");
  await page.goto(`/conferences/${SLUG}`);
  await page.getByRole("button", { name: "Plan trip" }).click();
  await expect(page).toHaveURL(/\/trips\/\d+$/);
  const tripUrl = page.url();

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Heart Rhythm Masterclass");
  await expect(page.getByTestId("trip-status")).toHaveText("Draft");
  await expect(page.getByTestId("trip-conference")).toContainText("GBP 890.00");
  // GBP 890 at the indicative rate
  await expect(page.getByLabel("Registration")).toHaveValue("1735.50");

  await page.getByLabel("Departure city").fill("Sydney");
  await page.getByLabel("Flights").fill("2,100");
  await page.getByLabel("Hotel").fill("900.50");
  await page.getByLabel("Other costs").fill("abc");
  await page.getByRole("button", { name: "Save plan" }).click();
  await expect(page.locator("p.error")).toContainText("Other costs");
  await expect(page.getByLabel("Departure city")).toHaveValue("Sydney");
  await page.getByLabel("Other costs").fill("64");
  await page.getByRole("button", { name: "Save plan" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Departure city")).toHaveValue("Sydney");
  await expect(page.getByTestId("trip-total")).toContainText("AUD 4,800.00");
  await page.screenshot({ path: "scripts/ralph/shots/US-010-trip.png", fullPage: true });

  // Plan trip again reopens the same draft
  await page.goto(`/conferences/${SLUG}`);
  await page.getByRole("button", { name: "Plan trip" }).click();
  await expect(page).toHaveURL(tripUrl);

  await page.getByRole("link", { name: "My trips", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My trips" })).toBeVisible();
  const list = page.getByTestId("trip-list");
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list).toContainText("Heart Rhythm Masterclass");
  await expect(list).toContainText("Draft");
  await expect(list).toContainText("AUD 4,800.00");
  await page.screenshot({ path: "scripts/ralph/shots/US-010-list.png", fullPage: true });

  // Another doctor in the same hospital can't open it; the manager can (read-only)
  const other = await browser.newPage();
  await signUpDoctor(other, "Dr Other");
  const res = await other.goto(tripUrl);
  expect(res?.status()).toBe(404);
  await other.goto("/trips");
  await expect(other.getByText("No trips yet")).toBeVisible();
  await other.getByRole("button", { name: "Log out" }).click();
  await expect(other.getByRole("heading", { name: "Log in" })).toBeVisible();
  await other.getByLabel("Email").fill("manager@demo.test");
  await other.getByLabel("Password").fill("password123");
  await other.getByRole("button", { name: "Log in" }).click();
  await expect(other.getByRole("heading", { name: /^Hi / })).toBeVisible();
  await other.goto(tripUrl);
  await expect(other.getByTestId("trip-status")).toHaveText("Draft");
  await expect(other.getByText("Dr Tripp")).toBeVisible();
  await expect(other.getByRole("button", { name: "Save plan" })).toHaveCount(0);
  await other.close();
});

test("trips pages need a login", async ({ page }) => {
  await page.goto("/trips");
  await expect(page).toHaveURL(/\/login\?next=%2Ftrips$/);
});
