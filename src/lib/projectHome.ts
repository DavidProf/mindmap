import type { Node, NodeKind, NodeMedia, NodeSide, NodeSize } from "../types/node";
import { isNodeKind, isNodeMediaKind, isNodeSide, isNodeSize } from "../types/node";
import type { Project, Viewport } from "../types/project";
import { DEFAULT_VIEWPORT, MAX_PROJECT_NAME_LENGTH, clampZoom, isNameUniquePure } from "../storage/localStore";

export type HomeSortKey = "name" | "created" | "updated";
export type HomeSortDir = "asc" | "desc";

export const PROJECT_EXPORT_VERSION = 1;
export const PROJECT_IMPORT_MAX_BYTES = 10 * 1024 * 1024;

export type ExportNode = {
    id: string;
    parentId: string | null;
    text: string;
    kind: NodeKind;
    url: string | null;
    media: NodeMedia | null;
    mediaFill: boolean;
    size: NodeSize;
    side: NodeSide | null;
    collapsed: boolean;
};

export type ProjectExportFile = {
    app: "mindmap";
    version: 1;
    project: { name: string; viewport: Viewport };
    nodes: ExportNode[];
};

export type ParsedProjectImport = {
    name: string;
    viewport: Viewport;
    nodes: ExportNode[];
};

function truncateForSuffix(base: string, suffix: string): string {
    const room = MAX_PROJECT_NAME_LENGTH - suffix.length;
    if (room <= 0) return suffix.slice(0, MAX_PROJECT_NAME_LENGTH);
    return base.length <= room ? base : base.slice(0, room).trimEnd();
}

function uniqueSuffixed(base: string, firstSuffix: string, numbered: (n: number) => string, projects: Project[]): string {
    const clean = base.trim();
    let suffix = firstSuffix;
    let candidate = `${truncateForSuffix(clean, suffix)}${suffix}`;
    let n = 2;
    while (!isNameUniquePure(candidate, projects)) {
        suffix = numbered(n);
        candidate = `${truncateForSuffix(clean, suffix)}${suffix}`;
        n += 1;
    }
    return candidate;
}

export function buildDuplicateNamePure(baseName: string, projects: Project[]): string {
    return uniqueSuffixed(baseName, " (copy)", (n) => ` (copy ${n})`, projects);
}

export function buildImportedNamePure(baseName: string, projects: Project[]): string {
    return uniqueSuffixed(baseName, " (imported)", (n) => ` (imported ${n})`, projects);
}

export function filterProjectsPure(projects: Project[], query: string): Project[] {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return [...projects];
    return projects.filter((p) => p.name.toLowerCase().includes(q));
}

export function sortProjectsPure(projects: Project[], key: HomeSortKey, dir: HomeSortDir = "desc"): Project[] {
    const sign = dir === "asc" ? 1 : -1;
    const out = [...projects];
    out.sort((a, b) => {
        if (key === "name") {
            const name = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
            if (name !== 0) return dir === "asc" ? name : -name;
            return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
        }
        const field = key === "created" ? "createdAt" : "updatedAt";
        const tiebreak = key === "created" ? "updatedAt" : "createdAt";
        if (Date.parse(a[field]) !== Date.parse(b[field])) return (Date.parse(a[field]) - Date.parse(b[field])) * sign;
        return (Date.parse(a[tiebreak]) - Date.parse(b[tiebreak])) * sign;
    });
    return out;
}

export function hasUploadMedia(nodes: Pick<Node, "media">[]): boolean {
    return nodes.some((n) => (n.media?.uploadId ?? null) !== null);
}

export function sanitizeExportFilenamePure(name: string): string {
    const slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
    return `${slug.length > 0 ? slug : "mindmap"}-mindmap.json`;
}

export function serializeProjectExportPure(project: Project, nodes: Node[]): ProjectExportFile {
    const scoped = nodes.filter((n) => n.projectId === project.id);
    return {
        app: "mindmap",
        version: PROJECT_EXPORT_VERSION,
        project: { name: project.name, viewport: { ...project.viewport } },
        nodes: scoped.map((n) => ({
            id: n.id,
            parentId: n.parentId,
            text: n.text,
            kind: n.kind,
            url: n.url,
            media: n.media?.uploadId ? null : n.media,
            mediaFill: n.media?.uploadId ? true : n.mediaFill,
            size: n.size,
            side: n.side,
            collapsed: n.collapsed,
        })),
    };
}

