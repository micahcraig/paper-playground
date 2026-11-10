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

- User code runs in a sandboxed iframe rebuilt through srcdoc on each run. Messages to the runner: run, stop, resize. Messages back: ready, log, error.
- Project files run in tab order in one shared scope. TypeScript is stripped with sucrase. There is no import between files in v1.
- Paper.js is pinned at 0.17.0 (the current npm release at M0); use `paper/dist/paper-full.js`, which includes the PaperScript compiler.
- Runner loading approach that worked in M1: (fill in after the spike)

## Out of scope for v1

Accounts, cloud sync, collaboration, npm installs for user code, IntelliSense, native wrapper.
