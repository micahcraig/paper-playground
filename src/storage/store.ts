import { createStore, del, entries, get, set } from 'idb-keyval'
import { makeProject, summarize, uniqueName, type Project, type ProjectSummary } from './model'
import { STARTER_TEMPLATE_ID, getTemplate } from './templates'

/** The slice of idb-keyval the store uses, so tests can pass an in-memory map. */
export interface KeyValue {
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  del(key: string): Promise<void>
  entries<T>(): Promise<[string, T][]>
}

export function indexedDbKeyValue(dbName = 'paper-playground', storeName = 'kv'): KeyValue {
  const store = createStore(dbName, storeName)
  return {
    get: (key) => get(key, store),
    set: (key, value) => set(key, value, store),
    del: (key) => del(key, store),
    entries: <T>() => entries<string, T>(store),
  }
}

const PROJECT_PREFIX = 'project:'
const LAST_OPENED = 'meta:lastOpened'

export class ProjectStore {
  private readonly kv: KeyValue

  constructor(kv: KeyValue) {
    this.kv = kv
  }

  /** Most recently changed first. */
  async list(): Promise<ProjectSummary[]> {
    const all = await this.kv.entries<Project>()
    return all
      .filter(([key]) => key.startsWith(PROJECT_PREFIX))
      .map(([, project]) => summarize(project))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  get(id: string): Promise<Project | undefined> {
    return this.kv.get<Project>(PROJECT_PREFIX + id)
  }

  async save(project: Project): Promise<void> {
    await this.kv.set(PROJECT_PREFIX + project.id, project)
  }

  async delete(id: string): Promise<void> {
    await this.kv.del(PROJECT_PREFIX + id)
    if ((await this.kv.get<string>(LAST_OPENED)) === id) await this.kv.del(LAST_OPENED)
  }

  async setLastOpened(id: string): Promise<void> {
    await this.kv.set(LAST_OPENED, id)
  }

  /** Makes a project from a template, with a name not already taken, and saves it. */
  async createFromTemplate(templateId: string, now = Date.now()): Promise<Project> {
    const template = getTemplate(templateId)
    const taken = (await this.list()).map((p) => p.name)
    const project = makeProject(
      { name: uniqueName(template.projectName, taken), mode: template.mode, files: template.files },
      now,
    )
    await this.save(project)
    return project
  }

  /** Saves a project read from an export as a new project. */
  async importProject(
    data: { name: string; mode: Project['mode']; libraries: string[]; files: { name: string; code: string }[] },
    now = Date.now(),
  ): Promise<Project> {
    const taken = (await this.list()).map((p) => p.name)
    const project = makeProject({ ...data, name: uniqueName(data.name, taken) }, now)
    await this.save(project)
    return project
  }

  /**
   * The project to show at launch: the last one opened, else the most recent,
   * else a new starter project.
   */
  async openInitial(): Promise<Project> {
    const lastId = await this.kv.get<string>(LAST_OPENED)
    const last = lastId ? await this.get(lastId) : undefined
    if (last) return last
    const [recent] = await this.list()
    const project = recent ? await this.get(recent.id) : undefined
    const opened = project ?? (await this.createFromTemplate(STARTER_TEMPLATE_ID))
    await this.setLastOpened(opened.id)
    return opened
  }
}

type SyncStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** localStorage key for a project the page was closed on before IndexedDB saved it. */
export const RESCUE_KEY = 'paper-playground:unsaved'

function localStore(): SyncStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * IndexedDB writes started while the page unloads may never land, so the
 * unsaved project is also written synchronously to localStorage.
 */
export function rescueProject(project: Project, storage: SyncStorage | null = localStore()): void {
  try {
    storage?.setItem(RESCUE_KEY, JSON.stringify(project))
  } catch {
    // Over quota or unavailable; the IndexedDB save may still land.
  }
}

/**
 * Moves a rescued project into the store when it is newer than the saved
 * copy, then clears the rescue slot.
 */
export async function restoreRescued(store: ProjectStore, storage: SyncStorage | null = localStore()): Promise<void> {
  let text: string | null = null
  try {
    text = storage?.getItem(RESCUE_KEY) ?? null
  } catch {
    return
  }
  if (!text) return
  try {
    const rescued = JSON.parse(text) as Project
    if (rescued && typeof rescued.id === 'string' && Array.isArray(rescued.files)) {
      const saved = await store.get(rescued.id)
      if (!saved || saved.updatedAt < rescued.updatedAt) await store.save(rescued)
    }
  } catch {
    // A damaged rescue copy is dropped.
  }
  try {
    storage?.removeItem(RESCUE_KEY)
  } catch {
    // Nothing more to do.
  }
}

/** Asks the browser not to evict saved projects under storage pressure. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist()
  } catch {
    // Best effort only.
  }
}
