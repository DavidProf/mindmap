import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const TINY_PNG_BASE64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function fixturePng(): string {
    const dir = join(tmpdir(), "mindmap-upload-fixture");
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "upload.png");
    writeFileSync(path, Buffer.from(TINY_PNG_BASE64, "base64"));
    return path;
}

async function createAndOpenProject(page: Page, projectName: string) {
    await page.goto("/");
    await page.getByRole("button", { name: /new project|create your first project/i }).first().click();
    await page.getByLabel("Project name").fill(projectName);
    await page.getByRole("button", { name: "Create project" }).click();
    await page.getByRole("button", { name: `Open project ${projectName}` }).click();
    await expect(page).toHaveURL(/#\/project\/.+/);
}

test("upload: attach via menu shows thumbnail, persists, previews, and removes", async ({ page }) => {
    const projectName = `Upload ${Date.now()}`;
    await createAndOpenProject(page, projectName);

    await page.getByLabel(projectName, { exact: true }).click({ button: "right" });
    await page.getByRole("button", { name: `Add media to "${projectName}"` }).click();
    await page.getByRole("dialog").locator('input[type="file"]').setInputFiles(fixturePng());
    // A successful dialog upload closes the dialog and attaches the image.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const badge = page.getByRole("button", { name: `Open image for "${projectName}"` });
    await expect(badge).toBeVisible();
    await expect(page.locator(".node-rect__img")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: `Open image for "${projectName}"` })).toBeVisible();
    await expect(page.locator(".node-rect__img")).toBeVisible();

    await page.getByRole("button", { name: "Export PNG" }).click();
    await expect(page.getByRole("heading", { name: "Export preview" })).toBeVisible();
    await expect(page.getByTestId("export-preview-image")).toBeVisible();
    await expect(page.getByTestId("export-media-warning")).toHaveCount(0);
    await page.getByRole("button", { name: "Cancel" }).click();

    await page.getByLabel(projectName, { exact: true }).click({ button: "right" });
    await page.getByRole("button", { name: `Edit "${projectName}"` }).click();
    await page.getByRole("button", { name: "Remove media" }).click();
    await expect(page.getByRole("button", { name: `Open image for "${projectName}"` })).toHaveCount(0);
});

test("upload: converting a media node to circle drops the media", async ({ page }) => {
    const projectName = `Convert ${Date.now()}`;
    await createAndOpenProject(page, projectName);

    await page.getByLabel(projectName, { exact: true }).click({ button: "right" });
    await page.getByRole("button", { name: `Add media to "${projectName}"` }).click();
    await page.getByRole("dialog").locator('input[type="file"]').setInputFiles(fixturePng());
    await expect(page.getByRole("button", { name: `Open image for "${projectName}"` })).toBeVisible();

    await page.getByLabel(projectName, { exact: true }).click({ button: "right" });
    await page.getByRole("button", { name: `Convert "${projectName}" to circle` }).click();
    await page.getByRole("button", { name: "Convert" }).click();
    await expect(page.getByRole("button", { name: `Open image for "${projectName}"` })).toHaveCount(0);
    await expect(page.locator(".node-circle").first()).toBeVisible();
});

test("upload: combined editor keeps unsaved edits when uploading mid-edit", async ({ page }) => {
    const projectName = `Keep ${Date.now()}`;
    await createAndOpenProject(page, projectName);

    // Attach URL media first (node becomes media kind).
    await page.getByLabel(projectName, { exact: true }).click({ button: "right" });
    await page.getByRole("button", { name: `Add media to "${projectName}"` }).click();
    await page.getByLabel("Media URL").fill("https://example.com/a.png");
    await page.getByRole("button", { name: "Save media" }).click();

    // Open the combined editor, type text, then upload: edits must survive.
    await page.getByLabel(projectName, { exact: true }).click({ button: "right" });
    await page.getByRole("button", { name: `Edit "${projectName}"` }).click();
    await page.getByLabel("Text").fill("Remember me");
    await page.getByRole("dialog").locator('input[type="file"]').setInputFiles(fixturePng());
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel("Text")).toHaveValue("Remember me");
    // Uncheck fill: filled nodes hide their text, so the text shows only unfilled.
    await page.getByRole("checkbox", { name: "Fill node with media" }).click();
    await page.getByRole("button", { name: "Save media" }).click();
    await expect(page.getByText("Remember me")).toBeVisible();
    await expect(page.locator(".node-rect__img")).toBeVisible();
});

test("upload: invalid file shows an inline error and saves nothing", async ({ page }) => {
    const projectName = `BadUpload ${Date.now()}`;
    await createAndOpenProject(page, projectName);

    await page.getByLabel(projectName, { exact: true }).click({ button: "right" });
    await page.getByRole("button", { name: `Add media to "${projectName}"` }).click();
    const dir = join(tmpdir(), "mindmap-upload-fixture");
    mkdirSync(dir, { recursive: true });
    const badPath = join(dir, "upload.txt");
    writeFileSync(badPath, "not an image");
    await page.getByRole("dialog").locator('input[type="file"]').setInputFiles(badPath);
    await expect(page.getByText("Choose a PNG, JPEG, WEBP, or GIF image.")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("button", { name: `Open image for "${projectName}"` })).toHaveCount(0);
});

test("upload: disabled with notice when IndexedDB is unavailable", async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(window, "indexedDB", { value: undefined, configurable: true });
    });
    const projectName = `NoIdb ${Date.now()}`;
    await createAndOpenProject(page, projectName);

    await page.getByLabel(projectName, { exact: true }).click({ button: "right" });

    await page.getByRole("button", { name: `Add media to "${projectName}"` }).click();
    await expect(page.getByText("Uploads need IndexedDB storage")).toBeVisible();
});
