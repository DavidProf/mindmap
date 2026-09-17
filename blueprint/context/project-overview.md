# Mindmap - Project Overview

<!-- blueprint:source-hash b0e4497c228df446701298f2205356f7c9f1118f3e392c6751896012393162c1 -->

> Calm, mobile-first mind-map app where a centered root grows into a strict auto-laid-out tree that can be collapsed and exported as PNG - local-only, no login, Excalidraw-minimal on GitHub Pages.

## Problem

Existing tools (Miro, MindMeister) are heavy and freeform-drag oriented, where styling distracts from structure.

This project removes manual positioning with a strict tree plus auto-layout, so a map is instantly readable and fast to build on phone or laptop.

## Users

- **Learners** - brain-dump a topic, structure sub-ideas, collapse branches to self-test, export image for notes.
- **Teachers** - prepare a lesson map quickly, collapse to focus attention, export PNG for slides and docs.
- **Presenters / general organizers** - organize any hierarchical information on any device.

**Access:** no login, no onboarding tutorial. Short bursts (1-5 min create, 10-15 nodes). Interactions must be discoverable (pluses plus context menu).

**Non-users for MVP:** teams needing real-time collaboration, sharing and permissions, or complex graph analysis.

## Features

In `build-plan.md` order (headline feature: tree canvas with auto-layout):

1. **App shell and minimal theme** - Vite SPA shell, SPA-safe routing, Excalidraw-minimal MUI theme, Pages base-path config.
2. **Home projects management** - project list newest-first with create, rename, delete, empty state, local persistence.
3. **Tree canvas with auto-layout** - centered root, strict-tree auto-layout, pan plus pinch and wheel zoom, re-center, persisted viewport.
4. **Node add and edit** - redundant plus buttons around node (hover on desktop, tap on mobile) to add a child and focus inline editor, char-limit enforcement.
5. **Context menu and branch controls** - right-click and long-press menu for Edit, Delete, Collapse-Expand; subtree delete confirm; persisted collapsed state with reflow.
6. **PNG export** - client-side whole-tree PNG with light background, export button on editor.
7. **Deploy and polish** - Pages build config with SPA fallback handling, `lastEdited` timestamps, responsive and touch polish, storage and empty-map error handling, zoom % indicator.
8. **Node text limit 30** - tighten node text from 60 to 30 chars with validation, counter, and tests; over-limit nodes display as-is until edited.
9. **Design polish pass** - palette/typography tokens, collapse badge and empty-state feel; add badges smaller with larger offset and auto-hide on click-out/deselect, collapse badge click toggles expand, node rename commits on blur, project rename inline like node.
10. **Tree layout quality pass** - fix misleading placements (B→C[left] reading as root child; A→D[bottom] edge crossing B/C edges); subtree separation, edge routing, parent-proximity.
11. **PNG export preview** - whole-tree fitted preview with confirm/download plus cancel.
12. **IndexedDB storage** - IndexedDB primary with localStorage fallback plus unavailable warning.
13. **Dense text and media nodes** - rectangle nodes for images/video/links and expanded text; includes sub-features 13a-13f (expanded-text rects, link nodes, media rects, local upload, full-bleed fill, node resize).
14. **Context menu polish** - icon-first node menu: Edit and link icons on one row, convert section with per-kind icons, size letters (S, M, L, XL), one media edit entry, Open link/Open media removed.
15. **Undo/redo history** - in-memory stack for add/delete/edit/collapse.
16. **Home enhancements** - duplicate project, search/filter/sort, JSON import/export.
17. **Graph cross-links** - arbitrary links between nodes (breaks strict tree).
18. **Presentation and a11y polish** - present mode, dark mode, keyboard nav (incl. Select + Del to delete selected node), PDF/print, ads evaluation.
19. **Multi-select nodes** - multi-select with bulk actions.
    - **19a. Bulk project export/import** - multi-select projects on Home and export/import them together (single bundle file).
20. **Grid-like layout** - alternative placement model toward stable, direction-faithful positioning.
21. **PNG preview fit-to-view** - scale whole-tree preview to fit the dialog without scrolling.
22. **Share via URL** - encode a project into a shareable URL (query/hash) that opens or imports a copy, with length-limit and malformed-link handling.
23. **Team sharing via short link** - cloud-backed short link for teammates to open and edit the same project; local-only remains the default. Sync must be delta-based (per-record `updatedAt` cursors plus delete tombstones), not whole-list transfer; tombstones not yet implemented.
24. **JSON export with uploaded images** - embed local upload blobs in project JSON export so round-trips preserve images; file-size handling and export schema version bump.

## Data model

Local-only, no backend. Layout positions computed, not stored. IndexedDB primary with a `localStorage` fallback for environments without it (notably mobile-framework WebViews); MVP keys were `mindmap:projects` + `mindmap:nodes`.

### Project

- `id` (string, uuid) - primary key
- `name` (string, unique case-insensitive, trimmed, non-empty, max 40 chars) - display name and initial root label
- `rootNodeId` (string) - FK to `Node.id`
- `createdAt` (string, ISO-8601)
- `updatedAt` (string, ISO-8601) - drives newest-first sort; content edits bump it, viewport-only saves preserve it
- `viewport` (`{ x: number, y: number, zoom: number }`) - persisted pan and zoom, restored on open
- Relationship: one `Project` has many `Node` via `Node.projectId`; one `Project` has one root `Node`
- Sibling order is implicit creation order (layout preserves insertion order); no stored order field

### Node

