# Project Plan

## 1. Problem - What problem are we solving?

**Confirmed:** People need to map information by linking nodes of related ideas. Existing tools (Miro, MindMeister, etc.) are heavy, feature-bloated, or focused on freeform dragging where visual styling distracts from the information and its structure.

**This project:** A calm, simple mind-map app where *the information and how it links matters most*. Start from a centered root idea, grow a structured tree around it, collapse/expand branches to focus, and export for study or presentation. Designed mobile-first so it works on phone and laptop without a manual.

**Why now / why this approach:** Strict tree + auto-layout removes the cognitive load of manual positioning and makes the map instantly readable. Local-only keeps hosting free on GitHub Pages and ships fastest without auth/backend. Excalidraw-like minimalism keeps visual noise low.

**TODO:** Validate that strict tree (vs. free graph) satisfies real lesson/study use without frustrating users who want cross-links.

## 2. Users - Who is this for?

**Primary (MVP):**
- **Learners** — brain-dump a topic (e.g., "Photosynthesis"), structure sub-ideas, collapse branches to self-test, export image for notes.
- **Teachers** — prepare a lesson map quickly, collapse to focus class attention, export PNG for slides/docs.
- **Presenters / general organizers** — organize any hierarchical information quickly on any device.

**Context:** Uses app in short bursts (1-5 min to create, 10-15 nodes), often on a phone or laptop, no login, no onboarding tutorial expected. Needs discoverable interactions (pluses + context menu), not hidden shortcuts.

**Non-users for MVP:** Teams needing real-time collaboration, enterprise sharing/permissions, or complex graph analysis.

## 3. Features - What does the MVP need?

### MVP — must ship for "usable map in <2 min and exportable" bar:

1. **Home / Projects** — list/grid of locally stored projects (newest first). Actions: Create (prompt for unique name, validation inline), Open, Rename (unique check), Delete (confirm, deletes entire tree). Empty state when no projects. Data in localStorage/IndexedDB. Names unique case-insensitive. No search/duplicate for MVP (deferred).

2. **Tree Editor Canvas — Auto-layout** — Every project starts with a single centered root node (named after project, editable). Strict parent→children tree (each node one parent, root has none). Custom auto-layout (SVG/Canvas, no React Flow) places children radially/hierarchically around parent predictably. Pannable (one-finger drag + mouse drag) + pinch/wheel zoom + "Re-center / Fit to view" button. Viewport persisted per project.

3. **Node Add / Edit** — Circles, fixed uniform size, plain text only, enforced char limit (~40-60 chars, TODO: pick exact). Adaptive interaction: **Desktop:** multiple plus buttons around node appear on hover; **Mobile:** multiple plus buttons around node appear on tap (large hit targets ≥44px, spaced N/E/S/W or radially). Tapping any plus creates a child immediately placed by layout and focuses inline editor. All pluses do the same "Add child" action — redundant entry points for thumb reachability, not directional placement. Edit via double-tap / inline click *and* via context menu. Inline edit enforces limit (counter/truncate).

4. **Context Menu + Delete** — Right-click (desktop) / long-press (mobile, ~500ms, not conflicting with drag) opens menu: Edit / Delete / Collapse-Expand (when applicable). Delete removes node + entire subtree after confirmation. No undo for MVP.

5. **Collapse / Expand Branches** — Any node with children can collapse to hide its whole subtree; indicator (e.g., badge/count or chevron) shows collapsed state. Collapsed state persisted per node so reopening restores focus. Auto-layout reflows on toggle.

6. **PNG Export** — Client-side export of the map as PNG (TODO: decide whole-tree vs. current viewport; assume whole-tree fitted with white/off-white background for MVP). Button on editor. No backend, no PDF for MVP.

7. **Shell & Polish for Deploy** — App shell, client routing (Vite SPA), Excalidraw-minimal theme, responsive layout, GitHub Pages base-path handling, empty/error states, lastEdited timestamps.

### Explicit Non-goals for MVP (deferred):
- Arbitrary graph: cross-links between any nodes, cycles, multiple parents
- Media/rectangle nodes: images, videos, links, dense/long-text node type (future node type for paragraphs)
- Variable circle sizes, gradients, heavy theming
- Cloud sync, accounts, shareable links, collaboration, permissions
- Search/filter/sort/duplicate on home
- Undo/redo history (deferred with note)
- Present mode, PDF export, print styles
- Dark mode, full a11y beyond basic keyboard/reachability, ads

### Post-MVP ideas (agreed to keep, not in MVP):
- Dense text node, image/video/rectangle nodes, link nodes
- Graph cross-links
- Undo/redo stack
- Duplicate project, search/filter/sort, JSON import/export
- Cloud sync + auth (Firebase/Supabase etc.), shareable links
- Dark mode, keyboard shortcuts, improved a11y, PDF/print, present mode, ads

## 4. Data - What are we storing?

**Confirmed (local-only):**
- `Project { id: string (uuid), name: string (unique case-insensitive), createdAt: ISO, updatedAt: ISO, rootNodeId: string, viewport: { x, y, zoom } }`
- `Node { id: string, projectId: string, parentId: string | null (root = null), text: string (max ~50 chars), collapsed: boolean, createdAt, updatedAt }` — strict tree enforced; `parentId` single.
- Persistence: `localStorage` or `IndexedDB` (TODO: pick; localStorage simpler for MVP, IndexedDB scales better). No backend. No auth. Single browser/device scope. Clear-storage loses data — acceptable for MVP with warning on delete.

