# Paper Playground

A touch-first creative-coding playground for [Paper.js](http://paperjs.org/), built as an installable web app for the Pixel Fold. Edit a sketch and see it render in under half a second, online or off.

Status: M4 (projects and files). See [PLAN.md](PLAN.md) for the milestones.

## Develop

Requires Node 22 or newer.

```bash
nvm use        # if your default Node is older
npm install
npm run dev
```

## Test

```bash
npm run typecheck
npm test                         # unit tests (Vitest)
npx playwright install chromium  # first time only
npx playwright test              # end-to-end at 390×844 and 840×780
```

## Deploy

Every push to `main` runs the tests and deploys `dist/` to GitHub Pages at `/paper-playground/`.
