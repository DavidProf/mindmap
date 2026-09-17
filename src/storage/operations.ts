import type { Node, NodeKind, NodeMedia, NodeSide, NodeSize } from "../types/node";
import { isMediaNodeKind, isNodeKind, isNodeSide, normalizeNodeSizeValue, normalizeNodes } from "../types/node";
import { cloneNodes } from "../lib/history";
import type { Project, Viewport } from "../types/project";
import type { StorageBackend } from "./backend";
import type { MediaBlobStore } from "./mediaBlobs";
import {
    bumpedIso,
    clampZoom,
    DEFAULT_VIEWPORT,
    genId,
    getNodeCountForProjectPure,
    getSubtreeIdsPure,
    MAX_NODE_TEXT_LENGTH,
    normalizeNodeMediaPure,
    normalizeNodeUrlPure,
    nowIso,
    saveNodes,
    saveProjects,
    validateNodeMediaPure,
    validateNodeTextPure,
    validateNodeUrlPure,
    validateProjectNamePure,
} from "./localStore";

function sortByUpdatedAt(projects: Project[]): Project[] {
    return [...projects].sort((a, b) => {
        const diff = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
        if (diff !== 0) return diff;
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
}

export async function getProjectsSortedByUpdatedAtAsync(backend: StorageBackend): Promise<Project[]> {
    return sortByUpdatedAt(await backend.loadProjects());
}

export async function getNodeCountForProjectAsync(backend: StorageBackend, projectId: string): Promise<number> {
    return getNodeCountForProjectPure(await backend.loadNodes(), projectId);
}

// The localStorage copy is the fallback seed (spec: kept in place). Every
// backend write mirrors it best-effort so the fallback path stays fresh.
// Failures are swallowed: the backend already persisted authoritatively.
function mirrorToLocalStorage(projects: Project[], nodes: Node[]): void {
    try {
        saveProjects(projects);
        saveNodes(nodes);
    } catch {
        // best-effort fallback seed only
    }
}

export async function createProjectAsync(backend: StorageBackend, name: string): Promise<Project> {
    const projects = await backend.loadProjects();
    const trimmed = name.trim();
    const err = validateProjectNamePure(trimmed, projects);
    if (err) throw new Error(err);

    const id = genId();
    const rootId = genId();
    const now = nowIso();
    const project: Project = {
        id,
        name: trimmed,
        rootNodeId: rootId,
        createdAt: now,
        updatedAt: now,
        viewport: { x: 0, y: 0, zoom: 1 },
    };
    const rootNode: Node = {
        id: rootId,
        projectId: id,
        parentId: null,
        text: trimmed,
        kind: "circle",
        url: null,
        media: null,
        mediaFill: true,
        size: "small",
        side: null,
        collapsed: false,
        createdAt: now,
        updatedAt: now,
    };

    const nodes = await backend.loadNodes();
    projects.push(project);
    nodes.push(rootNode);
    await backend.saveProjects(projects);
    await backend.saveNodes(nodes);
    mirrorToLocalStorage(projects, nodes);
    return project;
}

export async function renameProjectAsync(backend: StorageBackend, id: string, newName: string): Promise<Project> {
    const projects = await backend.loadProjects();
    const trimmed = newName.trim();
    const err = validateProjectNamePure(trimmed, projects, id);
    if (err) throw new Error(err);

    const idx = projects.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Project not found.");

    const oldName = projects[idx].name;
    const now = nowIso();
    projects[idx] = { ...projects[idx], name: trimmed, updatedAt: now };
    await backend.saveProjects(projects);

    const nodes = await backend.loadNodes();
    const rootIdx = nodes.findIndex((n) => n.id === projects[idx].rootNodeId);
    if (rootIdx !== -1 && nodes[rootIdx].text === oldName) {
        nodes[rootIdx] = { ...nodes[rootIdx], text: trimmed, updatedAt: now };
        await backend.saveNodes(nodes);
    }
    mirrorToLocalStorage(projects, nodes);

    return projects[idx];
}

export async function deleteProjectAsync(backend: StorageBackend, id: string, blobs?: MediaBlobStore): Promise<void> {
    const projects = await backend.loadProjects();
    const nodes = await backend.loadNodes();
    const remainingProjects = projects.filter((p) => p.id !== id);
    const remainingNodes = nodes.filter((n) => n.projectId !== id);
    await backend.saveProjects(remainingProjects);
    await backend.saveNodes(remainingNodes);
    mirrorToLocalStorage(remainingProjects, remainingNodes);
    await blobs?.deleteBlobsForProject(id).catch(() => undefined);
}

export async function addChildNodeAsync(
    backend: StorageBackend,
    projectId: string,
    parentId: string,
    text: string,
    side: NodeSide,
    kind: NodeKind = "circle",
): Promise<Node> {
    if (!isNodeKind(kind)) throw new Error("Invalid kind.");
    const err = validateNodeTextPure(text, kind);
    if (err) throw new Error(err);
    if (!isNodeSide(side)) throw new Error("Invalid side.");

    const projects = await backend.loadProjects();
    const pIdx = projects.findIndex((p) => p.id === projectId);
    if (pIdx === -1) throw new Error("Project not found.");

    const nodes = await backend.loadNodes();
    const parent = nodes.find((n) => n.id === parentId && n.projectId === projectId);
    if (!parent) throw new Error("Parent node not found.");

    const now = nowIso();
    const child: Node = {
        id: genId(),
        projectId,
        parentId,
        text: text.trim(),
        kind,
        url: null,
        media: null,
        mediaFill: true,
        size: "small",
        side,
        collapsed: false,
        createdAt: now,
        updatedAt: now,
    };
    nodes.push(child);
    await backend.saveNodes(nodes);

    projects[pIdx] = { ...projects[pIdx], updatedAt: bumpedIso(projects[pIdx].updatedAt) };
    await backend.saveProjects(projects);
    mirrorToLocalStorage(projects, nodes);
    return child;
}

export async function updateNodeTextAsync(backend: StorageBackend, nodeId: string, text: string): Promise<Node> {
    const nodes = normalizeNodes(await backend.loadNodes());
    const idx = nodes.findIndex((n) => n.id === nodeId);
    if (idx === -1) throw new Error("Node not found.");

    const err = validateNodeTextPure(text, nodes[idx].kind);
    if (err) throw new Error(err);

    const trimmed = text.trim();
    if (nodes[idx].text === trimmed) return nodes[idx];
    const updated: Node = { ...nodes[idx], text: trimmed, updatedAt: bumpedIso(nodes[idx].updatedAt) };
    nodes[idx] = updated;
    await backend.saveNodes(nodes);

    const projects = await backend.loadProjects();
    const pIdx = projects.findIndex((p) => p.id === updated.projectId);
    if (pIdx !== -1) {
        projects[pIdx] = { ...projects[pIdx], updatedAt: bumpedIso(projects[pIdx].updatedAt) };
        await backend.saveProjects(projects);
        mirrorToLocalStorage(projects, nodes);
    }
    return updated;
}

export async function setNodeKindAsync(
    backend: StorageBackend,
    nodeId: string,
    kind: NodeKind,
    opts?: { allowTruncate?: boolean },
): Promise<Node> {
    if (!isNodeKind(kind)) throw new Error("Invalid kind.");
    const nodes = normalizeNodes(await backend.loadNodes());
    const idx = nodes.findIndex((n) => n.id === nodeId);
    if (idx === -1) throw new Error("Node not found.");
    if (nodes[idx].kind === kind) return nodes[idx];

    let text = nodes[idx].text;
    if (kind === "circle" && text.trim().length > MAX_NODE_TEXT_LENGTH) {
        if (!opts?.allowTruncate) throw new Error(`Text exceeds ${MAX_NODE_TEXT_LENGTH} characters; confirm truncation to convert.`);
        text = text.trim().slice(0, MAX_NODE_TEXT_LENGTH);
    }
    if (isMediaNodeKind(kind)) throw new Error("Attach media to make a media node.");
    // Media converts away with the kind: a media node becoming circle or note
    // drops its media, since media is what makes the node a media node.
    const dropMedia = isMediaNodeKind(nodes[idx].kind) && nodes[idx].media !== null;
    const updated: Node = {
        ...nodes[idx],
        kind,
        text,
        media: dropMedia ? null : nodes[idx].media,
        mediaFill: dropMedia ? true : nodes[idx].mediaFill,
        updatedAt: bumpedIso(nodes[idx].updatedAt),
    };
    nodes[idx] = updated;
    await backend.saveNodes(nodes);

    const projects = await backend.loadProjects();
    const pIdx = projects.findIndex((p) => p.id === updated.projectId);
    if (pIdx !== -1) {
        projects[pIdx] = { ...projects[pIdx], updatedAt: bumpedIso(projects[pIdx].updatedAt) };
        await backend.saveProjects(projects);
        mirrorToLocalStorage(projects, nodes);
    }
    return updated;
}

export async function setNodeUrlAsync(backend: StorageBackend, nodeId: string, url: string | null): Promise<Node> {
    const nodes = normalizeNodes(await backend.loadNodes());
    const idx = nodes.findIndex((n) => n.id === nodeId);
    if (idx === -1) throw new Error("Node not found.");

    const err = validateNodeUrlPure(url);
    if (err) throw new Error(err);
    const nextUrl = normalizeNodeUrlPure(url);
    if ((nodes[idx].url ?? null) === nextUrl) return nodes[idx];

    const updated: Node = { ...nodes[idx], url: nextUrl, updatedAt: bumpedIso(nodes[idx].updatedAt) };
    nodes[idx] = updated;
    await backend.saveNodes(nodes);

    const projects = await backend.loadProjects();
    const pIdx = projects.findIndex((p) => p.id === updated.projectId);
    if (pIdx !== -1) {
        projects[pIdx] = { ...projects[pIdx], updatedAt: bumpedIso(projects[pIdx].updatedAt) };
        await backend.saveProjects(projects);
        mirrorToLocalStorage(projects, nodes);
    }
    return updated;
}

export async function setNodeMediaAsync(
    backend: StorageBackend,
    nodeId: string,
    media: NodeMedia | null,
): Promise<Node> {
    const nodes = normalizeNodes(await backend.loadNodes());
    const idx = nodes.findIndex((n) => n.id === nodeId);
    if (idx === -1) throw new Error("Node not found.");

    const err = validateNodeMediaPure(media?.kind ?? null, media?.src ?? null, media?.uploadId ?? null);
    if (err) throw new Error(err);
    const nextMedia = normalizeNodeMediaPure(media);
    const prevMedia = nodes[idx].media ?? null;
    const same =
        (nextMedia === null && prevMedia === null) ||
        (nextMedia !== null &&
            prevMedia !== null &&
            nextMedia.kind === prevMedia.kind &&
            nextMedia.src === prevMedia.src &&
            (nextMedia.uploadId ?? null) === (prevMedia.uploadId ?? null));
    if (same) return nodes[idx];

    // Attaching media or clearing it resets fill to the default; editing keeps the choice.
    const nextMediaFill = nextMedia !== null && prevMedia !== null ? nodes[idx].mediaFill : true;
    // Media nodes carry their media: attaching names the kind, clearing reverts to note.
    const nextKind = nextMedia !== null ? ("media" as const) : isMediaNodeKind(nodes[idx].kind) ? ("note" as const) : nodes[idx].kind;
    // Fresh attach on a small node: media reads too tight at the base footprint.
    const currentSize = normalizeNodeSizeValue(nodes[idx].size);
    const autoSize = nextMedia !== null && prevMedia === null && currentSize === "small" ? ("medium" as const) : currentSize;
    const updated: Node = {
        ...nodes[idx],
        kind: nextKind,
        media: nextMedia,
        mediaFill: nextMediaFill,
        size: autoSize,
        updatedAt: bumpedIso(nodes[idx].updatedAt),
    };
    nodes[idx] = updated;
    await backend.saveNodes(nodes);

    const projects = await backend.loadProjects();
    const pIdx = projects.findIndex((p) => p.id === updated.projectId);
    if (pIdx !== -1) {
        projects[pIdx] = { ...projects[pIdx], updatedAt: bumpedIso(projects[pIdx].updatedAt) };
        await backend.saveProjects(projects);
        mirrorToLocalStorage(projects, nodes);
    }
    return updated;
}

export async function setNodeMediaFillAsync(backend: StorageBackend, nodeId: string, fill: boolean): Promise<Node> {
    const nodes = normalizeNodes(await backend.loadNodes());
    const idx = nodes.findIndex((n) => n.id === nodeId);
    if (idx === -1) throw new Error("Node not found.");
    if (nodes[idx].media === null) throw new Error("Attach media before filling the node.");
    if (nodes[idx].mediaFill === fill) return nodes[idx];

    const updated: Node = { ...nodes[idx], mediaFill: fill, updatedAt: bumpedIso(nodes[idx].updatedAt) };
    nodes[idx] = updated;
    await backend.saveNodes(nodes);

    const projects = await backend.loadProjects();
    const pIdx = projects.findIndex((p) => p.id === updated.projectId);
    if (pIdx !== -1) {
        projects[pIdx] = { ...projects[pIdx], updatedAt: bumpedIso(projects[pIdx].updatedAt) };
        await backend.saveProjects(projects);
        mirrorToLocalStorage(projects, nodes);
    }
    return updated;
}

export async function setNodeSizeAsync(backend: StorageBackend, nodeId: string, size: NodeSize): Promise<Node> {
    const nodes = normalizeNodes(await backend.loadNodes());
    const idx = nodes.findIndex((n) => n.id === nodeId);
    if (idx === -1) throw new Error("Node not found.");
    if (nodes[idx].size === size) return nodes[idx];

    const updated: Node = { ...nodes[idx], size, updatedAt: bumpedIso(nodes[idx].updatedAt) };
    nodes[idx] = updated;
    await backend.saveNodes(nodes);

    const projects = await backend.loadProjects();
    const pIdx = projects.findIndex((p) => p.id === updated.projectId);
    if (pIdx !== -1) {
        projects[pIdx] = { ...projects[pIdx], updatedAt: bumpedIso(projects[pIdx].updatedAt) };
        await backend.saveProjects(projects);
        mirrorToLocalStorage(projects, nodes);
    }
    return updated;
}

export async function setNodeCollapsedAsync(backend: StorageBackend, nodeId: string, collapsed: boolean): Promise<Node> {
    const nodes = await backend.loadNodes();
    const idx = nodes.findIndex((n) => n.id === nodeId);
    if (idx === -1) throw new Error("Node not found.");
    if (nodes[idx].collapsed === collapsed) return nodes[idx];

    const updated: Node = { ...nodes[idx], collapsed, updatedAt: bumpedIso(nodes[idx].updatedAt) };
    nodes[idx] = updated;
    await backend.saveNodes(nodes);

    const projects = await backend.loadProjects();
    const pIdx = projects.findIndex((p) => p.id === updated.projectId);
    if (pIdx !== -1) {
        projects[pIdx] = { ...projects[pIdx], updatedAt: bumpedIso(projects[pIdx].updatedAt) };
        await backend.saveProjects(projects);
        mirrorToLocalStorage(projects, nodes);
    }
    return updated;
}

export async function deleteNodeSubtreeAsync(
    backend: StorageBackend,
    nodeId: string,
    blobs?: MediaBlobStore,
): Promise<{ deletedIds: string[] }> {
    const nodes = await backend.loadNodes();
    const target = nodes.find((n) => n.id === nodeId);
    if (!target) throw new Error("Node not found.");
    if (target.parentId === null) throw new Error("Cannot delete the root node.");

    const ids = new Set(getSubtreeIdsPure(nodes, nodeId));
    const remaining = nodes.filter((n) => !ids.has(n.id));
    await backend.saveNodes(remaining);

    const projects = await backend.loadProjects();
    const pIdx = projects.findIndex((p) => p.id === target.projectId);
    if (pIdx !== -1) {
        projects[pIdx] = { ...projects[pIdx], updatedAt: bumpedIso(projects[pIdx].updatedAt) };
        await backend.saveProjects(projects);
        mirrorToLocalStorage(projects, remaining);
    }
    await blobs?.deleteBlobsForNodeIds([...ids]).catch(() => undefined);
    return { deletedIds: [...ids] };
}

export async function restoreProjectNodesAsync(
    backend: StorageBackend,
    projectId: string,
    snapshot: Node[],
): Promise<Node[]> {
    const scoped = cloneNodes(snapshot);
    const all = await backend.loadNodes();
    const merged = [...all.filter((n) => n.projectId !== projectId), ...scoped];
    await backend.saveNodes(merged);

    const projects = await backend.loadProjects();
    const pIdx = projects.findIndex((p) => p.id === projectId);
    if (pIdx !== -1) {
        projects[pIdx] = { ...projects[pIdx], updatedAt: bumpedIso(projects[pIdx].updatedAt) };
        await backend.saveProjects(projects);
    }
    mirrorToLocalStorage(projects, merged);
    return scoped;
}

export function isQuotaError(e: unknown): boolean {
    const err = e as DOMException;
    return err?.name === "QuotaExceededError" || err?.name === "NS_ERROR_DOM_QUOTA_REACHED";
}

function isValidViewport(v: unknown): v is Viewport {
    if (!v || typeof v !== "object") return false;
    const o = v as Record<string, unknown>;
    return typeof o.x === "number" && typeof o.y === "number" && typeof o.zoom === "number";
}

export async function getViewportAsync(backend: StorageBackend, projectId: string): Promise<Viewport | null> {
    const projects = await backend.loadProjects();
    const p = projects.find((pr) => pr.id === projectId);
    if (!p) return null;
    if (!isValidViewport(p.viewport)) return { ...DEFAULT_VIEWPORT };
    return p.viewport;
}

export async function setViewportAsync(backend: StorageBackend, projectId: string, viewport: Viewport): Promise<Viewport> {
    const projects = await backend.loadProjects();
    const idx = projects.findIndex((pr) => pr.id === projectId);
    if (idx === -1) throw new Error("Project not found.");

    const clamped: Viewport = {
        x: viewport.x,
        y: viewport.y,
        zoom: clampZoom(viewport.zoom),
    };
    // Viewport-only saves must not bump updatedAt, or panning would
    // reorder the home list. Content edits bump it elsewhere.
    projects[idx] = { ...projects[idx], viewport: clamped };
    await backend.saveProjects(projects);
    mirrorToLocalStorage(projects, await backend.loadNodes());
    return clamped;
}