**Derived / UI:** layout positions computed, not stored; collapsed state and viewport *are* persisted (so reopen = where you left off).

**Business rules:**
- Project name unique (trimmed, case-insensitive, non-empty, length limit e.g., 40 chars). Inline error: "A project with this name already exists."
- Node text non-empty, trimmed, max length enforced; empty after edit = keep previous or delete? For MVP: revert to previous and show validation, not create empty node.
- Delete node = delete subtree atomically; must confirm ("Delete this branch? This will remove X nodes.").
- Collapse only available if node has children.

**Edge cases:** duplicate name on rename, deleting root (disallowed — maybe prompt to delete project instead), adding child to collapsed parent (auto-expand), exporting empty/single-node map, storage quota exceeded, stale viewport after tree grows.

**TODO:** Exact char limits (project name, node text), viewport persist format, whether to store node order among siblings.

## 5. Tech - What stack are we using?

**Confirmed:** Vite + React 19 + TypeScript (already scaffolded). Planned **React Flow dropped** — use custom SVG (or Canvas) auto-layout instead. **Material UI (MUI)** retained for components/theme, tuned to minimal neutral palette (no gradients). No tests/CI yet (will add via `/tests` and `/ci` later).

**Layout:** Stateless tree layout function (e.g., radial or layered tidy-tree) that given nodes returns `x,y` per id. No D3 heavy dependency if avoidable; simple math + SVG lines for edges.

**Panning/Zooming:** Either lightweight lib (e.g., `use-gesture` + CSS transforms) or custom; must support mouse drag + wheel + touch drag + pinch.

**Export:** Client-side PNG via SVG→Canvas→Blob (e.g., `html-to-image` or manual `canvas`) — verify CORS/foreignObject limits.

**Constraints:** GitHub Pages static host, SPA routing needs `HashRouter` or `BrowserRouter` with `404.html` fallback and `base` in `vite.config.ts`. No env secrets.

**Assumptions:** MUI + custom SVG keeps bundle small vs. React Flow. No backend means no API layer.

**TODO:** Choose localStorage vs IndexedDB, zoom/pan impl, SVG vs Canvas for performance at ~50-100 nodes, exact PNG export library.

## 6. Monetize - How will this make money?

**Confirmed:** No monetization for MVP. **Future:** ads (non-intrusive, after core value proven). No paywall, no subscriptions for MVP. Post-MVP to evaluate privacy/UX impact of ads before adding.

## 7. UI/UX - How should this look and feel?

**Confirmed direction:** **Excalidraw minimalism** as reference: no gradients, simple, information-first. White/off-white canvas, thin neutral lines (gray), circles by default (uniform size, thin stroke, subtle fill), rectangles reserved for future media nodes. One accent color for selection/hover only. Plenty of whitespace, calm typography (MUI default or Inter-like). "Similar size by default" strict.

**Interaction specifics:**
- Multiple plus buttons around node (large touch targets ≥44px, spaced radially N/E/S/W). Appear on hover (desktop) / tap (mobile). Any plus tap = add child + focus editor. Redundant entry points for reachability.
- Selection ring on selected node; context menu on right-click / long-press.
- Collapse indicator on parent (badge with child count or chevron).
- Minimal canvas chrome (re-center button + export button).

**Responsive & Touch:** Adaptive: hover logic disabled on touch; long-press threshold tuned not to conflict with drag. Pinch-zoom + drag for canvas; viewport clamped. Must be usable on smartphone as first-class.

**Accessibility MVP:** Basic keyboard: accessible labels, focus visible. Full screen-reader and full keyboard nav deferred post-MVP.

**TODO:** Exact palette/typography tokens, collapse indicator design, empty-state illustration.

## 8. Deployment - Where and how will this ship?

**Confirmed:** **GitHub Pages** static from `main` (Vite `build` → `dist`). No server, no env vars for MVP. Commands: `npm run dev` (5173), `npm run build` (`tsc -b && vite build`), `npm run preview`, `npm run lint`. Need Vite `base` for Pages path and SPA fallback handling.

**Later:** No Verify/CI command yet; will set up via `/ci` (typecheck+build at minimum). No browser tests harness yet.

## 9. Edge Cases & Business Rules (summary)

- Unique project names enforced both on create and rename.
- Node text limit enforced live; truncation/wrap inside fixed circle with tooltip on overflow.
- Delete subtree requires confirm with count; root deletion blocked.
- Add child to collapsed node auto-expands parent.
- Refresh retains collapsed + viewport + edits (localStorage).
- Storage full / `localStorage` unavailable → show error, suggest export/delete.
- Export must handle off-screen nodes (fit whole tree).

## 10. Risks, Assumptions & TODOs

**Risks:** Local-only data loss if browser cleared; touch long-press vs drag conflict; PNG export of large trees off-screen; auto-layout readability at 50+ nodes on small screens; SPA routing on GitHub Pages 404.

**Assumptions:** Users accept tree-only for MVP; short text sufficient; MUI can be themed to Excalidraw-minimal without custom CSS burden; custom layout cheaper than React Flow.

**Open TODOs:** Exact char limits, localStorage vs IndexedDB choice, PNG scope (whole tree vs viewport), node sibling order persistence, palette tokens, IndexedDB migration path to cloud later.

## 11. Success Criteria

MVP succeeds if on **both phone and laptop without login**, a new user in <2 min can: create a uniquely-named project, build a 10–15 node tree from the centered root using adaptive pluses, edit inline, collapse/expand branches and have it persist after refresh (including viewport), and export a clean PNG suitable for slides — with calm minimalism on GitHub Pages and no data loss in normal use.
