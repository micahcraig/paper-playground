import { describe, expect, it } from 'vitest'
import { keyboardInset, thumbSize, thumbTransform } from './layout'

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
