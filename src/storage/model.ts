import type { SketchMode } from '../runner/protocol'

export interface ProjectFile {
  id: string
  name: string
  code: string
}

export interface Project {
  id: string
  name: string
  mode: SketchMode
  /** Library ids loaded into the runner. Only "paper" until M5 adds the picker. */
  libraries: string[]
  /** In tab order, which is also run order. */
  files: ProjectFile[]
  activeFileId: string
  createdAt: number
  updatedAt: number
}

export type ProjectSummary = Pick<Project, 'id' | 'name' | 'mode' | 'updatedAt'> & { fileCount: number }

export const FILE_EXTENSIONS = ['.js', '.ts'] as const
export const MAX_FILES = 12
export const MAX_NAME_LENGTH = 40

export function newId(): string {
  return crypto.randomUUID()
}

export function summarize(project: Project): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    mode: project.mode,
    updatedAt: project.updatedAt,
    fileCount: project.files.length,
  }
}

export const isTypeScript = (name: string) => name.toLowerCase().endsWith('.ts')

/**
 * Checks a file name typed by the user. A name without an extension gets
 * ".js". Returns the name to use, or an error to show.
 */
export function validateFileName(
  input: string,
  existing: string[],
): { ok: true; name: string } | { ok: false; error: string } {
  let name = input.trim()
  if (!name) return { ok: false, error: 'Enter a file name.' }
  if (!/\.[a-z]+$/i.test(name)) name += '.js'
  if (!FILE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))) {
    return { ok: false, error: 'Use a .js or .ts file.' }
  }
  if (name.length > MAX_NAME_LENGTH) return { ok: false, error: `Keep it under ${MAX_NAME_LENGTH} characters.` }
  if (!/^[\w.-]+$/.test(name)) return { ok: false, error: 'Use letters, numbers, dots, dashes and underscores.' }
  if (existing.some((other) => other.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: `There is already a file called ${name}.` }
  }
  return { ok: true, name }
}

export function validateProjectName(input: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = input.trim().replace(/\s+/g, ' ')
  if (!name) return { ok: false, error: 'Enter a project name.' }
  if (name.length > MAX_NAME_LENGTH) return { ok: false, error: `Keep it under ${MAX_NAME_LENGTH} characters.` }
  return { ok: true, name }
}

/** "ripple", then "ripple 2", "ripple 3", … */
export function uniqueName(base: string, taken: string[]): string {
  const lower = new Set(taken.map((name) => name.toLowerCase()))
  if (!lower.has(base.toLowerCase())) return base
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`
    if (!lower.has(candidate.toLowerCase())) return candidate
  }
}

/** "sketch.js", then "sketch-2.js", … */
export function uniqueFileName(base: string, taken: string[]): string {
  const lower = new Set(taken.map((name) => name.toLowerCase()))
  if (!lower.has(base.toLowerCase())) return base
  const dot = base.lastIndexOf('.')
  const stem = base.slice(0, dot)
  const ext = base.slice(dot)
  for (let n = 2; ; n++) {
    const candidate = `${stem}-${n}${ext}`
    if (!lower.has(candidate.toLowerCase())) return candidate
  }
}

export function makeProject(
  input: { name: string; mode: SketchMode; files: { name: string; code: string }[]; libraries?: string[] },
  now = Date.now(),
): Project {
  const files = input.files.map((file) => ({ id: newId(), name: file.name, code: file.code }))
  return {
    id: newId(),
    name: input.name,
    mode: input.mode,
    libraries: input.libraries ?? ['paper'],
    files,
    activeFileId: files[0].id,
    createdAt: now,
    updatedAt: now,
  }
}

/** Moves a file one place earlier (-1) or later (+1) in tab and run order. */
export function moveFile(files: ProjectFile[], id: string, step: -1 | 1): ProjectFile[] {
  const from = files.findIndex((file) => file.id === id)
  const to = from + step
  if (from < 0 || to < 0 || to >= files.length) return files
  const next = [...files]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}

// Export format

export const EXPORT_FORMAT = 'paper-playground-project'
export const EXPORT_VERSION = 1

export interface ProjectExport {
  format: typeof EXPORT_FORMAT
  version: typeof EXPORT_VERSION
  name: string
  mode: SketchMode
  libraries: string[]
  files: { name: string; code: string }[]
}

export function exportProject(project: Project): ProjectExport {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    name: project.name,
    mode: project.mode,
    libraries: project.libraries,
    files: project.files.map(({ name, code }) => ({ name, code })),
  }
}

export function exportFileName(project: Project): string {
  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project'
  return `${slug}.paper-playground.json`
}

/** Reads an exported project. Throws an Error with a message fit to show the user. */
export function parseProjectExport(text: string): ProjectExport {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('That file is not JSON.')
  }
  const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
  if (!record(data) || data.format !== EXPORT_FORMAT) throw new Error('That is not a Paper Playground project.')
  if (data.version !== EXPORT_VERSION) throw new Error(`Unsupported project version: ${String(data.version)}.`)
  if (data.mode !== 'paperscript' && data.mode !== 'javascript') throw new Error('The project has an unknown language.')
  const nameCheck = validateProjectName(typeof data.name === 'string' ? data.name : '')
  if (!nameCheck.ok) throw new Error('The project has no name.')
  if (!Array.isArray(data.files) || data.files.length === 0) throw new Error('The project has no files.')
  if (data.files.length > MAX_FILES) throw new Error(`A project can have at most ${MAX_FILES} files.`)
  const files: { name: string; code: string }[] = []
  for (const file of data.files) {
    if (!record(file) || typeof file.name !== 'string' || typeof file.code !== 'string') {
      throw new Error('A file in the project is malformed.')
    }
    const check = validateFileName(file.name, files.map((f) => f.name))
    if (!check.ok || check.name !== file.name) throw new Error(`Bad file name: ${file.name}`)
    files.push({ name: file.name, code: file.code })
  }
  const libraries = Array.isArray(data.libraries) && data.libraries.every((id) => typeof id === 'string')
    ? (data.libraries as string[])
    : ['paper']
  return { format: EXPORT_FORMAT, version: EXPORT_VERSION, name: nameCheck.name, mode: data.mode, libraries, files }
}
