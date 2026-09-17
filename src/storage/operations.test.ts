import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    addChildNodeAsync,
    createProjectAsync,
    deleteNodeSubtreeAsync,
    deleteProjectAsync,
    duplicateProjectAsync,
    getNodeCountForProjectAsync,
    getProjectsSortedByUpdatedAtAsync,
    getViewportAsync,
    importProjectAsync,
    isQuotaError,
    renameProjectAsync,
    setNodeCollapsedAsync,
    setNodeKindAsync,
    setNodeMediaAsync,
    setNodeMediaFillAsync,
    setNodeSizeAsync,
    setNodeUrlAsync,
    setViewportAsync,
    updateNodeTextAsync,
} from "./operations";
import { createLocalStorageBackend, createMemoryBackend } from "./backend";
import { createMemoryMediaBlobStore } from "./mediaBlobs";
import { __resetForTests, loadNodes, loadProjects } from "./localStore";
import type { Project, Viewport } from "../types/project";

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

function project(id: string): Project {
    return { id, name: id, rootNodeId: `${id}-root`, createdAt: STAMP, updatedAt: STAMP, viewport: { x: 0, y: 0, zoom: 1 } };
}

beforeEach(() => {
    __resetForTests();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("storageAsync project parity", () => {
    it("creates a project with a root node", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        expect(project.name).toBe("Alpha");
        expect(await getProjectsSortedByUpdatedAtAsync(backend)).toHaveLength(1);
        expect(await getNodeCountForProjectAsync(backend, project.id)).toBe(1);
        const root = (await backend.loadNodes()).find((n) => n.id === project.rootNodeId)!;
        expect(root.text).toBe("Alpha");
        expect(root.parentId).toBeNull();
    });
    it("rejects duplicate names", async () => {
        const backend = createMemoryBackend();
        await createProjectAsync(backend, "Alpha");
        await expect(createProjectAsync(backend, "alpha")).rejects.toThrow("A project with this name already exists.");
    });
    it("renames and syncs untouched root text", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const renamed = await renameProjectAsync(backend, project.id, "Beta");
        expect(renamed.name).toBe("Beta");
        const nodes = await backend.loadNodes();
        expect(nodes.find((n) => n.id === project.rootNodeId)?.text).toBe("Beta");
    });
    it("keeps edited root text on rename", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const nodes = await backend.loadNodes();
        const root = nodes.find((n) => n.id === project.rootNodeId)!;
        await backend.saveNodes(nodes.map((n) => (n.id === root.id ? { ...n, text: "Custom" } : n)));
        await renameProjectAsync(backend, project.id, "Beta");
        const after = await backend.loadNodes();
        expect(after.find((n) => n.id === project.rootNodeId)?.text).toBe("Custom");
    });
    it("sorts newest first with createdAt tie-break", async () => {
        const backend = createMemoryBackend();
        const older = { ...project("a"), updatedAt: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" };
        const newer = { ...project("b"), updatedAt: "2026-01-02T00:00:00.000Z", createdAt: "2026-01-02T00:00:00.000Z" };
        const tied = { ...project("c"), updatedAt: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-03T00:00:00.000Z" };
        await backend.saveProjects([older, newer, tied]);
        const sorted = await getProjectsSortedByUpdatedAtAsync(backend);
        expect(sorted.map((p) => p.id)).toEqual(["b", "c", "a"]);
    });
    it("deletes with cascade", async () => {
        const backend = createMemoryBackend();
        const first = await createProjectAsync(backend, "First");
        const second = await createProjectAsync(backend, "Second");
        await deleteProjectAsync(backend, second.id);
        expect(await getProjectsSortedByUpdatedAtAsync(backend)).toHaveLength(1);
        expect(await getNodeCountForProjectAsync(backend, second.id)).toBe(0);
        expect(await getNodeCountForProjectAsync(backend, first.id)).toBe(1);
    });
    it("throws for unknown project on rename", async () => {
        const backend = createMemoryBackend();
        await expect(renameProjectAsync(backend, "missing", "Beta")).rejects.toThrow("Project not found.");
    });
});

describe("storageAsync node parity", () => {
    it("adds a child with linkage, side, and project bump", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const before = (await backend.loadProjects()).find((p) => p.id === project.id)!.updatedAt;
        const child = await addChildNodeAsync(backend, project.id, project.rootNodeId, " Kid ", "north");
        expect(child.parentId).toBe(project.rootNodeId);
        expect(child.text).toBe("Kid");
        expect(child.side).toBe("north");
        const after = (await backend.loadProjects()).find((p) => p.id === project.id)!.updatedAt;
        expect(Date.parse(after) >= Date.parse(before)).toBe(true);
    });
    it("rejects bad child input", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        await expect(addChildNodeAsync(backend, project.id, project.rootNodeId, "  ", "south")).rejects.toThrow(
            "Text is required.",
        );
        await expect(addChildNodeAsync(backend, project.id, project.rootNodeId, "x".repeat(31), "south")).rejects.toThrow(
            "Text must be 30 characters or less.",
        );
        await expect(
            addChildNodeAsync(backend, project.id, project.rootNodeId, "ok", "sideways" as never),
        ).rejects.toThrow("Invalid side.");
        await expect(addChildNodeAsync(backend, project.id, "missing", "ok", "south")).rejects.toThrow(
            "Parent node not found.",
        );
        await expect(addChildNodeAsync(backend, "missing", project.rootNodeId, "ok", "south")).rejects.toThrow(
            "Project not found.",
        );
    });
    it("updates text with trim and strictly-increasing bumps", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const child = await addChildNodeAsync(backend, project.id, project.rootNodeId, "Kid", "south");
        const updated = await updateNodeTextAsync(backend, child.id, "  Renamed  ");
        expect(updated.text).toBe("Renamed");
        expect(Date.parse(updated.updatedAt)).toBeGreaterThan(Date.parse(child.updatedAt));
        const first = await updateNodeTextAsync(backend, child.id, "One");
        const second = await updateNodeTextAsync(backend, child.id, "Two");
        expect(Date.parse(second.updatedAt)).toBeGreaterThan(Date.parse(first.updatedAt));
        await expect(updateNodeTextAsync(backend, child.id, "   ")).rejects.toThrow("Text is required.");
        await expect(updateNodeTextAsync(backend, "missing", "ok")).rejects.toThrow("Node not found.");
    });
    it("toggles collapse and deletes subtrees atomically", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const child = await addChildNodeAsync(backend, project.id, project.rootNodeId, "Kid", "south");
        const grandchild = await addChildNodeAsync(backend, project.id, child.id, "Grandkid", "south");
        const collapsed = await setNodeCollapsedAsync(backend, child.id, true);
        expect(collapsed.collapsed).toBe(true);
        const same = await setNodeCollapsedAsync(backend, child.id, true);
        expect(same.updatedAt).toBe(collapsed.updatedAt);
        const res = await deleteNodeSubtreeAsync(backend, child.id);
        expect(res.deletedIds).toContain(child.id);
        expect(res.deletedIds).toContain(grandchild.id);
        expect(await getNodeCountForProjectAsync(backend, project.id)).toBe(1);
        const sibling = await addChildNodeAsync(backend, project.id, project.rootNodeId, "Sibling", "south");
        const projBefore = (await backend.loadProjects()).find((p) => p.id === project.id)!.updatedAt;
        await deleteNodeSubtreeAsync(backend, sibling.id);
        const projAfter = (await backend.loadProjects()).find((p) => p.id === project.id)!.updatedAt;
        expect(Date.parse(projAfter)).toBeGreaterThan(Date.parse(projBefore));
        await expect(deleteNodeSubtreeAsync(backend, project.rootNodeId)).rejects.toThrow("Cannot delete the root node.");
        await expect(deleteNodeSubtreeAsync(backend, "missing")).rejects.toThrow("Node not found.");
        await expect(setNodeCollapsedAsync(backend, "missing", true)).rejects.toThrow("Node not found.");
    });
    it("viewport round-trips with clamping and no updatedAt bump", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const before = (await backend.loadProjects()).find((p) => p.id === project.id)!.updatedAt;
        const saved = await setViewportAsync(backend, project.id, { x: 10, y: 20, zoom: 99 });
        expect(saved.zoom).toBe(3);
        expect(await getViewportAsync(backend, project.id)).toEqual(saved);
        const after = (await backend.loadProjects()).find((p) => p.id === project.id)!;
        expect(after.updatedAt).toBe(before);
        expect(loadProjects().find((p) => p.id === project.id)?.viewport).toEqual(saved);
        expect(await getViewportAsync(backend, "missing")).toBeNull();
        await expect(setViewportAsync(backend, "missing", { x: 0, y: 0, zoom: 1 })).rejects.toThrow(
            "Project not found.",
        );
    });
    it("falls back to the default for a corrupt stored viewport", async () => {
        const backend = createMemoryBackend();
        await backend.saveProjects([{ ...project("a"), viewport: "bad" as unknown as Viewport }]);
        expect(await getViewportAsync(backend, "a")).toEqual({ x: 0, y: 0, zoom: 1 });
    });
});

