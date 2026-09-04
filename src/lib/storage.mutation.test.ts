import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    __resetForTests,
    addChildNode,
    consumeCorruptionFlag,
    createProject,
    deleteNodeSubtree,
    getProjectsSortedByUpdatedAt,
    loadNodes,
    loadProjects,
    renameProject,
    saveProjects,
    setNodeCollapsed,
    updateNodeText,
} from "./storage";
import type { Project } from "../types/project";
import type { NodeSide } from "../types/node";

const STAMP = "2026-01-01T00:00:00.000Z";

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

function project(id: string, name: string, createdAt: string, updatedAt: string): Project {
    return { id, name, rootNodeId: `${id}-root`, createdAt, updatedAt, viewport: { x: 0, y: 0, zoom: 1 } };
}

beforeEach(() => {
    __resetForTests();
    stubWindow();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("createProject", () => {
    it("creates a project with a matching root node", () => {
        const created = createProject("  Alpha  ");
        expect(created.name).toBe("Alpha");
        const roots = loadNodes().filter((n) => n.id === created.rootNodeId);
        expect(roots).toHaveLength(1);
        expect(roots[0].text).toBe("Alpha");
        expect(roots[0].parentId).toBeNull();
    });

    it("rejects blank and duplicate names", () => {
        expect(() => createProject("   ")).toThrow("Name is required.");
        createProject("Alpha");
        expect(() => createProject("alpha")).toThrow("A project with this name already exists.");
    });
});

describe("renameProject", () => {
    it("renames and follows the root text", () => {
        const created = createProject("Alpha");
        const renamed = renameProject(created.id, "Beta");
        expect(renamed.name).toBe("Beta");
        expect(loadNodes().find((n) => n.id === created.rootNodeId)!.text).toBe("Beta");
    });

    it("leaves an edited root text alone", () => {
        const created = createProject("Alpha");
        updateNodeText(created.rootNodeId, "Custom");
        renameProject(created.id, "Beta");
        expect(loadNodes().find((n) => n.id === created.rootNodeId)!.text).toBe("Custom");
    });

    it("rejects unknown projects and bad names", () => {
        expect(() => renameProject("missing", "Beta")).toThrow("Project not found.");
        const created = createProject("Alpha");
        expect(() => renameProject(created.id, "  ")).toThrow("Name is required.");
    });
});

describe("addChildNode", () => {
    it("links the child with persisted side", () => {
        const created = createProject("Alpha");
        const child = addChildNode(created.id, created.rootNodeId, "Kid", "east");
        expect(child.parentId).toBe(created.rootNodeId);
        expect(child.side).toBe("east");
        expect(child.text).toBe("Kid");
    });

    it("rejects bad text, side, project, and parent", () => {
        const created = createProject("Alpha");
        expect(() => addChildNode(created.id, created.rootNodeId, "  ", "east")).toThrow("Text is required.");
        expect(() => addChildNode(created.id, created.rootNodeId, "Kid", "up" as unknown as NodeSide)).toThrow(
            "Invalid side.",
        );
        expect(() => addChildNode("missing", created.rootNodeId, "Kid", "east")).toThrow("Project not found.");
        expect(() => addChildNode(created.id, "missing", "Kid", "east")).toThrow("Parent node not found.");
    });
});

describe("updateNodeText", () => {
    it("trims and returns the same node when unchanged", () => {
        const created = createProject("Alpha");
        const child = addChildNode(created.id, created.rootNodeId, "Kid", "east");
        const same = updateNodeText(child.id, "Kid");
        expect(same.updatedAt).toBe(child.updatedAt);
        expect(updateNodeText(child.id, "  Kid 2 ").text).toBe("Kid 2");
    });

    it("rejects blank text and unknown nodes", () => {
        const created = createProject("Alpha");
        expect(() => updateNodeText(created.rootNodeId, " ")).toThrow("Text is required.");
        expect(() => updateNodeText("missing", "Hi")).toThrow("Node not found.");
    });
});

describe("setNodeCollapsed", () => {
    it("toggles and returns the same node when unchanged", () => {
        const created = createProject("Alpha");
        const collapsed = setNodeCollapsed(created.rootNodeId, true);
        expect(collapsed.collapsed).toBe(true);
        expect(setNodeCollapsed(created.rootNodeId, true).updatedAt).toBe(collapsed.updatedAt);
    });

    it("rejects unknown nodes", () => {
        expect(() => setNodeCollapsed("missing", true)).toThrow("Node not found.");
    });
});

describe("updatedAt monotonicity", () => {
    it("strictly increases across rapid writes", () => {
        const created = createProject("Alpha");
        const first = updateNodeText(created.rootNodeId, "One");
        const second = updateNodeText(created.rootNodeId, "Two");
        expect(Date.parse(second.updatedAt)).toBeGreaterThan(Date.parse(first.updatedAt));
    });

    it("bumps the project when a subtree is deleted", () => {
        const created = createProject("Alpha");
        const before = loadProjects().find((p) => p.id === created.id)!.updatedAt;
        const child = addChildNode(created.id, created.rootNodeId, "Kid", "east");
        deleteNodeSubtree(child.id);
        const after = loadProjects().find((p) => p.id === created.id)!.updatedAt;
        expect(Date.parse(after)).toBeGreaterThan(Date.parse(before));
    });
});

describe("getProjectsSortedByUpdatedAt", () => {
    it("sorts newest first with createdAt tie-break", () => {
        saveProjects([
            project("old", "Old", "2026-01-01T00:00:00.000Z", "2026-01-03T00:00:00.000Z"),
            project("new", "New", "2026-01-01T00:00:00.000Z", "2026-01-05T00:00:00.000Z"),
            project("tie", "Tie", "2026-01-04T00:00:00.000Z", "2026-01-03T00:00:00.000Z"),
        ]);
        expect(getProjectsSortedByUpdatedAt().map((p) => p.id)).toEqual(["new", "tie", "old"]);
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
        expect(() => saveProjects([project("p1", "P1", STAMP, STAMP)])).toThrow(quotaError);
    });
});
