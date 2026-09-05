// Storage layer for Home projects management — localStorage with
// corruption recovery, quota handling, and unavailable fallback.
// Keys: mindmap:projects + mindmap:nodes (documented choice per spec).

import type { Project, Viewport } from "../types/project";
import type { Node, NodeSide } from "../types/node";
import { isNodeSide } from "../types/node";

const PROJECTS_KEY = "mindmap:projects";
const NODES_KEY = "mindmap:nodes";

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 3;
export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

let storageAvailable: boolean | null = null;
let memoryProjects: Project[] | null = null;
let memoryNodes: Node[] | null = null;
let hadCorruption = false;

function checkStorageAvailable(): boolean {
    if (storageAvailable !== null) return storageAvailable;
    try {
        const probe = "__mindmap_probe__";
        window.localStorage.setItem(probe, "1");
        window.localStorage.removeItem(probe);
        storageAvailable = true;
    } catch {
        storageAvailable = false;
        if (memoryProjects === null) memoryProjects = [];
        if (memoryNodes === null) memoryNodes = [];
    }
    return storageAvailable;
}

export function isStorageAvailable(): boolean {
    return checkStorageAvailable();
}

function safeGetItem(key: string): string | null {
    if (!checkStorageAvailable()) return null;
    try {
        return window.localStorage.getItem(key);
    } catch {
        storageAvailable = false;
        if (memoryProjects === null) memoryProjects = [];
        if (memoryNodes === null) memoryNodes = [];
        return null;
    }
}

function safeSetItem(key: string, value: string): void {
    if (!checkStorageAvailable()) {
        if (key === PROJECTS_KEY) memoryProjects = JSON.parse(value) as Project[];
        if (key === NODES_KEY) memoryNodes = JSON.parse(value) as Node[];
        return;
    }
    try {
        window.localStorage.setItem(key, value);
    } catch (e) {
        const err = e as DOMException;
        if (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED") {
            throw err;
        }
        storageAvailable = false;
        if (memoryProjects === null) memoryProjects = [];
        if (memoryNodes === null) memoryNodes = [];
        if (key === PROJECTS_KEY) memoryProjects = JSON.parse(value) as Project[];
        if (key === NODES_KEY) memoryNodes = JSON.parse(value) as Node[];
    }
}

function safeRemoveItem(key: string): void {
    if (!checkStorageAvailable()) return;
    try {
        window.localStorage.removeItem(key);
    } catch {
        storageAvailable = false;
    }
}

function genId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
    return new Date().toISOString();
}

function parseOrFallback<T>(raw: string | null, key: string): T[] {
    if (raw === null) return [];
    try {
        const parsed = JSON.parse(raw) as T[];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        console.warn(`[storage] corrupted ${key}, resetting`);
        hadCorruption = true;
        safeRemoveItem(key);
        return [];
    }
}

export function consumeCorruptionFlag(): boolean {
    const v = hadCorruption;
    hadCorruption = false;
    return v;
}

export function loadProjects(): Project[] {
    if (!checkStorageAvailable() && memoryProjects !== null) return [...memoryProjects];
    const raw = safeGetItem(PROJECTS_KEY);
    if (!checkStorageAvailable() && memoryProjects !== null) return [...memoryProjects];
    const parsed = parseOrFallback<Project>(raw, PROJECTS_KEY);
    if (memoryProjects !== null && !checkStorageAvailable()) return [...memoryProjects];
    return parsed;
}

export function loadNodes(): Node[] {
    if (!checkStorageAvailable() && memoryNodes !== null) return [...memoryNodes];
    const raw = safeGetItem(NODES_KEY);
    if (!checkStorageAvailable() && memoryNodes !== null) return [...memoryNodes];
    const parsed = parseOrFallback<Node>(raw, NODES_KEY);
    return parsed;
}

export function saveProjects(projects: Project[]): void {
    safeSetItem(PROJECTS_KEY, JSON.stringify(projects));
    if (memoryProjects !== null) memoryProjects = [...projects];
}

export function saveNodes(nodes: Node[]): void {
    safeSetItem(NODES_KEY, JSON.stringify(nodes));
    if (memoryNodes !== null) memoryNodes = [...nodes];
}

