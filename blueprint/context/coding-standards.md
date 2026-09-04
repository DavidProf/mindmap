# Coding Standards

> Tuned for this project by `/onboard`. Review before `/overview`.

## Stack

- Vite + React 19 + TypeScript (strict) + ESLint
- React Compiler enabled via `@vitejs/plugin-react` + `babel-plugin-react-compiler`
- Planned: React Flow for canvas/graph, Material UI for components (per `project-plan.md`)
- Package manager: npm (`package-lock.json`)
- No Tailwind, no Prisma, no Next.js in this project

## TypeScript

- Strict mode enabled (`tsconfig.app.json` + `tsconfig.node.json`)
- No `any` types - use proper typing or `unknown`
- Define interfaces for all props, API responses, and data models
- Use type inference where obvious, explicit types where helpful
- `verbatimModuleSyntax`, `noUnusedLocals`, `erasableSyntaxOnly` enforced

## React

- Functional components only (no class components)
- Use hooks for state and side effects
- Keep components focused - one job per component
- Extract reusable logic into custom hooks
- React Compiler is enabled - avoid manual `useMemo`/`useCallback` unless measured need
- Vite handles HMR; no Server Components / Server Actions (Vite SPA model)

## File Organization

- Components: `src/components/[feature]/ComponentName.tsx`
- Pages/Views: `src/pages/` or `src/routes/` (create as needed; currently `src/App.tsx` is entry)
- Types: `src/types/[feature].ts`
- Lib/Utils: `src/lib/[utility].ts` or `src/utils/`
- Assets: `src/assets/`
- Static: `public/`

## Naming

- Components: PascalCase (`MindNode.tsx`)
- Files: Match component name or kebab-case
- Functions: camelCase
- Constants: SCREAMING_SNAKE_CASE
- Types/Interfaces: PascalCase (no prefix)

## Styling

- Current: plain CSS (`src/index.css`, `src/App.css`)
- Planned: Material UI components + simple custom CSS
- No gradients (per project plan)
- Nodes: circles by default, rectangles for images/videos, similar size by default
- Keep styling simple - information and links matter most
- No Tailwind in this project; if added later, update this section
- > TODO: Decide CSS approach for MUI theming vs plain CSS and document here

## Data

- Projects and nodes (text, links, images, etc. - per project plan)
- Storage not yet implemented - likely local state / localStorage first, evaluate persistence later
- > TODO: Choose persistence (localStorage, IndexedDB, backend) and document data access boundaries

## Data Fetching / State

- Vite SPA - client-side state via React hooks / context
- Validate inputs where applicable (consider Zod if validation grows)
- No Server Actions / API routes yet; if backend added, document API boundaries here

## Error Handling

- Use try/catch for operations that can fail (storage, parsing)
- Display user-friendly error messages
- Keep error handling close to the UI that triggers it

## Build & Verification

- Dev: `npm run dev` (Vite on http://localhost:5173)
- Build: `npm run build` (`tsc -b` + `vite build`)
- Preview: `npm run preview`
- Lint: `npm run lint`
- Test: `npm test` (Vitest, single run); watch: `npm run test:watch`
- No Verify command yet - see Testing and `AGENTS.md` Commands

## Testing

The blueprint installs no test runner; testing is opt-in at the project level,
because the overlay can't know your stack. Adding unit testing is an explicit
setup task the AI can do through the normal workflow, either as a build-plan item
or with `/tests`. The setup should choose the stack-native runner, wire the
scripts or commands, add a small example test, and update the Commands section
of `AGENTS.md`.

When `AGENTS.md` declares a `Verify` command, treat it as the umbrella automated
gate. It combines only the checks this project actually has, in this order when
available: typecheck, tests, then build. The command does not enable an absent
test runner or replace focused evidence. It gives local work and optional CI one
exact command to run. `/ci` owns Verify and CI setup. `/tests` adds the real test
command to Verify when it already exists, but never creates CI only because
testing was configured.

**The opt-in switch is one signal: a `test` command in the Commands section of
`AGENTS.md`.** Declare one and **tests become a gate for logic-bearing steps**,
not an optional extra; leave it out and the loop verifies logic with the evidence
it already uses (run it, a screenshot, the build). Adding the runner is itself a
deliberate step, never a silent mid-step install. This is the single definition
of the switch; the skills and `ai-interaction.md` only point back here.

- **What to test (the scope rule):** pure logic where a wrong answer is possible -
  parsers, formatters, validators, id/slug builders, layout/branch expand-collapse logic. These have
  assertable inputs and outputs and real edge cases (empty, missing, malformed).
- **What not to test:** UI components and integration-level surfaces (render or
  export routes, anything driving a real browser or external service). Verify those
  with a screenshot and the build, not brittle unit tests.
- **The gate (when a runner is configured):** a build step that adds in-scope logic
  must ship a passing test in the same reviewable diff. The project's test command
  must be green before the step is approved, before any checkpoint commit, and
  before `/complete` merges. UI and integration-only steps are exempt and ride on
  screenshot plus build evidence.
- **When it's named:** the `/feature` spec's Testing section predicts the coverage,
  `/implement` writes the test with the step, and if a step surfaces logic the spec
  didn't foresee, add a focused test then.
- An empty suite should fail, not pass, so "no tests ran" never looks like "passed".
- Test files live next to source files (for example `feature.test.ts`).
- Run them via the project's test command (see Commands in `AGENTS.md`), not a
  hardcoded tool name.

Stack binding for this project: TypeScript + Vite uses Vitest, `vi.mock()` for
external dependencies and `vi.useFakeTimers()` for time-dependent logic.

## Browser Verification

For UI and integration behavior, prefer real browser evidence over reading the
code and assuming it works.

- Browser automation is separately opt-in through `/browser-tests`. That setup
  reuses a compatible runner or prefers Playwright for supported projects, then
  documents the exact command as `Browser tests` in `AGENTS.md`.
- When `Browser tests` is declared, add focused coverage for stable behavioral
  done-whens when it is proportionate, and run the documented command during
  `/check`. Do not assume it proves visual fidelity, real authenticated-profile
  behavior, browser chrome, or another claim the test does not observe.
- If no Browser tests command is declared, do not add a runner silently in the
  middle of an unrelated feature. Use the available dev server, browser
  screenshots, build output, API output, or manual evidence instead.
- Browser tests are not part of the default Verify command or CI unless the user
  separately chooses that slower gate.
- Browser evidence is especially important for flows that click, type, submit,
  navigate, download files, render complex layouts, or depend on client-side
  state.

## Code Quality

- No commented-out code unless specified
- No unused imports or variables
- Keep functions under 50 lines when possible

## Comments

Write code that explains itself; comment only what the code cannot say.
Over-commenting is a common AI tell, so resist it.

- Comment the **why**, not the **what**. Delete any comment that restates the code.
- No banner/header blocks, section dividers, or step-by-step narration of obvious
  code. A file does not need a comment announcing each region.
- A comment earns its place only when it captures something the code can't: a
  non-obvious decision, a gotcha or workaround, why a value is what it is, or a
  link to a spec or issue.
- Prefer self-documenting names and small functions over explanatory comments.
- Keep doc comments minimal: a one-line purpose on an exported type or function is
  plenty; don't write JSDoc that just repeats the signature.
- When in doubt, leave the comment out.

## Writing

- No em dashes (U+2014) in generated content: docs, comments, commit messages,
  READMEs, specs. They read as AI-generated.
- Use a hyphen for `term - description` separators; rephrase prose with commas,
  parentheses, or a colon. Avoid en dashes and the ellipsis character too.
