import { describe, expect, it, vi } from 'vitest'
import { prepareFiles } from './typescript'

describe('prepareFiles', () => {
  it('passes JavaScript through without loading sucrase', async () => {
    const load = vi.fn()
    const files = [{ name: 'a.js', code: 'var a = 1;' }]
    expect(await prepareFiles(files, load)).toEqual({ ok: true, files })
    expect(load).not.toHaveBeenCalled()
  })

  it('strips types from .ts files and keeps their line numbers', async () => {
    const code = [
      'interface Ring { radius: number }',
      'const rings: Ring[] = [];',
      'function add(r: number): void {',
      '  rings.push({ radius: r } as Ring);',
      '}',
      'add(4);',
    ].join('\n')
    const result = await prepareFiles([{ name: 'a.js', code: 'var a;' }, { name: 'rings.ts', code }])
    if (!result.ok) throw new Error(result.error.message)
    expect(result.files[0]).toEqual({ name: 'a.js', code: 'var a;' })
    const out = result.files[1].code
    expect(out).not.toMatch(/interface|: number|: Ring|as Ring|: void/)
    expect(out.split('\n')).toHaveLength(6)
    expect(out.split('\n')[5]).toContain('add(4)')
    // Runs as plain JavaScript.
    expect(new Function(`${out}; return rings.length;`)()).toBe(1)
  })

  it('reports a TypeScript syntax error with its file and 1-based position', async () => {
    const result = await prepareFiles([{ name: 'bad.ts', code: 'let x: number = ;\n' }])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.file).toBe('bad.ts')
    expect(result.error.message).toMatch(/^SyntaxError: /)
    expect(result.error.line).toBe(1)
    expect(result.error.column).toBe(17)
  })
})
