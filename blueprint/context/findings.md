# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

_No findings recorded. `/audit` appends findings here when it finds them._

### F-01 [P2] fixed - Long note text overflows the photo well in PNG export

**File:** src/lib/exportPng.ts:310
**Found:** 2026-09-08 by /audit (scope: current; lens: quality)
**Why it matters:** Photo nodes use `wrapNoteLinesPure` (up to 6 lines), but the text region above the media well fits about 3 lines at scale 2. A note with long text plus a loaded image paints text over the photo and can spill above the rect top.
**Suggested fix:** Cap lines for photo nodes to what the region fits (e.g. `wrapLinesPure(text, NOTE_MAX_CHARS_PER_LINE, 3)` when `showPhoto`), keeping the badge for overflow signal.
**Resolution:** Fixed 2026-09-08 by /implement: new `wrapExportTextPure` caps photo text to 3 lines, `hasDrawableImage` folds the dimension check into `showPhoto`; unit cases added. Awaiting re-audit to close.

### F-02 [P3] fixed - Image glyph SVG duplicated in NodeRect badge and placeholder

**File:** src/components/canvas/NodeRect.tsx:118
**Found:** 2026-09-08 by /audit (scope: current; lens: quality)
**Why it matters:** The image-icon path block appears verbatim twice (media badge button and broken-image placeholder). A future glyph tweak must be applied twice, repeating the pattern 13a/F-01 and 13b/F-01 already paid down.
**Suggested fix:** Extract a shared `NodeMediaGlyph({ kind })` component used by both spots, mirroring the `NodeLinkBadge` precedent.
**Resolution:** Fixed 2026-09-08 by /implement: new `NodeMediaGlyph({ kind, size })` serves the badge (both kinds) and the image placeholder; the framed video placeholder is a distinct variant and stays inline. Verify + 12 browser tests green. Awaiting re-audit to close.

### F-03 [P3] fixed - Zero-dimension images shift export text with no photo drawn

**File:** src/lib/exportPng.ts:293
**Found:** 2026-09-08 by /audit (scope: current; lens: quality)
**Why it matters:** `showPhoto` is set from map presence, but the draw is guarded by `naturalWidth/Height > 0`. A loaded image reporting zero dimensions (e.g. a dimension-less SVG) shifts the text block up while drawing nothing, leaving a gap.
**Suggested fix:** Fold the dimension check into `showPhoto` (e.g. resolve natural size at load time or check before layout) so text shifts only when pixels will draw.
**Resolution:** Fixed 2026-09-08 by /implement together with F-01: `showPhoto` now requires `hasDrawableImage`. Awaiting re-audit to close.
