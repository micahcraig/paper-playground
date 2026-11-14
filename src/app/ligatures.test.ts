import { describe, expect, it } from 'vitest'
import { LIGATURES_STORAGE_KEY, readStoredLigatures, setLigatures } from './ligatures'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  }
}

const fakeRoot = () => ({ dataset: {} as Record<string, string> }) as unknown as HTMLElement

describe('code ligatures setting', () => {
  it('is off unless "on" was saved', () => {
    expect(readStoredLigatures(memoryStorage({ [LIGATURES_STORAGE_KEY]: 'on' }))).toBe(true)
    expect(readStoredLigatures(memoryStorage({ [LIGATURES_STORAGE_KEY]: 'yes' }))).toBe(false)
    expect(readStoredLigatures(memoryStorage())).toBe(false)
    expect(readStoredLigatures(null)).toBe(false)
  })

  it('saves and applies the choice, and clears both when turned off', () => {
    const storage = memoryStorage()
    const root = fakeRoot()
    setLigatures(true, storage, root)
    expect(storage.data.get(LIGATURES_STORAGE_KEY)).toBe('on')
    expect(root.dataset.ligatures).toBe('on')
    setLigatures(false, storage, root)
    expect(storage.data.has(LIGATURES_STORAGE_KEY)).toBe(false)
    expect(root.dataset.ligatures).toBeUndefined()
  })

  it('survives storage that throws', () => {
    const broken = {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('denied') },
      removeItem: () => { throw new Error('denied') },
    }
    expect(readStoredLigatures(broken)).toBe(false)
    const root = fakeRoot()
    expect(() => setLigatures(true, broken, root)).not.toThrow()
    expect(root.dataset.ligatures).toBe('on')
  })
})
