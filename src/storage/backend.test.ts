import { describe, expect, it } from "vitest";
import {
    createLocalStorageBackend,
    createMemoryBackend,
    mergeForMigration,
    shouldMigrate,
} from "./backend";
import { __resetForTests, saveNodes, saveProjects } from "./localStore";
import type { Node } from "../types/node";
import type { Project } from "../types/project";

const STAMP = "2026-01-01T00:00:00.000Z";

function project(id: string): Project {
    return { id, name: id, rootNodeId: `${id}-root`, createdAt: STAMP, updatedAt: STAMP, viewport: { x: 0, y: 0, zoom: 1 } };
}

function node(id: string, projectId: string): Node {
    return { id, projectId, parentId: null, text: id, kind: "circle", url: null, media: null, mediaFill: true, side: null, collapsed: false, createdAt: STAMP, updatedAt: STAMP };
}

describe("shouldMigrate", () => {
    it("migrates when IDB is empty and LS has projects", () => {
        expect(shouldMigrate([], [], [project("a")], [])).toBe(true);
    });
    it("migrates when IDB is empty and LS has only nodes", () => {
        expect(shouldMigrate([], [], [], [node("n", "a")])).toBe(true);
    });
    it("does not overwrite populated IDB", () => {
        expect(shouldMigrate([project("a")], [], [project("b")], [])).toBe(false);
    });
    it("is a no-op when both are empty", () => {
        expect(shouldMigrate([], [], [], [])).toBe(false);
    });
    it("does not migrate when IDB has only nodes", () => {
        expect(shouldMigrate([], [node("n", "a")], [project("b")], [])).toBe(false);
    });
});

describe("mergeForMigration", () => {
    it("copies LS when IDB is empty", () => {
        const ls = { projects: [project("a")], nodes: [node("n", "a")] };
        const merged = mergeForMigration([], [], ls.projects, ls.nodes);
        expect(merged.projects).toEqual(ls.projects);
        expect(merged.nodes).toEqual(ls.nodes);
    });
    it("keeps IDB when populated", () => {
        const idb = { projects: [project("a")], nodes: [] as Node[] };
        const merged = mergeForMigration(idb.projects, idb.nodes, [project("b")], [node("n", "b")]);
        expect(merged.projects).toEqual(idb.projects);
    });
});

describe("backends", () => {
    it("memory backend round-trips", async () => {
        const backend = createMemoryBackend();
        await backend.saveProjects([project("a")]);
        await backend.saveNodes([node("n", "a")]);
        expect(await backend.loadProjects()).toEqual([project("a")]);
        expect(await backend.loadNodes()).toEqual([node("n", "a")]);
    });
    it("localStorage backend delegates without behavior change", async () => {
        __resetForTests();
        saveProjects([project("a")]);
        saveNodes([node("n", "a")]);
        const backend = createLocalStorageBackend();
        expect(backend.kind).toBe("localstorage");
        expect(await backend.loadProjects()).toEqual([project("a")]);
        expect(await backend.loadNodes()).toEqual([node("n", "a")]);
        __resetForTests();
    });
});
