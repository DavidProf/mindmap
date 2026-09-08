# Feature: Image/video rectangle nodes

**From build-plan:** feature 13c (sub-item of 13; 13a and 13b shipped)
**Status:** verified (repair pass complete)

## Goal

Attach one optional image or video (by URL) to any node so maps can carry visual reference alongside text and links, rendered as a rectangle with a thumbnail/placeholder, persisted locally, and exported PNG-safe. Completes the dense-text and media milestone (13a notes + 13b links + this) without changing the `kind`/`url` contracts.

## In scope

- `Node.media` contract: `{ kind: "image" | "video", src: string } | null` on any `kind` (circle or note), normalized on load, cleared with remove.
- URL-based media only: `src` is a normalized `http(s)` URL (same rules as 13b links: trim, auto-`https://`, `URL` parse, `http:`/`https:` only, `javascript:`/`data:`/`ftp:` rejected, max 2048, embedded whitespace rejected). No file upload, no data URLs, no blobs in this spec.
- Attach/edit/remove via context menu plus a small `NodeMediaDialog` (type select image/video, URL field, inline error, Save blocked on invalid, Cancel, Remove when media exists). Reuses `NodeLinkDialog` patterns.
- Canvas rendering: any node with `media` renders with the note rectangle footprint (`168x104`, same tokens, text + media strip); image shows `<img loading="lazy">` thumbnail with `onError` fallback to placeholder glyph; video shows placeholder with play glyph and duration-agnostic label. Small media badge distinct from link badge (link top-right) and collapse badge (bottom-right); tooltips show type + URL; click opens `src` in new tab (`noopener,noreferrer`); keyboard accessible; touch long-press menu offers same actions. Applies to root too.
- Layout: media forces rectangle footprint regardless of `kind` (circle + media uses note extents); no new side/direction behavior; step/clearance reuse 13a footprint logic.
- PNG export + preview: CORS-safe, never fetch/draw external pixels (canvas would taint). Draw placeholder indicator inside rect (image glyph / play triangle + type label), light-background safe; bounds logic unchanged; preview confirm/cancel unchanged.
- Persistence (IndexedDB primary + localStorage fallback + mirror) including legacy records without `media`; content edits bump `updatedAt`, viewport-only saves still do not.
- Parity: collapse/expand reflow, plus buttons (`>=44px` targets), selection ring, delete-subtree count, corrupted/unknown `media` normalizes to `null` with no crash, image-error fallback never breaks layout/export.

## Out of scope

