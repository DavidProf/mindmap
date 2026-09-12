# Feature: Full-bleed media nodes (13e)

**From build-plan:** 13e
**Status:** verified

## Goal

Let any media node (image or video) fill its whole rectangle with the media instead of
showing text plus a small thumbnail. The option is per node and on by default when media
is attached: the text becomes a tooltip / aria-label, and the media covers the node. When
turned off, the node keeps today's look (text + thumbnail well). Video plays inline via
click-to-play instead of only opening in a new tab.

## In scope

- New per-node `mediaFill` field, defaulting to on for media nodes.
- Context-menu toggle "Fill node with media" (enabled only when media is attached).
- Fill rendering for URL images and uploaded images: media covers the node rect, text
  hidden (kept as tooltip / aria-label), placeholder when the image is broken or missing.
- Inline click-to-play for video nodes: direct video URLs play in a `<video>` element,
  YouTube URLs play in an embedded player; playback stops and cleans up on deselect.
- PNG export honors fill: image drawn over the whole node rect, no text, no media well.
- Existing media nodes upgrade to filled (option is on by default); users can toggle off.

## Out of scope

- Per-node resize (13f) - fill works at the current fixed note footprint.
- Poster/thumbnail generation for videos - filled video nodes show a play glyph overlay,
  not a video frame.
- Non-YouTube, non-direct-file video URLs (e.g. Vimeo, streaming pages): they keep the
  existing "open in new tab" behavior; no inline playback.
- Layout changes - node footprint stays `NOTE_WIDTH x NOTE_HEIGHT`.
- Removing or redesigning the media dialog beyond what the fill default requires.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too
big, so split it.

## Build steps

- [x] **Step 1 - Data contract and normalization** - add `mediaFill: boolean` to `Node`
      (default `true`), normalize it in `types/node.ts` (`normalizeNodes`: missing or
      non-boolean becomes `true`; resets to `true` when media is removed), keep storage
      save/load round-tripping it, and have media save paths set `mediaFill: true`.
      *Done when:* loading a map with mixed/missing `mediaFill` values normalizes to
      `true`; saving and reloading preserves an explicit `false`; `npm test` passes
      including new `normalizeNodes` cases.
- [x] **Step 2 - Fill rendering and toggle** - in `NodeRect` (and `NodeUploadedImage`),
      when effective fill is on render the image with `object-fit: cover` across the
      whole node, hide the text (keep `title` and `aria-label`), and show the existing
      placeholder when the image is broken or a blob upload is missing. Add a context
      menu item "Fill node with media" (check state shown), enabled only when media is
      attached, wired through `EditorPage` to persist the flag. *Done when:* toggling
      the item on hides the text and covers the node with the image; toggling off
      restores text + thumbnail; reload keeps the choice; broken URL falls back to the
      placeholder.
- [x] **Step 3 - PNG export honors fill** - extend the export renderer: for nodes with
      effective fill and a loaded image, draw the image covering the full node rect (no
      text, no media well, no inner thumbnail); failed loads keep the placeholder
      behavior. Filled video nodes keep their existing glyph/badge treatment but drop
      the drawn text, matching the canvas. Extract the effective-fill decision into a
      pure helper and unit test it. *Done when:* exporting a map with a filled image
      node produces a PNG where the image covers the node; a filled video node exports
      without text; unit tests for the helper pass; `npm run verify` is green.
- [x] **Step 4 - Inline video click-to-play** - for media nodes with
      `kind === "video"`, render a play-glyph overlay (on the thumbnail today, over the
      full node when filled). Clicking it (with gesture propagation stopped) swaps in
      inline playback: a `<video controls autoplay>` for direct video URLs, a YouTube
      embed iframe for YouTube URLs (reuse `youtubeVideoIdPure`); other URLs keep
      open-in-new-tab via the existing badge. Leaving the node (deselect / click
      elsewhere) unmounts the player. Extract the embed decision (direct / youtube /
      unsupported) into a pure helper with tests. *Done when:* clicking play on a
      direct mp4 URL plays inline with controls; a YouTube URL embeds and plays;
      clicking elsewhere removes the player; unit tests for the helper pass.
- [x] **Step 5 - Browser smoke coverage** - extend `e2e/smoke.spec.ts` with one focused
      test seeded through storage (the pattern the existing tests use): a node with a
      URL image and `mediaFill: true` renders the image covering the node with no
      visible text, and toggling fill off restores the text + thumbnail. *Done when:*
      `npm run test:browser` passes including the new test.
- [x] **Repair F-02 - drop redundant broken-upload wiring** - remove the
      `broken`/`onBroken` props from `NodeUploadedImage` and the `brokenUpload` state
      from `NodeRect`; the child's existing placeholder fallback covers failure.
      *Done when:* the props/state are gone, behavior unchanged, tests green.
- [x] **Repair F-01 - fix the render-phase ref write** - with F-02's removal the
      `onBrokenRef` pattern disappears; `npm run lint` must pass with zero errors.
      *Done when:* `npm run lint` is clean.
