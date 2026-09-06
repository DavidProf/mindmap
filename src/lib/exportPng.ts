import { NODE_DIAMETER } from "./layout";
import { TOKENS } from "../theme/tokens";
import type { Node } from "../types/node";

export const EXPORT_PADDING = 48;
export const EXPORT_BACKGROUND = TOKENS.bg;
export const EXPORT_EDGE_COLOR = TOKENS.line;
export const EXPORT_NODE_FILL = TOKENS.nodeFill;
export const EXPORT_NODE_STROKE = TOKENS.nodeStroke;
export const EXPORT_TEXT_COLOR = TOKENS.text;
export const EXPORT_FONT_FAMILY = TOKENS.fontSans;
export const MAX_EXPORT_SIDE = 4096;

export type ExportBounds = {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
};

export type ExportPosition = { x: number; y: number };
export type ExportEdge = { from: string; to: string };

export function paddedExportBounds(bounds: ExportBounds, padding: number = EXPORT_PADDING): ExportBounds {
    const minW = NODE_DIAMETER + padding * 2;
    const minH = NODE_DIAMETER + padding * 2;
    const width = Math.max(bounds.width + padding * 2, minW);
    const height = Math.max(bounds.height + padding * 2, minH);
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    return {
        minX: cx - width / 2,
        maxX: cx + width / 2,
        minY: cy - height / 2,
        maxY: cy + height / 2,
        width,
        height,
    };
}

export function buildExportFilename(projectName: string): string {
    const slug = projectName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60)
        .replace(/-+$/g, "");
    const base = slug.length > 0 ? slug : "mindmap";
    return `${base}-mindmap.png`;
}

export function wrapLinesPure(text: string, maxCharsPerLine = 12, maxLines = 3): string[] {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    const lines: string[] = [];
    let current = "";
    let truncated = false;
    const pushCurrent = () => {
        if (current.length > 0) lines.push(current);
        current = "";
    };
    for (const word of words) {
        const chunks: string[] =
            word.length > maxCharsPerLine
                ? (word.match(new RegExp(`.{1,${maxCharsPerLine}}`, "g")) ?? [word])
                : [word];
        for (const chunk of chunks) {
            if (lines.length >= maxLines) {
                truncated = true;
                break;
            }
            const candidate = current.length === 0 ? chunk : `${current} ${chunk}`;
            if (candidate.length <= maxCharsPerLine) {
                current = candidate;
            } else {
                pushCurrent();
                if (lines.length >= maxLines) {
                    truncated = true;
                    break;
                }
                current = chunk;
            }
        }
        if (truncated) break;
    }
    pushCurrent();
    if (lines.length > maxLines) {
        lines.length = maxLines;
        truncated = true;
    }
    if (truncated && lines.length > 0) {
        const last = lines[lines.length - 1];
        lines[lines.length - 1] =
            last.length >= maxCharsPerLine ? `${last.slice(0, Math.max(0, maxCharsPerLine - 1))}…` : `${last}…`;
    }
    return lines;
}

export function resolveExportScale(
    padded: ExportBounds,
    devicePixelRatio: number = 1,
    baseScale: number = 2,
): number {
    const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? Math.min(devicePixelRatio, 2) : 1;
    let scale = baseScale * dpr;
    const longest = Math.max(padded.width, padded.height, 1);
    if (longest * scale > MAX_EXPORT_SIDE) scale = MAX_EXPORT_SIDE / longest;
    return Math.max(1, scale);
}

export function renderMapToCanvas(args: {
    nodes: Node[];
    positions: Map<string, ExportPosition>;
    edges: ExportEdge[];
    bounds: ExportBounds;
    scale?: number;
    background?: string;
}): HTMLCanvasElement {
    const { nodes, positions, edges, bounds } = args;
    const scale = args.scale ?? 2;
    const background = args.background ?? EXPORT_BACKGROUND;
    const padded = paddedExportBounds(bounds);
    const width = Math.max(1, Math.round(padded.width * scale));
    const height = Math.max(1, Math.round(padded.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported in this browser.");

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const toPx = (wx: number, wy: number): [number, number] => [
        (wx - padded.minX) * scale,
        (wy - padded.minY) * scale,
    ];
    const radius = (NODE_DIAMETER / 2) * scale;

    ctx.strokeStyle = EXPORT_EDGE_COLOR;
    ctx.lineWidth = 1.5 * scale;
    ctx.lineCap = "round";
    for (const edge of edges) {
        const from = positions.get(edge.from);
        const to = positions.get(edge.to);
        if (!from || !to) continue;
        const [x1, y1] = toPx(from.x, from.y);
        const [x2, y2] = toPx(to.x, to.y);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    const fontSize = 13 * scale;
    ctx.font = `${fontSize}px ${EXPORT_FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (const node of nodes) {
        const pos = positions.get(node.id);
        if (!pos) continue;
        const [cx, cy] = toPx(pos.x, pos.y);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = EXPORT_NODE_FILL;
        ctx.fill();
        ctx.strokeStyle = EXPORT_NODE_STROKE;
        ctx.lineWidth = 1 * scale;
        ctx.stroke();

        const lines = wrapLinesPure(node.text);
        if (lines.length === 0) continue;
        ctx.fillStyle = EXPORT_TEXT_COLOR;
        const lineHeight = fontSize * 1.2;
        const startY = cy - ((lines.length - 1) * lineHeight) / 2;
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], cx, startY + i * lineHeight, radius * 2 - 8 * scale);
        }
    }

    return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Could not create PNG image."));
        }, "image/png");
    });
}

export async function exportMapAsPng(args: {
    projectName: string;
    nodes: Node[];
    positions: Map<string, ExportPosition>;
    edges: ExportEdge[];
    bounds: ExportBounds;
}): Promise<string> {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const padded = paddedExportBounds(args.bounds);
    const scale = resolveExportScale(padded, dpr);
    const canvas = renderMapToCanvas({
        nodes: args.nodes,
        positions: args.positions,
        edges: args.edges,
        bounds: args.bounds,
        scale,
    });
    const blob = await canvasToBlob(canvas);
    const filename = buildExportFilename(args.projectName);
    const url = URL.createObjectURL(blob);
    try {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
    } finally {
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return filename;
}
