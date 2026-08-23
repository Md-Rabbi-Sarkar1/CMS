import { expect, test } from "@playwright/test";

import { loginAsAdmin, modal, uniqueSuffix } from "./helpers";

const suffix = uniqueSuffix();
const projectName = `E2E Tower ${suffix}`;
const taskTitle = `E2E Task ${suffix}`;
const materialName = `E2E Rebar ${suffix}`;
const expenseDescription = `E2E cement order ${suffix}`;
const issueTitle = `E2E cracked beam ${suffix}`;

test.describe.configure({ mode: "serial" });

test.describe("Critical user flows", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("creates a project and sees it in the list", async ({ page }) => {
    await page.goto("/projects");
    await page.getByRole("button", { name: "New project" }).click();

    const dialog = modal(page);
    await expect(dialog.getByRole("heading", { name: "Create project" })).toBeVisible();
    await dialog.getByLabel("Name").fill(projectName);
    await dialog.getByLabel("Description").fill("Created by the E2E suite");
    await dialog.getByRole("button", { name: "Create" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("link", { name: new RegExp(projectName) })).toBeVisible();
  });

  test("creates a task on the project and sees it with TODO status", async ({ page }) => {
    await page.goto("/projects");
    await page.getByRole("link", { name: new RegExp(projectName) }).click();

    await page.locator('a[href^="/tasks?projectId="]').first().click();
    await expect(page).toHaveURL(/\/tasks\?projectId=/);

    await page.getByRole("button", { name: "New task" }).click();
    const dialog = modal(page);
    await dialog.getByLabel("Title").fill(taskTitle);
    await dialog.getByLabel("Priority").selectOption("HIGH");
    await dialog.getByRole("button", { name: "Create" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(taskTitle)).toBeVisible();
    await expect(page.getByText("TODO").first()).toBeVisible();
  });

  test("creates a material and records a purchase transaction", async ({ page }) => {
    await page.goto("/materials");
    await page.getByRole("button", { name: "New material" }).click();

    const dialog = modal(page);
    await dialog.getByLabel("Name").fill(materialName);
    await dialog.getByLabel("Unit").fill("kg");
    await dialog.getByLabel("Current stock").fill("5");
    await dialog.getByLabel("Reorder level").fill("10");
    await dialog.getByRole("button", { name: "Create" }).click();

    const card = page.locator("div.rounded-lg.border", {
      has: page.getByRole("heading", { name: materialName, exact: true }),
    });
    await expect(card).toBeVisible();
    await expect(card.getByText("5 kg · reorder at 10")).toBeVisible();
    await expect(card.getByText("Low stock")).toBeVisible();

    await card.getByRole("button", { name: "Record transaction" }).click();
    const txDialog = modal(page);
    await txDialog.getByLabel("Type").selectOption("PURCHASE");
    await txDialog.getByLabel("Quantity").fill("6");
    await txDialog.getByRole("button", { name: "Record" }).click();

    await expect(txDialog).toHaveCount(0);
    await expect(card.getByText("11 kg · reorder at 10")).toBeVisible();
    await expect(card.getByText("In stock")).toBeVisible();
  });

  test("submits an expense and approves it", async ({ page }) => {
    await page.goto("/expenses");
    await page.getByRole("button", { name: "New expense" }).click();

    const dialog = modal(page);
    await dialog.getByLabel("Project").selectOption({ label: projectName });
    await dialog.getByLabel("Category").selectOption("MATERIALS");
    await dialog.getByLabel("Amount").fill("123.45");
    await dialog.getByLabel("Expense date").fill("2026-08-21");
    await dialog.getByLabel("Description").fill(expenseDescription);
    await dialog.getByRole("button", { name: "Create" }).click();

    const row = page.getByRole("row", { name: new RegExp(`${projectName}.*Pending`) });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Review" }).click();
    const reviewDialog = modal(page);
    await reviewDialog.getByLabel("Decision").selectOption("APPROVED");
    await reviewDialog.getByRole("button", { name: "Submit review" }).click();

    await expect(reviewDialog).toHaveCount(0);
    await expect(page.getByRole("row", { name: new RegExp(`${projectName}.*Approved`) })).toBeVisible();
  });

  test("reports an issue and sees it as OPEN", async ({ page }) => {
    await page.goto("/issues");
    await page.getByRole("button", { name: "New issue" }).click();

    const dialog = modal(page);
    await dialog.getByLabel("Project").selectOption({ label: projectName });
    await dialog.getByLabel("Title").fill(issueTitle);
    await dialog.getByLabel("Description").fill("Found during E2E walkthrough");
    await dialog.getByLabel("Priority").selectOption("HIGH");
    await dialog.getByRole("button", { name: "Create" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(issueTitle)).toBeVisible();
    await expect(page.getByText("OPEN").first()).toBeVisible();
  });

  test("shows the low-stock notification and marks all as read", async ({ page }) => {
    await page.goto("/notifications");

    await expect(page.getByText(`Low stock: ${materialName}`)).toBeVisible();
    await page.getByRole("button", { name: "Mark all as read" }).click();

    await expect(page.getByText("You're all caught up.")).toBeVisible();
  });
});
