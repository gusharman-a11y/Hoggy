import { expect, test } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { E2E_INBOUND_SECRET } from "./inbound-secret";

// Seeded SAMPLE conferences: Brisbane 12–14 Apr 2027 and Adelaide 18–20 Mar 2027.
const BRISBANE = "sample-paediatrics-spring-symposium-2027";
const ADELAIDE = "sample-general-practice-annual-conference-2027";
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function textPdf(lines: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([400, 400]);
  lines.forEach((l, i) => page.drawText(l, { x: 20, y: 370 - i * 14, size: 10, font }));
  return Buffer.from(await doc.save());
}

test("doctor reviews, edits, moves, files and deletes what Hoggy filed", async ({ page }) => {
  const email = `review${unique()}@example.test`;
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(`Dr Review ${unique()}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password (8+ characters)").fill("password123");
  await page.getByLabel("Hospital join code").fill("DEMO2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);

  const plan = async (slug: string) => {
    await page.goto(`/conferences/${slug}`);
    await page.getByRole("button", { name: "Plan trip" }).click();
    await expect(page).toHaveURL(/\/trips\/\d+$/);
    return Number(page.url().split("/").pop());
  };
  const brisbane = await plan(BRISBANE);
  const adelaide = await plan(ADELAIDE);
  const address = (await page.getByTestId("hoggy-inbox-address").textContent())!.trim();
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByTestId("nav-receipts")).toHaveText("Receipts");
  await expect(nav.getByTestId("nav-review-count")).toHaveCount(0);

  const post = async (data: Record<string, unknown>) => {
    const res = await page.request.post("/api/inbound", {
      data: { to: address, from: email, attachments: [], ...data },
      headers: { "x-inbound-secret": E2E_INBOUND_SECRET },
    });
    expect(res.status()).toBe(201);
    return res.json();
  };
  // A Brisbane taxi (filed, needs review), a surf hire and a dinner (both unfiled)
  const taxi = await textPdf(["SAMPLE Riverside Cabs", "Tax invoice", "Date: 13/04/2027", "Total $38.50", "GST $3.50"]);
  expect(
    await post({
      subject: "Fwd: cab",
      attachments: [{ filename: "cab.pdf", contentType: "application/pdf", base64: taxi.toString("base64") }],
    }),
  ).toMatchObject({ filed: [{ tripId: brisbane }] });
  expect((await post({ subject: "Fwd: Booking", text: "SAMPLE Noosa Surf Hire\nDate: 05/01/2027\nTotal $60.00" })).unfiled).toHaveLength(1);
  expect((await post({ subject: "Fwd: Dinner", text: "SAMPLE Corner Bistro\nDate: 02/02/2027\nTotal $84.00" })).unfiled).toHaveLength(1);

  await page.goto("/receipts");
  await expect(page.getByRole("heading", { name: "Receipts to check" })).toBeVisible();
  await expect(nav.getByTestId("nav-review-count")).toHaveText("3");

  const filed = page.getByTestId("review-receipt");
  await expect(filed).toHaveCount(1);
  await expect(filed).toContainText("SAMPLE Riverside Cabs");
  await expect(filed).toContainText("AUD 38.50");
  await expect(filed).toContainText("AUD 3.50");
  await expect(filed).toContainText("13 Apr 2027");
  await expect(filed).toContainText("SAMPLE – Paediatrics Spring Symposium");
  const unfiled = page.getByTestId("review-unfiled");
  await expect(unfiled).toHaveCount(2);
  await page.screenshot({ path: "scripts/ralph/shots/US-030-receipts.png", fullPage: true });

  // Edit: fix the GST; it stays in the review list
  await filed.getByText("Edit", { exact: true }).click();
  await filed.getByLabel("GST (AUD)").fill("3.20");
  await filed.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Changes saved.");
  await expect(filed).toContainText("AUD 3.20");

  // Move: the cab was really on the Adelaide trip
  await filed.getByLabel("Move to").selectOption(String(adelaide));
  await filed.getByRole("button", { name: "Move" }).click();
  await expect(page.getByRole("status")).toHaveText("Receipt moved.");
  await expect(filed).toContainText("SAMPLE – General Practice Annual Conference");

  // Confirm: off the list
  await filed.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByRole("status")).toHaveText("Receipt confirmed.");
  await expect(page.getByTestId("review-receipt")).toHaveCount(0);
  await expect(nav.getByTestId("nav-review-count")).toHaveText("2");

  // File the dinner on the Brisbane trip -> back in the review list
  const dinner = unfiled.filter({ hasText: "SAMPLE Corner Bistro" });
  await dinner.getByLabel("File on").selectOption(String(brisbane));
  await dinner.getByRole("button", { name: "File it" }).click();
  await expect(page.getByRole("status")).toHaveText("Receipt moved.");
  await expect(page.getByTestId("review-receipt")).toContainText("SAMPLE Corner Bistro");

  // Personal — delete the surf hire (row and file gone)
  const surf = unfiled.filter({ hasText: "SAMPLE Noosa Surf Hire" });
  const surfHref = (await surf.getByRole("link", { name: "View" }).getAttribute("href"))!;
  page.once("dialog", (d) => d.accept());
  await surf.getByRole("button", { name: "Personal — delete" }).click();
  await expect(page.getByRole("status")).toHaveText("Receipt deleted.");
  await expect(page.getByTestId("review-unfiled")).toHaveCount(0);
  expect((await page.request.get(surfHref)).status()).toBe(404);
  await expect(nav.getByTestId("nav-review-count")).toHaveText("1");

  // The trips show where things ended up
  await page.goto(`/trips/${adelaide}`);
  await expect(page.getByTestId("receipt").filter({ hasText: "SAMPLE Riverside Cabs" })).toHaveCount(1);
  await expect(page.getByTestId("check-receipt")).toHaveCount(0);
  await page.goto(`/trips/${brisbane}`);
  await expect(page.getByTestId("receipt").filter({ hasText: "SAMPLE Corner Bistro" })).toContainText("Needs review");
  await page.goto("/receipts");
  await page.screenshot({ path: "scripts/ralph/shots/US-030-after.png", fullPage: true });
});
