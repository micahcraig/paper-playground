import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { Project } from '../storage/model'
import { rescueProject, type ProjectStore } from '../storage/store'
import { debounce } from './debounce'
import { createSaver } from './saver'

/** Autosave runs this long after the last change. */
export const AUTOSAVE_DELAY_MS = 400

export interface ProjectState {
  project: Project | null
  /** The latest project, for callbacks that outlive a render. */
  ref: { current: Project | null }
  /**
   * Changes the open project. Typing is saved after a short pause; other
   * changes (`immediate`) are saved straight away.
   */
  update(change: (project: Project) => Project, options?: { immediate?: boolean }): void
  /** Shows another project; save the current one first with `flush`. */
  replace(project: Project | null): void
  /** Saves pending changes now. */
  flush(): Promise<void>
  saveFailed: boolean
}

export function useProject(store: ProjectStore): ProjectState {
  const [project, setProject] = useState<Project | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  const ref = useRef<Project | null>(null)

  const api = useMemo(() => {
    const saver = createSaver(
      () => ref.current,
      (project) => store.save(project),
      setSaveFailed,
    )
    const save = () => saver.save()
    const saveSoon = debounce(() => void save(), AUTOSAVE_DELAY_MS)
    return {
      update(change: (project: Project) => Project, options?: { immediate?: boolean }) {
        if (!ref.current) return
        const next = { ...change(ref.current), updatedAt: Date.now() }
        ref.current = next
        setProject(next)
        saver.changed()
        if (options?.immediate) {
          saveSoon.cancel()
          void save()
        } else {
          saveSoon()
        }
      },
      /**
       * For pagehide: start the save, and keep a synchronous copy in case it
       * never lands. A save already in flight counts too: unloading can drop it.
       */
      rescue() {
        if (ref.current && saver.unsaved) rescueProject(ref.current)
        saveSoon.cancel()
        void save()
      },
      replace(next: Project | null) {
        saveSoon.cancel()
        saver.reset()
        ref.current = next
        setProject(next)
      },
      flush() {
        saveSoon.cancel()
        return save()
      },
    }
  }, [store])

  // Save before the app is hidden or closed; Android may kill it afterwards.
  useEffect(() => {
    const onHide = () => api.rescue()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide()
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [api])

  const { rescue: _rescue, ...rest } = api
  return { project, ref, saveFailed, ...rest }
}
