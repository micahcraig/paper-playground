import { useEffect, useState } from 'preact/hooks'

/** The two layouts switch at this width (UI spec in PLAN.md). */
export const WIDE_QUERY = '(min-width: 600px)'

/** Whether the viewport is short, as on a folded phone turned sideways (about 844 x 390). */
export const SHORT_QUERY = '(max-height: 479px)'

/** The floating preview's side at the Pixel Fold's folded width (390 px), and its largest. */
export const THUMB_MIN = 152
export const THUMB_MAX = 200

/**
 * Side of the floating preview in the narrow layout, in CSS px: 152 on the
 * Pixel Fold, growing with the width on wider narrow screens (tall flip
 * phones, the iPhone Fold folded) and never below 152 on narrow covers.
 */
export function thumbSize(viewportWidth: number): number {
  return Math.min(THUMB_MAX, Math.max(THUMB_MIN, Math.round(viewportWidth * 0.39)))
}

/** Height of the preview toolbar, in CSS px. */
export const PREVIEW_TOOLBAR = 44

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])
  return matches
}

export interface ViewportMetrics {
  /** Layout viewport size. */
  width: number
  height: number
  /** Space the on-screen keyboard covers at the bottom of the layout viewport. */
  keyboardInset: number
}

interface VisualViewportLike {
  height: number
  offsetTop: number
  scale: number
}

/**
 * How much of the layout viewport the on-screen keyboard hides. With
 * `interactive-widget=resizes-content` Chrome shrinks the layout viewport
 * instead, and this is 0; it covers browsers that only shrink the visual one.
 * A pinch zoom also shrinks the visual viewport, so a zoomed view reports 0.
 */
export function keyboardInset(layoutHeight: number, visual: VisualViewportLike | null | undefined): number {
  if (!visual || visual.scale > 1.01) return 0
  return Math.max(0, Math.round(layoutHeight - visual.height - visual.offsetTop))
}

export function readViewport(): ViewportMetrics {
  return {
    width: document.documentElement.clientWidth,
    height: window.innerHeight,
    keyboardInset: keyboardInset(window.innerHeight, window.visualViewport),
  }
}

/** Layout viewport size and keyboard inset, updated as they change. */
export function useViewport(): ViewportMetrics {
  const [metrics, setMetrics] = useState(readViewport)
  useEffect(() => {
    const update = () => {
      const next = readViewport()
      setMetrics((prev) =>
        prev.width === next.width && prev.height === next.height && prev.keyboardInset === next.keyboardInset
          ? prev
          : next,
      )
    }
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    return () => {
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
    }
  }, [])
  return metrics
}

export interface ThumbTransform {
  scale: number
  x: number
  y: number
}

/**
 * Scales a `width` x `height` sketch down to cover a square `box`, centred,
 * so the floating preview shows the same picture as the full preview.
 */
export function thumbTransform(box: number, width: number, height: number): ThumbTransform {
  if (width <= 0 || height <= 0) return { scale: 1, x: 0, y: 0 }
  const scale = Math.max(box / width, box / height)
  return { scale, x: (box - width * scale) / 2, y: (box - height * scale) / 2 }
}

/* Fold postures (Viewport Segments API, Chrome 138+; Safari has none). */

export interface SegmentRect {
  x: number
  y: number
  width: number
  height: number
}

export type FoldLayout =
  | { kind: 'flat' }
  /**
   * Half-open like a book (segments side by side), or half-folded like a
   * laptop (stacked). `first` is where the first segment ends and `gap` the
   * hinge width, in CSS px from the left or top of the viewport.
   */
  | { kind: 'book' | 'tabletop'; first: number; gap: number }

export const FLAT: FoldLayout = { kind: 'flat' }

/** Reads the viewport segments: two side by side is book posture, two stacked is tabletop. */
export function foldLayout(segments: readonly SegmentRect[] | null | undefined): FoldLayout {
  if (!segments || segments.length !== 2) return FLAT
  const [a, b] = [...segments].sort((p, q) => p.y - q.y || p.x - q.x)
  const near = (p: number, q: number) => Math.abs(p - q) < 1
  if (near(a.y, b.y) && b.x > a.x) {
    return { kind: 'book', first: a.x + a.width, gap: Math.max(0, b.x - (a.x + a.width)) }
  }
  if (near(a.x, b.x) && b.y > a.y) {
    return { kind: 'tabletop', first: a.y + a.height, gap: Math.max(0, b.y - (a.y + a.height)) }
  }
  return FLAT
}

/**
 * Opening the keyboard in tabletop shrinks the viewport, and Chrome may then
 * report one segment. While the device still says it is folded and only the
 * height shrank, keep the tabletop layout so the preview stays on top.
 */
export function holdTabletop(
  previous: FoldLayout,
  next: FoldLayout,
  posture: string | null | undefined,
  previousSize: { width: number; height: number },
  nextSize: { width: number; height: number },
): FoldLayout {
  if (next.kind !== 'flat' || previous.kind !== 'tabletop' || posture !== 'folded') return next
  return nextSize.width === previousSize.width && nextSize.height < previousSize.height ? previous : next
}

interface FoldWindow {
  viewport?: { segments?: readonly SegmentRect[] | null }
}

interface DevicePostureLike extends EventTarget {
  type: string
}

const SEGMENT_QUERIES = ['(horizontal-viewport-segments: 2)', '(vertical-viewport-segments: 2)']

/** The current fold posture, updated as the phone folds, unfolds or rotates. */
export function useFoldLayout(): FoldLayout {
  const read = () => foldLayout((window as FoldWindow).viewport?.segments)
  const [layout, setLayout] = useState<FoldLayout>(read)
  useEffect(() => {
    let current = read()
    let size = { width: window.innerWidth, height: window.innerHeight }
    const posture = (navigator as { devicePosture?: DevicePostureLike }).devicePosture
    const update = () => {
      const nextSize = { width: window.innerWidth, height: window.innerHeight }
      const next = holdTabletop(current, read(), posture?.type, size, nextSize)
      size = nextSize
      const same =
        next.kind === current.kind &&
        (next.kind === 'flat' || (current.kind !== 'flat' && next.first === current.first && next.gap === current.gap))
      current = next
      if (!same) setLayout(next)
    }
    update()
    // Folding changes the segments without resizing the viewport, so listen
    // to the segment media queries as well as resize.
    const queries = SEGMENT_QUERIES.map((query) => window.matchMedia(query))
    queries.forEach((query) => query.addEventListener('change', update))
    window.addEventListener('resize', update)
    posture?.addEventListener('change', update)
    return () => {
      queries.forEach((query) => query.removeEventListener('change', update))
      window.removeEventListener('resize', update)
      posture?.removeEventListener('change', update)
    }
  }, [])
  return layout
}
