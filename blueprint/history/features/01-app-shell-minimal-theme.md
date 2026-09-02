# Feature: 1 - App shell & minimal theme

**From build-plan:** feature 1
**Status:** verified

## Goal

Ship the Vite React shell that every later feature builds on — SPA-safe routing for GitHub Pages, the locked Excalidraw-minimal theme from prototypes, and the shared header/page frame — so Home and Editor have a consistent, calm canvas to fill in.

## Design reference

Prototypes are the source of truth for this feature. Do not invent colors, spacing, or header layout.

- `prototypes/theme.css` — **canonical design tokens** (`--bg`, `--surface`, `--canvas`, `--border`, `--text`, `--accent`, `--node-*`, `--radius-*`, `--shadow-*`, `--font-sans` Inter). First step ports these into the app.
- `prototypes/home.html` — header (brand + "local only" badge + New Project primary button), `wrap`/title-row/grid/card tokens, empty-state illustration, sticky header + spacing.
- `prototypes/editor.html` — editor header (back button + title/sub + Fit/Re-center/Export chrome), canvas background (`radial-gradient` dot grid on `var(--canvas)`), stage/zoom legend patterns.

> No screenshot needed beyond prototypes — they are the reference. If a token is missing there, ask; do not guess.

## In scope

- Port `prototypes/theme.css` tokens into the app's global stylesheet as single source of truth (no duplicated hex values).
- Install and theme **MUI** to the minimal palette (neutral slate + one blue accent `#3b82f6`, no gradients, Inter typography, `radius-full` buttons, `CssBaseline`).
- SPA-safe routing for GitHub Pages — `HashRouter` with routes `/` (Home shell) and `/project/:projectId` (Editor shell) plus catch-all redirect; document why HashRouter for #1.
- Shared **app shell layout**: sticky header with brand (circle-nodes icon + "Mind Map — local"), layout wrappers (`wrap`/canvas chrome), footer-free page frames matching prototypes.
- `vite.config.ts` `base` handling for Pages (env-aware, works locally and on `/{repo}/` sub-path) and verification that `npm run build` + `npm run preview` serve routes correctly.
- Placeholder pages for Home and Editor (no real data yet — next feature owns persistence).
- Inter font loading (Google Fonts via `<link>` or `@import`, matching prototypes).

## Out of scope

- Real project list, create/rename/delete, localStorage/IndexedDB persistence — feature 2.
- Tree canvas, auto-layout, nodes, pan/zoom — feature 3.
- Plus buttons, inline edit, context menu, PNG export — features 4–6.
- Final GitHub Pages deployment (`gh-pages` branch/action), `404.html` SPA fallback for `BrowserRouter`, `CNAME`, ads, dark mode — feature 7 (Deploy & polish). Feature 1 only proves the build artifact is routable; the production deploy pipeline lands in #7.
- Search/duplicate/filter, cloud sync, undo/redo — post-MVP.
- Test runner / Verify command / browser harness — separate `/tests`, `/ci`, `/browser-tests` setups (not this feature).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

Each step ends with something working and a diff small enough to read in full. `/implement` ticks these off and resumes from the first unchecked box.

- [x] **Step 1 — Port design tokens to app globals** — copy `prototypes/theme.css` `:root` variables verbatim into the app's global CSS (e.g. `src/index.css` or `src/theme/tokens.css` imported before any component CSS), wire Inter font loading (`<link>` in `index.html` matching prototypes, with `preconnect`), set `body` bg/text to `var(--bg)`/`var(--text)` and `font-family` to `var(--font-sans)`. Remove conflicting default Vite CSS (`src/App.css` demo + `src/index.css` dark/light gradient). *Done when:* `npm run dev` shows warm off-white `#fbfaf7` background, computed `backgroundColor` on `body` is `rgb(251,250,247)`, `--accent` is `#3b82f6`, Google Fonts Inter loads (network tab 200), no Vite demo styles remain, and both `npm run build` and `npm run lint` pass.

