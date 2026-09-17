import { expect, test } from "@playwright/test";

test("undo/redo: add, collapse, and delete round-trip with header buttons and shortcuts", async ({ page }) => {
    const projectName = `Undo ${Date.now()}`;

    await page.goto("/");
    await page.getByRole("button", { name: /new project|create your first project/i }).first().click();
    await page.getByLabel("Project name").fill(projectName);
    await page.getByRole("button", { name: "Create project" }).click();
    await page.getByRole("button", { name: `Open project ${projectName}` }).click();
    await expect(page).toHaveURL(/#\/project\/.+/);

    const undoBtn = page.getByRole("button", { name: "Undo", exact: true });
    const redoBtn = page.getByRole("button", { name: "Redo", exact: true });
    await expect(undoBtn).toBeDisabled();
    await expect(redoBtn).toBeDisabled();

    const root = page.getByLabel(projectName, { exact: true });

    await root.click({ button: "right" });
    await page.getByRole("button", { name: `Edit "${projectName}"` }).click();
    await page.getByLabel("Edit node text").press("Enter");
    await expect(undoBtn).toBeDisabled();

    await root.hover();
    await page.getByRole("button", { name: `Add child to ${projectName}` }).first().click();
    const editor = page.getByLabel("Edit node text");
    await editor.fill("Kid A");
    await editor.press("Enter");
    await expect(page.getByText("Kid A")).toBeVisible();
    await expect(undoBtn).toBeEnabled();

    await page.getByTestId("tree-canvas").click({ position: { x: 20, y: 20 } });
    await page.keyboard.press("Control+z");
    await expect(page.getByText("Kid A")).toHaveCount(0);
    await expect(redoBtn).toBeEnabled();
    await page.keyboard.press("Control+Shift+z");
    await expect(page.getByText("Kid A")).toBeVisible();

    await root.click({ button: "right" });
    await page.getByRole("menuitem", { name: `Collapse "${projectName}"` }).click();
    await expect(page.getByRole("button", { name: /hidden node/ })).toBeVisible();
    await undoBtn.click();
    await expect(page.getByText("Kid A")).toBeVisible();
    await redoBtn.click();
    await expect(page.getByRole("button", { name: /hidden node/ })).toBeVisible();

    await root.hover();
    await page.getByRole("button", { name: `Add child to ${projectName}` }).first().click();
    const editor2 = page.getByLabel("Edit node text");
    await editor2.fill("Kid B");
    await editor2.press("Enter");
    await expect(page.getByText("Kid B")).toBeVisible();
    await undoBtn.click();
    await expect(page.getByText("Kid B")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /hidden node/ })).toBeVisible();

    await undoBtn.click();
    const kid = page.getByLabel("Kid A", { exact: true });
    await kid.click({ button: "right" });
    await page.getByRole("menuitem", { name: `Delete "Kid A"` }).click();
    await page.getByRole("button", { name: "Confirm delete" }).click();
    await expect(page.getByText("Kid A")).toHaveCount(0);
    await undoBtn.click();
    await expect(page.getByText("Kid A")).toBeVisible();
    await redoBtn.click();
    await expect(page.getByText("Kid A")).toHaveCount(0);

    await page.getByLabel(projectName, { exact: true }).click({ button: "right" });
    await page.getByRole("button", { name: `Edit "${projectName}"` }).click();
    const renameEditor = page.getByLabel("Edit node text");
    await renameEditor.fill(`${projectName} Renamed`);
    await renameEditor.press("Enter");
    await expect(page.getByText(`${projectName} Renamed`)).toBeVisible();
    await undoBtn.click();
    await expect(page.getByLabel(projectName, { exact: true })).toBeVisible();
    await redoBtn.click();
    await expect(page.getByText(`${projectName} Renamed`)).toBeVisible();
});
