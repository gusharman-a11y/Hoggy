import { execSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "@playwright/test";

test.beforeAll(() => {
  execSync("npx tsx scripts/seed.ts", { stdio: "ignore" });
});

const SLUG = "sample-paediatrics-spring-symposium-2027"; // AUD 780, starts 2027
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

/** No approval UI until US-013: approve the trip straight in the dev database. */
function approveTrip(tripId: number) {
  const db = new DatabaseSync("data/app.db");
  try {
    db.prepare("UPDATE trips SET status = 'approved' WHERE id = ?").run(tripId);
  } finally {
    db.close();
  }
}

test("dashboard budget card, and a manager sets the doctor's allowance on /team", async ({ page, browser }) => {
  const name = `Dr Budget ${unique()}`;
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(`budget${unique()}@example.test`);
  await page.getByLabel("Password (8+ characters)").fill("password123");
  await page.getByLabel("Hospital join code").fill("DEMO2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);

  // Fresh demo doctor: default AUD 3,000, nothing used
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByTestId("budget-allowance")).toHaveText("AUD 3,000.00");
  await expect(page.getByTestId("budget-remaining")).toHaveText("AUD 3,000.00");
  await expect(page.getByText("No trips yet")).toBeVisible();
  await expect(page.getByRole("link", { name: "Team" })).toHaveCount(0);

  // Plan a trip; it opens on the trip's year, a draft costs nothing yet
  await page.goto(`/conferences/${SLUG}`);
  await page.getByRole("link", { name: "Plan trip" }).click();
  await expect(page).toHaveURL(/\/trips\/\d+$/);
  const tripId = Number(page.url().split("/").pop());
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Study budget 2027" })).toBeVisible();
  await expect(page.getByTestId("budget-committed")).toHaveText("AUD 0.00");
  await expect(page.getByTestId("recent-trips")).toContainText("Paediatrics Spring Symposium");

  approveTrip(tripId);
  await page.reload();
  await expect(page.getByTestId("budget-committed")).toHaveText("AUD 780.00");
  await expect(page.getByTestId("budget-remaining")).toHaveText("AUD 2,220.00");
  await page.screenshot({ path: "scripts/ralph/shots/US-011-dashboard.png", fullPage: true });

  // Doctors can't open /team
  await page.goto("/team");
  await expect(page).toHaveURL(/\/\?denied=1$/);

  // Manager raises the allowance for 2027
  const mgr = await browser.newPage();
  await mgr.goto("/login");
  await mgr.getByLabel("Email").fill("manager@demo.test");
  await mgr.getByLabel("Password").fill("password123");
  await mgr.getByRole("button", { name: "Log in" }).click();
  await expect(mgr.getByRole("heading", { name: /^Hi / })).toBeVisible();
  await mgr.getByRole("link", { name: "Team" }).click();
  await expect(mgr.getByRole("heading", { name: "Team budgets" })).toBeVisible();
  await mgr.getByRole("link", { name: "2027 →" }).click();
  await expect(mgr).toHaveURL(/\/team\?year=2027$/);
  const row = mgr.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText("Hospital default");
  await expect(row).toContainText("AUD 780.00");
  const input = row.getByLabel(`Allowance for ${name} (AUD)`);
  await expect(input).toHaveValue("3000.00");
  await input.fill("abc");
  await row.getByRole("button", { name: "Set" }).click();
  await expect(row.locator("p.error")).toBeVisible();
  await input.fill("4,000");
  await row.getByRole("button", { name: "Set" }).click();
  await expect(row.getByRole("status")).toHaveText("Saved");
  await expect(row).toContainText("AUD 3,220.00");
  await expect(row).not.toContainText("Hospital default");
  await mgr.screenshot({ path: "scripts/ralph/shots/US-011-team.png", fullPage: true });
  await mgr.close();

  await page.goto("/dashboard?year=2027");
  await expect(page.getByTestId("budget-allowance")).toHaveText("AUD 4,000.00");
  await expect(page.getByTestId("budget-remaining")).toHaveText("AUD 3,220.00");
  // 2026 still on the hospital default
  await page.getByRole("link", { name: "2026" }).click();
  await expect(page.getByTestId("budget-allowance")).toHaveText("AUD 3,000.00");
});

test("dashboard and team need a login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  await page.goto("/team");
  await expect(page).toHaveURL(/\/login\?next=%2Fteam$/);
});
