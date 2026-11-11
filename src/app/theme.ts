import { useEffect, useState } from 'preact/hooks'

export type Theme = 'dark' | 'light'
export type ThemeOverride = Theme | null

export const THEME_NAMES: Record<Theme, string> = {
  dark: 'Tokyo Night',
  light: 'Tokyo Night Day',
}

/** Browser chrome colour (the panel token) for each theme. */
export const THEME_COLORS: Record<Theme, string> = {
  dark: '#16161e',
  light: '#d0d5e3',
}

/** An explicit override wins; otherwise follow the system setting. */
export function resolveTheme(override: ThemeOverride, systemPrefersLight: boolean): Theme {
  if (override) return override
  return systemPrefersLight ? 'light' : 'dark'
}

/** Reads a data-theme attribute value, ignoring anything that is not a known theme. */
export function parseOverride(value: string | null | undefined): ThemeOverride {
  return value === 'dark' || value === 'light' ? value : null
}

const LIGHT_QUERY = '(prefers-color-scheme: light)'

/** The active theme, kept in sync with the system setting and the data-theme override. */
export function useTheme(): Theme {
  const read = () =>
    resolveTheme(
      parseOverride(document.documentElement.dataset.theme),
      window.matchMedia(LIGHT_QUERY).matches,
    )
  const [theme, setTheme] = useState<Theme>(read)

  useEffect(() => {
    const media = window.matchMedia(LIGHT_QUERY)
    const update = () => setTheme(read())
    media.addEventListener('change', update)
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      media.removeEventListener('change', update)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
  }, [theme])

  return theme
}

/** localStorage key for the theme the user picked; absent means follow the system. */
export const THEME_STORAGE_KEY = 'paper-playground:theme'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function safeStorage(): StorageLike | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readStoredOverride(storage: StorageLike | null = safeStorage()): ThemeOverride {
  try {
    return parseOverride(storage?.getItem(THEME_STORAGE_KEY))
  } catch {
    return null
  }
}

/** Saves the choice and applies it through the data-theme attribute. */
export function setThemeOverride(
  override: ThemeOverride,
  storage: StorageLike | null = safeStorage(),
  root: HTMLElement = document.documentElement,
): void {
  try {
    if (override) storage?.setItem(THEME_STORAGE_KEY, override)
    else storage?.removeItem(THEME_STORAGE_KEY)
  } catch {
    // Storage can be unavailable; the choice still applies for this visit.
  }
  if (override) root.dataset.theme = override
  else delete root.dataset.theme
}

/** The current override, kept in sync with the data-theme attribute. */
export function useThemeOverride(): ThemeOverride {
  const read = () => parseOverride(document.documentElement.dataset.theme)
  const [override, setOverride] = useState<ThemeOverride>(read)
  useEffect(() => {
    const observer = new MutationObserver(() => setOverride(read()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  return override
}
