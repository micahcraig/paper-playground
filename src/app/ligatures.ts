import { useEffect, useState } from 'preact/hooks'
import { safeStorage, type StorageLike } from './localSettings'

/** localStorage key for the code ligatures choice; absent means off. */
export const LIGATURES_STORAGE_KEY = 'paper-playground:ligatures'

export function readStoredLigatures(storage: StorageLike | null = safeStorage()): boolean {
  try {
    return storage?.getItem(LIGATURES_STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

/**
 * Saves the choice and applies it through data-ligatures on <html>, which
 * app.css turns into --code-ligatures for the editor and console. The symbol
 * keys ignore it: they always show the characters they type.
 */
export function setLigatures(
  on: boolean,
  storage: StorageLike | null = safeStorage(),
  root: HTMLElement = document.documentElement,
): void {
  try {
    if (on) storage?.setItem(LIGATURES_STORAGE_KEY, 'on')
    else storage?.removeItem(LIGATURES_STORAGE_KEY)
  } catch {
    // Storage can be unavailable; the choice still applies for this visit.
  }
  if (on) root.dataset.ligatures = 'on'
  else delete root.dataset.ligatures
}

/** Whether code ligatures are on, kept in sync with the data-ligatures attribute. */
export function useLigatures(): boolean {
  const read = () => document.documentElement.dataset.ligatures === 'on'
  const [on, setOn] = useState(read)
  useEffect(() => {
    const observer = new MutationObserver(() => setOn(read()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ligatures'] })
    return () => observer.disconnect()
  }, [])
  return on
}
