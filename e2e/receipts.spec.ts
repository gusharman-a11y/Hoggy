import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";

test.beforeAll(() => {
  execSync("npx tsx scripts/seed.ts", { stdio: "ignore" });
});

const SLUG = "sample-paediatrics-spring-symposium-2027";
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");

test("doctor uploads, views, downloads and deletes their own receipts", async ({ page, browser }) => {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(`Dr Taxi ${unique()}`);
  await page.getByLabel("Email").fill(`taxi${unique()}@example.test`);
  await page.getByLabel("Password (8+ characters)").fill("password123");
  await page.getByLabel("Hospital join code").fill("DEMO2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.goto(`/conferences/${SLUG}`);
  await page.getByRole("button", { name: "Plan trip" }).click();
  await expect(page).toHaveURL(/\/trips\/\d+$/);
  const tripUrl = page.url();
  const form = page.getByTestId("upload-receipt");
  await expect(page.getByRole("heading", { name: "Receipts" })).toBeVisible();

  // Wrong type is rejected with a clear message and the typed values stay
  await form.getByLabel(/Receipt file/).setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await form.getByLabel("Description").fill("Not a receipt");
  await form.getByLabel("Amount (AUD)").fill("5");
  await form.getByRole("button", { name: "Upload receipt" }).click();
  await expect(form.locator("p.error")).toHaveText(/isn't supported.*PDF, JPG or PNG/);
  await expect(form.getByLabel("Description")).toHaveValue("Not a receipt");
  await expect(page.getByTestId("receipt")).toHaveCount(0);

  // PDF taxi receipt
  await form.getByLabel(/Receipt file/).setInputFiles({ name: "taxi.pdf", mimeType: "application/pdf", buffer: PDF });
  await form.getByLabel("What is it?").selectOption("taxi");
  await form.getByLabel("Description").fill("Taxi to venue");
  await form.getByLabel("Amount (AUD)").fill("42.50");
  await form.getByRole("button", { name: "Upload receipt" }).click();
  await expect(page).toHaveURL(/\?receipt=added$/);
  await expect(page.getByRole("status")).toContainText("Receipt uploaded");
  const taxi = page.getByTestId("receipt").filter({ hasText: "Taxi to venue" });
  await expect(taxi).toContainText("AUD 42.50");

  // PNG meal receipt
  await form.getByLabel(/Receipt file/).setInputFiles({ name: "dinner.png", mimeType: "image/png", buffer: PNG });
  await form.getByLabel("What is it?").selectOption("meals");
  await form.getByLabel("Description").fill("Conference dinner");
  await form.getByLabel("Amount (AUD)").fill("30");
  await form.getByRole("button", { name: "Upload receipt" }).click();
  await expect(page.getByTestId("receipt")).toHaveCount(2);
  await page.screenshot({ path: "scripts/ralph/shots/US-018-receipts.png", fullPage: true });

  // View inline + download as attachment, bytes intact
  const viewHref = (await taxi.getByRole("link", { name: "View" }).getAttribute("href"))!;
  const view = await page.request.get(viewHref);
  expect(view.headers()["content-type"]).toBe("application/pdf");
  expect(view.headers()["content-disposition"]).toMatch(/^inline/);
  expect(Buffer.from(await view.body()).equals(PDF)).toBe(true);
  const dl = await page.request.get((await taxi.getByRole("link", { name: "Download" }).getAttribute("href"))!);
  expect(dl.headers()["content-disposition"]).toMatch(/^attachment; filename="taxi.pdf"/);

  // Another doctor can't see the trip or its receipts
  const other = await browser.newPage();
  await other.goto("/signup");
  await other.getByLabel("Your name").fill(`Dr Other ${unique()}`);
  await other.getByLabel("Email").fill(`other${unique()}@example.test`);
  await other.getByLabel("Password (8+ characters)").fill("password123");
  await other.getByLabel("Hospital join code").fill("DEMO2026");
  await other.getByRole("button", { name: "Create account" }).click();
  await expect(other).toHaveURL(/\/account$/);
  expect((await other.request.get(viewHref)).status()).toBe(404);

  // Manager sees the receipts but can't delete or upload
  const mgr = await browser.newPage();
  await mgr.goto("/login");
  await mgr.getByLabel("Email").fill("manager@demo.test");
  await mgr.getByLabel("Password").fill("password123");
  await mgr.getByRole("button", { name: "Log in" }).click();
  await expect(mgr.getByRole("heading", { name: /^Hi / })).toBeVisible();
  await mgr.goto(tripUrl);
  await expect(mgr.getByTestId("receipt")).toHaveCount(2);
  await expect(mgr.getByRole("button", { name: /^Delete/ })).toHaveCount(0);
  await expect(mgr.getByTestId("upload-receipt")).toHaveCount(0);
  await mgr.close();
  await other.close();

  // Owner deletes one
  await taxi.getByRole("button", { name: "Delete Taxi to venue" }).click();
  await expect(page).toHaveURL(/\?receipt=deleted$/);
  await expect(page.getByTestId("receipt")).toHaveCount(1);
  await expect(page.getByTestId("receipt")).toContainText("Conference dinner");
  expect((await page.request.get(viewHref)).status()).toBe(404);

  // Bigger than the 1 MB server-action default still works
  const big = Buffer.concat([PDF, Buffer.alloc(3 * 1024 * 1024, 0x20)]);
  await form.getByLabel(/Receipt file/).setInputFiles({ name: "registration.pdf", mimeType: "application/pdf", buffer: big });
  await form.getByLabel("What is it?").selectOption("registration");
  await form.getByLabel("Description").fill("Registration fee");
  await form.getByLabel("Amount (AUD)").fill("950");
  await form.getByRole("button", { name: "Upload receipt" }).click();
  await expect(page.getByTestId("receipt")).toHaveCount(2);
  await expect(page.getByTestId("receipt").filter({ hasText: "Registration fee" })).toContainText("AUD 950.00");
});
