import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

test.beforeAll(() => {
  execSync("npx tsx scripts/seed.ts", { stdio: "ignore" });
});

const SLUG = "sample-paediatrics-spring-symposium-2027"; // AUD 780, starts 2027
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function logInManager(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("manager@demo.test");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: /^Hi / })).toBeVisible();
}

test("doctor submits, manager rejects with a comment, doctor edits and resubmits, manager approves", async ({
  page,
  browser,
}) => {
  const name = `Dr Approve ${unique()}`;
  const email = `approve${unique()}@example.test`;
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password (8+ characters)").fill("password123");
  await page.getByLabel("Hospital join code").fill("DEMO2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);
  // doctors don't get the approvals page
  await expect(page.getByRole("link", { name: "Approvals" })).toHaveCount(0);
  await page.goto("/approvals");
  await expect(page).toHaveURL(/\/\?denied=1$/);

  await page.goto(`/conferences/${SLUG}`);
  await page.getByRole("button", { name: "Plan trip" }).click();
  await expect(page).toHaveURL(/\/trips\/\d+$/);
  const tripUrl = page.url();
  const tripId = Number(tripUrl.split("/").pop());
  await page.getByLabel("Flights").fill("1,200");
  await page.getByRole("button", { name: "Save plan" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
  await expect(page.getByTestId("trip-total")).toContainText("AUD 1,980.00");

  await page.getByRole("button", { name: "Submit for approval" }).click();
  await expect(page.getByTestId("trip-status")).toHaveText("Awaiting approval");
  await expect(page.getByRole("button", { name: "Save plan" })).toHaveCount(0);
  await expect(page.getByText("Waiting for your manager")).toBeVisible();

  // The manager is emailed
  await page.goto("/outbox");
  const ask = page.locator(".outbox-email", { hasText: `Approval needed: ${name}` });
  await expect(ask).toContainText("To: manager@demo.test");
  await expect(ask).toContainText("AUD 1,980.00");

  // Manager rejects with a comment
  const mgr = await browser.newPage();
  await logInManager(mgr);
  await mgr.getByRole("link", { name: "Approvals" }).click();
  await expect(mgr.getByRole("heading", { name: "Approvals" })).toBeVisible();
  const card = mgr.getByTestId(`approval-${tripId}`);
  await expect(card).toContainText(name);
  await expect(card.getByTestId("approval-cost")).toHaveText("AUD 1,980.00");
  await expect(card.getByTestId("approval-remaining")).toHaveText("AUD 3,000.00");
  await expect(card.getByTestId("approval-after")).toHaveText("AUD 1,020.00");
  await mgr.screenshot({ path: "scripts/ralph/shots/US-013-approvals.png", fullPage: true });
  await card.getByRole("button", { name: "Reject" }).click();
  await expect(card.locator("p.error")).toContainText("say why");
  await card.getByLabel(`Comment for ${name}`).fill("Flights look high, please find a cheaper fare.");
  await card.getByRole("button", { name: "Reject" }).click();
  await expect(mgr).toHaveURL(/\/approvals\?decided=rejected/);
  await expect(mgr.getByRole("status")).toContainText(`Rejected: ${name}’s trip`);
  await expect(card).toHaveCount(0);

  // Doctor sees the decision, the comment and an email
  await page.goto(tripUrl);
  await expect(page.getByTestId("trip-status")).toHaveText("Rejected");
  await expect(page.getByTestId("manager-comment")).toContainText("cheaper fare");
  await page.goto("/outbox");
  const no = page.locator(".outbox-email", { hasText: `To: ${email}` }).first();
  await expect(no).toContainText("Trip rejected");
  await expect(no).toContainText("cheaper fare");

  // Edit and resubmit
  await page.goto(tripUrl);
  await page.getByLabel("Flights").fill("800");
  await page.getByRole("button", { name: "Save plan" }).click();
  await expect(page.getByTestId("trip-total")).toContainText("AUD 1,580.00");
  await page.screenshot({ path: "scripts/ralph/shots/US-013-rejected.png", fullPage: true });
  await page.getByRole("button", { name: "Resubmit for approval" }).click();
  await expect(page.getByTestId("trip-status")).toHaveText("Awaiting approval");

  // Manager approves from the trip page this time
  await mgr.goto("/approvals");
  await expect(mgr.getByTestId(`approval-${tripId}`).getByTestId("approval-cost")).toHaveText("AUD 1,580.00");
  await mgr.goto(tripUrl);
  await mgr.getByLabel(`Comment for ${name}`).fill("Approved, enjoy.");
  await mgr.getByRole("button", { name: "Approve" }).click();
  await expect(mgr.getByTestId("trip-status")).toHaveText("Approved");
  await expect(mgr.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await mgr.goto("/approvals");
  await expect(mgr.getByTestId(`approval-${tripId}`)).toHaveCount(0);
  await mgr.close();

  await page.goto(tripUrl);
  await expect(page.getByTestId("trip-status")).toHaveText("Approved");
  await expect(page.getByTestId("manager-comment")).toContainText("Approved, enjoy.");
  await expect(page.getByRole("button", { name: /Submit|Resubmit/ })).toHaveCount(0);
  await page.screenshot({ path: "scripts/ralph/shots/US-013-approved.png", fullPage: true });
  await page.goto("/outbox");
  const yes = page.locator(".outbox-email", { hasText: `To: ${email}` }).first();
  await expect(yes).toContainText("Trip approved");
  await page.goto("/dashboard");
  await expect(page.getByTestId("budget-committed")).toHaveText("AUD 1,580.00");
});

test("approvals needs a login", async ({ page }) => {
  await page.goto("/approvals");
  await expect(page).toHaveURL(/\/login\?next=%2Fapprovals$/);
});
