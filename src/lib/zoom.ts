import { clampZoom } from "./storage";

export function formatZoomPct(z: number): string {
    if (!Number.isFinite(z)) return "100%";
    return `${Math.round(clampZoom(z) * 100)}%`;
}