describe("localStorage mirror", () => {
    it("keeps the fallback seed fresh on create and delete", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        expect(loadProjects().map((p) => p.id)).toContain(project.id);
        expect(loadNodes().some((n) => n.projectId === project.id)).toBe(true);
        await deleteProjectAsync(backend, project.id);
        expect(loadProjects()).toHaveLength(0);
        expect(loadNodes()).toHaveLength(0);
    });
});

describe("node kind (13a)", () => {
    it("creates root and children as circles by default", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const root = (await backend.loadNodes()).find((n) => n.id === project.rootNodeId)!;
        expect(root.kind).toBe("circle");
        const child = await addChildNodeAsync(backend, project.id, project.rootNodeId, "Kid", "south");
        expect(child.kind).toBe("circle");
    });
    it("creates and edits long note text", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const child = await addChildNodeAsync(backend, project.id, project.rootNodeId, "x".repeat(200), "south", "note");
        expect(child.kind).toBe("note");
        const updated = await updateNodeTextAsync(backend, child.id, "y".repeat(280));
        expect(updated.text).toBe("y".repeat(280));
        await expect(updateNodeTextAsync(backend, child.id, "y".repeat(281))).rejects.toThrow(
            "Text must be 280 characters or less.",
        );
    });
    it("rejects invalid kind on add", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        await expect(
            addChildNodeAsync(backend, project.id, project.rootNodeId, "ok", "south", "photo" as never),
        ).rejects.toThrow("Invalid kind.");
    });
    it("converts circle to note and back with truncation guard", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const child = await addChildNodeAsync(backend, project.id, project.rootNodeId, "Kid", "south");
        const note = await setNodeKindAsync(backend, child.id, "note");
        expect(note.kind).toBe("note");
        const long = await updateNodeTextAsync(backend, child.id, "z".repeat(100));
        expect(long.text).toHaveLength(100);
        await expect(setNodeKindAsync(backend, child.id, "circle")).rejects.toThrow("confirm truncation");
        const truncated = await setNodeKindAsync(backend, child.id, "circle", { allowTruncate: true });
        expect(truncated.kind).toBe("circle");
        expect(truncated.text).toHaveLength(30);
    });
    it("normalizes legacy seed without kind on load", async () => {
        const legacy = {
            id: "r1",
            projectId: "p1",
            parentId: null,
            text: "hi",
            side: null,
            collapsed: false,
            createdAt: STAMP,
            updatedAt: STAMP,
        };
        const backend = createMemoryBackend({ nodes: [legacy as never] });
        const loaded = (await backend.loadNodes())[0];
        expect(loaded.kind).toBe("circle");
        expect(loaded.url).toBeNull();
    });
});

