import { describe, expect, it } from "vitest";
import {
    buildExportFilename,
    paddedExportBounds,
    resolveExportScale,
    wrapLinesPure,
} from "./exportPng";

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
});
