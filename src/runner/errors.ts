import type { ErrorMessage, SketchMode } from './protocol'
import { PAPERSCRIPT_URL, type LineSegment } from './srcdoc'

export interface SourceLocation {
  file: string
  line: number
  column: number | null
}

interface RawPosition {
  line: number
  column: number | null
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const PAPERSCRIPT_FRAME = new RegExp(`${escapeRegExp(PAPERSCRIPT_URL)}:(\\d+):(\\d+)`)
/** Paper.js 0.17 ends parse errors with "(at <url>:line:column)", column one-based. */
const PARSE_AT = new RegExp(`\\s*\\(at ${escapeRegExp(PAPERSCRIPT_URL)}:(\\d+):(\\d+)\\)\\s*$`)
/** Older compilers end parse errors with "(line:column)", column zero-based. */
const PARSE_POSITION = /\((\d+):(\d+)\)\s*$/

function paperScriptPosition(error: ErrorMessage): RawPosition | null {
  const at = error.message.match(PARSE_AT)
  if (at) return { line: Number(at[1]), column: Number(at[2]) }
  const frame = error.stack?.match(PAPERSCRIPT_FRAME)
  if (frame) return { line: Number(frame[1]), column: Number(frame[2]) }
  const parse = error.message.match(PARSE_POSITION)
  if (parse) return { line: Number(parse[1]), column: Number(parse[2]) + 1 }
  return null
}

/** Maps a line in the runner's coordinates back to a file and a line inside it. */
export function locateLine(lineMap: LineSegment[], position: RawPosition): SourceLocation | null {
  for (const segment of lineMap) {
    const offset = position.line - segment.startLine
    if (offset >= 0 && offset < segment.lineCount) {
      return { file: segment.file, line: offset + 1, column: position.column }
    }
  }
  return null
}

/**
 * Where in the user's files an error happened, or null when it came from
 * outside them (a library, or the runner itself).
 */
export function resolveErrorLocation(
  mode: SketchMode,
  lineMap: LineSegment[],
  error: ErrorMessage,
): SourceLocation | null {
  const position =
    mode === 'paperscript'
      ? paperScriptPosition(error)
      : error.line === null
        ? null
        : { line: error.line, column: error.column }
  return position ? locateLine(lineMap, position) : null
}

/** Drops the runner's internal position suffix; the console shows the file location instead. */
export function cleanErrorMessage(message: string): string {
  return message.replace(PARSE_AT, '')
}

export function formatLocation(location: SourceLocation | null): string {
  if (!location) return ''
  return location.column === null
    ? `${location.file}:${location.line}`
    : `${location.file}:${location.line}:${location.column}`
}