describe("node url (13b)", () => {
    it("creates root and children with null url", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const root = (await backend.loadNodes()).find((n) => n.id === project.rootNodeId)!;
        expect(root.url).toBeNull();
        const child = await addChildNodeAsync(backend, project.id, project.rootNodeId, "Kid", "south");
        expect(child.url).toBeNull();
    });
    it("sets, normalizes, and clears a link with project bump", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const child = await addChildNodeAsync(backend, project.id, project.rootNodeId, "Kid", "south");
        const before = (await backend.loadProjects()).find((p) => p.id === project.id)!.updatedAt;
        const linked = await setNodeUrlAsync(backend, child.id, "example.com");
        expect(linked.url).toBe("https://example.com/");
        const after = (await backend.loadProjects()).find((p) => p.id === project.id)!.updatedAt;
        expect(Date.parse(after) >= Date.parse(before)).toBe(true);
        const cleared = await setNodeUrlAsync(backend, child.id, "   ");
        expect(cleared.url).toBeNull();
        const clearedNull = await setNodeUrlAsync(backend, child.id, null);
        expect(clearedNull.url).toBeNull();
    });
    it("rejects invalid urls and unknown nodes", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const child = await addChildNodeAsync(backend, project.id, project.rootNodeId, "Kid", "south");
        await expect(setNodeUrlAsync(backend, child.id, "javascript:alert(1)")).rejects.toThrow("Enter a valid http(s) URL.");
        await expect(setNodeUrlAsync(backend, child.id, "ftp://example.com")).rejects.toThrow("Enter a valid http(s) URL.");
        await expect(setNodeUrlAsync(backend, "missing", "https://example.com")).rejects.toThrow("Node not found.");
    });
    it("preserves url across kind convert", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const child = await addChildNodeAsync(backend, project.id, project.rootNodeId, "Kid", "south");
        await setNodeUrlAsync(backend, child.id, "https://example.com");
        const note = await setNodeKindAsync(backend, child.id, "note");
        expect(note.url).toBe("https://example.com/");
    });
    it("defaults media to null on create", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const root = (await backend.loadNodes()).find((n) => n.id === project.rootNodeId)!;
        expect(root.media).toBeNull();
        const child = await addChildNodeAsync(backend, project.id, project.rootNodeId, "Kid", "south");
        expect(child.media).toBeNull();
    });
    it("sets, normalizes, and clears media with project bump", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const child = await addChildNodeAsync(backend, project.id, project.rootNodeId, "Kid", "south");
        const before = (await backend.loadProjects()).find((p) => p.id === project.id)!.updatedAt;
        const imaged = await setNodeMediaAsync(backend, child.id, { kind: "image", src: "example.com/a.png", uploadId: null });
        expect(imaged.media).toEqual({ kind: "image", src: "https://example.com/a.png", uploadId: null });
        const after = (await backend.loadProjects()).find((p) => p.id === project.id)!.updatedAt;
        expect(Date.parse(after) >= Date.parse(before)).toBe(true);
        const cleared = await setNodeMediaAsync(backend, child.id, null);
        expect(cleared.media).toBeNull();
    });
    it("resets mediaFill to true on attach and clear, keeps it on edit (13e)", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const child = await addChildNodeAsync(backend, project.id, project.rootNodeId, "Kid", "south");
        const attached = await setNodeMediaAsync(backend, child.id, { kind: "image", src: "https://example.com/a.png", uploadId: null });
        expect(attached.mediaFill).toBe(true);
        // Simulate a stored fill-off choice, then edit the media in place.
        const all = await backend.loadNodes();
        await backend.saveNodes(all.map((n) => (n.id === child.id ? { ...n, mediaFill: false } : n)));
        const edited = await setNodeMediaAsync(backend, child.id, { kind: "image", src: "https://example.com/b.png", uploadId: null });
        expect(edited.media?.src).toBe("https://example.com/b.png");
        expect(edited.mediaFill).toBe(false);
        const cleared = await setNodeMediaAsync(backend, child.id, null);
        expect(cleared.media).toBeNull();
        expect(cleared.mediaFill).toBe(true);
    });
    it("auto-sets medium on fresh media attach to a small node, keeps size on edit, clear, and medium nodes (13f)", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const child = await addChildNodeAsync(backend, project.id, project.rootNodeId, "Kid", "south");
        const attached = await setNodeMediaAsync(backend, child.id, { kind: "image", src: "https://example.com/a.png", uploadId: null });
        expect(attached.size).toBe("medium");
        // Editing media in place keeps the auto-set size.
        const edited = await setNodeMediaAsync(backend, child.id, { kind: "image", src: "https://example.com/b.png", uploadId: null });
        expect(edited.size).toBe("medium");
        const cleared = await setNodeMediaAsync(backend, child.id, null);
        expect(cleared.size).toBe("medium");
        // A node already large stays large on attach.
        await setNodeSizeAsync(backend, child.id, "large");
        const reattached = await setNodeMediaAsync(backend, child.id, { kind: "image", src: "https://example.com/c.png", uploadId: null });
        expect(reattached.size).toBe("large");
    });
    it("sets node size and persists it (13f)", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const child = await addChildNodeAsync(backend, project.id, project.rootNodeId, "Kid", "south");
        const medium = await setNodeSizeAsync(backend, child.id, "medium");
        expect(medium.size).toBe("medium");
        const stored = (await backend.loadNodes()).find((n) => n.id === child.id)!;
        expect(stored.size).toBe("medium");
        const again = await setNodeSizeAsync(backend, child.id, "medium");
        expect(again).toBe(medium);
        await expect(setNodeSizeAsync(backend, "missing", "large")).rejects.toThrow("Node not found.");
    });
    it("sets kind media on attach and reverts to note on clear (media kind)", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const child = await addChildNodeAsync(backend, project.id, project.rootNodeId, "Kid", "south");
        const attached = await setNodeMediaAsync(backend, child.id, { kind: "image", src: "https://example.com/a.png", uploadId: null });
        expect(attached.kind).toBe("media");
        const cleared = await setNodeMediaAsync(backend, child.id, null);
        expect(cleared.kind).toBe("note");
        await expect(setNodeKindAsync(backend, child.id, "media")).rejects.toThrow("Attach media");
    });
    it("toggles media fill only on nodes with media (13e)", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const child = await addChildNodeAsync(backend, project.id, project.rootNodeId, "Kid", "south");
        await expect(setNodeMediaFillAsync(backend, child.id, false)).rejects.toThrow("Attach media before filling the node.");
        await expect(setNodeMediaFillAsync(backend, "missing", false)).rejects.toThrow("Node not found.");
        await setNodeMediaAsync(backend, child.id, { kind: "image", src: "https://example.com/a.png", uploadId: null });
        const off = await setNodeMediaFillAsync(backend, child.id, false);
        expect(off.mediaFill).toBe(false);
        const stored = (await backend.loadNodes()).find((n) => n.id === child.id)!;
        expect(stored.mediaFill).toBe(false);
        const again = await setNodeMediaFillAsync(backend, child.id, false);
        expect(again).toBe(off);
        const on = await setNodeMediaFillAsync(backend, child.id, true);
        expect(on.mediaFill).toBe(true);
    });
    it("rejects invalid media and unknown nodes", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const child = await addChildNodeAsync(backend, project.id, project.rootNodeId, "Kid", "south");
        await expect(
            setNodeMediaAsync(backend, child.id, { kind: "image", src: "javascript:alert(1)", uploadId: null }),
        ).rejects.toThrow("Enter a valid http(s) URL.");
        await expect(
            setNodeMediaAsync(backend, child.id, { kind: "audio" as unknown as "image", src: "https://example.com/a.mp3", uploadId: null }),
        ).rejects.toThrow("Choose image or video.");
        await expect(
            setNodeMediaAsync(backend, "missing", { kind: "video", src: "https://example.com/v.mp4", uploadId: null }),
        ).rejects.toThrow("Node not found.");
    });
    it("drops media when converting away from the media kind, keeps it across url set", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const child = await addChildNodeAsync(backend, project.id, project.rootNodeId, "Kid", "south");
        await setNodeMediaAsync(backend, child.id, { kind: "video", src: "https://example.com/v.mp4", uploadId: null });
        // Converting the media node away drops its media: media is the kind.
        const note = await setNodeKindAsync(backend, child.id, "note");
        expect(note.kind).toBe("note");
        expect(note.media).toBeNull();
        const linked = await setNodeUrlAsync(backend, child.id, "https://example.com");
        expect(linked.media).toBeNull();
    });
    it("sets and clears upload media with project bump", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const child = await addChildNodeAsync(backend, project.id, project.rootNodeId, "Kid", "south");
        const uploaded = await setNodeMediaAsync(backend, child.id, { kind: "image", src: "", uploadId: "blob-1" });
        expect(uploaded.media).toEqual({ kind: "image", src: "", uploadId: "blob-1" });
        const cleared = await setNodeMediaAsync(backend, child.id, null);
        expect(cleared.media).toBeNull();
    });
    it("rejects video uploads", async () => {
        const backend = createMemoryBackend();
        const project = await createProjectAsync(backend, "Alpha");
        const child = await addChildNodeAsync(backend, project.id, project.rootNodeId, "Kid", "south");
        await expect(
            setNodeMediaAsync(backend, child.id, { kind: "video", src: "", uploadId: "blob-1" }),
        ).rejects.toThrow("Choose image or video.");
    });
});

