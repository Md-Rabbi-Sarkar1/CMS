import { expect, test } from "@playwright/test";

import { ADMIN, loginAsAdmin } from "./helpers";

test.describe("Authentication", () => {
  test("logs in and lands on the dashboard", async ({ page }) => {
    await loginAsAdmin(page);

    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: /Projects/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Tasks/ })).toBeVisible();
  });

  test("shows an error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ADMIN.email);
    await page.getByLabel("Password").fill("wrong-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText(/invalid/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("signs out and can no longer access the dashboard", async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
