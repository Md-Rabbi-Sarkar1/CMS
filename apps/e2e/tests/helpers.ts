import { expect, type Page } from "@playwright/test";

export const ADMIN = {
  name: "Alex Admin",
  email: "admin@demo.local",
  password: process.env.E2E_ADMIN_PASSWORD ?? "Password123!",
};

export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(`Welcome, ${ADMIN.name}`)).toBeVisible();
}

export function modal(page: Page) {
  return page.locator("div.fixed.inset-0.z-50");
}
