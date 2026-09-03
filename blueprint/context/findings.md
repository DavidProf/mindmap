# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-02 [P3] open - Oversized HomePage bundles 4 dialogs and grid in one file

**File:** src/pages/HomePage.tsx:1
**Found:** 2026-09-02 by /audit (scope: current; lens: quality)
**Why it matters:** `HomePage.tsx` is 393 lines combining grid, empty state, create/rename/delete dialogs, menu, and navigation. `coding-standards.md` prefers one job per component and `src/components/[feature]/ComponentName.tsx`. The file is hard to review in one sitting and duplicates button `sx` props, increasing drift risk for future canvas features.
**Suggested fix:** Extract `ProjectGrid`, `ProjectCard`, `CreateProjectDialog`, `RenameProjectDialog`, `ConfirmDeleteDialog` into `src/components/home/` (as the spec's optional split suggested). Keep `HomePage` as data wiring only. No behavior change.
**Resolution:**