describe("upload blob GC (13d)", () => {
    it("deletes subtree blobs but keeps the rest", async () => {
        const backend = createMemoryBackend();
        const blobs = createMemoryMediaBlobStore();
        const project = await createProjectAsync(backend, "Alpha");
        const child = await addChildNodeAsync(backend, project.id, project.rootNodeId, "Kid", "south");
        const other = await addChildNodeAsync(backend, project.id, project.rootNodeId, "Other", "north");
        await setNodeMediaAsync(backend, child.id, { kind: "image", src: "", uploadId: "blob-1" });
        await setNodeMediaAsync(backend, other.id, { kind: "image", src: "", uploadId: "blob-2" });
        await blobs.saveBlob({ id: "blob-1", projectId: project.id, nodeId: child.id, blob: new Blob(["a"]), createdAt: STAMP });
        await blobs.saveBlob({ id: "blob-2", projectId: project.id, nodeId: other.id, blob: new Blob(["b"]), createdAt: STAMP });
        await deleteNodeSubtreeAsync(backend, child.id, blobs);
        expect(await blobs.loadBlob("blob-1")).toBeNull();
        expect(await blobs.loadBlob("blob-2")).not.toBeNull();
    });
    it("deletes project blobs", async () => {
        const backend = createMemoryBackend();
        const blobs = createMemoryMediaBlobStore();
        const project = await createProjectAsync(backend, "Alpha");
        const child = await addChildNodeAsync(backend, project.id, project.rootNodeId, "Kid", "south");
        await setNodeMediaAsync(backend, child.id, { kind: "image", src: "", uploadId: "blob-1" });
        await blobs.saveBlob({ id: "blob-1", projectId: project.id, nodeId: child.id, blob: new Blob(["a"]), createdAt: STAMP });
        await deleteProjectAsync(backend, project.id, blobs);
        expect(await blobs.countBlobs()).toBe(0);
    });
});

