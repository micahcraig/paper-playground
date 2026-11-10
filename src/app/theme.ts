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
