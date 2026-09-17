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

test("export: preview opens, shows fitted image, and download closes it", async ({ page }) => {
    const projectName = `Preview ${Date.now()}`;

    await page.goto("/");
    await page.getByRole("button", { name: /new project|create your first project/i }).first().click();
    await page.getByLabel("Project name").fill(projectName);
    await page.getByRole("button", { name: "Create project" }).click();
    await page.getByRole("button", { name: `Open project ${projectName}` }).click();
    await expect(page).toHaveURL(/#\/project\/.+/);

    await page.getByRole("button", { name: "Export PNG" }).click();
    await expect(page.getByRole("heading", { name: "Export preview" })).toBeVisible();
    const image = page.getByTestId("export-preview-image");
    await expect(image).toBeVisible();
    const src = await image.getAttribute("src");
    expect(src?.startsWith("data:image/png")).toBe(true);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PNG" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/-mindmap\.png$/);
    await expect(page.getByRole("heading", { name: "Export preview" })).toHaveCount(0);
});

test("media fill (13e): filled node hides text, toggle restores it", async ({ page }) => {
    // 1x1 red PNG served for the node's image URL.
    const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
    );
    await page.route("**://example.com/test-image.png", (route) => route.fulfill({ body: png, contentType: "image/png", headers: { "Access-Control-Allow-Origin": "*" } }));

    await page.addInitScript(() => {
        const now = new Date().toISOString();
        window.localStorage.setItem(
            "mindmap:projects",
            JSON.stringify([
                { id: "p1", name: "Filled", rootNodeId: "r1", createdAt: now, updatedAt: now, viewport: { x: 0, y: 0, zoom: 1 } },
            ]),
        );
        window.localStorage.setItem(
            "mindmap:nodes",
            JSON.stringify([
                { id: "r1", projectId: "p1", parentId: null, text: "Root", kind: "circle", url: null, media: null, mediaFill: true, side: null, collapsed: false, createdAt: now, updatedAt: now },
                {
                    id: "n2",
                    projectId: "p1",
                    parentId: "r1",
                    text: "Photo",
                    kind: "note",
                    url: null,
                    media: { kind: "image", src: "https://example.com/test-image.png", uploadId: null },
                    mediaFill: true,
                    side: "south",
                    collapsed: false,
                    createdAt: now,
                    updatedAt: now,
                },
            ]),
        );
    });

    await page.goto("/#/project/p1");
    await expect(page.getByTestId("tree-canvas")).toBeVisible();

    const rect = page.locator('[data-node-id="n2"] .node-rect');
    await expect(page.locator('[data-node-id="n2"] .node-rect--filled')).toBeVisible();
    await expect(page.locator('[data-node-id="n2"] .node-rect__text')).toHaveCount(0);
    await expect(page.locator('[data-node-id="n2"] .node-rect__img')).toBeVisible();

    await rect.click({ button: "right" });
    await page.getByRole("button", { name: 'Edit "Photo"' }).click();
    const fillBox = page.getByRole("checkbox", { name: "Fill node with media" });
    await expect(fillBox).toBeChecked();
    await fillBox.click();
    await page.getByRole("button", { name: "Save media" }).click();

    await expect(page.locator('[data-node-id="n2"] .node-rect__text')).toHaveText("Photo");
    await expect(page.locator('[data-node-id="n2"] .node-rect__media')).toBeVisible();

    await rect.click({ button: "right" });
    await page.getByRole("button", { name: 'Edit "Photo"' }).click();
    const fillBoxOff = page.getByRole("checkbox", { name: "Fill node with media" });
    await expect(fillBoxOff).not.toBeChecked();
    await fillBoxOff.click();
    await page.getByRole("button", { name: "Save media" }).click();

    await expect(page.locator('[data-node-id="n2"] .node-rect--filled')).toBeVisible();
    await expect(page.locator('[data-node-id="n2"] .node-rect__text')).toHaveCount(0);
});

test("media fill (13e): export paints the filled node with the image", async ({ page }) => {
    const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
    );
    await page.route("**://example.com/test-image.png", (route) => route.fulfill({ body: png, contentType: "image/png", headers: { "Access-Control-Allow-Origin": "*" } }));

    await page.addInitScript(() => {
        const now = new Date().toISOString();
        window.localStorage.setItem(
            "mindmap:projects",
            JSON.stringify([
                { id: "p1", name: "FilledExport", rootNodeId: "r1", createdAt: now, updatedAt: now, viewport: { x: 0, y: 0, zoom: 1 } },
            ]),
        );
        window.localStorage.setItem(
            "mindmap:nodes",
            JSON.stringify([
                { id: "r1", projectId: "p1", parentId: null, text: "Root", kind: "circle", url: null, media: null, mediaFill: true, side: null, collapsed: false, createdAt: now, updatedAt: now },
                {
                    id: "n2",
                    projectId: "p1",
                    parentId: "r1",
                    text: "Photo",
                    kind: "note",
                    url: null,
                    media: { kind: "image", src: "https://example.com/test-image.png", uploadId: null },
                    mediaFill: true,
                    side: "south",
                    collapsed: false,
                    createdAt: now,
                    updatedAt: now,
                },
            ]),
        );
    });

    await page.goto("/#/project/p1");
    await expect(page.locator('[data-node-id="n2"] .node-rect--filled')).toBeVisible();

    await page.getByRole("button", { name: "Export PNG" }).click();
    const image = page.getByTestId("export-preview-image");
    await expect(image).toBeVisible();
    const src = await image.getAttribute("src");
    expect(src?.startsWith("data:image/png")).toBe(true);

    const redPixels = await page.evaluate(async (dataUrl) => {
        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = dataUrl;
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no 2d");
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
            // The fixture image is 50%-alpha red over white, so it blends to pink.
            if (data[i] > 200 && data[i + 1] > 100 && data[i + 1] < 160 && data[i + 2] > 100 && data[i + 2] < 160) count++;
        }
        return count;
    }, src!);

    // Full-bleed cover paints nearly the whole node; the thumbnail-well
    // fallback would draw well under half as much.
    expect(redPixels).toBeGreaterThan(40000);
});

