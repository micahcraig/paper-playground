import { describe, expect, it } from 'vitest'
import { FLAT, foldLayout, holdTabletop, keyboardInset, thumbSize, thumbTransform } from './layout'

describe('keyboardInset', () => {
  it('is the part of the layout viewport the keyboard hides', () => {
    expect(keyboardInset(844, { height: 500, offsetTop: 0, scale: 1 })).toBe(344)
  })

  it('subtracts a scrolled visual viewport', () => {
    expect(keyboardInset(844, { height: 500, offsetTop: 40, scale: 1 })).toBe(304)
  })

  it('is 0 when the layout viewport already shrank for the keyboard', () => {
    expect(keyboardInset(500, { height: 500, offsetTop: 0, scale: 1 })).toBe(0)
  })

  it('ignores pinch zoom and missing visualViewport', () => {
    expect(keyboardInset(844, { height: 400, offsetTop: 0, scale: 2 })).toBe(0)
    expect(keyboardInset(844, null)).toBe(0)
  })

  it('never goes negative', () => {
    expect(keyboardInset(800, { height: 810, offsetTop: 0, scale: 1 })).toBe(0)
  })
})

describe('thumbTransform', () => {
  it('scales a tall sketch to the box width and centres it vertically', () => {
    const t = thumbTransform(152, 390, 760)
    expect(t.scale).toBeCloseTo(152 / 390)
    expect(t.x).toBeCloseTo(0)
    expect(t.y).toBeCloseTo((152 - 760 * (152 / 390)) / 2)
  })

  it('scales a wide sketch to the box height and centres it horizontally', () => {
    const t = thumbTransform(152, 800, 400)
    expect(t.scale).toBeCloseTo(152 / 400)
    expect(t.y).toBeCloseTo(0)
    expect(t.x).toBeCloseTo((152 - 800 * (152 / 400)) / 2)
  })

  it('leaves an unmeasured sketch alone', () => {
    expect(thumbTransform(152, 0, 0)).toEqual({ scale: 1, x: 0, y: 0 })
  })
})

describe('thumbSize', () => {
  it('is 152 px at the Pixel Fold folded width', () => {
    expect(thumbSize(390)).toBe(152)
  })

  it('never shrinks below 152 px on narrow cover screens', () => {
    expect(thumbSize(344)).toBe(152)
  })

  it('grows on wider narrow screens and stops at 200 px', () => {
    expect(thumbSize(412)).toBe(161)
    expect(thumbSize(466)).toBe(182)
    expect(thumbSize(599)).toBe(200)
  })
})

describe('foldLayout', () => {
  it('is flat without segments or with one', () => {
    expect(foldLayout(null)).toEqual(FLAT)
    expect(foldLayout(undefined)).toEqual(FLAT)
    expect(foldLayout([{ x: 0, y: 0, width: 840, height: 780 }])).toEqual(FLAT)
  })

  it('reads side-by-side segments as book posture, split at the hinge', () => {
    const segments = [
      { x: 0, y: 0, width: 420, height: 780 },
      { x: 420, y: 0, width: 420, height: 780 },
    ]
    expect(foldLayout(segments)).toEqual({ kind: 'book', first: 420, gap: 0 })
  })

  it('reads stacked segments as tabletop, with the hinge gap, in any order', () => {
    const segments = [
      { x: 0, y: 466, width: 412, height: 449 },
      { x: 0, y: 0, width: 412, height: 450 },
    ]
    expect(foldLayout(segments)).toEqual({ kind: 'tabletop', first: 450, gap: 16 })
  })

  it('ignores layouts it does not understand', () => {
    expect(foldLayout([{ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 20, width: 10, height: 10 }])).toEqual(FLAT)
    expect(foldLayout([{ x: 0, y: 0, width: 1, height: 1 }, { x: 1, y: 0, width: 1, height: 1 }, { x: 2, y: 0, width: 1, height: 1 }])).toEqual(FLAT)
  })
})

describe('holdTabletop', () => {
  const tabletop = { kind: 'tabletop', first: 450, gap: 16 } as const
  const tall = { width: 412, height: 915 }
  const keyboard = { width: 412, height: 600 }

  it('keeps tabletop while the keyboard shrinks the folded viewport', () => {
    expect(holdTabletop(tabletop, FLAT, 'folded', tall, keyboard)).toBe(tabletop)
  })

  it('goes flat once the device is flat again', () => {
    expect(holdTabletop(tabletop, FLAT, 'continuous', tall, keyboard)).toBe(FLAT)
  })

  it('goes flat without the Device Posture API', () => {
    expect(holdTabletop(tabletop, FLAT, undefined, tall, keyboard)).toBe(FLAT)
  })

  it('goes flat when the width changes, as on rotation', () => {
    expect(holdTabletop(tabletop, FLAT, 'folded', tall, { width: 915, height: 412 })).toBe(FLAT)
  })

  it('passes other changes through', () => {
    const book = { kind: 'book', first: 420, gap: 0 } as const
    expect(holdTabletop(FLAT, book, 'folded', tall, tall)).toBe(book)
    expect(holdTabletop(book, FLAT, 'folded', tall, keyboard)).toBe(FLAT)
  })
})
