import { describe, expect, it } from "vitest";
import {
    buildDuplicateNamePure,
    buildImportedNamePure,
    filterProjectsPure,
    hasUploadMedia,
    parseProjectImportPure,
    sanitizeExportFilenamePure,
    serializeProjectExportPure,
    sortProjectsPure,
} from "./projectHome";
import type { Node } from "../types/node";
import type { Project } from "../types/project";

const VIEW = { x: 0, y: 0, zoom: 1 };

function project(id: string, name: string, updatedAt = "2026-03-01T00:00:00.000Z"): Project {
    return { id, name, rootNodeId: `${id}-root`, createdAt: updatedAt, updatedAt, viewport: { ...VIEW } };
}

function node(id: string, projectId: string, parentId: string | null, text: string): Node {
    return {
        id,
        projectId,
        parentId,
        text,
        kind: "circle",
        url: null,
        media: null,
        mediaFill: true,
        size: "small",
        side: parentId === null ? null : "east",
        collapsed: false,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
    };
}

describe("buildDuplicateNamePure", () => {
    it("adds (copy) and numbers further copies", () => {
        expect(buildDuplicateNamePure("Alpha", [])).toBe("Alpha (copy)");
        const one = [project("a", "Alpha"), project("b", "Alpha (copy)")];
        expect(buildDuplicateNamePure("Alpha", one)).toBe("Alpha (copy 2)");
        const two = [...one, project("c", "Alpha (copy 2)")];
        expect(buildDuplicateNamePure("Alpha", two)).toBe("Alpha (copy 3)");
    });
    it("matches names case-insensitively and truncates to 40 chars", () => {
        const existing = [project("a", "alpha (copy)")];
        expect(buildDuplicateNamePure("Alpha", existing)).toBe("Alpha (copy 2)");
        const long = "x".repeat(40);
        expect(buildDuplicateNamePure(long, []).length).toBeLessThanOrEqual(40);
        expect(buildDuplicateNamePure(long, [])).toContain("(copy)");
    });
});

describe("buildImportedNamePure", () => {
    it("adds (imported) and numbers collisions", () => {
        expect(buildImportedNamePure("Alpha", [])).toBe("Alpha (imported)");
        const one = [project("a", "Alpha"), project("b", "Alpha (imported)")];
        expect(buildImportedNamePure("Alpha", one)).toBe("Alpha (imported 2)");
    });
});

describe("filterProjectsPure", () => {
    it("matches substrings case-insensitively and trims", () => {
        const all = [project("a", "Photosynthesis"), project("b", "History 101")];
        expect(filterProjectsPure(all, "photo")).toHaveLength(1);
        expect(filterProjectsPure(all, "  HISTORY ")).toHaveLength(1);
        expect(filterProjectsPure(all, "  ")).toHaveLength(2);
        expect(filterProjectsPure(all, "zzz")).toHaveLength(0);
    });
});

describe("sortProjectsPure", () => {
    it("sorts by name, created, and updated in both directions", () => {
        const a = project("a", "Beta", "2026-01-01T00:00:00.000Z");
        const b = project("b", "alpha", "2026-02-01T00:00:00.000Z");
        const c = project("c", "Gamma", "2026-03-01T00:00:00.000Z");
        expect(sortProjectsPure([a, b, c], "updated", "desc").map((p) => p.id)).toEqual(["c", "b", "a"]);
        expect(sortProjectsPure([a, b, c], "updated", "asc").map((p) => p.id)).toEqual(["a", "b", "c"]);
        expect(sortProjectsPure([a, b, c], "name", "asc").map((p) => p.id)).toEqual(["b", "a", "c"]);
        expect(sortProjectsPure([a, b, c], "name", "desc").map((p) => p.id)).toEqual(["c", "a", "b"]);
        const old = { ...project("x", "New", "2026-03-01T00:00:00.000Z"), createdAt: "2026-01-01T00:00:00.000Z" };
        const fresh = { ...project("y", "Old", "2026-01-15T00:00:00.000Z"), createdAt: "2026-03-01T00:00:00.000Z" };
        expect(sortProjectsPure([old, fresh], "created", "asc").map((p) => p.id)).toEqual(["x", "y"]);
        expect(sortProjectsPure([old, fresh], "created", "desc").map((p) => p.id)).toEqual(["y", "x"]);
        expect(sortProjectsPure([old, fresh], "updated", "desc").map((p) => p.id)).toEqual(["x", "y"]);
    });
});

