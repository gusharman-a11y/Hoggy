import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";

// The run's temp DB is seeded by playwright.config.ts; re-seeding is idempotent.
test.beforeAll(() => {
  execSync("npx tsx scripts/seed.ts", { stdio: "ignore" });
});

test("search conferences by text, specialty, country and month via the URL", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Conferences" }).click();
  await expect(page.getByRole("heading", { name: "Conferences", level: 1 })).toBeVisible();

  const cards = page.locator(".conf-card");
  expect(await cards.count()).toBeGreaterThanOrEqual(28);
  await expect(cards.first()).toContainText("CPD points");
  await expect(cards.first()).toContainText("SAMPLE");
  await page.screenshot({ path: "scripts/ralph/shots/US-007-list.png", fullPage: true });

  await page.getByLabel("Specialty").selectOption("Cardiology");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/specialty=Cardiology/);
  await expect(cards).toHaveCount(3);
  for (const t of await cards.allTextContents()) expect(t).toContain("Cardiology");

  await page.getByLabel("Country").selectOption("Spain");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Barcelona, Spain");
  await page.screenshot({ path: "scripts/ralph/shots/US-007-filtered.png", fullPage: true });

  await page.goto("/conferences?q=rhythm");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Heart Rhythm Masterclass");
  await expect(page.getByRole("searchbox")).toHaveValue("rhythm");

  await page.goto("/conferences?month=2027-03");
  expect(await cards.count()).toBeGreaterThan(0);
  for (const t of await cards.allTextContents()) expect(t).toMatch(/Mar( –| 2027)/);

  await page.goto("/conferences?q=zzznomatch");
  await expect(page.locator(".empty")).toContainText("No conferences match");
  await page.screenshot({ path: "scripts/ralph/shots/US-007-empty.png", fullPage: true });
});
