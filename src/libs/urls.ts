// Asset URLs for each library's classic-script build. Kept apart from the
// registry so unit tests can import the registry without the generated bundle.
// p5 and d3 hide these files behind their package "exports", hence the paths.
import d3Url from '../../node_modules/d3/dist/d3.min.js?url'
import p5Url from '../../node_modules/p5/lib/p5.min.js?url'
import threeUrl from '../vendor/generated/three.global.js?url'
import { PAPER_URL } from '../runner/libraries'
import type { LibraryId } from './registry'

export const LIBRARY_URLS: Record<LibraryId, string> = {
  paper: PAPER_URL,
  p5: p5Url,
  three: threeUrl,
  d3: d3Url,
}
