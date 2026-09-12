import { expect, test } from "@playwright/test";

test("links: attach via dialog shows badge and persists across reload", async ({ page }) => {
    const projectName = `Link ${Date.now()}`;

    await page.goto("/");
    await page.getByRole("button", { name: /new project|create your first project/i }).first().click();
    await page.getByLabel("Project name").fill(projectName);
    await page.getByRole("button", { name: "Create project" }).click();
    await page.getByRole("button", { name: `Open project ${projectName}` }).click();
    await expect(page).toHaveURL(/#\/project\/.+/);

    const root = page.getByLabel(projectName, { exact: true });
    await root.click({ button: "right" });
    await page.getByRole("button", { name: `Add link for "${projectName}"` }).click();
    await expect(page.getByRole("heading", { name: "Add link" })).toBeVisible();

    const urlField = page.getByLabel("Link URL");
    await urlField.fill("not a url");
    await expect(page.getByText("Enter a valid http(s) URL.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save link" })).toBeDisabled();

    await urlField.fill("example.com");
    await page.getByRole("button", { name: "Save link" }).click();
    await expect(page.getByRole("button", { name: `Open link for "${projectName}"` })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: `Open link for "${projectName}"` })).toBeVisible();
});
