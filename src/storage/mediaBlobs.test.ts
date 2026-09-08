import { describe, expect, it } from "vitest";
import { createMemoryMediaBlobStore, type MediaBlob } from "./mediaBlobs";

const STAMP = "2026-01-01T00:00:00.000Z";

function blob(id: string, projectId: string, nodeId: string): MediaBlob {
    return { id, projectId, nodeId, blob: new Blob(["pixels"], { type: "image/jpeg" }), createdAt: STAMP };
}

describe("memory media blob store (13d)", () => {
    it("saves, loads, and deletes by id", async () => {
        const store = createMemoryMediaBlobStore();
        expect(await store.loadBlob("missing")).toBeNull();
        await store.saveBlob(blob("b1", "p1", "n1"));
        expect((await store.loadBlob("b1"))?.nodeId).toBe("n1");
        expect(await store.countBlobs()).toBe(1);
        await store.deleteBlob("b1");
        expect(await store.loadBlob("b1")).toBeNull();
        expect(await store.countBlobs()).toBe(0);
    });
    it("replaces the blob on re-upload to the same id", async () => {
        const store = createMemoryMediaBlobStore();
        await store.saveBlob(blob("b1", "p1", "n1"));
        await store.saveBlob({ ...blob("b1", "p1", "n1"), createdAt: "2026-02-01T00:00:00.000Z" });
        expect(await store.countBlobs()).toBe(1);
    });
    it("deletes blobs for removed nodes only", async () => {
        const store = createMemoryMediaBlobStore();
        await store.saveBlob(blob("b1", "p1", "n1"));
        await store.saveBlob(blob("b2", "p1", "n2"));
        await store.deleteBlobsForNodeIds(["n1", "ghost"]);
        expect(await store.loadBlob("b1")).toBeNull();
        expect(await store.loadBlob("b2")).not.toBeNull();
    });
    it("deletes blobs for a removed project only", async () => {
        const store = createMemoryMediaBlobStore();
        await store.saveBlob(blob("b1", "p1", "n1"));
        await store.saveBlob(blob("b2", "p2", "n9"));
        await store.deleteBlobsForProject("p1");
        expect(await store.loadBlob("b1")).toBeNull();
        expect(await store.loadBlob("b2")).not.toBeNull();
    });
});
