import { describe, expect, it } from 'vitest'
import { settlePending } from './preview'

describe('settlePending', () => {
  it('shows a run that finished cleanly', () => {
    expect(settlePending('ran', true)).toBe('show')
    expect(settlePending('ran', false)).toBe('show')
  })

  it('keeps a good render when the new run fails', () => {
    expect(settlePending('error', true)).toBe('discard')
  })

  it('shows a failing run when nothing good is on screen', () => {
    expect(settlePending('error', false)).toBe('show')
  })

  it('waits on ready and logs', () => {
    expect(settlePending('ready', true)).toBe('wait')
    expect(settlePending('log', false)).toBe('wait')
  })
})
