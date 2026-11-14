// Builds browser globals for libraries that ship only ES modules, so the
// sandboxed runner can inline them as classic scripts. Runs before dev and build.
import { build } from 'vite'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

const bundles = [{ entry: 'scripts/vendor/three.js', name: 'THREE', file: 'three.global.js' }]

for (const bundle of bundles) {
  await build({
    root,
    configFile: false,
    logLevel: 'warn',
    build: {
      lib: { entry: bundle.entry, formats: ['iife'], name: bundle.name, fileName: () => bundle.file },
      outDir: 'src/vendor/generated',
      emptyOutDir: false,
      minify: true,
      sourcemap: false,
      copyPublicDir: false,
    },
  })
}