describe("isQuotaError", () => {
    it("detects quota names", () => {
        expect(isQuotaError(Object.assign(new Error("x"), { name: "QuotaExceededError" }))).toBe(true);
        expect(isQuotaError(Object.assign(new Error("x"), { name: "NS_ERROR_DOM_QUOTA_REACHED" }))).toBe(true);
        expect(isQuotaError(new Error("other"))).toBe(false);
    });
});

describe("quota handling", () => {
    it("rethrows quota errors through the localStorage backend instead of swallowing them", async () => {
        stubWindow();
        const backend = createLocalStorageBackend();
        await backend.loadProjects();
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
        await expect(createProjectAsync(backend, "Alpha")).rejects.toThrow(quotaError);
        vi.unstubAllGlobals();
        __resetForTests();
    });
});

describe("duplicateProjectAsync", () => {
    it("deep-copies nodes with fresh ids, (copy) name, and newest-first order", async () => {
        const backend = createMemoryBackend();
        const blobs = createMemoryMediaBlobStore();
        const source = await createProjectAsync(backend, "Alpha");
        const kid = await addChildNodeAsync(backend, source.id, source.rootNodeId, "Kid", "east");
        await setNodeCollapsedAsync(backend, source.rootNodeId, false);
        const copy = await duplicateProjectAsync(backend, source.id, blobs);
        expect(copy.id).not.toBe(source.id);
        expect(copy.name).toBe("Alpha (copy)");
        expect(copy.rootNodeId).not.toBe(source.rootNodeId);
        expect(await getNodeCountForProjectAsync(backend, copy.id)).toBe(2);
        const nodes = await backend.loadNodes();
        const copiedKid = nodes.find((n) => n.projectId === copy.id && n.parentId !== null)!;
        expect(copiedKid.text).toBe("Kid");
        expect(copiedKid.id).not.toBe(kid.id);
        const sorted = await getProjectsSortedByUpdatedAtAsync(backend);
        expect(sorted[0].id).toBe(copy.id);
        const copy2 = await duplicateProjectAsync(backend, source.id, blobs);
        expect(copy2.name).toBe("Alpha (copy 2)");
    });
    it("copies upload blobs and clears refs when the blob is missing", async () => {
        const backend = createMemoryBackend();
        const blobs = createMemoryMediaBlobStore();
        const source = await createProjectAsync(backend, "Media");
        const kid = await addChildNodeAsync(backend, source.id, source.rootNodeId, "Photo", "east");
        await setNodeMediaAsync(backend, kid.id, { kind: "image", src: "", uploadId: "blob-1" });
        await blobs.saveBlob({ id: "blob-1", projectId: source.id, nodeId: kid.id, blob: new Blob(["a"]), createdAt: STAMP });
        const copy = await duplicateProjectAsync(backend, source.id, blobs);
        const nodes = await backend.loadNodes();
        const copiedKid = nodes.find((n) => n.projectId === copy.id && n.parentId !== null)!;
        const newUploadId = copiedKid.media?.uploadId ?? null;
        expect(newUploadId).not.toBeNull();
        expect(newUploadId).not.toBe("blob-1");
        const record = await blobs.loadBlob(newUploadId!);
        expect(record?.projectId).toBe(copy.id);
        expect(record?.nodeId).toBe(copiedKid.id);

        const missing = await createProjectAsync(backend, "Gone");
        const ghost = await addChildNodeAsync(backend, missing.id, missing.rootNodeId, "Ghost", "east");
        await setNodeMediaAsync(backend, ghost.id, { kind: "image", src: "", uploadId: "blob-gone" });
        const copyMissing = await duplicateProjectAsync(backend, missing.id, blobs);
        const nodesAfter = await backend.loadNodes();
        const copiedGhost = nodesAfter.find((n) => n.projectId === copyMissing.id && n.parentId !== null)!;
        expect(copiedGhost.media).toBeNull();
    });
    it("strips upload refs when duplicating without a blob store", async () => {
        const backend = createMemoryBackend();
        const source = await createProjectAsync(backend, "NoBlobs");
        const kid = await addChildNodeAsync(backend, source.id, source.rootNodeId, "Photo", "east");
        await setNodeMediaAsync(backend, kid.id, { kind: "image", src: "", uploadId: "blob-1" });
        const copy = await duplicateProjectAsync(backend, source.id);
        const nodes = await backend.loadNodes();
        const copiedKid = nodes.find((n) => n.projectId === copy.id && n.parentId !== null)!;
        expect(copiedKid.media).toBeNull();
        expect(copiedKid.kind).toBe("note");
    });
    it("clears the upload ref when the blob copy fails", async () => {
        const backend = createMemoryBackend();
        const blobs = createMemoryMediaBlobStore();
        const source = await createProjectAsync(backend, "Flaky");
        const kid = await addChildNodeAsync(backend, source.id, source.rootNodeId, "Photo", "east");
        await setNodeMediaAsync(backend, kid.id, { kind: "image", src: "", uploadId: "blob-1" });
        await blobs.saveBlob({ id: "blob-1", projectId: source.id, nodeId: kid.id, blob: new Blob(["a"]), createdAt: STAMP });
        const failingBlobs = { ...blobs, saveBlob: () => Promise.reject(new Error("full")) };
        const copy = await duplicateProjectAsync(backend, source.id, failingBlobs);
        const nodes = await backend.loadNodes();
        const copiedKid = nodes.find((n) => n.projectId === copy.id && n.parentId !== null)!;
        expect(copiedKid.media).toBeNull();
        expect(copiedKid.kind).toBe("note");
    });
});

