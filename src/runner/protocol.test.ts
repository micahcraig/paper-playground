import { describe, expect, it } from 'vitest'
import { isRunnerMessage } from './protocol'

describe('isRunnerMessage', () => {
  it('accepts each message type', () => {
    expect(isRunnerMessage({ type: 'ready', runId: 'r' })).toBe(true)
    expect(isRunnerMessage({ type: 'ran', runId: 'r' })).toBe(true)
    expect(isRunnerMessage({ type: 'log', runId: 'r', level: 'warn', args: ['a', 'b'] })).toBe(true)
    expect(
      isRunnerMessage({ type: 'error', runId: 'r', message: 'boom', line: 3, column: null, stack: null }),
    ).toBe(true)
  })

  it('rejects messages without a run id', () => {
    expect(isRunnerMessage({ type: 'ready' })).toBe(false)
    expect(isRunnerMessage({ type: 'ready', runId: 7 })).toBe(false)
  })

  it('rejects unknown types and non-objects', () => {
    expect(isRunnerMessage({ type: 'run', runId: 'r' })).toBe(false)
    expect(isRunnerMessage(null)).toBe(false)
    expect(isRunnerMessage('ready')).toBe(false)
  })

  it('rejects malformed log messages', () => {
    expect(isRunnerMessage({ type: 'log', runId: 'r', level: 'shout', args: [] })).toBe(false)
    expect(isRunnerMessage({ type: 'log', runId: 'r', level: 'log', args: [1] })).toBe(false)
    expect(isRunnerMessage({ type: 'log', runId: 'r', level: 'log' })).toBe(false)
  })

  it('rejects malformed error messages', () => {
    const base = { type: 'error', runId: 'r', message: 'boom', line: null, column: null, stack: null }
    expect(isRunnerMessage({ ...base, message: undefined })).toBe(false)
    expect(isRunnerMessage({ ...base, line: '3' })).toBe(false)
    expect(isRunnerMessage({ ...base, column: Number.NaN })).toBe(false)
    expect(isRunnerMessage({ ...base, stack: 42 })).toBe(false)
  })
})
