import { describe, expect, it } from 'vitest'
import { makeProject, type Project } from '../storage/model'
import { createSaver } from './saver'

function setup() {
  const project: Project = makeProject({ name: 'p', mode: 'paperscript', files: [{ name: 'a.js', code: '' }] })
  const writes: { project: Project; resolve: () => void; reject: () => void }[] = []
  const results: boolean[] = []
  const saver = createSaver(
    () => project,
    (p) => new Promise<void>((resolve, reject) => writes.push({ project: p, resolve, reject })),
    (failed) => results.push(failed),
  )
  return { project, saver, writes, results }
}

describe('createSaver', () => {
  it('writes only when there are unsaved changes', async () => {
    const { saver, writes } = setup()
    await saver.save()
    expect(writes).toHaveLength(0)
    saver.changed()
    void saver.save()
    expect(writes).toHaveLength(1)
  })

  it('counts a save that has not landed as unsaved', async () => {
    const { saver, writes, results } = setup()
    saver.changed()
    const saving = saver.save()
    // The page could unload here, so pagehide must still keep a rescue copy.
    expect(saver.unsaved).toBe(true)
    writes[0].resolve()
    await saving
    expect(saver.unsaved).toBe(false)
    expect(results).toEqual([false])
  })

  it('stays unsaved and retries after a failed write', async () => {
    const { saver, writes, results } = setup()
    saver.changed()
    const saving = saver.save()
    writes[0].reject()
    await saving
    expect(saver.unsaved).toBe(true)
    expect(results).toEqual([true])
    void saver.save()
    expect(writes).toHaveLength(2)
  })

  it('stays unsaved while a newer change waits behind a finished save', async () => {
    const { saver, writes } = setup()
    saver.changed()
    const saving = saver.save()
    saver.changed()
    writes[0].resolve()
    await saving
    expect(saver.unsaved).toBe(true)
  })

  it('reset forgets changes for a freshly loaded project', () => {
    const { saver } = setup()
    saver.changed()
    saver.reset()
    expect(saver.unsaved).toBe(false)
  })
})
