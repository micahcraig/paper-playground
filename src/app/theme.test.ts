import { describe, expect, it } from 'vitest'
import { THEME_NAMES, THEME_STORAGE_KEY, parseOverride, readStoredOverride, resolveTheme, setThemeOverride } from './theme'

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

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  }
}

describe('stored theme override', () => {
  it('reads a saved theme and ignores anything else', () => {
    expect(readStoredOverride(memoryStorage({ [THEME_STORAGE_KEY]: 'light' }))).toBe('light')
    expect(readStoredOverride(memoryStorage({ [THEME_STORAGE_KEY]: 'neon' }))).toBeNull()
    expect(readStoredOverride(memoryStorage())).toBeNull()
    expect(readStoredOverride(null)).toBeNull()
  })

  it('survives storage that throws', () => {
    const broken = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') }, removeItem: () => {} }
    expect(readStoredOverride(broken)).toBeNull()
    const root = { dataset: {} as Record<string, string> } as unknown as HTMLElement
    expect(() => setThemeOverride('dark', broken, root)).not.toThrow()
    expect(root.dataset.theme).toBe('dark')
  })

  it('saves and applies a choice, and clears it to follow the system', () => {
    const storage = memoryStorage()
    const root = { dataset: {} as Record<string, string> } as unknown as HTMLElement
    setThemeOverride('light', storage, root)
    expect(storage.data.get(THEME_STORAGE_KEY)).toBe('light')
    expect(root.dataset.theme).toBe('light')
    setThemeOverride(null, storage, root)
    expect(storage.data.has(THEME_STORAGE_KEY)).toBe(false)
    expect(root.dataset.theme).toBeUndefined()
  })
})
