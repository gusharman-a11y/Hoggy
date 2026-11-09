import { DatabaseSync } from "node:sqlite";
import { expect, test, type Page } from "@playwright/test";
import { E2E_INBOUND_SECRET } from "./inbound-secret";
import { e2eDbPath } from "./test-env";

const SLUG = "sample-paediatrics-spring-symposium-2027";
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

async function signUpDoctor(page: Page, email: string): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(`Dr Polish ${unique()}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password (8+ characters)").fill("password123");
  await page.getByLabel("Hospital join code").fill("DEMO2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

function tripCount(email: string): number {
  const db = new DatabaseSync(e2eDbPath());
  try {
    const row = db
      .prepare("SELECT COUNT(*) AS n FROM trips t JOIN users u ON u.id = t.user_id WHERE u.email = ?")
      .get(email) as { n: number };
    return row.n;
  } finally {
    db.close();
  }
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll, `horizontal scroll on ${page.url()}`).toBeLessThanOrEqual(client);
}

test("Plan trip only writes on POST; doctors fix an emailed $0 receipt", async ({ page }) => {
  const email = `polish${unique()}@example.test`;
  await signUpDoctor(page, email);

  // GET of the plan page (e.g. a prefetch or a reload) never creates a trip
  await page.goto(`/conferences/${SLUG}/plan`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Plan a trip");
  await page.reload();
  expect(tripCount(email)).toBe(0);

  await page.goto(`/conferences/${SLUG}`);
  await page.getByRole("button", { name: "Plan trip" }).click();
  await expect(page).toHaveURL(/\/trips\/\d+$/);
  expect(tripCount(email)).toBe(1);

  // An emailed receipt arrives at $0 with the subject as description
  const address = (await page.getByTestId("inbound-address").locator("code").textContent())!.trim();
  const res = await page.request.post("/api/inbound", {
    data: {
      to: address,
      from: email,
      subject: "Fwd: Your Tuesday trip with Uber",
      attachments: [{ filename: "uber.pdf", contentType: "application/pdf", base64: PDF.toString("base64") }],
    },
    headers: { "x-inbound-secret": E2E_INBOUND_SECRET },
  });
  expect(res.status()).toBe(201);
  await page.reload();
  const receipt = page.getByTestId("receipt");
  await expect(receipt).toContainText("AUD 0.00");

  await receipt.getByText("Edit", { exact: true }).click();
  const form = receipt.getByTestId("edit-receipt");
  await form.getByLabel("Description").fill("Uber to venue");
  await form.getByLabel("Amount (AUD)").fill("4x");
  await form.getByRole("button", { name: "Save receipt" }).click();
  await expect(form.locator("p.error")).toContainText("amount");
  await expect(form.getByLabel("Description")).toHaveValue("Uber to venue");
  await form.getByLabel("Amount (AUD)").fill("38.90");
  await form.getByRole("button", { name: "Save receipt" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Receipt updated" })).toBeVisible();
  await expect(page.getByTestId("receipt")).toContainText("Uber to venue · AUD 38.90");
  await expect(page.getByTestId("receipt")).toContainText("emailed");
  await page.screenshot({ path: "scripts/ralph/shots/US-025-receipt-edit.png", fullPage: true });
});

test.describe("at 375px wide", () => {
  test.use({ viewport: { width: 375, height: 740 } });

  test("the nav is consistent and nothing scrolls sideways", async ({ page }) => {
    await page.goto("/");
    await expectNoHorizontalScroll(page);
    await page.goto("/conferences");
    await expectNoHorizontalScroll(page);

    const email = `narrow${unique()}@example.test`;
    await signUpDoctor(page, email);
    const nav = page.getByRole("navigation", { name: "Main" });
    for (const name of ["Conferences", "My trips", "Dashboard"]) await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Log out" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Approvals" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Claims" })).toHaveCount(0);

    await page.goto(`/conferences/${SLUG}`);
    await expectNoHorizontalScroll(page);
    await page.getByRole("button", { name: "Plan trip" }).click();
    await expect(page).toHaveURL(/\/trips\/\d+$/);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: "scripts/ralph/shots/US-025-trip-375.png", fullPage: true });
    for (const p of ["/trips", "/dashboard", "/account"]) {
      await page.goto(p);
      await expectNoHorizontalScroll(page);
    }

    // Manager: Approvals appears in the same place
    await nav.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await page.getByLabel("Email").fill("manager@demo.test");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("heading", { name: /^Hi / })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Approvals" })).toBeVisible();
    for (const p of ["/approvals", "/team", "/trips", "/outbox"]) {
      await page.goto(p);
      await expectNoHorizontalScroll(page);
    }
    await page.goto("/dashboard");
    await page.screenshot({ path: "scripts/ralph/shots/US-025-nav-375.png" });

    // Finance: Claims instead
    await nav.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await page.getByLabel("Email").fill("finance@demo.test");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("heading", { name: /^Hi / })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Claims" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Approvals" })).toHaveCount(0);
    await page.goto("/claims");
    await expectNoHorizontalScroll(page);
  });
});
