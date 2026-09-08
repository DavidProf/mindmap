import { expect, test, type Page } from "@playwright/test";

async function createAndOpenProject(page: Page, projectName: string) {
    await page.goto("/");
    await page.getByRole("button", { name: /new project|create your first project/i }).first().click();
    await page.getByLabel("Project name").fill(projectName);
    await page.getByRole("button", { name: "Create project" }).click();
    await page.getByRole("button", { name: `Open project ${projectName}` }).click();
    await expect(page).toHaveURL(/#\/project\/.+/);
}

async function addChild(page: Page, parentName: string, childText: string) {
    await page.getByLabel(parentName, { exact: true }).hover();
    await page.getByRole("button", { name: `Add child to ${parentName}` }).first().click();
    const editor = page.getByLabel("Edit node text");
    await editor.fill(childText);
    await editor.press("Enter");
    await expect(page.getByText(childText)).toBeVisible();
}

test("storage: nodes persist across reload via IndexedDB", async ({ page }) => {
    const projectName = `Persist ${Date.now()}`;
    await createAndOpenProject(page, projectName);
    await expect(page.getByText("Using local fallback storage")).toHaveCount(0);
    await addChild(page, projectName, "Persisted kid");

    await page.reload();
    await expect(page.getByText("Persisted kid")).toBeVisible();
    await expect(page.getByText(projectName).first()).toBeVisible();

    await page.goto("/");
    await expect(page.getByRole("button", { name: `Open project ${projectName}` })).toBeVisible();
});

test("storage: blocked IndexedDB falls back with warning and persists", async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(window, "indexedDB", { value: undefined, configurable: true });
    });
    const projectName = `Fallback ${Date.now()}`;
    await createAndOpenProject(page, projectName);
    await expect(page.getByText("Using local fallback storage").first()).toBeVisible();
    await addChild(page, projectName, "Fallback kid");

    await page.reload();
    await expect(page.getByText("Fallback kid")).toBeVisible();
    await expect(page.getByText("Using local fallback storage").first()).toBeVisible();

    await page.goto("/");
    await expect(page.getByText("Using local fallback storage").first()).toBeVisible();
    await expect(page.getByRole("button", { name: `Open project ${projectName}` })).toBeVisible();
});
