# Feature: Local image upload

**From build-plan:** feature 13d (sub-item of 13; 13a-13c shipped)
**Status:** verified (repair pass for F-04 and F-05 complete)

## Goal

Attach image files from the device to any node, stored locally in-browser via IndexedDB with no backend, so maps carry real photos that survive refresh and print with real pixels. Pays off the 13c export warning ("try downloading the image and adding it manually") and locks the `uploadId` contract 13e/13f will extend.

## In scope

- `Node.media` upload variant: `{ kind: "image", src: "", uploadId: string }` (`src` empty and ignored; pixels come from the blob store). URL media unchanged (`uploadId: null`).
- New `media` blob store in IndexedDB (DB v2 upgrade, `keyPath: "id"`): `{ id, projectId, nodeId, blob, createdAt }`, one blob per node; re-upload replaces.
- File validation: `image/png`, `image/jpeg`, `image/webp`, `image/gif` only (SVG rejected: script/taint risk), pre-downscale cap 12MB with inline error.
- Downscale on upload: longest side 1024px via canvas, JPEG quality 0.85 (PNG photos stay PNG? No: normalize to JPEG unless source has transparency... keep simple: output JPEG 0.85 always except GIF stays GIF? Simplest deterministic rule: JPEG 0.85 for png/jpeg/webp, GIF passes through if under cap). Pure `fitDimensionsPure` math unit-tested; canvas work browser-covered.
- Upload entry points: context menu `Upload image` (image nodes only... applies to any node, sets image media) + file input in `NodeMediaDialog` (`accept` filter), progress/disabled state while reading, inline type/size errors, picker cancel is a no-op.
- Canvas render: uploaded image via object URL (`URL.createObjectURL`, revoked on change/unmount), same rect + badge chrome as URL media; missing blob renders the placeholder glyph, never crashes.
- Export: blob resolved to same-origin object URL so real pixels print with no taint; object URLs revoked after render; failed loads join the existing manual-add warning path.
- Deletion GC: replacing/clearing media deletes the old blob; subtree delete and project delete remove their blobs.
- Fallback envs (no IndexedDB): upload entry disabled with "Uploads need IndexedDB storage" notice; URL media unaffected; mirrored upload refs without blobs render placeholders.

## Out of scope

