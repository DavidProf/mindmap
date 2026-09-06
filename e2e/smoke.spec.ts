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

test("polish: collapse badge click and keyboard toggle expand", async ({ page }) => {
    const projectName = `Badge ${Date.now()}`;

    await page.goto("/");
    await page.getByRole("button", { name: /new project|create your first project/i }).first().click();
    await page.getByLabel("Project name").fill(projectName);
    await page.getByRole("button", { name: "Create project" }).click();
    await page.getByRole("button", { name: `Open project ${projectName}` }).click();
    await expect(page).toHaveURL(/#\/project\/.+/);

    const root = page.getByLabel(projectName, { exact: true });
    await root.hover();
    await page.getByRole("button", { name: `Add child to ${projectName}` }).first().click();
    const editor = page.getByLabel("Edit node text");
    await editor.fill("Badge kid");
    await editor.press("Enter");
    await expect(page.getByText("Badge kid")).toBeVisible();

    await root.click({ button: "right" });
    await page.getByRole("menuitem", { name: `Collapse "${projectName}"` }).click();
    const badge = page.getByRole("button", { name: "Expand, 1 hidden node" });
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute("aria-expanded", "false");

    await badge.click();
    await expect(page.getByText("Badge kid")).toBeVisible();
    await expect(page.getByRole("button", { name: /hidden node/ })).toHaveCount(0);

    await root.click({ button: "right" });
    await page.getByRole("menuitem", { name: `Collapse "${projectName}"` }).click();
    const badgeAgain = page.getByRole("button", { name: "Expand, 1 hidden node" });
    await badgeAgain.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Badge kid")).toBeVisible();
});

test("polish: inline project rename blocks duplicate, commits valid name", async ({ page }) => {
    const stamp = Date.now();

    await page.goto("/");
    for (const n of [`Alpha ${stamp}`, `Beta ${stamp}`]) {
        await page.getByRole("button", { name: /new project|create your first project/i }).first().click();
        await page.getByLabel("Project name").fill(n);
        await page.getByRole("button", { name: "Create project" }).click();
        await expect(page.getByRole("button", { name: `Open project ${n}` })).toBeVisible();
    }

    await page.getByRole("button", { name: `Actions for Beta ${stamp}` }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    const input = page.getByLabel("Rename project");
    await input.fill(`Alpha ${stamp}`);
    await input.press("Enter");
    await expect(page.getByText("A project with this name already exists.")).toBeVisible();
    await expect(input).toBeVisible();
    await input.press("Escape");

    await page.getByRole("button", { name: `Actions for Beta ${stamp}` }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await page.getByLabel("Rename project").fill(`Gamma ${stamp}`);
    await page.getByLabel("Rename project").press("Enter");
    await expect(page.getByRole("button", { name: `Open project Gamma ${stamp}` })).toBeVisible();
});
