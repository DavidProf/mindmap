import { expect, test } from "@playwright/test";

test("media: attach via dialog shows badge and persists across reload", async ({ page }) => {
    const projectName = `Media ${Date.now()}`;

    await page.goto("/");
    await page.getByRole("button", { name: /new project|create your first project/i }).first().click();
    await page.getByLabel("Project name").fill(projectName);
    await page.getByRole("button", { name: "Create project" }).click();
    await page.getByRole("button", { name: `Open project ${projectName}` }).click();
    await expect(page).toHaveURL(/#\/project\/.+/);

    const root = page.getByLabel(projectName, { exact: true });
    await root.click({ button: "right" });
    await page.getByRole("menuitem", { name: `Add media for "${projectName}"` }).click();
    await expect(page.getByRole("heading", { name: "Add media" })).toBeVisible();

    const urlField = page.getByLabel("Media URL");
    await urlField.fill("not a url");
    await expect(page.getByText("Enter a valid http(s) URL.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save media" })).toBeDisabled();

    await urlField.fill("example.com/photo.png");
    await page.getByRole("button", { name: "Save media" }).click();
    await expect(page.getByRole("button", { name: `Open image for "${projectName}"` })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: `Open image for "${projectName}"` })).toBeVisible();
});

test("media: broken image warns in export preview and suggests manual add", async ({ page }) => {
    const projectName = `Broken ${Date.now()}`;

    await page.goto("/");
    await page.getByRole("button", { name: /new project|create your first project/i }).first().click();
    await page.getByLabel("Project name").fill(projectName);
    await page.getByRole("button", { name: "Create project" }).click();
    await page.getByRole("button", { name: `Open project ${projectName}` }).click();
    await expect(page).toHaveURL(/#\/project\/.+/);

    const root = page.getByLabel(projectName, { exact: true });
    await root.click({ button: "right" });
    await page.getByRole("menuitem", { name: `Add media for "${projectName}"` }).click();
    await page.getByLabel("Media URL").fill("https://example.com/does-not-exist-13c.png");
    await page.getByRole("button", { name: "Save media" }).click();
    await expect(page.getByRole("button", { name: `Open image for "${projectName}"` })).toBeVisible();

    await page.getByRole("button", { name: "Export PNG" }).click();
    await expect(page.getByRole("heading", { name: "Export preview" })).toBeVisible();
    await expect(page.getByTestId("export-media-warning")).toContainText("adding it to the project manually");
});
