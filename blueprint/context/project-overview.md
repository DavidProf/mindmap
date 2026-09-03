# Mind Map - Project Overview

<!-- blueprint:source-hash faba4fcf4a25b6fad47f8969493c34cbae4a73670b169ec1d82d0685885bc87e -->

> Calm, simple mind-map app for learners, teachers and presenters to organize information as a radial tree of linked circular nodes with directional add, collapse/expand and PNG export — local-only, mobile-first, Excalidraw-minimal on GitHub Pages.

## Problem

Existing mind-map tools are heavy or freeform-drag oriented, where styling distracts from information structure. Users need a fast, readable way to brain-dump a centered idea, grow branches in every direction, collapse branches to focus, and export for study or presentation — without manual positioning or auth overhead.

## Users

- **Learners** — quickly structure a topic into branches, collapse to self-test, export image for notes.
- **Teachers** — prepare lesson maps in minutes, collapse branches for classroom focus, export PNG for slides/docs.
- **Presenters / general organizers** — organize any hierarchical information on phone or laptop.

**Access:** No accounts for MVP — single local user per browser/device. No collaboration/roles. Short sessions (1–5 min create, 10–15 nodes), no onboarding, interactions must be discoverable.

## Features

In `build-plan.md` order:

1. **App shell & minimal theme** — Vite React shell with SPA-safe routing for GitHub Pages and Excalidraw-minimal MUI theme. (done)
2. **Home projects management** — list/grid of locally stored projects with create/rename/delete (unique name, delete confirm) and empty state. (done)
3. **Tree canvas with auto-layout** — centered root, strict tree auto-layout (SVG + lines), fixed circular nodes with char limit, pan/drag + wheel/pinch zoom + re-center, persisted viewport. (done; layered placement later replaced by radial in feature 4)
4. **Node add & edit interactions** — four directional plus buttons per node (hover desktop / tap mobile, 44px targets) that grow a child on the clicked side and auto-focus the inline editor; inline edit with 60-char limit enforcement; radial layout around the centered root. (done)
5. **Context menu & branch controls** — right-click/long-press menu for Edit/Delete/Collapse-Expand, subtree delete confirm, collapsed indicator, persisted collapsed state.
6. **PNG export** — client-side whole-tree PNG export with light background.
7. **Deploy & polish** — GitHub Pages build, SPA 404 fallback, timestamps, responsive/touch polish, storage error handling.

Post-MVP (not in current slice): dense/media nodes, graph cross-links, undo/redo, home search/duplicate/JSON, cloud sync & sharing, present/dark/a11y modes.

## Data model

Local-only, no backend. Positions computed at render, not stored.

### Project

- `id` (string, uuid) — primary key
- `name` (string, unique case-insensitive, trimmed, non-empty, max 40 chars) — display + initial root label, validated inline ("A project with this name already exists.")
- `rootNodeId` (string) — FK to `Node.id` (root of tree)
- `createdAt` (string, ISO-8601)
- `updatedAt` (string, ISO-8601) — bumped on any node/viewport change, drives home sort (newest first)
- `viewport` ({ `x`: number, `y`: number, `zoom`: number }) — persisted pan/zoom, restored on open

- Relationship: one `Project` has many `Node` (via `Node.projectId`); one `Project` has one root `Node`.

### Node

- `id` (string, uuid)
- `projectId` (string) — FK to `Project.id`, cascade delete
- `parentId` (string | null) — `null` for root only; otherwise FK to parent `Node.id`; enforces strict tree (single parent, no cycles)
- `text` (string, trimmed, non-empty, max 60 chars) — circle content; empty edit reverts, overflow wraps/truncates inside fixed circle
- `side` (`"north" | "east" | "south" | "west" | null`) — which side of its parent the node grows toward; `null` for the root and legacy nodes (layout treats non-root missing side as `south`)
- `collapsed` (boolean, default false) — when true, subtree hidden; only valid if node has children; reflow on toggle
- `createdAt` (string, ISO-8601)
- `updatedAt` (string, ISO-8601)

