import { describe, expect, it } from 'vitest'
import { THEME_NAMES, parseOverride, resolveTheme } from './theme'

describe('resolveTheme', () => {
  it('follows the system when there is no override', () => {
    expect(resolveTheme(null, true)).toBe('light')
    expect(resolveTheme(null, false)).toBe('dark')
  })

  it('lets an override win over the system setting', () => {
    expect(resolveTheme('dark', true)).toBe('dark')
    expect(resolveTheme('light', false)).toBe('light')
  })
})

describe('parseOverride', () => {
  it('accepts known themes', () => {
    expect(parseOverride('dark')).toBe('dark')
    expect(parseOverride('light')).toBe('light')
  })

  it('ignores missing or unknown values', () => {
    expect(parseOverride(undefined)).toBeNull()
    expect(parseOverride(null)).toBeNull()
    expect(parseOverride('')).toBeNull()
    expect(parseOverride('solarized')).toBeNull()
  })
})

describe('THEME_NAMES', () => {
  it('names both Tokyo Night variants', () => {
    expect(THEME_NAMES).toEqual({ dark: 'Tokyo Night', light: 'Tokyo Night Day' })
  })
})
