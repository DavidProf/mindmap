import { describe, expect, it } from "vitest";
import {
    buildExportFilename,
    EXPORT_PADDING,
    NOTE_MAX_CHARS_PER_LINE,
    NOTE_MAX_LINES,
    noteRectForExport,
    paddedExportBounds,
    resolveExportScale,
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