- Relationship: self-referential tree via `parentId`; deleting a node deletes its entire subtree atomically (confirm with count).

> Storage: `localStorage` keys `mindmap:projects` + `mindmap:nodes` (decided during build; the `IndexedDB` alternative from the plan is deferred). No auth, no remote DB. Clear-storage = data loss (acceptable with delete warnings). Quota exceeded must surface error.

## Tech stack

- **Vite + React 19 + TypeScript** — app framework and build (already scaffolded, `tsc -b && vite build`).
- **Material UI (MUI)** — component library, themed to Excalidraw-minimal (no gradients, neutral palette, one accent for selection).
- **Custom SVG radial auto-layout** — stateless radial tidy-tree function returning `x,y` per `Node.id` (root at origin, one radial step per depth, same-side siblings fan out by leaf weight with fold-back push-out); SVG lines for edges; **React Flow dropped**.
- **Panning/zooming** — lightweight custom gesture handling (mouse drag/wheel + touch drag/pinch + re-center/fit) with CSS transforms.
- **Client-side PNG export** — SVG→Canvas→Blob (e.g., `html-to-image` or manual canvas).
- **GitHub Pages** — static hosting via `HashRouter` (no `404.html` needed); no server, no env secrets, no workers/cron.

## Monetization

Not in v1. Future: non-intrusive ads after core value proven. No paywall or subscriptions for MVP.

## UI/UX

Excalidraw-minimal: no gradients, simple, information-first. White/off-white canvas, thin gray lines, fixed uniform circles (thin stroke, subtle fill), rectangles reserved for future media nodes. One accent for selection/hover. Calm typography, ample whitespace, uniform node size strict.

- `/` — **Home** — "New Project" + list/grid of projects (name, lastEdited) with Open/Rename/Delete overflow; empty state when none; inline unique-name validation; delete confirms with subtree count.
- `/#/project/:projectId` — **Editor** — centered root with branches growing N/E/S/W, pannable/zoomable canvas, re-center/fit button, export PNG button; node selection ring, four directional plus buttons per node (hover desktop / tap mobile, 44px targets), inline editor with char counter, context menu (right-click / long-press ~500ms) for Edit/Delete/Collapse-Expand, collapsed badge/chevron.

Responsive & touch: hover disabled on touch, long-press tuned not to conflict with drag, pinch-zoom, minimal chrome. Accessibility: basic labels + focus visible for MVP; full screen-reader/keyboard nav deferred.

## Deployment

- **Host:** GitHub Pages (static, from `main` → `dist`)
- **App type:** SPA (Vite)
- **Build:** `npm run build` (`tsc -b && vite build`) — output `dist/`
- **Dev:** `npm run dev` (http://localhost:5173)
- **Preview:** `npm run preview`
- **Lint:** `npm run lint`
- **SPA routing:** `HashRouter` (SPA-safe, no `404.html` fallback needed)
- **Storage:** browser `localStorage` only — no DB, no env vars, no workers/cron, no health check
- **CI/Verify:** not configured yet — will be `typecheck + build` via `/ci` when added; no browser test harness yet

## Open questions

- **Plan contradiction - directional placement (needs a user decision):** `project-plan.md` §3 item 3 says "All pluses do the same 'Add child' action — redundant entry points for thumb reachability, **not directional placement**" and §7 repeats "Redundant entry points for reachability." Feature 4 as approved and shipped does the opposite: each plus button grows the child on its side (`Node.side` + radial layout). The overview above describes the shipped behavior. Either update the plan (change §3.3 and §7 to directional) or file a change to revert to same-action; until then the plans disagree with the code.
- **TODO (carried from the plan):** exact collapse indicator design (badge count vs chevron); empty-state illustration; node sibling order beyond side + insertion order.
- **TODO:** PNG scope is "whole-tree fitted" in `build-plan.md` item 6 but still marked undecided in `project-plan.md` §4/§10 — confirm whole-tree before `/feature 6`.
- No other contradictions: data model, tree constraint, local-only storage, dropped React Flow, and deferred items are consistent across both plans. Build plan correctly omits scaffolding and follows vertical slice order.
