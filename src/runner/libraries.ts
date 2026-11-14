// The minified full build: it includes the PaperScript compiler and is half the size.
import paperUrl from 'paper/dist/paper-full.min.js?url'
// A modern parser for PaperScript. Paper.js bundles an ES5-only acorn, but
// uses `self.acorn` instead when it is version 8 or later.
// The UMD build defines self.acorn; the package exports field hides it, hence the path.
import acornUrl from '../../node_modules/acorn/dist/acorn.js?url'

/** The pinned Paper.js version, shown in the library chip. */
export const PAPER_VERSION = '0.17.0'

/** The pinned acorn version that parses PaperScript. */
export const ACORN_VERSION = '8.19.0'
export const ACORN_URL = acornUrl

/** Library source URLs, emitted into dist/assets and precached by the service worker. */
export const PAPER_URL = paperUrl

const cache = new Map<string, Promise<string>>()

/**
 * Fetches a library's source text. The app page is controlled by the service
 * worker, so this works offline; the sandboxed runner gets the text inlined.
 */
export function loadLibrary(url: string, fetcher: typeof fetch = fetch): Promise<string> {
  let pending = cache.get(url)
  if (!pending) {
    pending = fetcher(url).then((response) => {
      if (!response.ok) throw new Error(`Could not load ${url} (HTTP ${response.status})`)
      return response.text()
    })
    // Retry on the next run instead of caching the failure.
    pending.catch(() => cache.delete(url))
    cache.set(url, pending)
  }
  return pending
}

/** For tests. */
export function clearLibraryCache(): void {
  cache.clear()
}