- File upload / camera / picker, pasted blobs, data URLs, local object URLs (deferred; quota + whole-list ops risk until feature 22 delta sync).
- Inline video playback, YouTube/Vimeo embeds/iframes, favicons, thumbnails fetched at export time.
- Extension/MIME sniffing beyond scheme check; any `http(s)` URL is accepted for either type.
- Directional placement, cross-links/graph edges (14), undo/redo (15), present/dark/keyboard modes (17), share links (21/22).
- Visual redesign, new palette or typography; badges reuse existing tokens and collapse-badge sizing.
- Cloud sync; storage stays whole-list ops until feature 22.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Media contract + validation + storage** - add `NodeMediaKind`/`NodeMedia` + `media: NodeMedia | null` to `Node`, `MAX_MEDIA_URL_LENGTH = 2048`, pure `validateNodeMediaPure(kind, src)` + `normalizeNodeMediaValue(value)` (null on missing/empty/invalid/scheme-rejected/over-length/whitespace; stored `src` is normalized `href`), extend `normalizeNodes` (legacy without `media` to `null`), new `setNodeMediaAsync(backend, nodeId, media | null)` (null clears, invalid throws, bumps `updatedAt`, mirrors to localStorage), new nodes default `media: null`, `setNodeKindAsync`/`setNodeUrlAsync` preserve `media`. *Done when:* legacy nodes load with no media; `https://example.com/a.png` as image and `https://example.com/v.mp4` (or bare `example.com/v`) as video accepted; `javascript:`, `data:`, `ftp:`, over-length, embedded-whitespace rejected; clear persists after refresh; `npm test` green for new validator/normalize/ops cases.
- [x] **Step 2 - Media dialog + context menu wiring** - new `NodeMediaDialog.tsx` (MUI Dialog, Image/Video select, URL input, inline error from validator, Save blocked on invalid, Cancel, Remove when media exists), context menu items `Add media` / `Edit media` / `Remove media` / `Open media` (Open disabled when no media, Remove needs no confirm), `TreeCanvas` state for media target plus `EditorPage` `handleSetMedia` handler with error banner on failure, focus returns to node on close. *Done when:* in dev server right-click (and touch long-press) a circle and a note can attach, edit (switch type, change URL), remove media; invalid input shows inline error and does not save; empty saves as remove; refresh keeps media; editor stays working when no media exists.
- [x] **Step 3 - Canvas media rendering + open behavior** - rect-footprint rendering for any node with `media` (circles with media use `NOTE_WIDTH x NOTE_HEIGHT` extents; notes unchanged size), image `<img loading="lazy">` with error fallback to placeholder, video placeholder with play glyph, media badge (corner distinct from link top-right and collapse bottom-right, reuses badge tokens, tooltip = type + URL, `aria-label` like `Open image for "text"`), click with `stopPropagation` opens normalized `src` in new tab (`noopener,noreferrer`), keyboard Enter/Space opens, plus buttons/collapse/link badge unaffected, layout footprints honor media (circle+media counts as note size). *Done when:* linked + media nodes show both badges without overlap even when collapsed; image shows thumbnail and broken-URL shows placeholder with no layout break; badge click opens media without selecting/dragging canvas; keyboard + touch open work; nodes without media pixel-identical to today.
- [x] **Step 4 - PNG export + parity pass** - `exportPng.ts` draws media placeholder indicator on media nodes (image glyph / play triangle inside node bounds, light-background safe, scaled; never loads external pixels so no canvas taint), bounds include rect extents for circle+media; parity: collapse/expand reflow with media, corrupted/over-long/invalid `media` normalizes to `null` with no crash, broken-image nodes export with placeholder, mobile long-press offers media actions, viewport-only saves still preserve `updatedAt` ordering. *Done when:* mixed circle/note/image/video map exports a PNG showing all media nodes with placeholders on light background; preview confirm/cancel works; `npm run verify` green; `npm run test:browser` smoke green.
- [x] **Step 5 - Real image pixels in export (CORS-safe with placeholder fallback)** - new `loadExportMediaImages(nodes, { timeoutMs })` in `src/lib/media.ts`: for image-kind media only, attempt `Image` load with `crossOrigin = "anonymous"`; resolves `{ images: Map<nodeId, HTMLImageElement>, failedIds: string[] }` (failures/timeouts/CORS denials land in `failedIds`, never reject the batch). `renderMapToCanvas` accepts optional `images` map: when present for a node, draw cover-fit into a media well in the lower part of the rect with text centered above it; when absent, today's centered-text + badge path unchanged. `handleExport` (preview) and `exportMapAsPng` (download) await the loader first (preview dialog shows "Rendering preview..." meanwhile; stale loads after dialog close are discarded). Load failures surface a warning in the preview dialog naming the affected nodes: "N image(s) couldn't be loaded for print and show as placeholders instead. Try downloading the image and adding it to the project manually." Download keeps the dialog open with the same warning when failures occur instead of closing silently. No credentials sent; only `http(s)` srcs (already validated). *Done when:* a map with a same-origin / CORS-open image exports the PNG with the photo drawn inside the rect; a CORS-denying or broken URL still exports with the placeholder badge plus the manual-add warning naming the node; slow hosts do not hang export past the timeout; `npm test` green for loader fallback cases (mocked Image) + well geometry; browser case covers the broken-image warning.
- [x] **Step 6 - YouTube shortlink above video nodes in export** - pure `youtubeVideoIdPure(src)` covering `youtu.be/{id}`, `youtube.com/watch?v=`, `/shorts/`, `/embed/`, `/live/` (incl. `m.` host), strict id charset, plus `youtubeShortlinkPure(src)` returning `https://youtu.be/{id}` or `null`. Export draws the shortlink centered just above the rect top for video media nodes with an id (muted small type, inside existing 48px export padding so no bounds change); non-YouTube video and image nodes unchanged. Canvas DOM unchanged (badge tooltip already carries the URL). *Done when:* a map with a `youtube.com/watch` video node exports with `https://youtu.be/{id}` readable above it; `youtu.be` input, shorts, and non-YouTube URLs behave (shortlink / same shortlink / none); `npm test` green for id extraction + shortlink cases.
- [x] **Repair F-01 + F-03 - photo text cap and dimension guard in export** - cap wrapped lines for photo nodes to the 3 lines the text region fits; fold the `naturalWidth/Height` check into `showPhoto` so text shifts only when pixels draw. *Done when:* long-text photo node exports with capped text clear of the well; zero-dimension image keeps centered text; `npm test` green for new wrap/guard cases.
- [x] **Repair F-02 - shared media glyph component** - extract `NodeMediaGlyph({ kind })` used by the badge button and the broken-image placeholder with no visual change. *Done when:* circles and notes with media render identical glyphs; `npm run verify` green; browser smoke green.

## Files / areas

