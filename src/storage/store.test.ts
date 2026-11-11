import { describe, expect, it } from 'vitest'
import { memoryKeyValue } from './memory'
import { ProjectStore, RESCUE_KEY, rescueProject, restoreRescued } from './store'

describe('ProjectStore', () => {
  it('creates the starter project on first launch and reopens it', async () => {
    const kv = memoryKeyValue()
    const first = await new ProjectStore(kv).openInitial()
    expect(first.name).toBe('ripple')
    expect(first.files.map((f) => f.name)).toEqual(['ripple.js', 'palette.js'])
    expect(first.activeFileId).toBe(first.files[0].id)

    const again = await new ProjectStore(kv).openInitial()
    expect(again).toEqual(first)
    expect(await new ProjectStore(kv).list()).toHaveLength(1)
  })

  it('reopens the last project opened', async () => {
    const store = new ProjectStore(memoryKeyValue())
    await store.openInitial()
    const other = await store.createFromTemplate('blank-javascript')
    await store.setLastOpened(other.id)
    expect((await store.openInitial()).id).toBe(other.id)
  })

  it('falls back to the most recent project when the last one was deleted', async () => {
    const store = new ProjectStore(memoryKeyValue())
    const a = await store.createFromTemplate('ripple', 1000)
    const b = await store.createFromTemplate('blank-paperscript', 2000)
    await store.setLastOpened(a.id)
    await store.delete(a.id)
    expect((await store.openInitial()).id).toBe(b.id)
  })

  it('saves changes and lists most recent first', async () => {
    const store = new ProjectStore(memoryKeyValue())
    const a = await store.createFromTemplate('ripple', 1000)
    const b = await store.createFromTemplate('blank-paperscript', 2000)
    await store.save({ ...a, name: 'waves', updatedAt: 3000, files: [...a.files, { id: 'x', name: 'extra.ts', code: 'let n: number = 1' }] })
    const list = await store.list()
    expect(list.map((p) => p.name)).toEqual(['waves', b.name])
    expect(list[0].fileCount).toBe(3)
    expect((await store.get(a.id))?.files[2].code).toBe('let n: number = 1')
  })

  it('gives new and imported projects free names', async () => {
    const store = new ProjectStore(memoryKeyValue())
    await store.createFromTemplate('ripple')
    expect((await store.createFromTemplate('ripple')).name).toBe('ripple 2')
    const imported = await store.importProject({ name: 'ripple', mode: 'paperscript', libraries: ['paper'], files: [{ name: 'a.js', code: '' }] })
    expect(imported.name).toBe('ripple 3')
  })

  it('deletes a project', async () => {
    const store = new ProjectStore(memoryKeyValue())
    const a = await store.createFromTemplate('ripple')
    await store.delete(a.id)
    expect(await store.get(a.id)).toBeUndefined()
    expect(await store.list()).toEqual([])
  })
})

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  }
}

describe('rescue copy', () => {
  it('restores a project newer than the saved one and clears the slot', async () => {
    const store = new ProjectStore(memoryKeyValue())
    const saved = await store.createFromTemplate('ripple', 1000)
    const storage = memoryStorage()
    rescueProject({ ...saved, name: 'renamed', updatedAt: 2000 }, storage)
    await restoreRescued(store, storage)
    expect((await store.get(saved.id))?.name).toBe('renamed')
    expect(storage.data.has(RESCUE_KEY)).toBe(false)
  })

  it('keeps the saved project when it is newer', async () => {
    const store = new ProjectStore(memoryKeyValue())
    const saved = await store.createFromTemplate('ripple', 3000)
    const storage = memoryStorage()
    rescueProject({ ...saved, name: 'old', updatedAt: 2000 }, storage)
    await restoreRescued(store, storage)
    expect((await store.get(saved.id))?.name).toBe('ripple')
  })

  it('drops a damaged rescue copy', async () => {
    const store = new ProjectStore(memoryKeyValue())
    const storage = memoryStorage()
    storage.setItem(RESCUE_KEY, '{not json')
    await restoreRescued(store, storage)
    expect(storage.data.has(RESCUE_KEY)).toBe(false)
    expect(await store.list()).toEqual([])
  })
})