export function getProjectsSortedByUpdatedAt(): Project[] {
    const projects = loadProjects();
    return [...projects].sort((a, b) => {
        const diff = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
        if (diff !== 0) return diff;
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
}

export function isNameUnique(name: string, excludeId?: string): boolean {
    return isNameUniquePure(name, loadProjects(), excludeId);
}

export function isNameUniquePure(name: string, projects: Project[], excludeId?: string): boolean {
    const normalized = name.trim().toLowerCase();
    return !projects.some((p) => p.id !== excludeId && p.name.trim().toLowerCase() === normalized);
}

export function validateProjectName(raw: string, excludeId?: string): string | null {
    return validateProjectNamePure(raw, loadProjects(), excludeId);
}

export function validateProjectNamePure(raw: string, projects: Project[], excludeId?: string): string | null {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return "Name is required.";
    if (trimmed.length > 40) return "Name must be 40 characters or less.";
    if (!isNameUniquePure(trimmed, projects, excludeId)) return "A project with this name already exists.";
    return null;
}

export function getNodeCountForProjectPure(nodes: Node[], projectId: string): number {
    return nodes.filter((n) => n.projectId === projectId).length;
}

export function createProject(name: string): Project {
    const trimmed = name.trim();
    const err = validateProjectName(trimmed);
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
        side: null,
        collapsed: false,
        createdAt: now,
        updatedAt: now,
    };

    const projects = loadProjects();
    const nodes = loadNodes();
    projects.push(project);
    nodes.push(rootNode);
    saveProjects(projects);
    saveNodes(nodes);
    return project;
}

export function renameProject(id: string, newName: string): Project {
    const trimmed = newName.trim();
    const err = validateProjectName(trimmed, id);
    if (err) throw new Error(err);

    const projects = loadProjects();
    const idx = projects.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Project not found.");

    const oldName = projects[idx].name;
    const now = nowIso();
    projects[idx] = { ...projects[idx], name: trimmed, updatedAt: now };
    saveProjects(projects);

    const nodes = loadNodes();
    const rootIdx = nodes.findIndex((n) => n.id === projects[idx].rootNodeId);
    if (rootIdx !== -1 && nodes[rootIdx].text === oldName) {
        nodes[rootIdx] = { ...nodes[rootIdx], text: trimmed, updatedAt: now };
        saveNodes(nodes);
    }

    return projects[idx];
}

export function deleteProject(id: string): void {
    const projects = loadProjects();
    const nodes = loadNodes();
    const filteredProjects = projects.filter((p) => p.id !== id);
    const filteredNodes = nodes.filter((n) => n.projectId !== id);
    saveProjects(filteredProjects);
    saveNodes(filteredNodes);
}

export function getNodeCountForProject(projectId: string): number {
    return loadNodes().filter((n) => n.projectId === projectId).length;
}

export const MAX_NODE_TEXT_LENGTH = 30;

export function validateNodeTextPure(raw: string): string | null {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return "Text is required.";
    if (trimmed.length > MAX_NODE_TEXT_LENGTH) return `Text must be ${MAX_NODE_TEXT_LENGTH} characters or less.`;
    return null;
}

function bumpedIso(prevUpdated: string): string {
    const now = nowIso();
    if (Date.parse(now) <= Date.parse(prevUpdated)) {
        return new Date(Date.parse(prevUpdated) + 1).toISOString();
    }
    return now;
}

export function addChildNode(projectId: string, parentId: string, text: string, side: NodeSide): Node {
    const err = validateNodeTextPure(text);
    if (err) throw new Error(err);
    if (!isNodeSide(side)) throw new Error("Invalid side.");

    const projects = loadProjects();
    const pIdx = projects.findIndex((p) => p.id === projectId);
    if (pIdx === -1) throw new Error("Project not found.");

    const nodes = loadNodes();
    const parent = nodes.find((n) => n.id === parentId && n.projectId === projectId);
    if (!parent) throw new Error("Parent node not found.");

    const now = nowIso();
    const child: Node = {
        id: genId(),
        projectId,
        parentId,
        text: text.trim(),
        side,
        collapsed: false,
        createdAt: now,
        updatedAt: now,
    };
    nodes.push(child);
    saveNodes(nodes);

    projects[pIdx] = { ...projects[pIdx], updatedAt: bumpedIso(projects[pIdx].updatedAt) };
    saveProjects(projects);
    return child;
}

export function updateNodeText(nodeId: string, text: string): Node {
    const err = validateNodeTextPure(text);
    if (err) throw new Error(err);

    const nodes = loadNodes();
    const idx = nodes.findIndex((n) => n.id === nodeId);
    if (idx === -1) throw new Error("Node not found.");

    const trimmed = text.trim();
    if (nodes[idx].text === trimmed) return nodes[idx];
    const updated: Node = { ...nodes[idx], text: trimmed, updatedAt: bumpedIso(nodes[idx].updatedAt) };
    nodes[idx] = updated;
    saveNodes(nodes);

    const projects = loadProjects();
    const pIdx = projects.findIndex((p) => p.id === updated.projectId);
    if (pIdx !== -1) {
        projects[pIdx] = { ...projects[pIdx], updatedAt: bumpedIso(projects[pIdx].updatedAt) };
        saveProjects(projects);
    }
    return updated;
}

export function setNodeCollapsed(nodeId: string, collapsed: boolean): Node {
    const nodes = loadNodes();
    const idx = nodes.findIndex((n) => n.id === nodeId);
    if (idx === -1) throw new Error("Node not found.");
    if (nodes[idx].collapsed === collapsed) return nodes[idx];

    const updated: Node = { ...nodes[idx], collapsed, updatedAt: bumpedIso(nodes[idx].updatedAt) };
    nodes[idx] = updated;
    saveNodes(nodes);

    const projects = loadProjects();
    const pIdx = projects.findIndex((p) => p.id === updated.projectId);
    if (pIdx !== -1) {
        projects[pIdx] = { ...projects[pIdx], updatedAt: bumpedIso(projects[pIdx].updatedAt) };
        saveProjects(projects);
    }
    return updated;
}

export function getSubtreeIdsPure(nodes: Node[], nodeId: string): string[] {
    const target = nodes.find((n) => n.id === nodeId);
    if (!target) return [];
    const childrenMap = new Map<string, Node[]>();
    for (const n of nodes) {
        if (n.parentId === null || n.projectId !== target.projectId) continue;
        const arr = childrenMap.get(n.parentId);
        if (arr) arr.push(n);
        else childrenMap.set(n.parentId, [n]);
    }
    const ids: string[] = [];
    const seen = new Set<string>();
    const stack: string[] = [nodeId];
    while (stack.length > 0) {
        const id = stack.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
        const children = childrenMap.get(id) ?? [];
        for (let i = children.length - 1; i >= 0; i--) stack.push(children[i].id);
    }
    return ids;
}

export function countSubtreeNodesPure(nodes: Node[], nodeId: string): number {
    return getSubtreeIdsPure(nodes, nodeId).length;
}

export function getSubtreeCountsPure(nodes: Node[]): Map<string, number> {
    const nodeById = new Map<string, Node>();
    for (const n of nodes) nodeById.set(n.id, n);
    const childrenMap = new Map<string, Node[]>();
    for (const n of nodes) {
        if (n.parentId === null) continue;
        const arr = childrenMap.get(n.parentId);
        if (arr) arr.push(n);
        else childrenMap.set(n.parentId, [n]);
    }
    const counts = new Map<string, number>();
    const visiting = new Set<string>();
    function count(id: string): number {
        if (counts.has(id)) return counts.get(id)!;
        if (visiting.has(id)) return 0;
        const node = nodeById.get(id);
        if (!node) {
            counts.set(id, 0);
            return 0;
        }
        visiting.add(id);
        const children = childrenMap.get(id) ?? [];
        // Keep subtree within the same project.
        let total = 1;
        for (const child of children) {
            if (child.projectId !== node.projectId) continue;
            total += count(child.id);
        }
        visiting.delete(id);
        counts.set(id, total);
        return total;
    }
    for (const n of nodes) count(n.id);
    return counts;
}

export function deleteNodeSubtree(nodeId: string): { deletedIds: string[] } {
    const nodes = loadNodes();
    const target = nodes.find((n) => n.id === nodeId);
    if (!target) throw new Error("Node not found.");
    if (target.parentId === null) throw new Error("Cannot delete the root node.");

    const ids = new Set(getSubtreeIdsPure(nodes, nodeId));
    saveNodes(nodes.filter((n) => !ids.has(n.id)));

    const projects = loadProjects();
    const pIdx = projects.findIndex((p) => p.id === target.projectId);
    if (pIdx !== -1) {
        projects[pIdx] = { ...projects[pIdx], updatedAt: bumpedIso(projects[pIdx].updatedAt) };
        saveProjects(projects);
    }
    return { deletedIds: [...ids] };
}

export function clampZoom(z: number): number {
    if (!Number.isFinite(z)) return DEFAULT_VIEWPORT.zoom;
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

function isValidViewport(v: unknown): v is Viewport {
    if (!v || typeof v !== "object") return false;
    const o = v as Record<string, unknown>;
    return typeof o.x === "number" && typeof o.y === "number" && typeof o.zoom === "number";
}

export function getViewport(projectId: string): Viewport | null {
    const projects = loadProjects();
    const p = projects.find((pr) => pr.id === projectId);
    if (!p) return null;
    if (!isValidViewport(p.viewport)) return { ...DEFAULT_VIEWPORT };
    return p.viewport;
}

export function setViewport(projectId: string, viewport: Viewport): Viewport {
    const projects = loadProjects();
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
    saveProjects(projects);
    return clamped;
}

// Test-only helper to reset in-memory state and storage keys
export function __resetForTests(): void {
    memoryProjects = null;
    memoryNodes = null;
    storageAvailable = null;
    hadCorruption = false;
    try {
        window.localStorage.removeItem(PROJECTS_KEY);
        window.localStorage.removeItem(NODES_KEY);
    } catch {
        // ignore
    }
}
