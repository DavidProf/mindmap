import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    __resetForTests,
    clampZoom,
    consumeCorruptionFlag,
    countSubtreeNodesPure,
    getNodeCountForProjectPure,
    getSubtreeCountsPure,
    getSubtreeIdsPure,
    isNameUniquePure,
    loadNodes,
    loadProjects,
    MAX_MEDIA_URL_LENGTH,
    MAX_NOTE_TEXT_LENGTH,
    MAX_UPLOAD_BYTES,
    MAX_URL_LENGTH,
    maxTextLengthForKind,
    fitDimensionsPure,
    normalizeNodeMediaPure,
    normalizeNodeUrlPure,
    saveNodes,
    saveProjects,
    validateImageFilePure,
    validateNodeMediaPure,
    validateNodeTextPure,
    validateNodeUrlPure,
    validateProjectNamePure,
} from "./localStore";
import {
    isNodeKind,
    isMediaFilledPure,
    normalizeNodeKind,
    normalizeNodeMediaValue,
    normalizeNodes,
    normalizeNodeUrlValue,
} from "../types/node";
import type { Project, Viewport } from "../types/project";
import type { Node } from "../types/node";

const STAMP = "2026-01-01T00:00:00.000Z";

function node(id: string, projectId: string, parentId: string | null): Node {
    return { id, projectId, parentId, text: id, kind: "circle", url: null, media: null, mediaFill: true, size: "small", side: "south", collapsed: false, createdAt: STAMP, updatedAt: STAMP };
}

function project(id: string, name: string, viewport: Viewport = { x: 0, y: 0, zoom: 1 }): Project {
    return { id, name, rootNodeId: `${id}-root`, createdAt: STAMP, updatedAt: STAMP, viewport };
}

