import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearLibraryCache, loadLibrary } from './libraries'

function respond(body: string, status = 200) {
  return Promise.resolve(new Response(body, { status }))
}

describe('loadLibrary', () => {
  beforeEach(() => clearLibraryCache())

  it('returns the library source text', async () => {
    const fetcher = vi.fn(() => respond('window.paper = {};'))
    await expect(loadLibrary('/lib.js', fetcher)).resolves.toBe('window.paper = {};')
  })

  it('fetches each library once', async () => {
    const fetcher = vi.fn(() => respond('src'))
    await loadLibrary('/lib.js', fetcher)
    await loadLibrary('/lib.js', fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('rejects on an HTTP error and retries on the next call', async () => {
    const fetcher = vi.fn().mockReturnValueOnce(respond('', 404)).mockReturnValueOnce(respond('src'))
    await expect(loadLibrary('/lib.js', fetcher)).rejects.toThrow('HTTP 404')
    await expect(loadLibrary('/lib.js', fetcher)).resolves.toBe('src')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
