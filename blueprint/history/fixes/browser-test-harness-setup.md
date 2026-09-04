# Browser Test Harness Setup

**Type:** Fix

**Status:** verified

## The problem

The repo has no repeatable browser verification: `AGENTS.md` declares no `Browser tests` command, and the `/browser-tests` setup ran on `main` leaving its output uncommitted and unlogged. Files in the working tree (`e2e/`, `playwright.config.ts`, plus edits to `package.json`, `package-lock.json`, `tsconfig.node.json`, `.gitignore`, `AGENTS.md`) belong to no work item, so `/complete` has nothing to archive or merge.

## The fix

Adopt the existing working-tree harness as this fix: Playwright Test (`@playwright/test@1.62.1`, reusing the already-present `playwright@1.62.1`) with a Chromium-only project, a `webServer` that starts and stops `npm run dev` on port 5173, one smoke test (`e2e/smoke.spec.ts`) that loads Home `/`, creates a project through the dialog, opens it via the `Open project <name>` card, and asserts the editor canvas (`Re-center`, `Export PNG`, `.editor-canvas`, root label). No app code changes; no Verify or CI changes (browser tests stay out of the default gate per standards).

Must not break: `npm run build`, `npm test` (Vitest 70 tests), `npm run lint`, existing unit coverage.

## Build steps

1. **Adopt and prove the harness** - confirm `playwright.config.ts`, `e2e/smoke.spec.ts`, `test:browser` script, `tsconfig.node.json` include, `.gitignore` entries, and the `AGENTS.md` `Browser tests` line are all in place; run `npm run test:browser`. Done when the Chromium smoke passes and the runner exits cleanly. - [x] (1 passed, 6.6s on fix branch; re-passed 7.3s in /complete final check)
2. **Regression check** - run `npm run build`, `npm test`, `npm run lint`. Done when all three are green. - [x] (build ok, 70/70 Vitest pass, eslint clean; re-passed in /complete final check)

## Verify

- `npm run test:browser` - 1 passed (smoke: home loads, project creation opens editor canvas).
- `npm run build`, `npm test`, `npm run lint` - all green.
- Manual path: `npm run dev`, open `http://localhost:5173`, create a project, open it, confirm the editor canvas renders.
