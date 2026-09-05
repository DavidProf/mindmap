import { expect, test } from "@playwright/test";

test("smoke: home loads, project creation opens editor canvas", async ({ page }) => {
    const projectName = `Smoke ${Date.now()}`;

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Your projects" })).toBeVisible();

    await page.getByRole("button", { name: /new project|create your first project/i }).first().click();

    await expect(page.getByRole("heading", { name: "Create project" })).toBeVisible();

    await page.getByLabel("Project name").fill(projectName);
    await page.getByRole("button", { name: "Create project" }).click();

    await expect(page.getByRole("button", { name: `Open project ${projectName}` })).toBeVisible();
    await page.getByRole("button", { name: `Open project ${projectName}` }).click();

    await expect(page).toHaveURL(/#\/project\/.+/);
    await expect(page.getByRole("button", { name: "Re-center" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export PNG" })).toBeVisible();
    await expect(page.locator(".editor-canvas")).toBeVisible();
    await expect(page.getByText(projectName).first()).toBeVisible();
    await expect(page.getByTestId("zoom-badge")).toBeVisible();
    await expect(page.getByTestId("zoom-badge")).toHaveText(/^\d+%$/);
    await page.getByRole("button", { name: "Re-center" }).click();
    await expect(page.getByTestId("zoom-badge")).toHaveText(/^\d+%$/);
});

test("smoke: unknown project shows not-found with back link", async ({ page }) => {
    await page.goto("/#/project/does-not-exist");
    await expect(page.getByRole("heading", { name: "Project not found" })).toBeVisible();
    await expect(page.getByText("Back to projects").first()).toBeVisible();
});