beforeEach(() => {
    __resetForTests();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

function stubWindow(initial: Record<string, string> = {}) {
    const store = new Map(Object.entries(initial));
    vi.stubGlobal("window", {
        localStorage: {
            getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
            setItem: (key: string, value: string) => {
                store.set(key, value);
            },
            removeItem: (key: string) => {
                store.delete(key);
            },
        },
    });
    return store;
}

describe("isNameUniquePure", () => {
    const projects = [project("a", "Alpha")];
    it("ignores case and surrounding whitespace", () => {
        expect(isNameUniquePure("  ALPHA ", projects)).toBe(false);
    });
    it("allows the excluded id to keep its name", () => {
        expect(isNameUniquePure("Alpha", projects, "a")).toBe(true);
    });
    it("accepts a fresh name", () => {
        expect(isNameUniquePure("Beta", projects)).toBe(true);
    });
});

describe("validateProjectNamePure", () => {
    it("rejects blank names", () => {
        expect(validateProjectNamePure("   ", [])).toBe("Name is required.");
    });
    it("rejects names over 40 characters", () => {
        expect(validateProjectNamePure("x".repeat(41), [])).toBe("Name must be 40 characters or less.");
    });
    it("rejects duplicates", () => {
        const projects = [project("a", "Alpha")];
        expect(validateProjectNamePure("alpha", projects)).toBe("A project with this name already exists.");
    });
    it("accepts a valid unique name", () => {
        expect(validateProjectNamePure("Beta", [project("a", "Alpha")])).toBeNull();
    });
});

describe("validateNodeTextPure", () => {
    it("rejects blank text", () => {
        expect(validateNodeTextPure("  ")).toBe("Text is required.");
    });
    it("rejects circle text over 30 characters", () => {
        expect(validateNodeTextPure("x".repeat(31))).toBe("Text must be 30 characters or less.");
    });
    it("accepts 30 characters for circles", () => {
        expect(validateNodeTextPure("x".repeat(30))).toBeNull();
    });
    it("accepts long text for notes up to 280 characters", () => {
        expect(validateNodeTextPure("x".repeat(31), "note")).toBeNull();
        expect(validateNodeTextPure("x".repeat(MAX_NOTE_TEXT_LENGTH), "note")).toBeNull();
        expect(validateNodeTextPure("x".repeat(MAX_NOTE_TEXT_LENGTH + 1), "note")).toBe(
            `Text must be ${MAX_NOTE_TEXT_LENGTH} characters or less.`,
        );
    });
    it("rejects blank note text", () => {
        expect(validateNodeTextPure("   ", "note")).toBe("Text is required.");
    });
});

describe("node kind", () => {
    it("picks the length limit by kind", () => {
        expect(maxTextLengthForKind("circle")).toBe(30);
        expect(maxTextLengthForKind("note")).toBe(MAX_NOTE_TEXT_LENGTH);
        expect(maxTextLengthForKind("bogus")).toBe(30);
    });
    it("guards and normalizes kind values", () => {
        expect(isNodeKind("note")).toBe(true);
        expect(isNodeKind("circle")).toBe(true);
        expect(isNodeKind("photo")).toBe(false);
        expect(normalizeNodeKind("note")).toBe("note");
        expect(normalizeNodeKind(undefined)).toBe("circle");
        expect(normalizeNodeKind("bogus")).toBe("circle");
    });
    it("normalizes legacy nodes missing kind to circle", () => {
        const legacy = { ...node("r1", "p1", null), kind: undefined as unknown as "circle" };
        expect(normalizeNodes([legacy])).toEqual([{ ...legacy, kind: "circle" }]);
    });
    it("normalizes invalid kind to circle and keeps valid notes", () => {
        const bad = { ...node("a", "p1", null), kind: "photo" as unknown as "circle" };
        const note = { ...node("b", "p1", null), kind: "note" as const };
        const out = normalizeNodes([bad, note]);
        expect(out[0].kind).toBe("circle");
        expect(out[1]).toBe(note);
    });
    it("loadNodes normalizes stored legacy records", () => {
        __resetForTests();
        const legacy = { ...node("r1", "p1", null), kind: undefined as unknown as "circle" };
        stubWindow({ "mindmap:nodes": JSON.stringify([legacy]) });
        expect(loadNodes()).toEqual([{ ...legacy, kind: "circle" }]);
    });
    it("round-trips note kind through storage", () => {
        __resetForTests();
        stubWindow();
        const noteNode = { ...node("n1", "p1", null), kind: "note" as const, text: "a longer paragraph" };
        saveNodes([noteNode]);
        expect(loadNodes()).toEqual([noteNode]);
    });
});

describe("getNodeCountForProjectPure", () => {
    it("counts only the given project", () => {
        const nodes = [node("r1", "p1", null), node("c1", "p1", "r1"), node("r2", "p2", null)];
        expect(getNodeCountForProjectPure(nodes, "p1")).toBe(2);
        expect(getNodeCountForProjectPure(nodes, "p2")).toBe(1);
    });
});

describe("node url (13b)", () => {
    it("accepts empty as clear", () => {
        expect(validateNodeUrlPure(null)).toBeNull();
        expect(validateNodeUrlPure(undefined)).toBeNull();
        expect(validateNodeUrlPure("   ")).toBeNull();
        expect(normalizeNodeUrlPure(null)).toBeNull();
        expect(normalizeNodeUrlPure("   ")).toBeNull();
    });
    it("accepts http and https urls", () => {
        expect(validateNodeUrlPure("https://example.com")).toBeNull();
        expect(validateNodeUrlPure("http://example.com/path?q=1")).toBeNull();
        expect(normalizeNodeUrlPure("https://example.com")).toBe("https://example.com/");
    });
    it("prepends https for bare domains", () => {
        expect(validateNodeUrlPure("example.com")).toBeNull();
        expect(normalizeNodeUrlPure("example.com")).toBe("https://example.com/");
    });
    it("rejects dangerous and non-http schemes", () => {
        expect(validateNodeUrlPure("javascript:alert(1)")).toBe("Enter a valid http(s) URL.");
        expect(validateNodeUrlPure("data:text/plain,hi")).toBe("Enter a valid http(s) URL.");
        expect(validateNodeUrlPure("ftp://example.com")).toBe("Enter a valid http(s) URL.");
        expect(normalizeNodeUrlValue("javascript:alert(1)")).toBeNull();
    });
    it("rejects urls containing whitespace", () => {
        expect(validateNodeUrlPure("not a url")).toBe("Enter a valid http(s) URL.");
        expect(normalizeNodeUrlValue("not a url")).toBeNull();
        expect(normalizeNodeUrlPure("has space.com")).toBeNull();
    });
    it("rejects over-length urls", () => {
        const long = `https://example.com/${"x".repeat(MAX_URL_LENGTH)}`;
        expect(validateNodeUrlPure(long)).toBe(`URL must be ${MAX_URL_LENGTH} characters or less.`);
        expect(normalizeNodeUrlValue(long)).toBeNull();
    });
    it("normalizes legacy nodes missing url to null", () => {
        const legacy = { ...node("r1", "p1", null), url: undefined as unknown as null };
        const out = normalizeNodes([legacy as unknown as Node]);
        expect(out[0].url).toBeNull();
    });
    it("normalizes invalid stored urls to null and keeps valid links", () => {
        const bad = { ...node("a", "p1", null), url: "javascript:alert(1)" };
        const good = { ...node("b", "p1", null), url: "https://example.com/" };
        const out = normalizeNodes([bad, good]);
        expect(out[0].url).toBeNull();
        expect(out[1]).toBe(good);
    });
    it("loadNodes normalizes stored legacy url records", () => {
        __resetForTests();
        const legacy = { ...node("r1", "p1", null), url: "not a url" };
        stubWindow({ "mindmap:nodes": JSON.stringify([legacy]) });
        expect(loadNodes()[0].url).toBeNull();
    });
    it("round-trips a link through storage", () => {
        __resetForTests();
        stubWindow();
        const linked = { ...node("n1", "p1", null), url: "https://example.com/" };
        saveNodes([linked]);
        expect(loadNodes()).toEqual([linked]);
    });
});

describe("node media (13c)", () => {
    it("accepts null and empty as clear", () => {
        expect(validateNodeMediaPure(null, null)).toBeNull();
        expect(validateNodeMediaPure("image", null)).toBeNull();
        expect(validateNodeMediaPure("image", undefined)).toBeNull();
        expect(validateNodeMediaPure("image", "   ")).toBeNull();
        expect(normalizeNodeMediaPure(null)).toBeNull();
        expect(normalizeNodeMediaPure(undefined)).toBeNull();
    });
    it("accepts image and video http urls", () => {
        expect(validateNodeMediaPure("image", "https://example.com/a.png")).toBeNull();
        expect(validateNodeMediaPure("video", "https://example.com/v.mp4")).toBeNull();
        expect(normalizeNodeMediaPure({ kind: "image", src: "https://example.com/a.png" })).toEqual({
            kind: "image",
            src: "https://example.com/a.png",
            uploadId: null,
        });
    });
    it("prepends https for bare domains", () => {
        expect(validateNodeMediaPure("video", "example.com/v")).toBeNull();
        expect(normalizeNodeMediaPure({ kind: "video", src: "example.com/v" })).toEqual({
            kind: "video",
            src: "https://example.com/v",
            uploadId: null,
        });
    });
    it("rejects bad kinds and dangerous schemes", () => {
        expect(validateNodeMediaPure("audio", "https://example.com/a.mp3")).toBe("Choose image or video.");
        expect(validateNodeMediaPure("image", "javascript:alert(1)")).toBe("Enter a valid http(s) URL.");
        expect(validateNodeMediaPure("video", "data:text/plain,hi")).toBe("Enter a valid http(s) URL.");
        expect(validateNodeMediaPure("image", "ftp://example.com/a.png")).toBe("Enter a valid http(s) URL.");
        expect(normalizeNodeMediaValue({ kind: "image", src: "javascript:alert(1)" })).toBeNull();
        expect(normalizeNodeMediaValue({ kind: "photo", src: "https://example.com/a.png" })).toBeNull();
    });
    it("rejects whitespace and over-length src", () => {
        expect(validateNodeMediaPure("image", "not a url")).toBe("Enter a valid http(s) URL.");
        expect(normalizeNodeMediaValue({ kind: "video", src: "not a url" })).toBeNull();
        const long = `https://example.com/${"x".repeat(MAX_MEDIA_URL_LENGTH)}`;
        expect(validateNodeMediaPure("image", long)).toBe(
            `Media URL must be ${MAX_MEDIA_URL_LENGTH} characters or less.`,
        );
        expect(normalizeNodeMediaValue({ kind: "image", src: long })).toBeNull();
    });
    it("normalizes legacy nodes missing media to null", () => {
        const legacy = { ...node("r1", "p1", null), media: undefined as unknown as null };
        const out = normalizeNodes([legacy as unknown as Node]);
        expect(out[0].media).toBeNull();
    });
    it("normalizes invalid stored media to null and keeps valid media", () => {
        const bad = { ...node("a", "p1", null), media: { kind: "image", src: "javascript:alert(1)" } };
        const good = {
            ...node("b", "p1", null),
            media: { kind: "video" as const, src: "https://example.com/v", uploadId: null },
        };
        const out = normalizeNodes([bad as unknown as Node, good]);
        expect(out[0].media).toBeNull();
        expect(out[1].media).toEqual({ kind: "video", src: "https://example.com/v", uploadId: null });
    });
    it("aligns kind with media: any media makes kind media, media kind without media reverts to note", () => {
        const circleWithMedia = {
            ...node("a", "p1", null),
            media: { kind: "video" as const, src: "https://example.com/v", uploadId: null },
        };
        const noteWithMedia = {
            ...node("b", "p1", null),
            kind: "note" as const,
            media: { kind: "image" as const, src: "https://example.com/a.png", uploadId: null },
        };
        const mediaKindBare = { ...node("c", "p1", null), kind: "media" as const, media: null };
        const out = normalizeNodes([circleWithMedia, noteWithMedia, mediaKindBare]);
        expect(out[0].kind).toBe("media");
        expect(out[1].kind).toBe("media");
        expect(out[2].kind).toBe("note");
    });
    it("round-trips media through storage", () => {
        __resetForTests();
        stubWindow();
        const withMedia = {
            ...node("n1", "p1", null),
            kind: "media" as const,
            media: { kind: "image" as const, src: "https://example.com/a.png", uploadId: null },
        };
        saveNodes([withMedia]);
        expect(loadNodes()).toEqual([withMedia]);
    });
});

describe("node upload media (13d)", () => {
    it("keeps valid upload refs and ignores src", () => {
        expect(normalizeNodeMediaValue({ kind: "image", src: "https://example.com/a.png", uploadId: "blob-1" })).toEqual({
            kind: "image",
            src: "",
            uploadId: "blob-1",
        });
        expect(validateNodeMediaPure("image", "", "blob-1")).toBeNull();
    });
    it("rejects video uploads and blank ids", () => {
        expect(normalizeNodeMediaValue({ kind: "video", src: "", uploadId: "blob-1" })).toBeNull();
        expect(normalizeNodeMediaValue({ kind: "image", src: "", uploadId: "  " })).toBeNull();
        expect(validateNodeMediaPure("video", "", "blob-1")).toBe("Choose image or video.");
    });
    it("coerces missing uploadId to null without rewriting url media", () => {
        const urlMedia = { ...node("u", "p1", null), kind: "media" as const, media: { kind: "image" as const, src: "https://example.com/a.png", uploadId: null } };
        expect(normalizeNodes([urlMedia])[0]).toBe(urlMedia);
    });
});

describe("node media fill (13e)", () => {
    it("fills only when media is attached and fill is on", () => {
        const media = { kind: "image" as const, src: "https://example.com/a.png", uploadId: null };
        expect(isMediaFilledPure({ media, mediaFill: true })).toBe(true);
        expect(isMediaFilledPure({ media, mediaFill: false })).toBe(false);
        expect(isMediaFilledPure({ media: null, mediaFill: true })).toBe(false);
    });
    it("normalizes missing mediaFill to true, with or without media", () => {
        const bare = { ...node("a", "p1", null), mediaFill: undefined as unknown as boolean };
        const withMedia = {
            ...node("b", "p1", null),
            media: { kind: "image" as const, src: "https://example.com/a.png", uploadId: null },
            mediaFill: undefined as unknown as boolean,
        };
        const out = normalizeNodes([bare as unknown as Node, withMedia as unknown as Node]);
        expect(out[0].mediaFill).toBe(true);
        expect(out[1].mediaFill).toBe(true);
    });
    it("normalizes size: missing or invalid becomes small, valid value survives, unchanged nodes are not rewritten", () => {
        const missing = node("a", "p1", null) as unknown as Record<string, unknown>;
        delete missing.size;
        const invalid = { ...node("b", "p1", null), size: "huge" };
        const valid = { ...node("c", "p1", null), size: "medium" };
        const out = normalizeNodes([missing, invalid, valid] as unknown as Node[]);
        expect(out[0].size).toBe("small");
        expect(out[1].size).toBe("small");
        expect(out[2].size).toBe("medium");
        expect(out[2]).toBe(valid);
    });
    it("keeps explicit false only while media is attached", () => {
        const filled = {
            ...node("a", "p1", null),
            media: { kind: "image" as const, src: "https://example.com/a.png", uploadId: null },
            mediaFill: false,
        };
        const cleared = { ...node("b", "p1", null), media: null, mediaFill: false };
        const bad = {
            ...node("c", "p1", null),
            media: { kind: "video" as const, src: "https://example.com/v", uploadId: null },
            mediaFill: "no" as unknown as boolean,
        };
        const out = normalizeNodes([filled, cleared, bad]);
        expect(out[0].mediaFill).toBe(false);
        expect(out[1].mediaFill).toBe(true);
        expect(out[2].mediaFill).toBe(true);
    });
    it("leaves already-normalized nodes untouched", () => {
        const kept = {
            ...node("a", "p1", null),
            kind: "media" as const,
            media: { kind: "image" as const, src: "https://example.com/a.png", uploadId: null },
            mediaFill: false,
        };
        expect(normalizeNodes([kept])[0]).toBe(kept);
    });
    it("round-trips mediaFill false through storage", () => {
        __resetForTests();
        stubWindow();
        const off = {
            ...node("n1", "p1", null),
            kind: "media" as const,
            media: { kind: "image" as const, src: "https://example.com/a.png", uploadId: null },
            mediaFill: false,
        };
        saveNodes([off]);
        expect(loadNodes()).toEqual([off]);
    });
});

describe("image file validation (13d)", () => {
    it("accepts listed types under the cap", () => {
        for (const type of ["image/png", "image/jpeg", "image/webp", "image/gif"]) {
            expect(validateImageFilePure({ type, size: 1024 })).toBeNull();
        }
    });
    it("rejects svg, wrong types, empty, and oversize files", () => {
        expect(validateImageFilePure({ type: "image/svg+xml", size: 1024 })).toBe(
            "Choose a PNG, JPEG, WEBP, or GIF image.",
        );
        expect(validateImageFilePure({ type: "video/mp4", size: 1024 })).toBe(
            "Choose a PNG, JPEG, WEBP, or GIF image.",
        );
        expect(validateImageFilePure({ type: "image/png", size: 0 })).toBe("That file looks empty.");
        expect(validateImageFilePure({ type: "image/png", size: MAX_UPLOAD_BYTES + 1 })).toBe(
            "Image must be 12MB or smaller.",
        );
    });
});

describe("fitDimensionsPure (13d)", () => {
    it("leaves small images untouched", () => {
        expect(fitDimensionsPure(800, 600, 1024)).toEqual({ width: 800, height: 600 });
    });
    it("scales landscape, portrait, and square to the longest side", () => {
        expect(fitDimensionsPure(2048, 1024, 1024)).toEqual({ width: 1024, height: 512 });
        expect(fitDimensionsPure(1000, 2000, 1024)).toEqual({ width: 512, height: 1024 });
        expect(fitDimensionsPure(3000, 3000, 1024)).toEqual({ width: 1024, height: 1024 });
    });
    it("returns zeros for invalid input", () => {
        expect(fitDimensionsPure(0, 100, 1024)).toEqual({ width: 0, height: 0 });
        expect(fitDimensionsPure(NaN, 100, 1024)).toEqual({ width: 0, height: 0 });
    });
});

describe("clampZoom", () => {
    it("clamps below the minimum and above the maximum", () => {
        expect(clampZoom(0.1)).toBe(0.25);
        expect(clampZoom(99)).toBe(3);
    });
    it("passes through finite in-range values", () => {
        expect(clampZoom(2)).toBe(2);
    });
    it("falls back for non-finite input", () => {
        expect(clampZoom(NaN)).toBe(1);
    });
});

describe("subtree helpers", () => {
    const nodes = [
        node("root", "p1", null),
        node("a", "p1", "root"),
        node("b", "p1", "a"),
        node("c", "p1", "root"),
        node("other", "p2", null),
    ];
    it("returns the leaf itself", () => {
        expect(getSubtreeIdsPure(nodes, "b")).toEqual(["b"]);
    });
    it("returns the full subtree for a mid-tree node", () => {
        expect(getSubtreeIdsPure(nodes, "a").sort()).toEqual(["a", "b"]);
        expect(getSubtreeIdsPure(nodes, "root").sort()).toEqual(["a", "b", "c", "root"]);
    });
    it("returns empty for an unknown id", () => {
        expect(getSubtreeIdsPure(nodes, "missing")).toEqual([]);
    });
    it("keeps subtrees within one project", () => {
        expect(getSubtreeIdsPure(nodes, "other")).toEqual(["other"]);
    });
    it("counts agree across helpers", () => {
        expect(countSubtreeNodesPure(nodes, "root")).toBe(4);
        const counts = getSubtreeCountsPure(nodes);
        expect(counts.get("root")).toBe(4);
        expect(counts.get("a")).toBe(2);
        expect(counts.get("b")).toBe(1);
    });
    it("terminates on a self-parent cycle", () => {
        const cyclic = [...nodes, node("loop", "p1", "loop")];
        expect(getSubtreeIdsPure(cyclic, "loop")).toEqual(["loop"]);
        expect(getSubtreeCountsPure(cyclic).get("loop")).toBe(1);
    });
});

describe("corruption recovery", () => {
    it("resets corrupt JSON and raises the flag once", () => {
        __resetForTests();
        stubWindow({ "mindmap:projects": "not-json{{{", "mindmap:nodes": "[]" });
        expect(loadProjects()).toEqual([]);
        expect(consumeCorruptionFlag()).toBe(true);
        expect(consumeCorruptionFlag()).toBe(false);
    });

    it("resets corrupt nodes without flagging valid projects", () => {
        __resetForTests();
        stubWindow({ "mindmap:projects": "[]", "mindmap:nodes": "broken" });
        expect(loadNodes()).toEqual([]);
        expect(consumeCorruptionFlag()).toBe(true);
    });

    it("treats non-array JSON as empty without corruption", () => {
        __resetForTests();
        stubWindow({ "mindmap:projects": '"oops"', "mindmap:nodes": "[]" });
        expect(loadProjects()).toEqual([]);
        expect(consumeCorruptionFlag()).toBe(false);
    });
});

describe("quota handling", () => {
    it("rethrows quota errors instead of swallowing them", () => {
        stubWindow();
        loadProjects();
        const quotaError = new DOMException("full", "QuotaExceededError");
        vi.stubGlobal("window", {
            localStorage: {
                getItem: () => null,
                setItem: () => {
                    throw quotaError;
                },
                removeItem: () => {},
            },
        });
        expect(() => saveProjects([project("p1", "P1")])).toThrow(quotaError);
    });
});