- `src/types/node.ts` - `NodeMediaKind`, `NodeMedia`, `media` field, `normalizeNodeMediaValue`, extended `normalizeNodes`.
- `src/storage/localStore.ts` - `MAX_MEDIA_URL_LENGTH`, `validateNodeMediaPure`, `normalizeNodeMediaPure`.
- `src/storage/operations.ts`, `src/storage/indexedDb.ts`, `src/storage/backend.ts` - `media` through writes, `setNodeMediaAsync`, default `null` on create.
- `src/components/canvas/NodeMediaDialog.tsx` (new), `NodeContextMenu.tsx`, `TreeCanvas.tsx`, `NodeCircle.tsx`, `NodeRect.tsx` (+ shared `NodeMediaBadge` if not trivially inline), `TreeCanvas.css` - dialog, menu items, badge, thumbnail/placeholder, open behavior.
- `src/pages/EditorPage.tsx` - `handleSetMedia` wiring with error banner.
- `src/lib/layout.ts`, `src/lib/layout.test.ts` - media forces note footprint.
- `src/lib/media.ts` (new, steps 5-6), `src/lib/media.test.ts` - CORS-safe image preloader + YouTube id/shortlink pures.
- `src/lib/exportPng.ts`, `src/lib/exportPng.test.ts`, `src/components/canvas/ExportPreviewDialog.tsx` - placeholder indicator in export/preview.
- `src/storage/*.test.ts`, `src/lib/*.test.ts` - validator, normalize, ops, layout footprint, export indicator cases.

## Data / contracts

- **Load-bearing, extends 13a `kind` + 13b `url` contracts, must not break future file-upload work:**
  ```ts
  export const NODE_MEDIA_KINDS = ["image", "video"] as const;
  export type NodeMediaKind = (typeof NODE_MEDIA_KINDS)[number];
  export type NodeMedia = { kind: NodeMediaKind; src: string };
  export type Node = {
    id: string;
    projectId: string;
    parentId: string | null;
    text: string;
    kind: NodeKind;
    url: string | null;
    media: NodeMedia | null;
    side: NodeSide | null;
    collapsed: boolean;
    createdAt: string;
    updatedAt: string;
  };
  ```
- Rules: `media` defaults to `null` when missing, empty, or invalid (forward/backward compat); valid means `kind` in set + `src` passing the 13b URL rules (trim, auto-`https://`, `URL` parse, `http(s)` only, length within max, no raw whitespace); stored `src` is the normalized `href`; remove stores `null`, never `""` or `{}`.
- `setNodeMediaAsync` bumps node and project `updatedAt` (content edit, affects home newest-first sort); viewport-only saves still do not bump (existing home-sort rule).
- Client-only (Vite SPA); no server, no API, no auth scoping. Storage stays whole-list ops until feature 22. A future file-upload extension adds a `source: "url"` discriminator or a separate `dataUrl` field; it must not rename `kind`/`url`/`media` or change `null` defaults without a migration step.
- Security: never render `src` as HTML, never accept `javascript:`/`data:`/`file:`/`blob:` schemes in this spec, open only via `noopener,noreferrer` new tab; `<img>` gets no credentials/cookies handling beyond default lazy load; export never fetches `src`.
- Step 5 loads pixels only via `crossOrigin = "anonymous"` (no credentials); a tainted image can never reach the canvas because only fully-loaded CORS-clean images are drawn, everything else keeps the placeholder.
- Step 6 shortlink is derived client-side from the stored `src` (`https://youtu.be/{id}`); no fetch, no oEmbed.

## Testing

- `npm test` (Vitest, gate on for logic steps): media validator (empty-clear, trim, bare-domain prepend, `http/https` pass, `javascript:`/`data:`/`ftp:` fail, over-length/whitespace fail, bad kind fail), normalize legacy/malformed `media` to `null`, `setNodeMediaAsync` set/clear/invalid-throws + `updatedAt` bump, layout footprint (circle+media counts as note size, circle-only unchanged), export placeholder bounds/flag, YouTube id/shortlink extraction, loader fallback (error/timeout/CORS-denied resolve absent), media-well geometry.
- `npm run test:browser` (Playwright Chromium smoke): keep green; add focused coverage only for stable behavior (dialog attach round-trip, badge presence, reload persists) when proportionate.
- Manual `/check` per done-when above: attach/edit/remove/open from menu and badge on circles, notes, and root; invalid blocked with inline error; broken image falls back; collapsed + linked + media badges without overlap; refresh persistence; whole-tree PNG shows placeholders; touch long-press media actions.
- `npm run verify` (tests + typecheck + build) is the final gate before `/complete`.

## Notes for the AI

- Keep diffs small and in step order; each step leaves the app working with media-free maps pixel-identical to today.
- No `any`, strict TS, `verbatimModuleSyntax`; no gradients; reuse `TOKENS` and existing canvas CSS variables; reuse `NodeLinkDialog`/`NodeConvertDialog`/`NodeDeleteDialog` dialog patterns and the `useNodeGestures` hook.
- Do not invent a test runner or CI; use declared `npm test`, `npm run test:browser`, `npm run verify`.
- Media badge/footprint is overlay + size rule only: do not change insertion-order, side-quadrant behavior, or circle-only step values; circle+media simply resolves to the note footprint helpers (`nodeRadius`/`nodeHalfExtents`/`step`).
- Stop event propagation on badge, thumbnail, and dialog interactions so canvas pan/select/drag and `NodeEditor` blur-commit paths do not fire accidentally; return focus to the node shape on dialog close (match `focusCircle`/`focusRect` pattern).
- Viewport-only saves must still not bump `updatedAt`; media set/clear must bump it.
- Export must never `fetch` or draw `src` pixels (CORS taint breaks `toBlob`); placeholder only.