- `id` (string) - primary key
- `projectId` (string) - FK to `Project.id`, cascade delete with project
- `parentId` (string | null) - `null` for root only; otherwise single parent FK; enforces strict tree, no cycles, no multiple parents
- `text` (string, trimmed, non-empty) - max 30 chars for circles, 280 for note-kind nodes (note and media); shapes locked by kind per `build-plan.md` items 13-13f
- `kind` (`"circle" | "note" | "media"`, default `"circle"`) - note-kind nodes render as rectangles; `media` is set by attaching media (never by convert) and reverts to `note` when media clears
- `url` (string | null) - optional validated http(s) link on any node (item 13b)
- `media` (`{ kind: "image" | "video", src: string, uploadId: string | null } | null`) - image uploads keep pixels in the blob store (`src` empty, `uploadId` set; items 13c-13d)
- `mediaFill` (boolean, default true while media attached) - full-bleed media vs text-plus-thumbnail (item 13e)
- `size` (`"small" | "medium" | "large"`, default `"small"`) - note-kind footprint; layout, canvas, and export share one size profile (item 13f; item 14 surfaces S/M/L/XL in the menu)
- `side` (`"north" | "east" | "south" | "west" | null`) - parent side the node grows from
- `collapsed` (boolean, default false) - hides whole subtree; only valid when node has children
- `createdAt`, `updatedAt` (string, ISO-8601)
- Relationship: self-referential tree via `parentId`; deleting a node deletes its subtree atomically after confirm
- Empty-after-edit rule per plan: revert to previous text with validation (not an empty node)

**Business rules carried forward:**

- Project name unique (trimmed, case-insensitive); inline error on conflict.
- Node text non-empty and length-enforced with live counter or truncate.
- Delete node removes subtree atomically; confirm shows count; root delete blocked (prompt to delete project instead).
- Adding a child to a collapsed parent auto-expands it.
- Collapse state and viewport persist across refresh.

## Tech stack

- **Vite + React 19 + TypeScript** - app framework and build, already scaffolded.
- **Material UI (MUI)** - component library, themed to minimal neutral palette, no gradients.
- **Custom SVG auto-layout** - stateless tree layout function returning `x,y` per node id, SVG lines for edges; React Flow dropped.
- **Custom pan and zoom** - mouse drag plus wheel plus touch drag plus pinch, CSS transforms, persisted per project.
- **Client-side PNG export** - SVG positions redrawn to Canvas 2D with light background, whole-tree fitted; no backend.
- **Unit tests (Vitest) plus browser smoke (Playwright Chromium)** - per plan §5; `npm test` and `npm run test:browser`.
- **No backend** - no API layer, no auth, no env secrets.

## Monetization

Not in v1. No paywall, no subscriptions.

Future: non-intrusive ads after core value proven; privacy and UX impact to be evaluated first.

## UI/UX

Excalidraw minimalism: no gradients, information-first. White and off-white canvas, thin neutral gray lines, uniform-size circles (thin stroke, subtle fill), one accent color for selection and hover only, calm typography, ample whitespace.

- `/` - Home: new-project action plus project list and grid (newest first) with Open, Rename, Delete overflow; empty state; inline unique-name validation; delete confirm; `Edited {date}` per card.
- `/project/:id` - Editor: centered root with radial and hierarchical children, pannable and zoomable canvas, re-center and fit button, export button, live zoom % badge; node plus buttons (large `>=44px` touch targets, hover on desktop and tap on mobile); inline editor; selection ring; context menu (right-click and long-press `~500ms`); collapse badge or chevron; not-found and empty-map placeholders plus error banner.

Responsive and touch: hover logic disabled on touch, long-press tuned not to conflict with drag, viewport clamped. Accessibility MVP: labels and visible focus; full screen-reader and keyboard nav deferred.

## Deployment

- **Host:** GitHub Pages, static from `main` (`dist/`)
- **App type:** SPA (Vite)
- **Dev:** `npm run dev` (`http://localhost:5173`)
- **Build:** `npm run build` (`tsc -b` plus `vite build`)
- **Preview:** `npm run preview`
- **Lint:** `npm run lint`
- **SPA routing:** `base "/mindmap/"` in production plus `HashRouter`, so no `404.html` fallback is needed (plan §5/§8 still describe the fallback as needed - see Open questions).
- **Storage:** browser IndexedDB primary with localStorage fallback (`build-plan.md` item 12); no DB, no env vars, no workers or cron, no health check
- **Verify and CI:** `npm run verify` (tests plus typecheck plus build) plus `npm run test:browser`, wired after the plans via explicit setup; plans still say "no Verify/CI yet" - see Open questions.

## Open questions

- **Build-only items with no project-plan entry:** items 14 (context menu polish), 19a (bulk project export/import), 20 (grid-like layout), 21 (PNG preview fit-to-view), and 24 (JSON export with uploaded images) appear only in `build-plan.md`. Items 22-23 split the plan's "shareable links / cloud sync" line into URL-encode sharing vs cloud short-link; confirm that split is intended. Resolve in the plans, then re-run `/overview`.
- **Stale plan text:** `project-plan.md` still describes the 30-char limit as a post-MVP idea (while §3 already says max 30 and item 8 is done) and says "no Verify/CI command yet" and "no browser tests harness yet," but the build plan lists items 8, 12, and 15 and the repo already has `npm run verify` plus `npm run test:browser`. Plans remain the source of truth; consider a small plan touch-up on the next plan edit, then re-run `/overview`.
- **TODOs still in plans:** palette/typography tokens, collapse-indicator design, empty-state illustration (all feed build-plan item 9 - confirm tokens are locked); cloud-migration path (feeds items 22-23); item 23 sync must be delta-based (whole-list transfer measured near 1 MB per op at 5k nodes; tombstones pending).
- **Zoom % indicator:** build-plan item 7 includes a read-only zoom badge though `project-plan.md` never mentions it; no plan edit needed unless the direction changes.
