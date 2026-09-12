import { describe, expect, it } from "vitest";
import {
    buildExportFilename,
    coverFitPure,
    EXPORT_PADDING,
    hasDrawableImage,
    linkBadgeCenterPure,
    mediaBadgeCenterPure,
    mediaWellForExport,
    NOTE_MAX_CHARS_PER_LINE,
    NOTE_MAX_LINES,
    noteRectForExport,
    paddedExportBounds,
    resolveExportScale,
    shouldDrawLinkBadge,
    shouldDrawMediaBadge,
    wrapExportTextPure,
    wrapLinesPure,
    wrapNoteLinesPure,
} from "./exportPng";
import { NODE_DIAMETER, NOTE_HEIGHT, NOTE_WIDTH } from "./layout";

describe("buildExportFilename", () => {
    it("slugifies the project name", () => {
        expect(buildExportFilename("My Mind Map")).toBe("my-mind-map-mindmap.png");
    });

    it("falls back for a blank name", () => {
        expect(buildExportFilename("   ")).toBe("mindmap-mindmap.png");
    });
});

describe("wrapLinesPure", () => {
    it("returns no lines for blank text", () => {
        expect(wrapLinesPure("   ")).toEqual([]);
    });

    it("wraps words that exceed the line length", () => {
        expect(wrapLinesPure("hello world", 5)).toEqual(["hello", "world"]);
    });
});

describe("resolveExportScale", () => {
    it("uses the base scale for a small map", () => {
        const padded = paddedExportBounds({ minX: -44, maxX: 44, minY: -44, maxY: 44, width: 88, height: 88 });
        expect(resolveExportScale(padded)).toBe(2);
    });

    it("floors an oversized map at scale 1", () => {
        const padded = paddedExportBounds({ minX: 0, maxX: 5000, minY: 0, maxY: 100, width: 5000, height: 100 });
        expect(resolveExportScale(padded)).toBe(1);
    });

    it("caps the device pixel ratio at 2", () => {
        const padded = paddedExportBounds({ minX: -44, maxX: 44, minY: -44, maxY: 44, width: 88, height: 88 });
        expect(resolveExportScale(padded, 3)).toBe(4);
        expect(resolveExportScale(padded, 0)).toBe(2);
    });

    it("caps the longest side at 4096px", () => {
        const padded = paddedExportBounds({ minX: 0, maxX: 3000, minY: 0, maxY: 100, width: 3000, height: 100 });
        expect(resolveExportScale(padded)).toBeCloseTo(4096 / padded.width, 10);
    });
});

describe("paddedExportBounds", () => {
    it("enforces a one-node minimum for zero-size bounds", () => {
        const padded = paddedExportBounds({ minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 });
        expect(padded.width).toBe(NODE_DIAMETER + EXPORT_PADDING * 2);
        expect(padded.height).toBe(NODE_DIAMETER + EXPORT_PADDING * 2);
    });

    it("centers padding on the bounds midpoint", () => {
        const padded = paddedExportBounds({ minX: 100, maxX: 300, minY: 0, maxY: 0, width: 200, height: 0 });
        expect((padded.minX + padded.maxX) / 2).toBe(200);
    });
});

describe("buildExportFilename edge cases", () => {
    it("strips punctuation and lowercases", () => {
        expect(buildExportFilename("Hello, World!")).toBe("hello-world-mindmap.png");
    });

    it("truncates long names to 60 characters", () => {
        expect(buildExportFilename("a".repeat(100))).toBe(`${"a".repeat(60)}-mindmap.png`);
    });
});

describe("wrapLinesPure edge cases", () => {
    it("packs words up to 12 characters per line by default", () => {
        expect(wrapLinesPure("hello wonderful world")).toEqual(["hello", "wonderful", "world"]);
    });

    it("chunks words longer than one line", () => {
        expect(wrapLinesPure("abcdefghijklmno")).toEqual(["abcdefghijkl", "mno"]);
    });

    it("truncates past three lines with an ellipsis", () => {
        const lines = wrapLinesPure("one two three four five six seven eight", 5, 3);
        expect(lines).toHaveLength(3);
        expect(lines[2].endsWith("…")).toBe(true);
    });

    it("keeps emoji surrogate pairs intact", () => {
        expect(wrapLinesPure("😀 hi")).toEqual(["😀 hi"]);
        expect(wrapLinesPure("😀".repeat(7))).toEqual(["😀".repeat(6), "😀"]);
    });
});

describe("note export helpers", () => {
    it("wraps note text wider and longer than circles", () => {
        expect(NOTE_MAX_CHARS_PER_LINE).toBeGreaterThan(12);
        expect(NOTE_MAX_LINES).toBeGreaterThan(3);
        expect(wrapNoteLinesPure("hello wonderful map")).toEqual(["hello wonderful map"]);
        const long = Array.from({ length: 40 }, (_, i) => `w${i}`).join(" ");
        const lines = wrapNoteLinesPure(long);
        expect(lines.length).toBeGreaterThan(3);
        expect(lines.length).toBeLessThanOrEqual(NOTE_MAX_LINES);
        for (const line of lines) expect(line.length).toBeLessThanOrEqual(NOTE_MAX_CHARS_PER_LINE + 1);
    });

    it("truncates very long notes with an ellipsis", () => {
        const lines = wrapNoteLinesPure("word ".repeat(200).trim());
        expect(lines).toHaveLength(NOTE_MAX_LINES);
        expect(lines[NOTE_MAX_LINES - 1].endsWith("…")).toBe(true);
    });

    it("centers the note rect on the node position", () => {
        const rect = noteRectForExport(100, 50, 2);
        expect(rect.width).toBe(NOTE_WIDTH * 2);
        expect(rect.height).toBe(NOTE_HEIGHT * 2);
        expect(rect.x).toBe(100 - NOTE_WIDTH);
        expect(rect.y).toBe(50 - NOTE_HEIGHT);
    });
});

