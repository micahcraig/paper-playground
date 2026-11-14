import { describe, expect, it } from 'vitest'
import d3Package from '../../node_modules/d3/package.json?raw'
import p5Package from '../../node_modules/p5/package.json?raw'
import paperPackage from '../../node_modules/paper/package.json?raw'
import threePackage from '../../node_modules/three/package.json?raw'
import appPackage from '../../package.json?raw'
import { LIBRARIES, libraryLabel, normalizeLibraries, toggleLibrary } from './registry'

const installed: Record<string, string> = {
  paper: paperPackage,
  p5: p5Package,
  three: threePackage,
  d3: d3Package,
}

describe('LIBRARIES', () => {
  it('lists paper, p5, three and d3', () => {
    expect(LIBRARIES.map((library) => library.id)).toEqual(['paper', 'p5', 'three', 'd3'])
  })

  it('pins each version exactly as installed and in package.json', () => {
    const dependencies = (JSON.parse(appPackage) as { dependencies: Record<string, string> }).dependencies
    for (const library of LIBRARIES) {
      expect(dependencies[library.id], library.id).toBe(library.version)
      expect((JSON.parse(installed[library.id]) as { version: string }).version, library.id).toBe(library.version)
    }
  })
})

describe('normalizeLibraries', () => {
  it('drops unknown ids and duplicates and sorts in registry order', () => {
    expect(normalizeLibraries(['d3', 'jquery', 'p5', 'd3'], 'javascript')).toEqual(['p5', 'd3'])
  })

  it('always includes Paper.js for PaperScript', () => {
    expect(normalizeLibraries(['three'], 'paperscript')).toEqual(['paper', 'three'])
    expect(normalizeLibraries([], 'javascript')).toEqual([])
  })
})

describe('toggleLibrary', () => {
  it('adds and removes a library', () => {
    expect(toggleLibrary(['paper'], 'p5', 'javascript')).toEqual(['paper', 'p5'])
    expect(toggleLibrary(['paper', 'p5'], 'paper', 'javascript')).toEqual(['p5'])
  })

  it('cannot remove Paper.js from a PaperScript project', () => {
    expect(toggleLibrary(['paper'], 'paper', 'paperscript')).toEqual(['paper'])
  })
})

describe('libraryLabel', () => {
  it('names each library with its version', () => {
    expect(libraryLabel(['paper', 'p5'])).toBe('paper 0.17.0 · p5 2.3.4')
    expect(libraryLabel([])).toBe('no libraries')
  })
})
