import { beforeEach, describe, expect, it } from "vitest";
import { addChildNodeAsync, createProjectAsync, restoreProjectNodesAsync } from "./operations";
import { createMemoryBackend } from "./backend";
import { __resetForTests } from "./localStore";

beforeEach(() => {
    __resetForTests();
});

describe("restoreProjectNodesAsync", () => {
    it("restores an earlier snapshot for one project only", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const other = await createProjectAsync(backend, "Beta");
        const before = (await backend.loadNodes()).filter((n) => n.projectId === project.id);

        await addChildNodeAsync(backend, project.id, project.rootNodeId, "Kid", "east");
        expect((await backend.loadNodes()).filter((n) => n.projectId === project.id)).toHaveLength(2);

        const restored = await restoreProjectNodesAsync(backend, project.id, before);
        expect(restored).toHaveLength(1);
        expect((await backend.loadNodes()).filter((n) => n.projectId === project.id)).toHaveLength(1);
        expect((await backend.loadNodes()).filter((n) => n.projectId === other.id)).toHaveLength(1);
    });

    it("reapplies a later snapshot for redo", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const before = (await backend.loadNodes()).filter((n) => n.projectId === project.id);

        await addChildNodeAsync(backend, project.id, project.rootNodeId, "Kid", "east");
        const after = (await backend.loadNodes()).filter((n) => n.projectId === project.id);

        await restoreProjectNodesAsync(backend, project.id, before);
        const redone = await restoreProjectNodesAsync(backend, project.id, after);
        expect(redone).toHaveLength(2);
        expect(redone.some((n) => n.text === "Kid")).toBe(true);
    });

    it("bumps the project updatedAt on restore", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const stamped = (await backend.loadProjects()).find((p) => p.id === project.id)?.updatedAt;
        const before = (await backend.loadNodes()).filter((n) => n.projectId === project.id);

        await addChildNodeAsync(backend, project.id, project.rootNodeId, "Kid", "east");
        await restoreProjectNodesAsync(backend, project.id, before);

        const next = (await backend.loadProjects()).find((p) => p.id === project.id)?.updatedAt;
        expect(stamped).toBeDefined();
        expect(next).toBeDefined();
        expect(Date.parse(next as string) >= Date.parse(stamped as string)).toBe(true);
    });
});
