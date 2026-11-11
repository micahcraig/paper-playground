# Paper Playground

Touch-first creative-coding playground (PWA) for a Pixel Fold. Full plan and milestones: PLAN.md.

## Commands

Node 22+ is required (`.nvmrc`); run `nvm use` first if the system Node is older.

- `npm run dev` start the dev server
- `npm run typecheck` TypeScript check
- `npm test` Vitest
- `npx playwright test` end-to-end tests at Pixel Fold sizes (builds and serves the production bundle)
- `npm run build` production build (uses the Pages base path)

## Conventions

- TypeScript strict mode. Preact function components only.
- Pin every dependency to an exact version (no ^ or ~), especially paper, p5, three and d3. `.npmrc` sets `save-exact`.
- Colours come only from the custom properties in src/theme/tokens.css. Do not change the Tokyo Night values; they are tuned for 4.5:1 contrast.
- Every control is a real `<button>` at least 44 x 44 px, with an aria-label if it shows only an icon.
- Do not add runtime dependencies without asking.
- Unit tests sit beside the code as `*.test.ts`; end-to-end tests live in `e2e/` as `*.spec.ts`.
- Work one milestone per branch. Use conventional commit messages. Open a PR with gh pr create; never push to main directly.
- Each PR description lists the manual checks to run on the Pixel Fold.

## Architecture notes

- User code runs in an `<iframe sandbox="allow-scripts">` (opaque origin) rebuilt through srcdoc on each run (src/runner/). The app never posts to the runner: new code means a new iframe, and resizing the iframe resizes the canvas (`data-paper-resize`). Messages back (src/runner/protocol.ts): ready, ran, log, error.
- Project files run in tab order in one shared scope. TypeScript is stripped with sucrase. There is no import between files in v1.
- Paper.js is pinned at 0.17.0 (the current npm release at M0); the runner uses `paper/dist/paper-full.min.js`, which includes the PaperScript compiler.
- Runner loading approach that worked in M1: **libraries are inlined into the srcdoc as text.** Chromium refuses blob: URLs inside a sandboxed (opaque-origin) iframe ("Not allowed to load local resource"), so the plan's blob-URL approach does not work, and the no-sandbox fallback was not needed. The app page fetches each library once (`src/runner/libraries.ts`; it is service-worker controlled, so this works offline) and inlines the text, escaped with `escapeScript`.
- Error locations: JavaScript files are separate inline scripts, so `error.lineno` is a srcdoc line, mapped back with the `lineMap` from `buildSrcdoc`. PaperScript is compiled by Paper.js with `url: PAPERSCRIPT_URL`, so positions come from that frame in the stack (or the compiler's `(line:col)` for parse errors).
- Paper.js listens to both touch and mouse events unless the user agent says "mobile" (Chrome in desktop-site mode, which large Android screens can default to, does not). The runner cancels `touchstart` so a tap fires handlers once.
- Keep-last-good-render (M2): each run's iframe loads hidden (class `pending`) on top of the one on screen and replaces it only after `ran`; an error first discards it and the host emits `kept` (src/runner/preview.ts). Tests target the shown iframe with `.preview iframe:not(.pending)`.
- Paper.js 0.17 parse errors end with `(at paperscript-sketch:L:C)`, column 1-based; `cleanErrorMessage` strips it for display.
- The runner iframe has `color-scheme: normal`: an iframe whose colour scheme differs from the app's gets an opaque white backdrop.
- Editor (src/editor/): CodeMirror with native selection (no drawSelection) for Android touch handles; colours are token custom properties, so one theme serves both variants.
- Logs are capped at 1000 per run inside the runner, and the console keeps the last 200 entries.

## Out of scope for v1

Accounts, cloud sync, collaboration, npm installs for user code, IntelliSense, native wrapper.
