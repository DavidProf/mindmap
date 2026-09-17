# Combined media editor discards mid-edit upload

## Type

Fix

## Status

verified

## Fixes

F-06

## The problem

- The combined Edit node dialog (`combined: true`) keeps unsaved text when uploading mid-edit, but loses the upload on Save.
- Flow: node has URL media, user opens Edit, types text, picks a file. Upload succeeds and persists to storage, dialog stays open, then Save writes the stale URL draft back over the upload.
- Result: `e2e/media-upload.spec.ts:71` fails at `.node-rect__img` (text `Remember me` saves, image missing).
- Root: `NodeMediaDialog` inits `draft` from `target.media.src` once via `useState`; `TreeCanvas` updates `mediaTarget.media` after upload without remounting (key is only `nodeId:combined/simple`), so `computeMedia()` still prefers the old non-empty URL draft.

## The fix

- `NodeMediaDialog.handlePick` clears the stale URL draft and resets kind to `image` on successful combined-mode upload, preserving `draftText` and `draftFill`.
- Simple (non-combined) upload still closes the dialog; URL entry, validation, invalid-file error, and IndexedDB-unavailable notice unchanged.
- Touched: `src/components/canvas/NodeMediaDialog.tsx` only.

## Build steps

- [x] 1. Sync upload into combined dialog draft
  - Done when `npx playwright test e2e/media-upload.spec.ts -g "keeps unsaved edits"` passes and the other four `media-upload` tests still pass.

## Verify

- `npx playwright test e2e/media-upload.spec.ts -g "keeps unsaved edits"` - 1 passed
- `npx playwright test e2e/media-upload.spec.ts` - 5 passed
- `npm run test:browser` - 21 passed
- `npm run verify` - 218 unit tests passed, `tsc -b` + `vite build` passed
- `npx eslint src/components/canvas/NodeMediaDialog.tsx` - clean

## Findings

### combined-media-editor-upload/F-06 [P2] closed - Pre-existing media-upload browser failure

**File:** e2e/media-upload.spec.ts:71
**Found:** 2026-09-16 by /audit (scope: current; lens: tests)
**Why it matters:** "combined editor keeps unsaved edits when uploading mid-edit" fails (`.node-rect__img` never appears) and it reproduces on the clean tree with this branch's working changes stashed, so it predates feature 15 and is unrelated to it.
**Suggested fix:** outside this feature's scope; run `/debug` on the media-upload flow, then `/fix` the root cause separately.
**Resolution:** repaired on `fix/combined-media-upload` - `NodeMediaDialog.handlePick` clears the stale URL draft (and resets kind to image) on successful combined-mode upload so Save keeps the fresh `uploadId` media plus unsaved text. Verified by `e2e/media-upload.spec.ts:71` and full `npm run test:browser` (21 passed). Re-reviewed 2026-09-17 by /audit (scope: current; all lenses): repair confirmed, no new defect, lint clean.
