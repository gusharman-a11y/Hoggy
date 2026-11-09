import { expect, test } from "@playwright/test";

const unique = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

test("sign up with an unknown code shows an error", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Dr Wrong");
  await page.getByLabel("Email").fill(`wrong${unique()}@example.test`);
  await page.getByLabel("Password (8+ characters)").fill("password123");
  await page.getByLabel("Hospital join code").fill("NOPE0000");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator("p.error")).toContainText("recognise that hospital code");
});

test("create a hospital, see its join code, log out, then a doctor joins with it and logs back in", async ({ page }) => {
  const id = unique();
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Ada Admin");
  await page.getByLabel("Email").fill(`admin${id}@example.test`);
  await page.getByLabel("Password (8+ characters)").fill("password123");
  await page.getByLabel("Create a new hospital").check();
  await page.getByLabel("Hospital name").fill(`E2E Hospital ${id}`);
  await page.getByLabel("Finance email (where claims are sent)").fill(`finance${id}@example.test`);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("status")).toContainText("Share this join code");
  const code = (await page.getByTestId("join-code").textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{8}$/);
  await expect(page.getByText("admin", { exact: true })).toBeVisible();
  await page.screenshot({ path: "scripts/ralph/shots/US-003-new-hospital.png", fullPage: true });

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();

  const doctorEmail = `doc${id}@example.test`;
  await page.goto("/signup");
  await page.screenshot({ path: "scripts/ralph/shots/US-003-signup.png", fullPage: true });
  await page.getByLabel("Your name").fill("Dr Dana");
  await page.getByLabel("Email").fill(doctorEmail);
  await page.getByLabel("Password (8+ characters)").fill("password123");
  await page.getByLabel("Hospital join code").fill(code.toLowerCase());
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Hi Dr Dana" })).toBeVisible();
  await expect(page.getByText(`E2E Hospital ${id}`)).toBeVisible();
  await expect(page.getByText("doctor", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await page.getByLabel("Email").fill(doctorEmail);
  await page.getByLabel("Password").fill("wrongpass1");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.locator("p.error")).toContainText("Wrong email or password");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Hi Dr Dana" })).toBeVisible();

  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "sl_session")?.httpOnly).toBe(true);
});

test("logged-out users are sent to login and back", async ({ page }) => {
  const id = unique();
  const email = `back${id}@example.test`;
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Bo Back");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password (8+ characters)").fill("password123");
  await page.getByLabel("Create a new hospital").check();
  await page.getByLabel("Hospital name").fill(`Back Hospital ${id}`);
  await page.getByLabel("Finance email (where claims are sent)").fill(`fin${id}@example.test`);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();

  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount/);
  await page.screenshot({ path: "scripts/ralph/shots/US-003-login.png", fullPage: true });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "Hi Bo Back" })).toBeVisible();
});
