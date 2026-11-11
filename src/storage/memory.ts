import type { KeyValue } from './store'

/** An in-memory KeyValue for tests; values are cloned like IndexedDB does. */
export function memoryKeyValue(): KeyValue & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>()
  return {
    data,
    get: async <T>(key: string) => (data.has(key) ? (structuredClone(data.get(key)) as T) : undefined),
    set: async (key, value) => void data.set(key, structuredClone(value)),
    del: async (key) => void data.delete(key),
    entries: async <T>() => [...data.entries()].map(([key, value]) => [key, structuredClone(value) as T] as [string, T]),
  }
}
