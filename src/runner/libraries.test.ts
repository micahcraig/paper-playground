import { beforeEach, describe, expect, it, vi } from 'vitest'
import paperPackage from '../../node_modules/paper/package.json?raw'
import acornPackage from '../../node_modules/acorn/package.json?raw'
import { ACORN_VERSION, clearLibraryCache, loadLibrary, PAPER_VERSION } from './libraries'

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

describe('PAPER_VERSION', () => {
  it('matches the installed paper package', () => {
    const pkg = JSON.parse(paperPackage) as { version: string }
    expect(PAPER_VERSION).toBe(pkg.version)
  })
})

describe('ACORN_VERSION', () => {
  it('matches the installed acorn package, and is new enough for Paper.js to use', () => {
    const pkg = JSON.parse(acornPackage) as { version: string }
    expect(ACORN_VERSION).toBe(pkg.version)
    expect(Number.parseInt(ACORN_VERSION, 10)).toBeGreaterThanOrEqual(8)
  })
})
