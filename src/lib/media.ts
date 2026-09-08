import type { NodeMedia } from "../types/node";

export const EXPORT_IMAGE_TIMEOUT_MS = 5000;
const MAX_WARNING_NAMES = 3;

export type ExportMediaLoad = {
    images: Map<string, HTMLImageElement>;
    failedIds: string[];
};

type MediaNode = { id: string; media: NodeMedia | null };

function loadImageElement(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Could not load ${src}`));
        img.src = src;
    });
}

function withTimeout<T>(work: Promise<T>, timeoutMs: number, src: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out loading ${src}`)), timeoutMs);
    });
    return Promise.race([work, timeout]).finally(() => {
        if (timer !== null) clearTimeout(timer);
    });
}

export async function loadExportMediaImages(
    nodes: MediaNode[],
    opts?: { timeoutMs?: number; loadOne?: (src: string) => Promise<HTMLImageElement> },
): Promise<ExportMediaLoad> {
    const timeoutMs = opts?.timeoutMs ?? EXPORT_IMAGE_TIMEOUT_MS;
    const loadOne = opts?.loadOne ?? loadImageElement;
    const images = new Map<string, HTMLImageElement>();
    const failedIds: string[] = [];
    await Promise.all(
        nodes
            .filter((n) => n.media?.kind === "image")
            .map(async (n) => {
                try {
                    images.set(n.id, await withTimeout(loadOne(n.media!.src), timeoutMs, n.media!.src));
                } catch {
                    images.delete(n.id);
                    failedIds.push(n.id);
                }
            }),
    );
    return { images, failedIds };
}

export function mediaLoadWarningPure(names: string[]): string | null {
    const listed = names.filter((n) => n.trim().length > 0);
    if (listed.length === 0) return null;
    const shown = listed.slice(0, MAX_WARNING_NAMES).map((n) => `"${n}"`);
    const extra = listed.length - shown.length;
    const subject = extra > 0 ? `${shown.join(", ")} and ${extra} more` : shown.join(" and ");
    const shows = listed.length === 1 ? "shows" : "show";
    return `${subject} couldn't be loaded for print and ${shows} as a placeholder instead. Try downloading the image and adding it to the project manually.`;
}

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{6,}$/;

export function youtubeVideoIdPure(src: unknown): string | null {
    if (typeof src !== "string") return null;
    let parsed: URL;
    try {
        parsed = new URL(src.trim());
    } catch {
        return null;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase())) return null;
    let candidate: string | null = null;
    if (parsed.hostname.toLowerCase() === "youtu.be") {
        candidate = parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (parsed.pathname === "/watch") {
        candidate = parsed.searchParams.get("v");
    } else if (parsed.pathname.startsWith("/shorts/") || parsed.pathname.startsWith("/embed/") || parsed.pathname.startsWith("/live/")) {
        candidate = parsed.pathname.split("/").filter(Boolean)[1] ?? null;
    }
    if (!candidate || !YOUTUBE_ID_RE.test(candidate)) return null;
    return candidate;
}

export function youtubeShortlinkPure(src: unknown): string | null {
    const id = youtubeVideoIdPure(src);
    return id === null ? null : `https://youtu.be/${id}`;
}
