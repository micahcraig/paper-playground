import type { Project } from '../storage/model'

export interface Saver {
  /** Records that the project changed and is not saved yet. */
  changed(): void
  /** Forgets unsaved changes, for a project that was just loaded. */
  reset(): void
  /** Saves the current project if it has unsaved changes. */
  save(): Promise<void>
  /**
   * True while a change is unsaved, including while its save is still in
   * flight: a page that unloads now may lose that write.
   */
  readonly unsaved: boolean
}

/** Tracks whether the open project is saved, around an async `write`. */
export function createSaver(
  current: () => Project | null,
  write: (project: Project) => Promise<void>,
  onResult: (failed: boolean) => void = () => {},
): Saver {
  let dirty = false
  let inFlight = 0
  return {
    changed() {
      dirty = true
    },
    reset() {
      dirty = false
    },
    save() {
      const project = current()
      if (!project || !dirty) return Promise.resolve()
      dirty = false
      inFlight++
      return write(project).then(
        () => {
          inFlight--
          onResult(false)
        },
        () => {
          inFlight--
          dirty = true
          onResult(true)
        },
      )
    },
    get unsaved() {
      return dirty || inFlight > 0
    },
  }
}
