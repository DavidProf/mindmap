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

test("smoke: node editor caps text at 30 characters", async ({ page }) => {
    const projectName = `Limit ${Date.now()}`;

    await page.goto("/");
    await page.getByRole("button", { name: /new project|create your first project/i }).first().click();
    await page.getByLabel("Project name").fill(projectName);
    await page.getByRole("button", { name: "Create project" }).click();
    await page.getByRole("button", { name: `Open project ${projectName}` }).click();
    await expect(page).toHaveURL(/#\/project\/.+/);

    await page.getByLabel(projectName, { exact: true }).click();
    await page.getByRole("button", { name: `Add child to ${projectName}` }).first().click();
    const editor = page.getByLabel("Edit node text");
    await expect(editor).toBeVisible();
    await editor.pressSequentially("x".repeat(35));
    await expect(editor).toHaveValue("x".repeat(30));
    await expect(page.getByText("30/30")).toBeVisible();
    await editor.press("Escape");
});

test("smoke: over-limit stored node still renders until edited", async ({ page }) => {
    await page.addInitScript(() => {
        const now = new Date().toISOString();
        window.localStorage.setItem(
            "mindmap:projects",
            JSON.stringify([
                { id: "p1", name: "Grandfather", rootNodeId: "r1", createdAt: now, updatedAt: now, viewport: { x: 0, y: 0, zoom: 1 } },
            ]),
        );
        window.localStorage.setItem(
            "mindmap:nodes",
            JSON.stringify([
                { id: "r1", projectId: "p1", parentId: null, text: "x".repeat(40), side: null, collapsed: false, createdAt: now, updatedAt: now },
            ]),
        );
    });
    await page.goto("/#/project/p1");
    await expect(page.getByTestId("tree-canvas")).toBeVisible();
    await expect(page.locator('[data-node-id="r1"] .node-circle__text')).toHaveText("x".repeat(40));
});
