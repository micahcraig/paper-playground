import { describe, expect, it } from 'vitest'
import { SYMBOL_KEYS } from './symbols'

describe('SYMBOL_KEYS', () => {
  it('has the keys from the UI spec, in order', () => {
    expect(SYMBOL_KEYS.map((key) => key.label)).toEqual([
      'Tab', '←', '→', '{', '}', '(', ')', '[', ']', ';', '=', '"', '=>', 'Undo', 'Redo',
    ])
  })

  it('gives every key a distinct accessible name', () => {
    const names = SYMBOL_KEYS.map((key) => key.ariaLabel)
    expect(new Set(names).size).toBe(names.length)
    expect(names.every((name) => name.trim().length > 0)).toBe(true)
  })

  it('inserts each symbol as typed', () => {
    for (const key of SYMBOL_KEYS.filter((k) => k.action.kind === 'insert')) {
      expect(key.action).toEqual({ kind: 'insert', text: key.label })
    }
  })

  it('keeps undo and redo apart from the typing keys', () => {
    expect(SYMBOL_KEYS.filter((key) => key.group === 'history').map((key) => key.label)).toEqual(['Undo', 'Redo'])
  })
})
