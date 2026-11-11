import { useEffect, useState } from 'preact/hooks'

/** The two layouts switch at this width (UI spec in PLAN.md). */
export const WIDE_QUERY = '(min-width: 600px)'

/** Side of the floating preview in the narrow layout, in CSS px. */
export const THUMB_SIZE = 152

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
