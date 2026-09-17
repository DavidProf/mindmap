# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

_Nothing in progress. The following findings remain open from earlier work._

### F-06 [P2] open - Pre-existing media-upload browser failure

**File:** e2e/media-upload.spec.ts:71
**Found:** 2026-09-16 by /audit (scope: current; lens: tests)
**Why it matters:** "combined editor keeps unsaved edits when uploading mid-edit" fails (`.node-rect__img` never appears) and it reproduces on the clean tree with this branch's working changes stashed, so it predates feature 15 and is unrelated to it. It still breaks the feature's Step 5 done-when (`npm run test:browser` green) and leaves a red suite on the branch.
**Suggested fix:** outside this feature's scope; run `/debug` on the media-upload flow, then `/fix` the root cause separately. Do not fold the repair into feature 15.
**Resolution:**