function invalid(message: string): Error {
    return new Error(`Not a valid mindmap file: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseViewport(value: unknown): Viewport {
    if (!isRecord(value)) return { ...DEFAULT_VIEWPORT };
    const { x, y, zoom } = value;
    if (typeof x !== "number" || typeof y !== "number" || typeof zoom !== "number") return { ...DEFAULT_VIEWPORT };
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom)) return { ...DEFAULT_VIEWPORT };
    return { x, y, zoom: clampZoom(zoom) };
}

function parseExportNode(value: unknown): ExportNode {
    if (!isRecord(value)) throw invalid("a node must be an object.");
    const { id, parentId, text, kind, url, media, mediaFill, size, side, collapsed } = value;
    if (typeof id !== "string" || id.length === 0) throw invalid("a node is missing its id.");
    if (typeof parentId !== "string" && parentId !== null) throw invalid("a node has a bad parent link.");
    if (typeof text !== "string" || text.trim().length === 0) throw invalid("a node is missing text.");
    if (!isNodeKind(kind)) throw invalid(`node "${text}" has an unknown kind.`);
    if (url !== null && typeof url !== "string") throw invalid(`node "${text}" has a bad link.`);
    if (media !== null && media !== undefined) {
        if (!isRecord(media)) throw invalid(`node "${text}" has bad media.`);
        if (!isNodeMediaKind(media.kind)) throw invalid(`node "${text}" has bad media.`);
        const uploadId = typeof media.uploadId === "string" && media.uploadId.length > 0 ? media.uploadId : null;
        if (uploadId === null && typeof media.src !== "string") throw invalid(`node "${text}" has bad media.`);
    }
    if (size !== undefined && !isNodeSize(size)) throw invalid(`node "${text}" has a bad size.`);
    if (side !== null && side !== undefined && !isNodeSide(side)) throw invalid(`node "${text}" has a bad side.`);
    if (typeof collapsed !== "boolean") throw invalid(`node "${text}" has a bad collapse flag.`);
    const rawMedia = (media ?? null) as NodeMedia | null;
    const stripped = rawMedia?.uploadId ? null : rawMedia;
    return {
        id,
        parentId: parentId ?? null,
        text,
        kind,
        url: typeof url === "string" ? url : null,
        media: stripped,
        mediaFill: typeof mediaFill === "boolean" ? mediaFill : true,
        size: isNodeSize(size) ? size : "small",
        side: isNodeSide(side) ? side : null,
        collapsed,
    };
}

export function parseProjectImportPure(rawText: string): ParsedProjectImport {
    if (rawText.length > PROJECT_IMPORT_MAX_BYTES) throw invalid("file is larger than 10MB.");
    let parsed: unknown;
    try {
        parsed = JSON.parse(rawText) as unknown;
    } catch {
        throw invalid("not valid JSON.");
    }
    if (!isRecord(parsed)) throw invalid("top level must be an object.");
    if (parsed.app !== "mindmap") throw invalid("wrong app tag.");
    if (parsed.version !== PROJECT_EXPORT_VERSION) {
        if (typeof parsed.version === "number" && parsed.version > PROJECT_EXPORT_VERSION) {
            throw new Error("Unsupported file version.");
        }
        throw invalid(`unsupported version ${String(parsed.version)}.`);
    }
    if (!isRecord(parsed.project)) throw invalid("missing project.");
    const name = parsed.project.name;
    if (typeof name !== "string" || name.trim().length === 0) throw invalid("project name is missing.");
    if (name.trim().length > MAX_PROJECT_NAME_LENGTH) throw invalid("project name is too long.");
    if (!Array.isArray(parsed.nodes) || parsed.nodes.length === 0) throw invalid("no nodes found.");
    const nodes = (parsed.nodes as unknown[]).map(parseExportNode);
    const ids = new Set(nodes.map((n) => n.id));
    if (ids.size !== nodes.length) throw invalid("duplicate node ids.");
    const roots = nodes.filter((n) => n.parentId === null);
    if (roots.length !== 1) throw invalid("must contain exactly one root.");
    for (const n of nodes) {
        if (n.parentId !== null && !ids.has(n.parentId)) throw invalid("a node points to a missing parent.");
        if (n.parentId === n.id) throw invalid("a node cannot be its own parent.");
    }
    const children = new Map<string, string[]>();
    for (const n of nodes) {
        if (n.parentId === null) continue;
        const arr = children.get(n.parentId);
        if (arr) arr.push(n.id);
        else children.set(n.parentId, [n.id]);
    }
    const visiting = new Set<string>();
    const done = new Set<string>();
    function visit(id: string): void {
        if (done.has(id)) return;
        if (visiting.has(id)) throw invalid("nodes contain a cycle.");
        visiting.add(id);
        for (const child of children.get(id) ?? []) visit(child);
        visiting.delete(id);
        done.add(id);
    }
    visit(roots[0].id);
    if (done.size !== nodes.length) throw invalid("some nodes are unreachable from the root.");
    return { name: name.trim(), viewport: parseViewport(parsed.project.viewport), nodes };
}