- [x] **Repair F-03 - reset playback state on deselect** - reset `playing` when the
      node is not selected so reselecting a video node requires a fresh play click.
      *Done when:* reselecting shows the play button, not a live player; browser
      tests stay green.

## Files / areas

- `src/types/node.ts` - `mediaFill` field, normalization.
- `src/storage/localStore.ts` (+ tests) - save/load round-trip, media validation path.
- `src/components/canvas/NodeRect.tsx`, `NodeUploadedImage.tsx`, `TreeCanvas.css` -
  fill rendering, play overlay, inline player.
- `src/components/canvas/NodeContextMenu.tsx` - fill toggle item.
- `src/pages/EditorPage.tsx` - wire the toggle through the storage backend.
- `src/lib/exportPng.ts` (+ tests) - filled-node drawing.
- `src/lib/media.ts` (+ tests) - inline-play decision helper.
- `e2e/smoke.spec.ts` - focused fill test.

## Data / contracts

- `Node` gains `mediaFill: boolean` - **load-bearing**: 13f (node resize) builds on the
  same per-node presentation flags, and 22 (team sharing) syncs whole node records.
- Normalization rule: missing/invalid `mediaFill` normalizes to `true`; nodes without
  media always report `true` (field is inert until media is attached).
- The effective-fill rule is one pure function used by canvas and export so the two
  cannot drift.

## Testing

- Vitest (`npm test`): `normalizeNodes` mediaFill cases (Step 1); effective-fill and
  embed-decision helpers (Steps 3-4).
- Browser: `npm run test:browser` - new focused fill-toggle test (Step 5); existing
  smoke must stay green.
- Manual via `/check`: visual fill on uploaded images (blob store), broken-image
  fallback, inline video playback, and exported PNG appearance.

## Notes for the AI

- All client-side, no server. Persist through the existing storage backend
  (`setNodeMedia`-style ops); add a focused op or extend the node-update path rather
  than bypassing normalization.
- Existing media nodes silently upgrade to filled on first load (default on). Do not
  write a migration; normalization covers it.
- Keep text as tooltip / `aria-label` on filled nodes so accessibility information is
  not lost when the visible text is hidden.
- Inline players must stop gesture propagation so select/drag gestures on the node do
  not fire, and must unmount on deselect to release the video element.
- Fill applies to any node carrying media, including circle-kind nodes (they already
  render as rectangles when media is attached); do not special-case kind.
- Match existing code style: functional components, no manual memoization without
  measured need, no `any`, no em dashes in comments or docs.

## Findings

### 13e/F-01 [P2] closed - Lint fails: ref written during render in NodeUploadedImage

**File:** src/components/canvas/NodeUploadedImage.tsx:20
**Found:** 2026-07-21 by /audit (scope: current; lens: quality)
**Why it matters:** `onBrokenRef.current = onBroken` runs during render, which the `react-hooks/refs` rule rejects; `npm run lint` exits with 1 error, so a declared project command is red on the feature branch.
**Suggested fix:** Update the ref inside a `useEffect`, or (better) remove the callback-ref indirection entirely - see F-02, which removes the need for `onBroken` altogether.
**Resolution:** Removed the broken/onBroken props and brokenUpload state; the ref pattern went with them. `npm run lint` now passes with zero errors. Awaiting /audit re-review. Re-audited 2026-07-21 (scope: current): ref pattern gone, lint clean, closed.

### 13e/F-02 [P2] closed - Redundant broken-upload state mirrors child fallback

**File:** src/components/canvas/NodeRect.tsx:64-71, src/components/canvas/NodeUploadedImage.tsx:5-12
**Found:** 2026-07-21 by /audit (scope: current; lens: quality)
**Why it matters:** `NodeUploadedImage` already falls back to the placeholder when the blob load fails or the `img` errors; the parent's `brokenUpload` state plus the `broken`/`onBroken` props mirror that internally-handled failure without any additional consumer, and the mirror is never reset when `uploadId` changes. Dead weight that also forces the lint-violating ref pattern (F-01).
**Suggested fix:** Drop `broken`/`onBroken` props and the `brokenUpload` state; keep the placeholder fallback inside `NodeUploadedImage`.
**Resolution:** Props and parent state removed; `NodeUploadedImage` handles failure internally as before. Behavior covered by the 18-test browser suite. Awaiting /audit re-review. Re-audited 2026-07-21: no remaining consumers of the removed props, child fallback intact, closed.

### 13e/F-03 [P3] closed - Video playback state survives deselect

**File:** src/components/canvas/NodeRect.tsx:68
**Found:** 2026-07-21 by /audit (scope: current; lens: quality)
**Why it matters:** `playing` stays true after the player unmounts on deselect; reselecting the same node instantly restarts autoplay rather than requiring a fresh play click. Minor UX surprise, not a correctness bug.
**Suggested fix:** Reset `playing` to false when `selected` turns false (small effect or derive-on-render reset), or accept and note it.
**Resolution:** Render-phase reset (`if (!selected && playing) setPlaying(false)`) in NodeRect; lint clean. Awaiting /audit re-review. Re-audited 2026-07-21: reset verified in code and by e2e mount/unmount test, closed.
