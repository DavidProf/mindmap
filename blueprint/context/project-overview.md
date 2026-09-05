# Mindmap - Project Overview

<!-- blueprint:source-hash d74a629e9ae06e2043b3789dcff37f36cc30c23804e129a4a12d660e360237c3 -->

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

In `build-plan.md` order (MVP 1-7 plus item 8 shipped):

1. **App shell and minimal theme** - Vite SPA shell, SPA-safe routing, Excalidraw-minimal MUI theme, Pages base-path config. *(done)*
2. **Home projects management** - project list newest-first with create, rename, delete, empty state, local persistence. *(done)*
3. **Tree canvas with auto-layout** - centered root, strict-tree auto-layout, pan plus pinch and wheel zoom, re-center, persisted viewport. *(done - headline feature)*
4. **Node add and edit** - redundant plus buttons around node (hover on desktop, tap on mobile) to add a child and focus inline editor, char-limit enforcement. *(done)*
5. **Context menu and branch controls** - right-click and long-press menu for Edit, Delete, Collapse-Expand; subtree delete confirm; persisted collapsed state with reflow. *(done)*
6. **PNG export** - client-side whole-tree PNG with light background, export button on editor. *(done)*
7. **Deploy and polish** - Pages build config with deploy workflow, SPA-safe routing locked, `lastEdited` timestamps, responsive and touch polish, storage and empty-map error handling, zoom % indicator. *(done)*
8. **Node text limit 30** - tighten node text from 60 to 30 chars with validation, counter, and tests; over-limit nodes display as-is until edited. *(done)*

Post-MVP (next, in order): design polish pass, IndexedDB storage, then dense text and media nodes, graph cross-links, undo and redo, home duplicate plus search plus JSON import and export, cloud sync and sharing, presentation and a11y polish.

## Data model

Local-only, no backend. Layout positions computed, not stored. `localStorage` for MVP (keys `mindmap:projects` + `mindmap:nodes`); migrating to `IndexedDB` primary with a `localStorage` fallback for environments without it (notably mobile-framework WebViews).

### Project

- `id` (string, uuid) - primary key
- `name` (string, unique case-insensitive, trimmed, non-empty, max 40 chars) - display name and initial root label
- `rootNodeId` (string) - FK to `Node.id`
- `createdAt` (string, ISO-8601)
- `updatedAt` (string, ISO-8601) - drives newest-first sort; content edits bump it, viewport-only saves preserve it (shipped with feature 7)
- `viewport` (`{ x: number, y: number, zoom: number }`) - persisted pan and zoom, restored on open
- Relationship: one `Project` has many `Node` via `Node.projectId`; one `Project` has one root `Node`
- Sibling order is implicit creation order (layout preserves insertion order); no stored order field

### Node

- `id` (string) - primary key
- `projectId` (string) - FK to `Project.id`, cascade delete with project
- `parentId` (string | null) - `null` for root only; otherwise single parent FK; enforces strict tree, no cycles, no multiple parents
- `text` (string, trimmed, non-empty, max 30 chars) - plain text only, fixed uniform circle
- `collapsed` (boolean, default false) - hides whole subtree; only valid when node has children
- `createdAt` (string, ISO-8601)
- `updatedAt` (string, ISO-8601)
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
- **Client-side PNG export** - manual Canvas 2D renderer (SVG positions redrawn, no new dependency), whole-tree fitted with light background.
- **Unit tests (Vitest) plus browser smoke (Playwright Chromium)** - added after the plans via explicit setup; `npm test` and `npm run test:browser`.
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

- **Host:** GitHub Pages, static from `main` (`dist/`), deployed by `.github/workflows/deploy.yml` on push to `main` plus manual dispatch.
- **App type:** SPA (Vite)
- **Dev:** `npm run dev` (`http://localhost:5173`)
- **Build:** `npm run build` (`tsc -b` plus `vite build`)
- **Preview:** `npm run preview`
- **Lint:** `npm run lint`
- **SPA routing:** locked: `base "/mindmap/"` in production plus `HashRouter`, so no `404.html` fallback is needed.
- **Storage:** browser `localStorage` only for now (IndexedDB migration is build-plan item 10); no DB, no env vars, no workers or cron, no health check
- **Verify and CI:** no combined Verify command yet; planned via `/ci` if wanted.

## Open questions

- **Zoom % indicator (resolved by shipping):** build-plan item 7 added it though `project-plan.md` never mentions it. It shipped as a tiny read-only badge; no plan edit needed unless the direction changes.
- **Stale plan text:** `project-plan.md` still describes the 30-char limit as a post-MVP idea and says "no browser tests harness yet," but item 8 is now done and `npm run test:browser` exists. Plans remain the source of truth; consider a small plan touch-up on the next plan edit, then re-run `/overview`.
- **TODOs still in plans:** palette/typography tokens, collapse-indicator design, empty-state illustration (all feed build-plan item 9); cloud-migration path (feeds item 10).
