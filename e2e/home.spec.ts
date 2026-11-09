import { expect, test } from "@playwright/test";

test("home page shows the app name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "StudyLeave" })).toBeVisible();
  await page.screenshot({ path: "scripts/ralph/shots/US-001-home.png", fullPage: true });
});
