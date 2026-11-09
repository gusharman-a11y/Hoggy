import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

test.beforeAll(() => {
  execSync("npx tsx scripts/seed.ts", { stdio: "ignore" });
});

const SLUG = "sample-paediatrics-spring-symposium-2027";
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

async function signUp(page: import("@playwright/test").Page, name: string) {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(`pack${unique()}@example.test`);
  await page.getByLabel("Password (8+ characters)").fill("password123");
  await page.getByLabel("Hospital join code").fill("DEMO2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

test("trip page offers a claim pack: cover + form + every receipt page in one PDF", async ({ page, browser }) => {
  const surname = `Packer${unique()}`;
  await signUp(page, `Dr Pat ${surname}`);
  await page.goto(`/conferences/${SLUG}`);
  await page.getByRole("button", { name: "Plan trip" }).click();
  await expect(page).toHaveURL(/\/trips\/\d+$/);
  const tripUrl = page.url();
  await expect(page.getByTestId("claim-pack-preview")).toHaveCount(0);

  const twoPages = await PDFDocument.create();
  twoPages.addPage([300, 400]);
  twoPages.addPage([300, 400]);
  const form = page.getByTestId("upload-receipt");
  await form.getByLabel(/Receipt file/).setInputFiles({
    name: "registration.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await twoPages.save()),
  });
  await form.getByLabel("What is it?").selectOption("registration");
  await form.getByLabel("Description").fill("Registration fee");
  await form.getByLabel("Amount (AUD)").fill("950");
  await form.getByRole("button", { name: "Upload receipt" }).click();
  await expect(page.getByTestId("receipt")).toHaveCount(1);

  await form.getByLabel(/Receipt file/).setInputFiles({ name: "taxi.png", mimeType: "image/png", buffer: PNG });
  await form.getByLabel("What is it?").selectOption("taxi");
  await form.getByLabel("Description").fill("Taxi to venue");
  await form.getByLabel("Amount (AUD)").fill("42.50");
  await form.getByRole("button", { name: "Upload receipt" }).click();
  await expect(page.getByTestId("receipt")).toHaveCount(2);

  const link = page.getByRole("link", { name: "Preview claim pack" });
  await expect(link).toBeVisible();
  await link.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "scripts/ralph/shots/US-021-claim-pack.png", fullPage: true });

  // Clicking downloads the PDF with the claim-<slug>-<surname>.pdf name
  const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
  expect(download.suggestedFilename()).toBe(`claim-${SLUG}-${surname.toLowerCase()}.pdf`);

  const href = (await link.getAttribute("href"))!;
  const res = await page.request.get(href);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  const pack = await PDFDocument.load(await res.body());
  // cover (1) + claim form (1) + registration (2) + taxi image (1)
  expect(pack.getPageCount()).toBe(5);
  expect(pack.getTitle()).toContain(surname);

  // Another doctor can't get it
  const other = await browser.newPage();
  await signUp(other, `Dr Other ${unique()}`);
  expect((await other.request.get(href)).status()).toBe(404);
  await other.close();
  expect(tripUrl).toMatch(/\/trips\/\d+$/);
});
