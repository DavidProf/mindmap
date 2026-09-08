import { clampZoom } from "../storage/localStore";

export function formatZoomPct(z: number): string {
    if (!Number.isFinite(z)) return "100%";
    return `${Math.round(clampZoom(z) * 100)}%`;
}
