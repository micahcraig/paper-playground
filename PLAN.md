# Paper Playground – Implementation Plan for Claude Code

Nov 6, 2026 · Micah · Source: [Implementation plan doc](https://claude.ai/artifact/9EH5uDGb8puTibwgAHGU3Q) (exported to Markdown; the doc is the master copy)

## Goal and scope

Build an installable web app (PWA) for the Pixel Fold where editing Paper.js code and seeing it render takes one keystroke and under half a second, with nothing to build or install on the phone.

**In scope for v1**

- Edit PaperScript, plain JS and TypeScript with live reload as you type.
- Paper.js loaded by default; p5.js, Three.js and d3 selectable per project from a pinned list.
- A handful of files per project (for example `sketch.js` and `palette.ts`), saved on the device.
- Fold-aware layout: editor and preview side by side unfolded, editor with a floating preview folded.
- Tokyo Night (dark) and Tokyo Night Day (light) themes, following the system setting.
- Installable, and usable offline once loaded.

**Non-goals for v1**

- Accounts, cloud sync, sharing links or collaboration.
- Installing arbitrary npm packages or bundling against `node_modules`.
- A native Android wrapper, TypeScript IntelliSense, or a git UI.

The visual source of truth is the [Tokyo Night mock canvas](https://claude.ai/artifact/6uVyT9SDkf4DZPfNfG4mmn). Its layouts and tokens are restated in the UI spec below, so Claude Code does not need to open it.

## Decisions and stack

Everything runs in the browser and ships as static files, so there is no server to maintain.

| Area | Choice | Why |
| --- | --- | --- |
| App shell | Vite + TypeScript + Preact | Small bundle, fast dev loop, familiar TS tooling |
| Editor | CodeMirror 6 with `@codemirror/lang-javascript` | Native touch selection and Android keyboard handling; Monaco is poor on touch |
| Runner | `<iframe sandbox="allow-scripts">` rebuilt through `srcdoc` on each run | Isolates sketch code; a fresh iframe means no state leaks between runs |
| Libraries | npm dependencies pinned in `package.json`, copied to `dist/vendor` at build, handed to the runner as blob URLs | Works offline and is deterministic; no CDN at runtime |
| Paper.js build | The full build (includes the PaperScript compiler) | PaperScript needs the compiler; the core build omits it |
| TypeScript | `sucrase` in the app, not in the iframe | Fast type stripping; no type checking in v1 |
| Storage | IndexedDB through `idb-keyval` | Survives restarts, no localStorage size limits |
| Offline and install | `vite-plugin-pwa` (service worker + manifest) | Installable on the Pixel, loads without a connection |
| Hosting | GitHub Pages deployed by GitHub Actions | HTTPS is required for install; free |
| Tests | Vitest (unit) and Playwright (end to end, Pixel Fold viewports) | Covers logic and the real layouts |
| Package manager | npm | One less tool to set up |

Verify the current Paper.js 0.12.x release on npm during M0 and pin that exact version; do not trust a number written in this plan.

> **M0 note:** npm's current Paper.js release is 0.17.0, so that is what is pinned. The library chip in the mocks (`paper 0.12`) should show the real pinned version.

## GitHub repo setup

Create `paper-playground` from a Vite scaffold, push it with the `gh` CLI, and let GitHub Actions test and deploy it to GitHub Pages. You need git, Node 22 or newer, and `gh auth status` showing you signed in.

1. Scaffold the project:

   ```bash
   mkdir paper-playground && cd paper-playground
   git init -b main
   npm create vite@latest . -- --template preact-ts
   npm install
   npm install paper codemirror @codemirror/lang-javascript idb-keyval sucrase
   npm install -D vite-plugin-pwa vitest @playwright/test
   ```
2. Add `PLAN.md` (this doc exported as Markdown), `CLAUDE.md` (the last section of this doc) and a short `README.md`.
3. Commit, then create the GitHub repo and push in one step:

   ```bash
   git add -A && git commit -m "Scaffold Vite, Preact and TypeScript"
   gh repo create paper-playground --public --source=. --remote=origin --push \
     --description "Touch-first creative-coding playground for Paper.js"
   ```

   Pages on a private repo needs a paid GitHub plan. On the Free plan keep it public; there are no secrets in this project.
4. Turn on Pages with Actions as the source:

   ```bash
   gh api -X POST repos/{owner}/{repo}/pages -f build_type=workflow
   ```
5. In `vite.config.ts` set `base: '/paper-playground/'`, and use the same path for `start_url` and `scope` in the PWA manifest.
6. Add two workflows under `.github/workflows/`:
   - `ci.yml` on pull requests: `npm ci`, typecheck, `npm test`, `npm run build`.
   - `deploy.yml` on push to `main`: build, then `actions/upload-pages-artifact` and `actions/deploy-pages` with `pages: write` and `id-token: write` permissions.
7. Create one GitHub issue per milestone (M0 to M6, below). Work each on its own branch, open a PR with `gh pr create`, and squash-merge once CI is green. After `ci.yml` has run once, require it in branch protection for `main`.

Target layout:

```text
src/
  app/        shell, fold-aware layout, theme switching
  editor/     CodeMirror setup, Tokyo Night themes, symbol strip
  runner/     iframe host, srcdoc builder, message protocol
  libs/       registry.ts: pinned libraries and how to load them
  storage/    projects and files in IndexedDB
  theme/      tokens.css (Tokyo Night dark and light)
public/       manifest, icons
e2e/          Playwright tests
CLAUDE.md  PLAN.md  README.md
```

## Architecture

The doc has a diagram here (six parts in two containers: the app page and the sandboxed runner iframe). In words:

The editor autosaves to the project store and sends code to the runner host, which builds a fresh sandboxed iframe on each run; the sketch reports logs and errors back to the console drawer with `postMessage`. A service worker caches the app and the vendored libraries so all of this works offline.

## Milestones

Build in this order. Each milestone is one PR and is done only when its acceptance line is true on the Pixel Fold, not just in a desktop browser.

### M0 Repo and tooling

- Everything in the GitHub repo setup section; pin the Paper.js version.
- Placeholder page that shows the app name and the current theme.

**Done when:** CI passes on a PR, the Pages URL loads on the Pixel, and the page installs to the home screen.

### M1 Runner spike

- Sandboxed iframe that loads vendored Paper.js through blob URLs and runs a hardcoded sketch, both as PaperScript and as plain JS.
- Forward `console.*` calls and uncaught errors (message, line, column) to the parent with `postMessage`.
- Fallback if blob URLs will not load inside the sandbox: serve a same-origin `runner.html` without the `sandbox` attribute. Record which one worked in `CLAUDE.md`.

**Done when:** the sketch renders, logs and errors reach the parent, and it still runs with the network off after one load.

### M2 Editor with live reload

- CodeMirror 6 with JavaScript highlighting and both Tokyo Night themes.
- Re-run 250 ms after the last keystroke. On a syntax error keep the last good render and show the error, never a blank preview.

**Done when:** a typed change shows in the preview within 500 ms on the Pixel, and touch selection, caret drag and Gboard composition all work.

### M3 Mobile ergonomics and fold layout

- Symbol strip: Tab, arrows, `{ } ( ) [ ] ; = " =>`, plus undo and redo.
- Layout switches on viewport width (see the UI spec): split view when wide, editor with floating preview when narrow.
- Keep the caret and the symbol strip above the on-screen keyboard using `visualViewport`.
- Console drawer: peek bar when narrow, panel under the preview when wide.

**Done when:** both layouts match the mocks at 390 px and 840 px wide, every touch target is at least 44 px, and the caret stays visible with the keyboard open.

### M4 Projects and files

- Projects with a few files each, stored in IndexedDB with autosave; create, rename, delete, export and import as JSON.
- Files run in tab order in one shared scope. TypeScript files go through `sucrase`. There is no `import` between files in v1.
- A starter project that draws the ripple sketch from the mocks.

**Done when:** a three-file project survives a reload and an app restart, and an exported project imports cleanly into a fresh install.

### M5 Library picker

- `libs/registry.ts` lists paper, p5, three and d3 with pinned versions and how each is loaded.
- Each project selects its libraries; only those are loaded into the runner.

**Done when:** a p5 sketch and a Three.js sketch both run offline, and a Paper.js-only project does not load the others.

### M6 PWA polish

- Manifest, icons, service worker precache, theme follows the system with a manual override, README with screenshots.

**Done when:** the app is installable, works in airplane mode after the first load, and passes the Pixel Fold checklist in the testing section.

## UI spec

The app has two layouts, switched by viewport width at 600 CSS px. The mock sizes below are design targets; read the real CSS pixel widths from the device in M3 and adjust the breakpoint if they differ.

|  | Unfolded (about 840 × 780) | Folded (about 390 × 844) |
| --- | --- | --- |
| Top bar, 56 px | Menu, project name, Live toggle, console toggle, more, Run button | Menu, project name, Live toggle, round Run button, more |
| File tabs, 44 px | Tabs, new-file button, library chip (`paper 0.12`) | Tabs, new-file button |
| Body | Editor (1.15 parts) beside preview (1 part); preview toolbar 44 px with reload and full screen | Editor fills the screen; 152 × 152 floating preview bottom-right with an expand button |
| Console | 132 px panel under the preview | 44 px peek bar above the symbol strip; tap to open |
| Symbol strip, 60 px | Tab, arrows, `{ } ( ) [ ] ; = " =>`, then Undo and Redo | Same keys, scrolls sideways |
| Code type | JetBrains Mono 15 / 22 px | JetBrains Mono 13 / 20 px |

UI text is Inter. Every control is a real `<button>` at least 44 × 44 px with an `aria-label` when it shows only an icon. The Live toggle uses `aria-pressed`.

Define these as CSS custom properties in `src/theme/tokens.css`, dark on `:root` and light under `prefers-color-scheme: light` and a `data-theme` override.

| Token | Dark (Tokyo Night) | Light (Tokyo Night Day) |
| --- | --- | --- |
| Background (editor) | `#1a1b26` | `#e1e2e7` |
| Panel (bars, tabs) | `#16161e` | `#d0d5e3` |
| Border | `#292e42` | `#b4b5b9` |
| Key / raised surface | `#292e42` | `#f0f1f6` |
| Current line | `#1f2335` | `#ecedf3` |
| Preview canvas | `#1f2335` | `#eef0f6` |
| Text | `#c0caf5` | `#2c4a9e` |
| Muted text | `#8089b3` | `#44558f` |
| Line numbers | `#7d86ad` | `#44558f` |
| Accent (Run button) | `#7aa2f7` | `#1f5fc4` |
| Text on accent | `#1a1b26` | `#ffffff` |
| Active tab underline | `#7aa2f7` | `#2e7de9` |
| Live dot | `#9ece6a` | `#4a6a2b` |
| Warning text | `#e0af68` | `#6e4f22` |
| Syntax: keyword | `#bb9af7` | `#7b36d6` |
| Syntax: function | `#7aa2f7` | `#1f5fc4` |
| Syntax: string | `#9ece6a` | `#4a6a2b` |
| Syntax: number | `#ff9e64` | `#9a4d00` |
| Syntax: property | `#73daca` | `#086654` |
| Syntax: built-in | `#7dcfff` | `#00657f` |
| Syntax: comment (italic) | `#8089b3` | `#44558f` |

These values start from the official Tokyo Night and Tokyo Night Day palettes. Muted text in dark, and text and syntax colours in light, are deliberately a little lighter or deeper than the official ones so small text keeps at least 4.5:1 contrast. Do not revert them to the stock values.

## Testing and verification

CI proves the logic and the layouts at Pixel Fold sizes; only the device proves touch, keyboard and install behaviour, so each milestone ends with a short manual pass.

**In CI**

- Vitest: the srcdoc builder, the message protocol, the sucrase wrapper, the project store (against a fake IndexedDB) and the library registry.
- Playwright with Chromium at 390 × 844 and 840 × 780, touch enabled: type in the editor, wait for the render, check the preview canvas is not blank, and check that a syntax error keeps the last good render.
- Playwright checks that every button is at least 44 × 44 px and has an accessible name.
- Build must succeed with the Pages `base` path.

**On the Pixel Fold, after each deploy**

- [ ] Install from the Pages URL; launch from the home screen.
- [ ] Type in the editor with Gboard: autocorrect and composition do not corrupt code, and the caret stays visible with the keyboard open.
- [ ] Fold and unfold while a sketch runs: the layout switches and the sketch keeps its state or restarts cleanly.
- [ ] Switch the system theme between light and dark: colours match the token table.
- [ ] Airplane mode: reload the app and run a saved project.
- [ ] Draw on the preview with touch: Paper.js mouse tools receive touch events.

## Risks and open questions

The two biggest unknowns are how the sandboxed runner loads libraries offline and how Gboard behaves in CodeMirror; M1 and M2 are ordered to settle them first.

| Risk | Effect | Mitigation |
| --- | --- | --- |
| Blob-URL libraries will not load inside the sandboxed iframe | Runner design changes | M1 spike; fallback is a same-origin `runner.html` without the `sandbox` attribute |
| Service worker does not control the sandboxed iframe, so offline fetches fail | No offline runs | The parent page fetches libraries (it is service-worker controlled) and passes them in as blobs; test with the network off in M1 |
| Gboard autocorrect or composition mangles code | Typing is unusable | Turn off autocorrect, autocapitalize and spellcheck on the editor's content element; test on the device in M2 |
| Folding or unfolding resizes the viewport mid-run | Canvas stretches or the layout flickers | Debounce resize, tell the runner the new size, test both postures in M3 |
| An infinite loop in user code freezes the tab | Preview hangs, editor may stop responding | Accept for v1 and document it; a Worker with OffscreenCanvas is a later option |
| Pages is unavailable for a private repo on the Free plan | Deploy fails | Keep the repo public, or move to a paid plan |

**Open questions**

- Public or private repo? This plan assumes public.
- Is `paper-playground` the name you want?
- Is "no `import` between files" acceptable for v1, or do you need ES modules from the start? Adding them means a second loading path for libraries.
