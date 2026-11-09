import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const SLUG = "sample-paediatrics-spring-symposium-2027";
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;
// SAMPLE Harbour Taxis $45.75 (a sidecar tells the mock reader what the photo says)
const TAXI_PHOTO = fs.readFileSync(path.join(process.cwd(), "src/providers/__fixtures__/receipts/taxi-photo.png"));

test("doctor snaps a receipt photo, checks the auto-filled details and confirms", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(`Dr Snap ${unique()}`);
  await page.getByLabel("Email").fill(`snap${unique()}@example.test`);
  await page.getByLabel("Password (8+ characters)").fill("password123");
  await page.getByLabel("Hospital join code").fill("DEMO2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.goto(`/conferences/${SLUG}`);
  await page.getByRole("button", { name: "Plan trip" }).click();
  await expect(page).toHaveURL(/\/trips\/\d+$/);

  // Snap receipt is the first (primary) receipt action, camera-ready
  const snap = page.getByTestId("snap-receipt");
  const input = snap.getByLabel("Snap receipt");
  await expect(input).toHaveAttribute("accept", "image/*,application/pdf");
  await expect(input).toHaveAttribute("capture", "environment");
  await expect(page.getByTestId("upload-receipt")).toBeVisible();

  await input.setInputFiles({ name: "IMG_0042.png", mimeType: "image/png", buffer: TAXI_PHOTO });
  await expect(page).toHaveURL(/\?receipt=snapped/);
  const card = page.getByTestId("check-receipt");
  await expect(card).toHaveCount(1);
  await expect(card.getByRole("heading", { name: "Check this receipt" })).toBeVisible();
  await expect(card.getByLabel("Supplier")).toHaveValue("SAMPLE Harbour Taxis");
  await expect(card.getByLabel("ABN")).toHaveValue("51 824 753 556");
  await expect(card.getByLabel("Amount (AUD)")).toHaveValue("45.75");
  await expect(card.getByLabel("GST (AUD)")).toHaveValue("4.16");
  await expect(card.getByLabel("Date")).toHaveValue("2027-03-10");
  await expect(card.getByLabel("What is it?")).toHaveValue("taxi");
  const row = page.getByTestId("receipt").filter({ hasText: "SAMPLE Harbour Taxis" });
  await expect(row.getByTestId("receipt-status")).toHaveText("Needs review");
  await page.screenshot({ path: "scripts/ralph/shots/US-028-check-receipt.png", fullPage: true });

  // A bad edit shows an error and keeps what was typed
  await card.getByLabel("ABN").fill("123");
  await card.getByLabel("Amount (AUD)").fill("46.20");
  await card.getByRole("button", { name: "Looks right" }).click();
  await expect(card.locator("p.error")).toHaveText(/11 digits/);
  await expect(card.getByLabel("Amount (AUD)")).toHaveValue("46.20");

  // Fix it and confirm
  await card.getByLabel("ABN").fill("51824753556");
  await card.getByRole("button", { name: "Looks right" }).click();
  await expect(page).toHaveURL(/\?receipt=confirmed$/);
  await expect(page.getByRole("status")).toContainText("Receipt checked");
  await expect(page.getByTestId("check-receipt")).toHaveCount(0);
  await expect(row).toContainText("AUD 46.20");
  await expect(row.getByTestId("receipt-status")).toHaveCount(0);
  await page.screenshot({ path: "scripts/ralph/shots/US-028-confirmed.png", fullPage: true });

  // A file type the reader can't take is refused on the spot
  await page.getByTestId("snap-receipt").getByLabel("Snap receipt").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });
  await expect(page.getByTestId("snap-receipt").locator("p.error")).toHaveText(/PDF, JPG or PNG/);
  await expect(page.getByTestId("receipt")).toHaveCount(1);
});
