import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("landing page exposes the product identity", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Cheer\s*Connect/i }).first()).toBeVisible();
});

test("landing page has no automatically detectable accessibility violations", async ({ page }) => {
   await page.goto("/");
   await page.waitForTimeout(1000);
   const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("authentication pages have no automatically detectable accessibility violations", async ({ page }) => {
  for (const path of ["/login", "/register"]) {
    await page.goto(path);
     await page.waitForTimeout(1500);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  }
});

test("protected routes redirect unauthenticated users to login", async ({ page }) => {
  await page.goto("/feed");
  await expect(page).toHaveURL(/\/login/);
});

test("registration form communicates password requirements", async ({ page }) => {
  await page.goto("/register");
  const password = page.locator('input[type="password"]').first();
  await password.fill("123");
  await page.getByRole("button", { name: /criar conta/i }).click();
  await expect(page.getByText(/8 caracteres/i).first()).toBeVisible();
});

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

async function authenticate(page: Page, userEmail: string, userPassword: string) {
  const csrfResponse = await page.request.get("/api/auth/csrf");
  const { csrfToken } = await csrfResponse.json();
  const response = await page.request.post("/api/auth/callback/credentials", {
    form: { csrfToken, email: userEmail, password: userPassword, callbackUrl: "/feed", json: "true" },
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    maxRedirects: 0,
  });
  expect(response.ok()).toBe(true);
}

test.describe("authenticated smoke flows", () => {
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD for authenticated smoke tests");

  test("login and open core modules", async ({ page }) => {
     await authenticate(page, email!, password!);
     await page.goto("/feed");
     await expect(page).toHaveURL(/\/feed/);

    for (const path of ["/search", "/events", "/connections", "/messages", "/teams"]) {
      await page.goto(path);
       await expect(page.locator("main")).toBeVisible();
       await page.waitForTimeout(1500);
       const results = await new AxeBuilder({ page }).analyze();
       expect(results.violations).toEqual([]);
    }
  });
});
