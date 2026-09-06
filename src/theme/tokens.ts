// Single TS source for palette values canvas and MUI need as literals.
// Mirror of the :root vars in src/index.css; keep both in sync by hand.
export const TOKENS = {
    bg: "#fbfaf7",
    surface: "#ffffff",
    canvas: "#fdfcfb",
    border: "#e2e8f0",
    borderStrong: "#cbd5e1",
    borderFaint: "#eef2f7",
    text: "#0f172a",
    textStrong: "#020617",
    muted: "#64748b",
    faint: "#94a3b8",
    accent: "#3b82f6",
    accentHover: "#2563eb",
    accentInk: "#ffffff",
    accentSubtle: "#eff6ff",
    accentRing: "#93c5fd",
    danger: "#ef4444",
    dangerSubtle: "#fef2f2",
    nodeFill: "#ffffff",
    nodeStroke: "#334155",
    line: "#94a3b8",
    fontSans:
        '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
} as const;
