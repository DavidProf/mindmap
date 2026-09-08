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
    saveProjects,
    validateNodeTextPure,
    validateProjectNamePure,
} from "./localStore";
import type { Project, Viewport } from "../types/project";
import type { Node } from "../types/node";

const STAMP = "2026-01-01T00:00:00.000Z";

function node(id: string, projectId: string, parentId: string | null): Node {
    return { id, projectId, parentId, text: id, side: "south", collapsed: false, createdAt: STAMP, updatedAt: STAMP };
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
    it("rejects text over 30 characters", () => {
        expect(validateNodeTextPure("x".repeat(31))).toBe("Text must be 30 characters or less.");
    });
    it("accepts 30 characters", () => {
        expect(validateNodeTextPure("x".repeat(30))).toBeNull();
    });
});

describe("getNodeCountForProjectPure", () => {
    it("counts only the given project", () => {
        const nodes = [node("r1", "p1", null), node("c1", "p1", "r1"), node("r2", "p2", null)];
        expect(getNodeCountForProjectPure(nodes, "p1")).toBe(2);
        expect(getNodeCountForProjectPure(nodes, "p2")).toBe(1);
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
