import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { debounce } from './debounce'

describe('debounce', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('fires once, the delay after the last call', () => {
    const fn = vi.fn()
    const run = debounce(fn, 250)
    run()
    vi.advanceTimersByTime(200)
    run()
    vi.advanceTimersByTime(200)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(50)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('fires again for a later burst', () => {
    const fn = vi.fn()
    const run = debounce(fn, 250)
    run()
    vi.advanceTimersByTime(250)
    run()
    vi.advanceTimersByTime(250)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('cancel drops a waiting call', () => {
    const fn = vi.fn()
    const run = debounce(fn, 250)
    run()
    expect(run.pending).toBe(true)
    run.cancel()
    expect(run.pending).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(fn).not.toHaveBeenCalled()
  })

  it('is not pending after it fires', () => {
    const run = debounce(() => {}, 250)
    run()
    vi.advanceTimersByTime(250)
    expect(run.pending).toBe(false)
  })
})
