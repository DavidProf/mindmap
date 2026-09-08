import { beforeEach, describe, expect, it } from "vitest";
import {
    __resetStorageInitForTests,
    initStorage,
    runMigration,
} from "./init";
import { createMemoryBackend } from "./backend";
import type { Node } from "../types/node";
import type { Project } from "../types/project";

const STAMP = "2026-01-01T00:00:00.000Z";

function project(id: string): Project {
    return { id, name: id, rootNodeId: `${id}-root`, createdAt: STAMP, updatedAt: STAMP, viewport: { x: 0, y: 0, zoom: 1 } };
}

function node(id: string, projectId: string): Node {
    return { id, projectId, parentId: null, text: id, kind: "circle", side: null, collapsed: false, createdAt: STAMP, updatedAt: STAMP };
}

beforeEach(() => {
    __resetStorageInitForTests();
});

describe("runMigration", () => {
    it("copies LS into empty IDB once", async () => {
        const idb = createMemoryBackend();
        const migrated = await runMigration(idb, [project("a")], [node("n", "a")]);
        expect(migrated).toBe(true);
        expect(await idb.loadProjects()).toEqual([project("a")]);
        const second = await runMigration(idb, [project("a")], [node("n", "a")]);
        expect(second).toBe(false);
    });
    it("leaves populated IDB alone", async () => {
        const idb = createMemoryBackend({ projects: [project("a")], nodes: [] });
        const migrated = await runMigration(idb, [project("b")], []);
        expect(migrated).toBe(false);
        expect(await idb.loadProjects()).toEqual([project("a")]);
    });
    it("clears a partial migration so the next boot retries", async () => {
        const inner = createMemoryBackend();
        let failNodes = true;
        const flaky = {
            ...inner,
            saveNodes: async (nodes: Node[]) => {
                if (failNodes) throw new Error("IO failure");
                await inner.saveNodes(nodes);
            },
        };
        await expect(runMigration(flaky, [project("a")], [node("n", "a")])).rejects.toThrow("IO failure");
        expect(await flaky.loadProjects()).toEqual([]);
        failNodes = false;
        expect(await runMigration(flaky, [project("a")], [node("n", "a")])).toBe(true);
        expect(await flaky.loadProjects()).toEqual([project("a")]);
        expect(await flaky.loadNodes()).toEqual([node("n", "a")]);
    });
    it("rejects when verification counts mismatch", async () => {
        const inner = createMemoryBackend();
        const lossy = { ...inner, saveNodes: (nodes: Node[]) => inner.saveNodes(nodes.slice(0, -1)) };
        await expect(runMigration(lossy, [project("a")], [node("n", "a")])).rejects.toThrow(
            "Migration verification failed.",
        );
        expect(await lossy.loadProjects()).toEqual([]);
        expect(await lossy.loadNodes()).toEqual([]);
    });
});

describe("initStorage", () => {
    it("is single-flight across concurrent callers", async () => {
        let saves = 0;
        const idb = createMemoryBackend();
        const counting = {
            ...idb,
            saveProjects: async (p: Project[]) => {
                saves += 1;
                await idb.saveProjects(p);
            },
        };
        const deps = { createIdb: () => counting, readLocal: () => ({ projects: [project("a")], nodes: [] as Node[] }) };
        const [first, second] = await Promise.all([initStorage(deps), initStorage(deps)]);
        expect(first.migrated).toBe(true);
        expect(second.migrated).toBe(true);
        expect(saves).toBe(1);
    });
    it("falls back to localstorage when IDB is unavailable", async () => {
        const res = await initStorage({ createIdb: () => null, readLocal: () => ({ projects: [], nodes: [] }) });
        expect(res.migrated).toBe(false);
        expect(["localstorage", "memory"]).toContain(res.fallback);
    });
    it("falls back when the IDB backend throws", async () => {
        const broken = {
            kind: "indexeddb" as const,
            loadProjects: () => Promise.reject(new Error("blocked")),
            loadNodes: () => Promise.resolve([] as Node[]),
            saveProjects: () => Promise.resolve(),
            saveNodes: () => Promise.resolve(),
        };
        const res = await initStorage({ createIdb: () => broken, readLocal: () => ({ projects: [project("a")], nodes: [] }) });
        expect(res.migrated).toBe(false);
        expect(["localstorage", "memory"]).toContain(res.fallback);
    });
});