describe("link export indicator (13b)", () => {
    it("draws a badge only for non-empty urls", () => {
        expect(shouldDrawLinkBadge(null)).toBe(false);
        expect(shouldDrawLinkBadge("   ")).toBe(false);
        expect(shouldDrawLinkBadge("https://example.com/")).toBe(true);
    });
    it("places circle and note badges inside the node bounds", () => {
        const circle = linkBadgeCenterPure(100, 100, 2, "circle");
        expect(circle.radius).toBeGreaterThan(0);
        expect(circle.x).toBeGreaterThan(100);
        expect(circle.y).toBeLessThan(100);
        const note = linkBadgeCenterPure(100, 100, 2, "note");
        const rect = noteRectForExport(100, 100, 2);
        expect(note.x).toBeLessThan(rect.x + rect.width);
        expect(note.x).toBeGreaterThan(rect.x);
        expect(note.y).toBeGreaterThan(rect.y);
        expect(note.y).toBeLessThan(rect.y + rect.height);
        expect(note.y - note.radius).toBeLessThan(rect.y);
    });
    it("centers the circle badge on the rim", () => {
        const badge = linkBadgeCenterPure(100, 100, 2, "circle");
        const dist = Math.hypot(badge.x - 100, badge.y - 100);
        expect(dist).toBeCloseTo((NODE_DIAMETER / 2) * 2, 6);
    });
    it("scales the badge with the export scale", () => {
        const small = linkBadgeCenterPure(0, 0, 1, "circle");
        const large = linkBadgeCenterPure(0, 0, 2, "circle");
        expect(large.radius).toBe(small.radius * 2);
    });
});

describe("media export indicator (13c)", () => {
    it("draws a badge only for image or video media", () => {
        expect(shouldDrawMediaBadge(null)).toBe(false);
        expect(shouldDrawMediaBadge(undefined)).toBe(false);
        expect(shouldDrawMediaBadge("https://example.com/a.png")).toBe(false);
        expect(shouldDrawMediaBadge({ kind: "audio", src: "https://example.com/a.mp3" })).toBe(false);
        expect(shouldDrawMediaBadge({ kind: "image", src: "https://example.com/a.png" })).toBe(true);
        expect(shouldDrawMediaBadge({ kind: "video", src: "https://example.com/v.mp4" })).toBe(true);
    });
    it("places the badge inside the note rect bounds", () => {
        const badge = mediaBadgeCenterPure(100, 100, 2);
        const rect = noteRectForExport(100, 100, 2);
        expect(badge.radius).toBeGreaterThan(0);
        expect(badge.x).toBeGreaterThan(rect.x);
        expect(badge.x).toBeLessThan(rect.x + rect.width);
        expect(badge.y).toBeGreaterThan(rect.y);
        expect(badge.y).toBeLessThan(rect.y + rect.height);
        expect(badge.y - badge.radius).toBeLessThan(rect.y);
    });
    it("scales the badge with the export scale", () => {
        const small = mediaBadgeCenterPure(0, 0, 1);
        const large = mediaBadgeCenterPure(0, 0, 2);
        expect(large.radius).toBe(small.radius * 2);
    });
    it("keeps the photo well inside the note rect", () => {
        const well = mediaWellForExport(100, 50, 2);
        const rect = noteRectForExport(100, 50, 2);
        expect(well.x).toBeGreaterThan(rect.x);
        expect(well.x + well.width).toBeLessThan(rect.x + rect.width);
        expect(well.y).toBeGreaterThan(50);
        expect(well.y + well.height).toBeLessThan(rect.y + rect.height);
        expect(well.height).toBeGreaterThan(0);
    });
});

describe("photo export guards (13c/F-01, F-03)", () => {
    const longNote =
        "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau";
    it("caps photo node text to 3 lines and keeps full wrap otherwise", () => {
        const photo = wrapExportTextPure(longNote, true, true);
        expect(photo.length).toBeLessThanOrEqual(3);
        expect(wrapExportTextPure(longNote, true, false).length).toBeGreaterThan(3);
        expect(wrapExportTextPure("hi", false, false)).toEqual(["hi"]);
        expect(wrapExportTextPure("hi", false, true)).toEqual(["hi"]);
    });
    it("treats only positive-dimension images as drawable", () => {
        expect(hasDrawableImage(null)).toBe(false);
        expect(hasDrawableImage(undefined)).toBe(false);
        expect(hasDrawableImage({ naturalWidth: 0, naturalHeight: 100 })).toBe(false);
        expect(hasDrawableImage({ naturalWidth: 100, naturalHeight: 0 })).toBe(false);
        expect(hasDrawableImage({ naturalWidth: 100, naturalHeight: 50 })).toBe(true);
    });
});

describe("coverFitPure (13e)", () => {
    it("scales to fill, cropping the longer overflow", () => {
        // 2:1 image into a square: width fills, height overflows.
        expect(coverFitPure(200, 100, 100, 100)).toEqual({ dw: 200, dh: 100 });
    });

    it("covers portrait images into landscape boxes", () => {
        const { dw, dh } = coverFitPure(100, 200, 200, 100);
        expect(dw).toBe(200);
        expect(dh).toBe(400);
    });

    it("keeps square images exact", () => {
        expect(coverFitPure(50, 50, 100, 100)).toEqual({ dw: 100, dh: 100 });
    });
});
