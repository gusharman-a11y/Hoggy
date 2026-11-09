import { execSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "@playwright/test";

test.beforeAll(() => {
  execSync("npx tsx scripts/seed.ts", { stdio: "ignore" }); // also runs migrations on data/app.db
});

const unique = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

/** Nothing sends email through the UI yet (US-022 will): put one straight in the outbox. */
function putInOutbox(subject: string, pdf: Buffer) {
  const db = new DatabaseSync("data/app.db");
  try {
    const id = Number(
      db
        .prepare("INSERT INTO outbox (to_addr, subject, body_text) VALUES (?, ?, ?)")
        .run("finance@demo.test", subject, "Hello finance,\nclaim pack attached.").lastInsertRowid,
    );
    db.prepare(
      "INSERT INTO outbox_attachments (email_id, filename, content_type, size_bytes, content) VALUES (?, ?, ?, ?, ?)",
    ).run(id, "claim-pack.pdf", "application/pdf", pdf.length, new Uint8Array(pdf));
  } finally {
    db.close();
  }
}

test("outbox lists sent emails and downloads attachments", async ({ page }) => {
  await page.goto("/outbox");
  await expect(page).toHaveURL(/\/login\?next=%2Foutbox$/);

  const subject = `Claim pack ${unique()}`;
  const pdf = Buffer.from(`%PDF-1.7\n% sample ${subject}\n`);
  putInOutbox(subject, pdf);

  await page.getByLabel("Email").fill("finance@demo.test");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Outbox" })).toBeVisible();

  const email = page.locator(".outbox-email", { hasText: subject });
  await expect(email).toContainText("To: finance@demo.test");
  await expect(email).toContainText("claim pack attached.");
  await expect(page.getByRole("link", { name: "Outbox" })).toBeVisible();

  const link = email.getByRole("link", { name: "claim-pack.pdf" });
  const res = await page.request.get((await link.getAttribute("href"))!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  expect(res.headers()["content-disposition"]).toContain('filename="claim-pack.pdf"');
  expect(Buffer.from(await res.body()).equals(pdf)).toBe(true);

  await email.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "scripts/ralph/shots/US-012-outbox.png", fullPage: true });

  const missing = await page.request.get("/outbox/attachments/999999999");
  expect(missing.status()).toBe(404);
});
