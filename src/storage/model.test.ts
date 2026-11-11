import { describe, expect, it } from 'vitest'
import {
  exportFileName,
  exportProject,
  makeProject,
  moveFile,
  parseProjectExport,
  uniqueFileName,
  uniqueName,
  validateFileName,
  validateProjectName,
} from './model'

const sample = () =>
  makeProject({
    name: 'My Waves!',
    mode: 'paperscript',
    files: [
      { name: 'a.js', code: 'var x = 1;' },
      { name: 'b.ts', code: 'let y: number = 2;' },
      { name: 'c.js', code: '// c' },
    ],
  }, 5)

describe('validateFileName', () => {
  it('accepts .js and .ts names and adds .js when there is no extension', () => {
    expect(validateFileName('palette.ts', [])).toEqual({ ok: true, name: 'palette.ts' })
    expect(validateFileName('  shapes ', [])).toEqual({ ok: true, name: 'shapes.js' })
  })

  it('rejects empty, unsupported, oddly named and duplicate files', () => {
    expect(validateFileName('   ', []).ok).toBe(false)
    expect(validateFileName('notes.txt', []).ok).toBe(false)
    expect(validateFileName('my file.js', []).ok).toBe(false)
    expect(validateFileName('A.JS', ['a.js'])).toEqual({ ok: false, error: 'There is already a file called A.JS.' })
    expect(validateFileName(`${'x'.repeat(40)}.js`, []).ok).toBe(false)
  })
})

describe('validateProjectName', () => {
  it('trims and collapses spaces', () => {
    expect(validateProjectName('  rainy   day ')).toEqual({ ok: true, name: 'rainy day' })
    expect(validateProjectName(' ').ok).toBe(false)
  })
})

describe('unique names', () => {
  it('numbers project names', () => {
    expect(uniqueName('ripple', [])).toBe('ripple')
    expect(uniqueName('ripple', ['Ripple', 'ripple 2'])).toBe('ripple 3')
  })

  it('numbers file names before the extension', () => {
    expect(uniqueFileName('sketch.js', ['sketch.js'])).toBe('sketch-2.js')
    expect(uniqueFileName('sketch.js', ['other.js'])).toBe('sketch.js')
  })
})

describe('moveFile', () => {
  it('swaps a file with its neighbour and ignores moves off the end', () => {
    const { files } = sample()
    expect(moveFile(files, files[1].id, -1).map((f) => f.name)).toEqual(['b.ts', 'a.js', 'c.js'])
    expect(moveFile(files, files[1].id, 1).map((f) => f.name)).toEqual(['a.js', 'c.js', 'b.ts'])
    expect(moveFile(files, files[0].id, -1)).toBe(files)
  })
})

describe('export and import', () => {
  it('round-trips a project without ids or timestamps', () => {
    const project = sample()
    const text = JSON.stringify(exportProject(project))
    expect(text).not.toContain(project.id)
    expect(parseProjectExport(text)).toEqual({
      format: 'paper-playground-project',
      version: 1,
      name: 'My Waves!',
      mode: 'paperscript',
      libraries: ['paper'],
      files: project.files.map(({ name, code }) => ({ name, code })),
    })
  })

  it('names the download after the project', () => {
    expect(exportFileName(sample())).toBe('my-waves.paper-playground.json')
  })

  it('rejects files that are not projects', () => {
    const valid = exportProject(sample())
    const bad = (change: object) => JSON.stringify({ ...valid, ...change })
    expect(() => parseProjectExport('not json')).toThrow('not JSON')
    expect(() => parseProjectExport('{"hello":1}')).toThrow('not a Paper Playground project')
    expect(() => parseProjectExport(bad({ version: 9 }))).toThrow('Unsupported project version')
    expect(() => parseProjectExport(bad({ mode: 'ruby' }))).toThrow('unknown language')
    expect(() => parseProjectExport(bad({ files: [] }))).toThrow('no files')
    expect(() => parseProjectExport(bad({ files: [{ name: 'a.js' }] }))).toThrow('malformed')
    expect(() => parseProjectExport(bad({ files: [{ name: 'a.js', code: '' }, { name: 'A.js', code: '' }] }))).toThrow('Bad file name')
    expect(() => parseProjectExport(bad({ files: [{ name: 'evil', code: '' }] }))).toThrow('Bad file name')
  })

  it('defaults missing libraries to paper', () => {
    const { libraries: _, ...rest } = exportProject(sample())
    expect(parseProjectExport(JSON.stringify(rest)).libraries).toEqual(['paper'])
  })
})
