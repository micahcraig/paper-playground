/** The part of Storage that per-device settings use; tests pass an in-memory one. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** localStorage, or null where reading it throws (blocked site data). */
export function safeStorage(): StorageLike | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
