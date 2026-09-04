# Mindmap - Project Overview

<!-- blueprint:source-hash d9a689f401fec71ce5784a25a88ee983ff9a61c3a1e227f2dac4d142d93cde46 -->

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

In `build-plan.md` order:

1. **App shell and minimal theme** - Vite SPA shell, SPA-safe routing, Excalidraw-minimal MUI theme, Pages base-path config.
2. **Home projects management** - project list newest-first with create, rename, delete, empty state, local persistence. *(done)*
3. **Tree canvas with auto-layout** - centered root, strict-tree auto-layout, pan plus pinch and wheel zoom, re-center, persisted viewport. *(done - headline feature)*
4. **Node add and edit** - redundant plus buttons around node (hover on desktop, tap on mobile) to add a child and focus inline editor, char-limit enforcement. *(done)*
5. **Context menu and branch controls** - right-click and long-press menu for Edit, Delete, Collapse-Expand; subtree delete confirm; persisted collapsed state with reflow. *(done)*
6. **PNG export** - client-side whole-tree PNG with light background, export button on editor. *(done)*
7. **Deploy and polish** - Pages build config, SPA fallback, `lastEdited` timestamps, responsive and touch polish, storage and empty-map error handling.

Post-MVP (deferred): dense text and media nodes, graph cross-links, undo and redo, home duplicate plus search plus JSON import and export, cloud sync and sharing, present mode, dark mode, keyboard nav, PDF and print, ads evaluation.

## Data model

Local-only, no backend. Layout positions computed, not stored.

### Project

- `id` (string, uuid) - primary key
- `name` (string, unique case-insensitive, trimmed, non-empty) - display name and initial root label
- `rootNodeId` (string) - FK to `Node.id`
- `createdAt` (string, ISO-8601)
- `updatedAt` (string, ISO-8601) - drives newest-first sort
- `viewport` (`{ x: number, y: number, zoom: number }`) - persisted pan and zoom, restored on open
- Relationship: one `Project` has many `Node` via `Node.projectId`; one `Project` has one root `Node`

> TODO from plan: exact project-name length limit (e.g. 40 chars), viewport persist format.

### Node

- `id` (string) - primary key
- `projectId` (string) - FK to `Project.id`, cascade delete with project
- `parentId` (string | null) - `null` for root only; otherwise single parent FK; enforces strict tree, no cycles, no multiple parents
- `text` (string, trimmed, non-empty) - plain text only, fixed uniform circle
- `collapsed` (boolean, default false) - hides whole subtree; only valid when node has children
- `createdAt` (string, ISO-8601)
- `updatedAt` (string, ISO-8601)
- Relationship: self-referential tree via `parentId`; deleting a node deletes its subtree atomically after confirm

> TODO from plan: exact node-text limit (~40-60 chars, §3 vs ~50 chars in §4 disagree); whether sibling order is stored; empty-after-edit rule currently "revert to previous", confirm in spec.

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
- **Pan and zoom handling** - mouse drag plus wheel plus touch drag plus pinch; impl still open (`use-gesture` plus CSS transforms or custom).
- **Client-side PNG export** - SVG to Canvas to Blob (candidate `html-to-image` or manual canvas); exact library still open.
- **No backend** - no API layer, no auth, no env secrets.

## Monetization

Not in v1. No paywall, no subscriptions.

Future: non-intrusive ads after core value proven; privacy and UX impact to be evaluated first.

## UI/UX

Excalidraw minimalism: no gradients, information-first. White and off-white canvas, thin neutral gray lines, uniform-size circles (thin stroke, subtle fill), one accent color for selection and hover only, calm typography, ample whitespace.

- `/` - Home: new-project action plus project list and grid (newest first) with Open, Rename, Delete overflow; empty state; inline unique-name validation; delete confirm.
- `/project/:id` - Editor: centered root with radial and hierarchical children, pannable and zoomable canvas, re-center and fit button, export button; node plus buttons (large `>=44px` touch targets, hover on desktop and tap on mobile); inline editor; selection ring; context menu (right-click and long-press `~500ms`); collapse badge or chevron.

Responsive and touch: hover logic disabled on touch, long-press tuned not to conflict with drag, viewport clamped. Accessibility MVP: labels and visible focus; full screen-reader and keyboard nav deferred.

## Deployment

- **Host:** GitHub Pages, static from `main` (`dist/`)
- **App type:** SPA (Vite)
- **Dev:** `npm run dev` (`http://localhost:5173`)
- **Build:** `npm run build` (`tsc -b` plus `vite build`)
- **Preview:** `npm run preview`
- **Lint:** `npm run lint`
- **SPA routing:** needs `base` in `vite.config.ts` plus `HashRouter` or `BrowserRouter` with `404.html` fallback - decision still open
- **Storage:** browser only (`localStorage` or `IndexedDB` - choice still open); no DB, no env vars, no workers or cron, no health check
- **Verify and CI:** not configured yet; planned via `/ci` (typecheck plus build minimum); no browser test harness yet

## Open questions

- **Node text limit disagreement:** §3 says `~40-60 chars`, §4 says `max ~50 chars`. Pick one exact value in the feature spec.
- **Build-plan-only scope:** item 7 adds a `zoom % indicator` that `project-plan.md` never mentions. Confirm it belongs in MVP polish or drop it.
- **TODOs to resolve in plans then re-run `/overview`:** `localStorage` vs `IndexedDB`; pan and zoom impl; SVG vs Canvas at 50-100 nodes; PNG export library and whole-tree vs viewport scope; sibling-order persistence; palette and typography tokens; collapse-indicator design; empty-state illustration; strict-tree validation with real users.
