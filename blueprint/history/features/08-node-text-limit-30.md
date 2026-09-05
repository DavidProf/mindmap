# Feature: 8 - Node text limit 30

**From build-plan:** feature 8
**Status:** verified

## Goal

Tighten the node text limit from 60 to 30 characters, matching the decided plan. Shorter labels keep the fixed 88px circles readable and the maps scannable.

## In scope

- `MAX_NODE_TEXT_LENGTH` 60 to 30 in `src/lib/storage.ts`; validation message follows the constant.
- Inline editor (`NodeEditor.tsx`) picks the new limit up via the shared constant (counter shows `/30`, input caps at 30).
- Unit tests updated to the new boundary (30 accepted, 31 rejected).
- Grandfather rule: existing stored nodes over 30 chars keep displaying as-is (CSS clamp plus ellipsis already handles overflow) and are enforced only on create/edit. No data migration.
- Focused browser assertion: typing past 30 chars in the editor truncates.

## Out of scope

- PNG export filename truncation (60 chars before `-mindmap.png` in `exportPng.ts`) - unrelated to node text, untouched.
- Project name limit (40, separate rule), circle size, layout, or wrapping changes.
- Backfilling or truncating existing over-limit nodes in storage.
- IndexedDB (item 10) and design polish (item 9).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Limit plus unit tests** - change `MAX_NODE_TEXT_LENGTH` to 30, update `storage.test.ts` boundary cases (30 accepted, 31 rejected with `Text must be 30 characters or less`). *Done when:* `npm test` green and a 31-char `addChildNode`/`updateNodeText` call throws the 30-char message.
- [x] **Step 2 - Editor and full verification** - confirm the inline editor caps input at 30 with a `/30` counter, add a Playwright assertion that over-length typing truncates in the editor, run the full gate. *Done when:* typing 31+ chars in a node editor leaves 30; an existing over-limit node still renders (clamped/ellipsis) until edited; `npm run build`, `npm run lint`, `npm test`, `npm run test:browser` all pass.

## Files / areas

- `src/lib/storage.ts` (`MAX_NODE_TEXT_LENGTH`, `validateNodeTextPure` - message follows the constant)
- `src/lib/storage.test.ts` (boundary assertions 60/61 to 30/31)
- `src/components/canvas/NodeEditor.tsx` (no logic change expected - reads the constant; verify counter/`maxLength`)
- `e2e/smoke.spec.ts` (extend: editor truncation assertion)

## Data / contracts

- **Load-bearing change:** `MAX_NODE_TEXT_LENGTH = 30`. Single source of truth consumed by validation and the editor; `Node.text` max becomes 30 per plan.
- Grandfather rule: stored nodes over 30 chars are valid to display, invalid to write (create/edit reject). No migration, no stored-shape change.
- Explicitly untouched: export filename cap (60), project name cap (40).

## Testing

- Test gate is on: `Test: npm test` (Vitest) and `Browser tests: npm run test:browser` (Playwright Chromium) per `AGENTS.md`.
- Unit (Step 1, same diff as the change): 30 accepted, 31 rejected with exact message; blank rejection unchanged.
- Browser (Step 2): editor truncates over-length typing; Re-center/export unaffected. Remaining rendering claims ride on build plus direct evidence.
- Gates per step: `npm run build` + `npm run lint` always; `npm test` in Step 1; `npm run test:browser` in Step 2.

## Notes for the AI

- Client-only Vite SPA, React 19 + TS strict; minimal diffs; no `em dashes`.
- `validateNodeTextPure` message interpolates the constant - no hardcoded `60` should remain in the node-text path (the `60` in `exportPng.ts` filename logic stays).
- Existing over-limit fixtures in tests (if any use >30 char node text) must be checked: display-only fixtures stay valid, write-path fixtures need shortening.