describe("serializeProjectExportPure", () => {
    it("carries version 1 and strips upload refs", () => {
        const p = project("p", "Alpha");
        const root = node("r", "p", null, "Alpha");
        const kid: Node = {
            ...node("k", "p", "r", "Photo"),
            kind: "media",
            media: { kind: "image", src: "", uploadId: "blob-1" },
        };
        const file = serializeProjectExportPure(p, [root, kid, node("x", "other", null, "Other")]);
        expect(file.app).toBe("mindmap");
        expect(file.version).toBe(1);
        expect(file.nodes).toHaveLength(2);
        expect(file.nodes.find((n) => n.id === "k")?.media).toBeNull();
        expect(hasUploadMedia([kid])).toBe(true);
        expect(hasUploadMedia([root])).toBe(false);
    });
});

describe("sanitizeExportFilenamePure", () => {
    it("slugifies and falls back", () => {
        expect(sanitizeExportFilenamePure("My Project!")).toBe("my-project-mindmap.json");
        expect(sanitizeExportFilenamePure("   ")).toBe("mindmap-mindmap.json");
    });
});

function exportText(): string {
    const p = project("p", "Alpha");
    return JSON.stringify(serializeProjectExportPure(p, [node("r", "p", null, "Alpha"), node("k", "p", "r", "Kid")]));
}

describe("parseProjectImportPure", () => {
    it("round-trips a serialized export", () => {
        const parsed = parseProjectImportPure(exportText());
        expect(parsed.name).toBe("Alpha");
        expect(parsed.nodes).toHaveLength(2);
    });
    it("rejects malformed JSON, wrong version, and structural problems", () => {
        expect(() => parseProjectImportPure("{nope")).toThrow("Not a valid mindmap file");
        expect(() => parseProjectImportPure(JSON.stringify({ app: "mindmap", version: 2 }))).toThrow("Unsupported file version.");
        expect(() => parseProjectImportPure(JSON.stringify({ app: "mindmap", version: 1, project: { name: "A" }, nodes: [] }))).toThrow(
            "no nodes",
        );
        const dangling = {
            app: "mindmap",
            version: 1,
            project: { name: "A" },
            nodes: [
                { id: "r", parentId: null, text: "A", kind: "circle", url: null, media: null, mediaFill: true, size: "small", side: null, collapsed: false },
                { id: "k", parentId: "missing", text: "K", kind: "circle", url: null, media: null, mediaFill: true, size: "small", side: "east", collapsed: false },
            ],
        };
        expect(() => parseProjectImportPure(JSON.stringify(dangling))).toThrow("missing parent");
        const twoRoots = {
            app: "mindmap",
            version: 1,
            project: { name: "A" },
            nodes: [
                { id: "r1", parentId: null, text: "A", kind: "circle", url: null, media: null, mediaFill: true, size: "small", side: null, collapsed: false },
                { id: "r2", parentId: null, text: "B", kind: "circle", url: null, media: null, mediaFill: true, size: "small", side: null, collapsed: false },
            ],
        };
        expect(() => parseProjectImportPure(JSON.stringify(twoRoots))).toThrow("exactly one root");
        const badName = {
            app: "mindmap",
            version: 1,
            project: { name: "   " },
            nodes: [{ id: "r", parentId: null, text: "A", kind: "circle", url: null, media: null, mediaFill: true, size: "small", side: null, collapsed: false }],
        };
        expect(() => parseProjectImportPure(JSON.stringify(badName))).toThrow("project name");
    });
    it("rejects duplicate ids, self-parents, and detached cycles", () => {
        const base = { app: "mindmap", version: 1, project: { name: "A" } };
        const root = { id: "r", parentId: null, text: "A", kind: "circle", url: null, media: null, mediaFill: true, size: "small", side: null, collapsed: false };
        const kid = (id: string, parentId: string | null) => ({
            id, parentId, text: id, kind: "circle", url: null, media: null, mediaFill: true, size: "small", side: "east", collapsed: false,
        });
        expect(() => parseProjectImportPure(JSON.stringify({ ...base, nodes: [root, kid("k", "r"), kid("k", "r")] }))).toThrow(
            "duplicate node ids",
        );
        expect(() => parseProjectImportPure(JSON.stringify({ ...base, nodes: [root, kid("k", "k")] }))).toThrow("own parent");
        // A detached parent cycle can never join the root tree, so it surfaces as unreachable.
        expect(() =>
            parseProjectImportPure(JSON.stringify({ ...base, nodes: [root, kid("a", "b"), kid("b", "a")] })),
        ).toThrow("unreachable");
    });
});