- Video upload (13e covers inline playback of URL videos; upload stays image-only).
- Multiple images per node, drag-and-drop files (picker only; mobile file sheet works via the input).
- HEIC/TIFF decoding (browser-dependent; MIME gate rejects what we don't list).
- Orphan-blob sweep on boot (deferred; GC covers all live paths).
- Quota management UI beyond the editor error banner (`QuotaExceededError` surfaces as "Storage is full...").

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Upload contract + blob store + file validation** - extend `NodeMedia` with `uploadId: string | null` (default `null`; normalize coerces missing/invalid to `null`, keeps valid upload refs, forces `src: ""` display-ignored for uploads), `validateImageFilePure({type, size})` (MIME allowlist, 12MB cap), pure `fitDimensionsPure(w, h, maxSide)`, new `src/storage/mediaBlobs.ts` with injectable `createMediaBlobStore(open)` (save/load/delete per id, delete-by-node, delete-by-project) over a new IDB `media` store (DB v1 to v2 upgrade creating the store when missing), `setNodeMediaAsync` accepts upload media. *Done when:* legacy/url nodes load unchanged; upload-shaped records round-trip; bad MIME/oversize rejected with named errors; blob save/load/delete works against injected fakes; `npm test` green.
- [x] **Step 2 - Upload UI + canvas render** - `NodeMediaDialog` file input with accept filter + inline errors + busy state; context menu `Upload image` (disabled with notice when IndexedDB unavailable); downscale-to-JPEG on pick; `EditorPage.handleUploadMedia` wiring with error banner; `NodeRect` renders uploads via revocable object URL with placeholder fallback; re-upload replaces the old blob; remove clears media and deletes the blob. *Done when:* in dev server a circle takes an uploaded photo, shows it in the rect, survives refresh, re-upload swaps it, remove clears it; oversize/wrong-type/undecodable picked files show inline errors and save nothing; picker cancel changes nothing; picking the same file twice in a row works (input reset). Split dialog vs render into two diffs at implement time if too big to read.
- [x] **Step 3 - Export from blobs + deletion GC + fallback parity** - `loadExportMediaImages` resolves upload refs via the blob store to same-origin object URLs (revoked after render); blob-backed photos print real pixels; unresolvable uploads join the existing manual-add warning; `deleteNodeSubtreeAsync`/`deleteProjectAsync`/media-replace delete orphaned blobs; fallback envs keep upload disabled while URL media, collapse, badges, and viewport behavior stay unchanged. *Done when:* uploaded photo exports with real pixels; deleted subtree/project leaves no blobs (store count checked in test with memory blobs); fallback-env smoke keeps upload disabled with notice; `npm run verify` green; `npm run test:browser` green with a new upload round-trip case.
- [x] **Repair F-04 - gate URL image branch on non-empty src** - uploads without a blob resolver go straight to the placeholder instead of rendering `<img src="">`. *Done when:* no `src=""` image path remains; `npm run verify` green.
- [x] **Repair F-05 - revoke export object URLs on failure** - revoke in preview `finally` and download `catch` so failed exports don't pin blob memory. *Done when:* failed export leaves no live object URLs (unit-covered revoke path); `npm run verify` green.

## Files / areas

- `src/types/node.ts` - `uploadId` on `NodeMedia`, extended `normalizeNodeMediaValue`/`normalizeNodes`.
- `src/storage/localStore.ts` - `MAX_UPLOAD_BYTES`, `validateImageFilePure`, `fitDimensionsPure`.
- `src/storage/mediaBlobs.ts` (new), `src/storage/indexedDb.ts` - `media` store, DB v2 upgrade, injectable store factory.
- `src/storage/operations.ts` - upload media through writes, blob GC on replace/clear/subtree/project delete.
- `src/components/canvas/NodeMediaDialog.tsx`, `NodeContextMenu.tsx`, `TreeCanvas.tsx`, `NodeRect.tsx` (+ small `useObjectUrl` hook or `NodeUploadedImage` component), `TreeCanvas.css` - picker, menu item, render, fallback notice.
- `src/pages/EditorPage.tsx` - `handleUploadMedia` with error banner, export blob resolution + URL revocation.
- `src/lib/media.ts`, `src/lib/media.test.ts` - loader upload resolution.
- `e2e/media-upload.spec.ts` (new) - upload round-trip via temp fixture file, reload persistence, broken/missing cases.

## Data / contracts

- **Load-bearing, extends the 13c `media` contract; 13e/13f must not rename:**
  ```ts
  export type NodeMedia = { kind: NodeMediaKind; src: string; uploadId: string | null };
  export type MediaBlob = { id: string; projectId: string; nodeId: string; blob: Blob; createdAt: string };
  ```
- Rules: url media keeps `src` = normalized `href`, `uploadId: null`; upload media requires `kind: "image"` + valid `uploadId`, `src` ignored (normalized to `""`); missing/invalid `uploadId` normalizes to `null` (and empty-src + null-uploadId normalizes whole media to `null`); one blob per node (re-upload replaces + deletes old); blob deletes follow node/project/subtree deletes.
- DB upgrade: `IDB_VERSION` 1 to 2; `onupgradeneeded` creates the `media` store only when missing so existing v1 databases upgrade without touching projects/nodes.
- Client-only (Vite SPA); blobs live in IndexedDB only, never in `localStorage` (quota) and never leave the browser. Storage stays whole-list ops for nodes until feature 22; blobs are per-record by design.
- Security: MIME allowlist enforced before decode (no SVG); object URLs are same-origin `blob:` (no taint, no credentials); upload input never renders the file as HTML.

## Testing

- `npm test` (Vitest, gate on for logic steps): file validator (allowlist pass, SVG/wrong-type fail, over-cap fail), fit math (landscape/portrait/square/untouched-small), normalize legacy + upload shapes, blob store save/load/delete/by-node/by-project against injected fakes, `setNodeMediaAsync` upload set/replace (old blob deleted) + `updatedAt` bump, subtree/project delete GC with a memory blob store, loader upload resolution (missing blob joins failedIds).
- `npm run test:browser` (Playwright Chromium smoke): keep green; add `e2e/media-upload.spec.ts` (picker upload via temp fixture shows thumbnail, reload persists, remove clears, export preview renders) when proportionate.
- Manual `/check` per done-when above: upload/edit/remove on circle, note, root; invalid files blocked; cancel no-op; busy state; fallback-env notice; quota error banner; export pixels vs placeholder; touch long-press upload.
- `npm run verify` (tests + typecheck + build) is the final gate before `/complete`.

## Notes for the AI

- `project-overview.md` is stale (predates 13c-13f): read live contracts from `src/types/node.ts`, `src/storage/*`, `src/lib/media.ts` instead of the overview's Data section. Flag the file for `/overview` refresh; do not hand-edit its source hash.
- No `any`, strict TS, `verbatimModuleSyntax`; no gradients; reuse tokens, dialog patterns, `useNodeGestures`, and the badge chrome.
- IDB access must stay injectable (mirroring `createIndexedDbBackend(open)` / `createMemoryBackend`) because the Vitest env has no IndexedDB; browser paths ride on `npm run test:browser`.
- Revoke every created object URL (render unmount/src change, post-export) so rapid node switches don't leak.
- Uploads never touch the `localStorage` mirror as blobs; node records mirror as today.
- Downscale constants: `MAX_UPLOAD_BYTES = 12 * 1024 * 1024`, longest side 1024px, JPEG 0.85; GIF passes through under cap.

## Findings

### 13d/F-01 [P2] closed - Long note text overflows the photo well in PNG export

**File:** src/lib/exportPng.ts:310
**Found:** 2026-09-08 by /audit (scope: current; lens: quality)
**Why it matters:** Photo nodes use `wrapNoteLinesPure` (up to 6 lines), but the text region above the media well fits about 3 lines at scale 2. A note with long text plus a loaded image paints text over the photo and can spill above the rect top.
**Suggested fix:** Cap lines for photo nodes to what the region fits (e.g. `wrapLinesPure(text, NOTE_MAX_CHARS_PER_LINE, 3)` when `showPhoto`), keeping the badge for overflow signal.
**Resolution:** Fixed 2026-09-08 by /implement: new `wrapExportTextPure` caps photo text to 3 lines, `hasDrawableImage` folds the dimension check into `showPhoto`; unit cases added. Re-audit 2026-09-08: cap and guard confirmed in `exportPng.ts`, tests green, no new defect. Closed.

### 13d/F-02 [P3] closed - Image glyph SVG duplicated in NodeRect badge and placeholder

**File:** src/components/canvas/NodeRect.tsx:118
**Found:** 2026-09-08 by /audit (scope: current; lens: quality)
**Why it matters:** The image-icon path block appears verbatim twice (media badge button and broken-image placeholder). A future glyph tweak must be applied twice, repeating the pattern 13a/F-01 and 13b/F-01 already paid down.
**Suggested fix:** Extract a shared `NodeMediaGlyph({ kind })` component used by both spots, mirroring the `NodeLinkBadge` precedent.
**Resolution:** Fixed 2026-09-08 by /implement: new `NodeMediaGlyph({ kind, size })` serves the badge (both kinds) and the image placeholder; the framed video placeholder is a distinct variant and stays inline. Verify + 12 browser tests green. Re-audit 2026-09-08: shared usage confirmed in `NodeRect.tsx`, no new defect. Closed.

### 13d/F-03 [P3] closed - Zero-dimension images shift export text with no photo drawn

**File:** src/lib/exportPng.ts:293
**Found:** 2026-09-08 by /audit (scope: current; lens: quality)
**Why it matters:** `showPhoto` is set from map presence, but the draw is guarded by `naturalWidth/Height > 0`. A loaded image reporting zero dimensions (e.g. a dimension-less SVG) shifts the text block up while drawing nothing, leaving a gap.
**Suggested fix:** Fold the dimension check into `showPhoto` (e.g. resolve natural size at load time or check before layout) so text shifts only when pixels will draw.
**Resolution:** Fixed 2026-09-08 by /implement together with F-01: `showPhoto` now requires `hasDrawableImage`. Re-audit 2026-09-08: guard confirmed in `exportPng.ts`, tests green, no new defect. Closed.

### 13d/F-04 [P3] closed - Upload media without a blob resolver renders `<img src="">`

**File:** src/components/canvas/NodeRect.tsx:106
**Found:** 2026-09-08 by /audit (scope: current; lens: quality)
**Why it matters:** When `media.uploadId` is set but `loadBlob` is absent, the render falls through to the URL branch with `src: ""`, issuing a request for the page itself before `onError` swaps in the placeholder. Unreachable today (EditorPage always passes `loadBlob`), but the fallback is accidental.
**Suggested fix:** Gate the URL branch on a non-empty `src` so uploads without a resolver go straight to the placeholder.
**Resolution:** Fixed 2026-09-08 by /implement: `showImage` requires non-empty `src`. Re-audit 2026-09-08: guard confirmed in `NodeRect.tsx`, `src` always a string post-normalize, verify green. Closed.

### 13d/F-05 [P3] closed - Export object URLs leak when render or download throws

**File:** src/pages/EditorPage.tsx:317
**Found:** 2026-09-08 by /audit (scope: current; lens: quality)
**Why it matters:** Blob URLs created for export are revoked only on the success path. If `renderMapToCanvas` or `exportMapAsPng` throws, the URLs stay alive until page unload, pinning decoded image memory.
**Suggested fix:** Revoke in a `finally` (preview) and in the download `catch` before setting the error.
**Resolution:** Fixed 2026-09-08 by /implement: both paths collect URLs and revoke in `finally`; revoke helper unit-tested. Re-audit 2026-09-08: `finally` covers success, throw, and stale-token paths in `EditorPage.tsx`; tests green. Closed.
