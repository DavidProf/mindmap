import { describe, expect, it } from "vitest";
import { createIndexedDbBackend, isIndexedDbSupported } from "./indexedDb";
import { createMemoryBackend } from "./backend";
import type { Node } from "../types/node";
import type { Project } from "../types/project";

const STAMP = "2026-01-01T00:00:00.000Z";

function project(id: string): Project {
    return { id, name: id, rootNodeId: `${id}-root`, createdAt: STAMP, updatedAt: STAMP, viewport: { x: 0, y: 0, zoom: 1 } };
}

function node(id: string, projectId: string): Node {
    return { id, projectId, parentId: null, text: id, kind: "circle", url: null, media: null, side: null, collapsed: false, createdAt: STAMP, updatedAt: STAMP };
}

describe("isIndexedDbSupported", () => {
    it("is false in the Vitest node environment", () => {
        expect(isIndexedDbSupported()).toBe(false);
    });
});

describe("indexedDb backend contract", () => {
    it("round-trips projects and nodes with projectId filtering", async () => {
        const backend = createMemoryBackend();
        await backend.saveProjects([project("a"), project("b")]);
        await backend.saveNodes([node("n1", "a"), node("n2", "a"), node("n3", "b")]);
        const projects = await backend.loadProjects();
        const nodes = await backend.loadNodes();
        expect(projects).toHaveLength(2);
        expect(nodes.filter((n) => n.projectId === "a")).toHaveLength(2);
        expect(nodes.filter((n) => n.projectId === "b")).toHaveLength(1);
    });
    it("rejects with a named error when IndexedDB is unsupported", async () => {
        const backend = createIndexedDbBackend(() => Promise.reject(Object.assign(new Error("nope"), { name: "NotSupportedError" })));
        await expect(backend.loadProjects()).rejects.toMatchObject({ name: "NotSupportedError" });
    });
    it("default open rejects with NotSupportedError when unsupported", async () => {
        const backend = createIndexedDbBackend();
        await expect(backend.loadProjects()).rejects.toMatchObject({ name: "NotSupportedError" });
    });
    it("shares one open across concurrent operations", async () => {
        let opens = 0;
        const backend = createIndexedDbBackend(() => {
            opens += 1;
            return Promise.reject(Object.assign(new Error("nope"), { name: "NotSupportedError" }));
        });
        await Promise.allSettled([backend.loadProjects(), backend.loadNodes()]);
        expect(opens).toBe(1);
    });
    it("retries the open after a failure instead of reusing it", async () => {
        let opens = 0;
        const backend = createIndexedDbBackend(() => {
            opens += 1;
            return Promise.reject(Object.assign(new Error("nope"), { name: "NotSupportedError" }));
        });
        await expect(backend.loadProjects()).rejects.toMatchObject({ name: "NotSupportedError" });
        await expect(backend.loadNodes()).rejects.toMatchObject({ name: "NotSupportedError" });
        expect(opens).toBe(2);
    });
});