- [x] **Step 2 — Install & theme MUI (minimal)** — `npm install @mui/material@9 @emotion/react @emotion/styled` (MUI v9.4.0 for React 19 compat), create `src/theme/muiTheme.ts` mapping **tokens to MUI** (not hard-coded duplicates): `palette.primary.main = #3b82f6`, `text.primary = #0f172a`, `background.default = #fbfaf7`, `typography.fontFamily = Inter / var(--font-sans)`, `shape.borderRadius = 12`, `components.MuiButton.styleOverrides` to `radius: var(--radius-full)` + no gradients + `textTransform: none`, subtle shadows from `--shadow-sm`. Wrap `App` with `<ThemeProvider>` + `<CssBaseline>` (tokens load before CssBaseline). Render a one-off MUI `<Button variant="contained">` probe (kept as disabled stub for traceability) to prove theming. *Done when:* MUI button renders with blue `#3b82f6` fill, rounded `999px` corners, Inter text, slate text on off-white — visually matches `prototypes/home.html` `.btn-primary`; no double font resets fighting tokens; `npm run build` and `npm run lint` pass.

- [x] **Step 3 — SPA-safe routing shell** — `npm install react-router-dom`, switch `src/main.tsx`/`src/App.tsx` to `HashRouter` with routes: `/` -> `HomePage` placeholder, `/project/:projectId` -> `EditorPage` placeholder, `*` -> redirect to `/`. Split placeholders into `src/pages/HomePage.tsx` and `src/pages/EditorPage.tsx` (each returns minimal `<main>` with heading so the router is observable). Keep `App.tsx` as route shell only. *Done when:* `npm run dev` at `http://localhost:5173/#/` shows "Your projects" heading, manual nav to `/#/project/demo-123` shows editor heading with `demo-123` param, browser back/forward works, hard reload on a hash route does not blank-page, and `npm run build` passes.

- [x] **Step 4 — App shell layout (header + page frames)** — build `src/components/layout/AppHeader.tsx` (sticky 56px header, `var(--surface)` + `var(--border)` bottom line, brand SVG from prototypes + "Mind Map — local" + "local only • GitHub Pages" badge + "New project" primary button as disabled stub). Wrap both pages with the header + `wrap`/`canvas` page containers matching prototypes spacing (max-width 960, 28px padding, responsive at 540/820 breakpoints). Home frame shows title-row "Your projects / Local to this browser" stub; Editor frame shows back `←`, title + subline stub, Fit / Re-center disabled stubs. *Done when:* side-by-side screenshot vs `prototypes/home.html`+`editor.html` matches header height/spacing/border/typography within 2px, layout collapses to single column under 540px, both routes share the same header without flash, header is keyboard-focusable.

