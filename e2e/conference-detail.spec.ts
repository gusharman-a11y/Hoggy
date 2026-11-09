import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";

test.beforeAll(() => {
  execSync("npx tsx scripts/seed.ts", { stdio: "ignore" });
});

const SLUG = "sample-heart-rhythm-masterclass-2027";

test("conference detail shows the facts; Plan trip sends logged-out users to log in and back", async ({ page }) => {
  await page.goto("/conferences?q=rhythm");
  await page.getByRole("link", { name: /Heart Rhythm Masterclass/ }).click();
  await expect(page).toHaveURL(new RegExp(`/conferences/${SLUG}$`));
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Heart Rhythm Masterclass");

  const facts = page.getByTestId("conference-facts");
  await expect(facts).toContainText("14–16 Jun 2027");
  await expect(facts).toContainText("Riverside Conference Centre");
  await expect(facts).toContainText("London");
  await expect(facts).toContainText("United Kingdom");
  await expect(facts).toContainText("15");
  await expect(facts).toContainText("GBP 890.00");
  await expect(facts.getByRole("link")).toHaveAttribute("href", /example\.org/);
  await page.screenshot({ path: "scripts/ralph/shots/US-008-detail.png", fullPage: true });

  await page.getByRole("link", { name: "Plan trip" }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel("Email").fill("manager@demo.test");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();
  // back through /plan, which opens the draft trip
  await expect(page).toHaveURL(/\/trips\/\d+$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Heart Rhythm Masterclass");
  await page.screenshot({ path: "scripts/ralph/shots/US-008-plan.png", fullPage: true });
});

test("unknown conference slug is a 404", async ({ page }) => {
  const res = await page.goto("/conferences/no-such-conference-zzz");
  expect(res?.status()).toBe(404);
  const plan = await page.goto("/conferences/no-such-conference-zzz/plan");
  expect(plan?.status()).toBe(404);
});
