export interface Debounced {
  (): void
  /** Drops a call that is waiting to fire. */
  cancel(): void
  /** True while a call is waiting to fire. */
  readonly pending: boolean
}

/** Calls `fn` once, `delayMs` after the last call in a burst. */
export function debounce(fn: () => void, delayMs: number): Debounced {
  let timer: ReturnType<typeof setTimeout> | null = null
  const debounced = (() => {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn()
    }, delayMs)
  }) as Debounced
  debounced.cancel = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  Object.defineProperty(debounced, 'pending', { get: () => timer !== null })
  return debounced
}