- [x] **Step 5 — Vite base-path & SPA plumbing check** — set `vite.config.ts` `base` to env-aware value (e.g. `base: process.env.NODE_ENV === 'production' ? '/mindmap/' : '/'` — read `git remote -v` to confirm repo name is `mindmap`; if unknown keep `'/'` locally with `TODO(repo-name)` comment so feature 7 finalizes). Confirm `npm run build` emits assets with correct prefix, and `npm run preview -- --port 4174` serves hash routes (`/#/` and `/#/project/x`) from hard refresh without 404. Add `public/404.html` only if switching to `BrowserRouter` (document that `HashRouter` makes it unnecessary for #1). Update no other config. *Done when:* `npm run build` succeeds (`tsc -b && vite build`), `npm run preview` loads both routes from hard refresh, asset paths in `dist/index.html` carry the base prefix, no console errors, `npm run lint` passes, and a short inline comment in `vite.config.ts` records the HashRouter vs BrowserRouter trade-off for feature 7 to revisit.

## Files / areas

- `prototypes/theme.css` (read-only reference, copy from)
- `prototypes/home.html`, `prototypes/editor.html` (read-only reference)
- `src/index.css` / `src/theme/tokens.css` — global tokens + font
- `src/theme/muiTheme.ts` (new) — MUI theme bound to tokens
- `src/main.tsx`, `src/App.tsx` — `ThemeProvider`, `HashRouter` shell
- `src/pages/HomePage.tsx`, `src/pages/EditorPage.tsx` (new) — route placeholders with shell frames
- `src/components/layout/AppHeader.tsx` (new) — shared header
- `vite.config.ts` — `base` config
- `index.html` — Inter font `<link>`
- `package.json` — deps (`@mui/material`, `@emotion/*`, `react-router-dom`)
- `public/404.html` — only if needed; otherwise explicitly not added

## Data / contracts

None yet — no persistence in this feature.

- **Load-bearing for later:** route shape is locked here. Home is `/` (hash: `/#/`), Editor is `/project/:projectId` (hash: `/#/project/:projectId`). `projectId` is `string (uuid)` per Data model. Changing this later touches every feature (2–6). Keep the param name `projectId` exactly.
- Types `Project`/`Node` from `project-overview.md` Data model are **not** implemented in this feature; feature 2 introduces `src/types/project.ts` + `src/types/node.ts`. This feature must not invent a competing shape.

## Testing

No `test` / `Verify` / `Browser tests` command is declared in `AGENTS.md` yet — so the gate is build + visual proof, not unit tests. Do not add a runner mid-feature; that belongs to `/tests`.

- Logic in scope for future tests: none in this feature (routing + theming is integration, not unit-testable pure logic per `coding-standards.md`). Future features will unit-test validators (unique name), text limits, layout math, collapsed filtering — not this shell.
- Verification per step is the **done-when** above, observed via:
  - `npm run build` must pass after every step (`tsc -b && vite build`), plus `npm run lint` with zero errors
  - `npm run dev` visual check in browser (tokens/typography/header breakpoints/hash routing)
  - `npm run preview` hard-refresh check for Step 5 (proves base + hash routing)
  - One screenshot per visual step (Steps 1, 2, 4) compared to prototypes
  - Error state: confirm unknown hash route (`/#/unknown`) redirects to `/` without blank page
- If a `test` command is added before `/implement` runs, add a trivial no-logic guard: no assertion-heavy test is required for this shell; keep testing focused on future pure logic.

## Notes for the AI

- **Tokens first:** Step 1 is required before any MUI or layout work — never theme MUI from hard-coded hexes while tokens drift. `prototypes/theme.css` is the single source of truth.
- **MUI tuning:** Keep MUI minimal — no gradients, no custom palette beyond `primary`/`text`/`background` mapped from tokens. Prefer `var(--*)` in `styleOverrides` where MUI allows it so prototypes stay canonical. Do not add Tailwind.
- **Routing choice:** Use `HashRouter` for feature 1 — it is SPA-safe on GitHub Pages without a `404.html` hack and keeps feature 7's `BrowserRouter` evaluation scoped to Deploy & polish. Document the trade-off inline (`#` in URL vs clean URL needing fallback) so feature 7 can revisit without rework.
- **History-agnostic shell:** The header's "New project" / Fit / Re-center / Export buttons are disabled stubs in this feature — wire them in features 2–6. Do not stub fake state.
- **Conventions:** Functional components only, hooks, strict TS, PascalCase components, no `any`, keep functions <50 lines, comments only for why (per `coding-standards.md`). React Compiler is enabled — no manual memo unless measured.
- **Scope discipline:** If tempted to add localStorage, nodes, or canvas in this feature, stop — that is scope creep. The only files this feature should leave behind are theming/routing/shell. Data arrives in feature 2.
- **Accessibility min:** Header nav and buttons must have discernible names, visible focus rings (MUI focusVisible), and not rely on hover alone. Full a11y nav is post-MVP, but this shell sets the baseline.
