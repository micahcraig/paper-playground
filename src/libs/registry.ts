import type { SketchMode } from '../runner/protocol'

export type LibraryId = 'paper' | 'p5' | 'three' | 'd3'

export interface Library {
  id: LibraryId
  name: string
  /** Pinned version; must match package.json (checked by a unit test). */
  version: string
  /** The global the sketch uses. */
  global: string
  description: string
  /** How the runner gets it as a classic script. */
  loading: string
}

/** Every library a project can load, in the order they are inlined. */
export const LIBRARIES: Library[] = [
  {
    id: 'paper',
    name: 'Paper.js',
    version: '0.17.0',
    global: 'paper',
    description: 'Vector graphics on a canvas; required by PaperScript',
    loading: 'paper/dist/paper-full.min.js (includes the PaperScript compiler)',
  },
  {
    id: 'p5',
    name: 'p5.js',
    version: '2.3.4',
    global: 'p5',
    description: 'Creative coding with setup() and draw()',
    loading: 'p5/lib/p5.min.js (UMD; global mode)',
  },
  {
    id: 'three',
    name: 'Three.js',
    version: '0.186.1',
    global: 'THREE',
    description: '3D scenes with WebGL',
    loading: 'three bundled to an IIFE by scripts/vendor.mjs (three ships ES modules only)',
  },
  {
    id: 'd3',
    name: 'd3',
    version: '7.9.0',
    global: 'd3',
    description: 'Data-driven SVG and charts',
    loading: 'd3/dist/d3.min.js (UMD)',
  },
]

const ORDER = new Map(LIBRARIES.map((library, index) => [library.id, index]))

export const isLibraryId = (id: string): id is LibraryId => ORDER.has(id as LibraryId)

export function getLibrary(id: LibraryId): Library {
  return LIBRARIES[ORDER.get(id)!]
}

/**
 * Known ids only, without duplicates, in registry order. PaperScript always
 * loads Paper.js, since its compiler lives there.
 */
export function normalizeLibraries(ids: readonly string[], mode: SketchMode): LibraryId[] {
  const set = new Set(ids.filter(isLibraryId))
  if (mode === 'paperscript') set.add('paper')
  return [...set].sort((a, b) => ORDER.get(a)! - ORDER.get(b)!)
}

/** Adds or removes one library, keeping the list normalized. */
export function toggleLibrary(ids: readonly string[], id: LibraryId, mode: SketchMode): LibraryId[] {
  const next = ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id]
  return normalizeLibraries(next, mode)
}

/** "paper 0.17.0 · p5 2.3.4" for the library chip. */
export function libraryLabel(ids: readonly LibraryId[]): string {
  if (ids.length === 0) return 'no libraries'
  return ids.map((id) => `${id} ${getLibrary(id).version}`).join(' · ')
}
