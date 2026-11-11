import { describe, expect, it } from 'vitest'
import { MAX_ENTRIES, appendEntry, entryFromEvent, type ConsoleEntry } from './console'

describe('entryFromEvent', () => {
  it('hides ready events', () => {
    expect(entryFromEvent({ type: 'ready', runId: 'r' })).toBeNull()
  })

  it('hides kept events; the preview shows its own notice', () => {
    expect(entryFromEvent({ type: 'kept', runId: 'r' })).toBeNull()
  })

  it('shows how long a run took', () => {
    expect(entryFromEvent({ type: 'ran', runId: 'r', elapsedMs: 38 })).toEqual({
      level: 'system',
      text: 'ran in 38 ms',
      location: '',
    })
  })

  it('joins console arguments with spaces', () => {
    expect(entryFromEvent({ type: 'log', runId: 'r', level: 'warn', args: ['rings:', '6'] })).toEqual({
      level: 'warn',
      text: 'rings: 6',
      location: '',
    })
  })

  it('shows errors with their location', () => {
    const entry = entryFromEvent({
      type: 'error',
      runId: 'r',
      message: 'ReferenceError: x is not defined',
      line: 40,
      column: 3,
      stack: null,
      location: { file: 'sketch.js', line: 4, column: 3 },
    })
    expect(entry).toEqual({ level: 'error', text: 'ReferenceError: x is not defined', location: 'sketch.js:4:3' })
  })
})

describe('appendEntry', () => {
  it('gives entries unique ids', () => {
    let list: ConsoleEntry[] = []
    list = appendEntry(list, { level: 'log', text: 'a', location: '' })
    list = appendEntry(list, { level: 'log', text: 'b', location: '' })
    expect(new Set(list.map((entry) => entry.id)).size).toBe(2)
  })

  it(`keeps only the last ${MAX_ENTRIES} entries`, () => {
    let list: ConsoleEntry[] = []
    for (let i = 0; i < MAX_ENTRIES + 5; i++) list = appendEntry(list, { level: 'log', text: String(i), location: '' })
    expect(list).toHaveLength(MAX_ENTRIES)
    expect(list[0].text).toBe('5')
    expect(list.at(-1)?.text).toBe(String(MAX_ENTRIES + 4))
  })
})