describe("importProjectAsync", () => {
    it("remaps ids, auto-renames on collision, and strips upload refs", async () => {
        const { serializeProjectExportPure, parseProjectImportPure } = await import("../lib/projectHome");
        const backend = createMemoryBackend();
        const source = await createProjectAsync(backend, "Alpha");
        await addChildNodeAsync(backend, source.id, source.rootNodeId, "Kid", "east");
        const file = serializeProjectExportPure(source, await backend.loadNodes());
        const parsed = parseProjectImportPure(JSON.stringify(file));
        const imported = await importProjectAsync(backend, parsed);
        expect(imported.name).toBe("Alpha (imported)");
        expect(imported.id).not.toBe(source.id);
        expect(await getNodeCountForProjectAsync(backend, imported.id)).toBe(2);
        const nodes = await backend.loadNodes();
        const importedRoot = nodes.find((n) => n.id === imported.rootNodeId)!;
        expect(importedRoot.text).toBe("Alpha");
        expect(importedRoot.parentId).toBeNull();

        const withUpload = {
            ...parsed,
            name: "Fresh",
            nodes: parsed.nodes.map((n) =>
                n.parentId === null ? n : { ...n, kind: "media" as const, media: { kind: "image" as const, src: "", uploadId: "blob-x" } },
            ),
        };
        const stripped = await importProjectAsync(backend, withUpload);
        const after = await backend.loadNodes();
        const mediaKid = after.find((n) => n.projectId === stripped.id && n.parentId !== null)!;
        expect(mediaKid.media).toBeNull();
    });
});
