import type { SketchFile } from './srcdoc'

export interface CompileError {
  file: string
  message: string
  line: number | null
  column: number | null
}

export type Prepared = { ok: true; files: SketchFile[] } | { ok: false; error: CompileError }

type Transform = (code: string, options: { transforms: ['typescript']; disableESTransforms: true }) => { code: string }

let transformPromise: Promise<Transform> | null = null

/** Sucrase is only fetched for projects that have a .ts file. */
function loadTransform(): Promise<Transform> {
  transformPromise ??= import('sucrase').then((module) => module.transform as Transform)
  return transformPromise
}

/** Sucrase parse errors end with "(line:column)", both 1-based. */
const POSITION = /\s*\((\d+):(\d+)\)\s*$/

/**
 * Strips types from .ts files; other files pass through. Sucrase keeps line
 * numbers, so error locations still point at the user's lines.
 */
export async function prepareFiles(files: SketchFile[], load: () => Promise<Transform> = loadTransform): Promise<Prepared> {
  if (!files.some((file) => file.name.toLowerCase().endsWith('.ts'))) return { ok: true, files }
  const transform = await load()
  const out: SketchFile[] = []
  for (const file of files) {
    if (!file.name.toLowerCase().endsWith('.ts')) {
      out.push(file)
      continue
    }
    try {
      out.push({ name: file.name, code: transform(file.code, { transforms: ['typescript'], disableESTransforms: true }).code })
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)
      const position = text.match(POSITION)
      return {
        ok: false,
        error: {
          file: file.name,
          message: `SyntaxError: ${text.replace(POSITION, '')}`,
          line: position ? Number(position[1]) : null,
          column: position ? Number(position[2]) : null,
        },
      }
    }
  }
  return { ok: true, files: out }
}
