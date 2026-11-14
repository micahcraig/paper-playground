# Paper Playground

Touch-first creative-coding playground (PWA) for a Pixel Fold. Full plan and milestones: PLAN.md.

## Commands

Node 22+ is required (`.nvmrc`); run `nvm use` first if the system Node is older.

- `npm run dev` start the dev server
- `npm run typecheck` TypeScript check
- `npm test` Vitest
- `npx playwright test` end-to-end tests at Pixel Fold sizes (builds and serves the production bundle)
- `npm run build` production build (uses the Pages base path; runs `npm run vendor` first)

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
- Layouts (M3): `.app.wide` / `.app.narrow` from `WIDE_QUERY` (600 px). The preview element never moves in the DOM (moving an iframe reloads it); CSS places it docked, as the 152 px thumbnail, or full screen. In the thumbnail the sketch renders at full-preview size and is CSS-scaled, so expanding does not resize it, and it ignores touches.
- Symbol keys cancel pointerdown/mousedown so the editor keeps focus and the keyboard stays open.
- E2E helpers live in e2e/helpers.ts (imported as `./helpers.ts`); interact with the sketch through `openFullPreview` in the folded project.
- Projects (M4, src/storage/): one IndexedDB key per project (`project:<id>`) via idb-keyval, plus `meta:lastOpened`. Typing autosaves after 400 ms; structural changes save at once; on pagehide the unsaved project is also copied synchronously to localStorage (`restoreRescued` applies it at launch). Tests use `memoryKeyValue()` instead of a fake IndexedDB.
- TypeScript: `.ts` files go through sucrase (lazy chunk, precached) in src/runner/typescript.ts; sucrase keeps line numbers and reports 1-based `(line:col)`.
- PaperScript parses with acorn 8.19.0 (pinned runtime dependency): Paper.js's bundled acorn is ES5 only, but Paper uses `self.acorn` when it is >= 8, so the runner inlines `acorn/dist/acorn.js` (the UMD build; imported by node_modules path because the package `exports` hides it) before Paper.js in PaperScript mode only.
- The Preview region is `aria-busy` while a run loads; E2E helpers wait on it (`settled`) instead of racing the iframe swap.
- Libraries (M5): src/libs/registry.ts lists paper 0.17.0, p5 2.3.4, three 0.186.1 and d3 7.9.0 (a unit test checks them against package.json); src/libs/urls.ts maps each to its classic-script asset. Projects store a normalized list; PaperScript always includes paper. Only the selected libraries are fetched and inlined, and without paper the runner skips `paper.setup` and the `#canvas`.
- three ships ES modules only, so `npm run vendor` (run by predev/prebuild) bundles it with Vite's library mode into src/vendor/generated/three.global.js (gitignored), an IIFE defining `THREE`. p5 and d3 are imported from node_modules by path because their package `exports` hide the UMD builds.
- Logs are capped at 1000 per run inside the runner, and the console keeps the last 200 entries.
- Fonts (M6): src/theme/fonts.css declares @font-face for the pinned @fontsource packages (5.3.0), pointing straight at the Latin woff2 files so Vite does not also emit the woff fallbacks. Only the weights in use are bundled: Inter 400/500/600 and JetBrains Mono 400 plus italic (comments). Add a face there if you use a new weight. Code ligatures are an Options setting (src/app/ligatures.ts, `data-ligatures="on"` on `<html>` → `--code-ligatures`), off by default, and apply to the editor and console only; the symbol keys and other code-font UI always use `font-variant-ligatures: none`. Per-device settings share `safeStorage` from src/app/localSettings.ts.
- README screenshots: `npm run screenshots` (playwright.screenshots.config.ts, scripts/screenshots/) rewrites docs/screenshots.

## Out of scope for v1

Accounts, cloud sync, collaboration, npm installs for user code, IntelliSense, native wrapper.