test("home enhancements (16): duplicate, search, export, import round-trip", async ({ page }) => {
    const stamp = Date.now();
    const projectName = `Home16 ${stamp}`;
    const copyName = `${projectName} (copy)`;

    await page.goto("/");
    await page.getByRole("button", { name: /new project|create your first project/i }).first().click();
    await page.getByLabel("Project name").fill(projectName);
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByRole("button", { name: `Open project ${projectName}` })).toBeVisible();

    await page.getByRole("button", { name: `Open project ${projectName}` }).click();
    await expect(page).toHaveURL(/#\/project\/.+/);
    await page.getByLabel(projectName, { exact: true }).click();
    await page.getByRole("button", { name: `Add child to ${projectName}` }).first().click();
    const editor = page.getByLabel("Edit node text");
    await editor.fill("Roundtrip kid");
    await editor.press("Enter");
    await expect(page.getByText("Roundtrip kid")).toBeVisible();

    await page.goto("/");
    await page.getByRole("button", { name: `Actions for ${projectName}` }).click();
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    await expect(page.getByRole("button", { name: `Open project ${copyName}` })).toBeVisible();

    const search = page.getByLabel("Search projects");
    await search.fill("(copy)");
    await expect(page.getByRole("button", { name: `Open project ${copyName}`, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: `Open project ${projectName}`, exact: true })).toHaveCount(0);
    await expect(page.getByText("1 of 2 projects")).toBeVisible();
    await search.fill("");
    await expect(page.getByRole("button", { name: `Open project ${projectName}`, exact: true })).toBeVisible();

    await page.getByRole("button", { name: `Actions for ${copyName}` }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "Export JSON" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/-mindmap\.json$/);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    await page.getByRole("button", { name: "Import project from JSON" }).click();
    await page.locator('input[type="file"]').setInputFiles(downloadPath!);
    const importedName = `${copyName} (imported)`;
    await expect(page.getByRole("button", { name: `Open project ${importedName}` })).toBeVisible();

    await page.getByRole("button", { name: `Open project ${importedName}` }).click();
    await expect(page).toHaveURL(/#\/project\/.+/);
    await expect(page.getByText("Roundtrip kid")).toBeVisible();

    await page.goto("/");
    const badBuffer = Buffer.from("{nope", "utf-8");
    await page.locator('input[type="file"]').setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: badBuffer });
    await expect(page.getByText("Not a valid mindmap file")).toBeVisible();

    await page.getByRole("combobox", { name: "Sort", exact: true }).click();
    await page.getByRole("option", { name: "Name" }).click();
    const cardNames = page.locator(".home-card__name");
    await expect(cardNames.first()).toHaveText(importedName);
    await page.getByRole("button", { name: "Toggle sort direction" }).click();
    await expect(cardNames.first()).toHaveText(projectName);

    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/");
    await expect(page.getByLabel("Search projects")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Sort", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Import project from JSON" })).toBeVisible();
});

test("media fill (13e): video node plays inline on click and stops on click-out", async ({ page }) => {
    await page.route("**://example.com/clip.mp4", (route) =>
        route.fulfill({
            body: Buffer.alloc(256, 0),
            contentType: "video/mp4",
            headers: { "Access-Control-Allow-Origin": "*" },
        }),
    );

    await page.addInitScript(() => {
        const now = new Date().toISOString();
        window.localStorage.setItem(
            "mindmap:projects",
            JSON.stringify([
                { id: "p1", name: "Video", rootNodeId: "r1", createdAt: now, updatedAt: now, viewport: { x: 0, y: 0, zoom: 1 } },
            ]),
        );
        window.localStorage.setItem(
            "mindmap:nodes",
            JSON.stringify([
                { id: "r1", projectId: "p1", parentId: null, text: "Root", kind: "circle", url: null, media: null, mediaFill: true, side: null, collapsed: false, createdAt: now, updatedAt: now },
                {
                    id: "n2",
                    projectId: "p1",
                    parentId: "r1",
                    text: "Clip",
                    kind: "note",
                    url: null,
                    media: { kind: "video", src: "https://example.com/clip.mp4", uploadId: null },
                    mediaFill: true,
                    side: "south",
                    collapsed: false,
                    createdAt: now,
                    updatedAt: now,
                },
            ]),
        );
    });

    await page.goto("/#/project/p1");
    await expect(page.getByTestId("tree-canvas")).toBeVisible();

    const play = page.getByRole("button", { name: 'Play video for "Clip"' });
    await expect(play).toBeVisible();
    await play.click();

    const video = page.locator('[data-node-id="n2"] .node-rect__player video[controls]');
    await expect(video).toBeVisible();
    await expect(video).toHaveAttribute("src", "https://example.com/clip.mp4");

    // Clicking the canvas outside the node deselects it and unmounts the player.
    await page.getByTestId("tree-canvas").click({ position: { x: 20, y: 20 } });
    await expect(page.locator('[data-node-id="n2"] .node-rect__player')).toHaveCount(0);
});
