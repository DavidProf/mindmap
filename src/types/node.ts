export const NODE_SIDES = ["north", "east", "south", "west"] as const;

export type NodeSide = (typeof NODE_SIDES)[number];

export function isNodeSide(value: unknown): value is NodeSide {
    return typeof value === "string" && (NODE_SIDES as readonly string[]).includes(value);
}

export const NODE_KINDS = ["circle", "note"] as const;

export type NodeKind = (typeof NODE_KINDS)[number];

export function isNodeKind(value: unknown): value is NodeKind {
    return typeof value === "string" && (NODE_KINDS as readonly string[]).includes(value);
}

export function normalizeNodeKind(value: unknown): NodeKind {
    return isNodeKind(value) ? value : "circle";
}

export const MAX_URL_LENGTH = 2048;

const URL_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

export function normalizeNodeUrlValue(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > MAX_URL_LENGTH) return null;
    if (/\s/.test(trimmed)) return null;
    const candidate = URL_SCHEME_RE.test(trimmed) ? trimmed : `https://${trimmed}`;
    let parsed: URL;
    try {
        parsed = new URL(candidate);
    } catch {
        return null;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    const href = parsed.href;
    if (href.length === 0 || href.length > MAX_URL_LENGTH) return null;
    return href;
}

export const NODE_MEDIA_KINDS = ["image", "video"] as const;

export type NodeMediaKind = (typeof NODE_MEDIA_KINDS)[number];

export function isNodeMediaKind(value: unknown): value is NodeMediaKind {
    return typeof value === "string" && (NODE_MEDIA_KINDS as readonly string[]).includes(value);
}

export type NodeMedia = { kind: NodeMediaKind; src: string };

export const MAX_MEDIA_URL_LENGTH = MAX_URL_LENGTH;

export function normalizeNodeMediaValue(value: unknown): NodeMedia | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (!isNodeMediaKind(record.kind)) return null;
    const src = normalizeNodeUrlValue(record.src);
    if (src === null) return null;
    return { kind: record.kind, src };
}

export type Node = {
    id: string;
    projectId: string;
    parentId: string | null;
    text: string;
    kind: NodeKind;
    url: string | null;
    media: NodeMedia | null;
    side: NodeSide | null;
    collapsed: boolean;
    createdAt: string;
    updatedAt: string;
};

export function normalizeNodes(nodes: Node[]): Node[] {
    let changed = false;
    const out = nodes.map((n) => {
        const wantKind = isNodeKind(n.kind) ? n.kind : ("circle" as NodeKind);
        const rawUrl = (n as unknown as Record<string, unknown>).url;
        const wantUrl = normalizeNodeUrlValue(rawUrl);
        const hasUrlField = Object.prototype.hasOwnProperty.call(n, "url");
        const rawMedia = (n as unknown as Record<string, unknown>).media;
        const wantMedia = normalizeNodeMediaValue(rawMedia);
        const hasMediaField = Object.prototype.hasOwnProperty.call(n, "media");
        const prevMedia = (n as Node).media;
        const mediaSame =
            wantMedia === null
                ? prevMedia === null
                : prevMedia !== null &&
                  prevMedia !== undefined &&
                  prevMedia.kind === wantMedia.kind &&
                  prevMedia.src === wantMedia.src;
        if (wantKind === n.kind && hasUrlField && (n as Node).url === wantUrl && hasMediaField && mediaSame)
            return n;
        changed = true;
        return { ...n, kind: wantKind, url: wantUrl, media: wantMedia };
    });
    return changed ? out : nodes;
}
