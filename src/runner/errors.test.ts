import { describe, expect, it } from 'vitest'
import { cleanErrorMessage, formatLocation, locateLine, resolveErrorLocation } from './errors'
import type { ErrorMessage } from './protocol'
import { PAPERSCRIPT_URL, type LineSegment } from './srcdoc'

const lineMap: LineSegment[] = [
  { file: 'a.js', startLine: 10, lineCount: 3 },
  { file: 'b.js', startLine: 15, lineCount: 2 },
]

function error(fields: Partial<ErrorMessage>): ErrorMessage {
  return { type: 'error', runId: 'r', message: 'Error: boom', line: null, column: null, stack: null, ...fields }
}

describe('locateLine', () => {
  it('maps a line to its file and a 1-based line inside it', () => {
    expect(locateLine(lineMap, { line: 10, column: 4 })).toEqual({ file: 'a.js', line: 1, column: 4 })
    expect(locateLine(lineMap, { line: 12, column: null })).toEqual({ file: 'a.js', line: 3, column: null })
    expect(locateLine(lineMap, { line: 16, column: 1 })).toEqual({ file: 'b.js', line: 2, column: 1 })
  })

  it('returns null outside every file', () => {
    expect(locateLine(lineMap, { line: 9, column: 1 })).toBeNull()
    expect(locateLine(lineMap, { line: 13, column: 1 })).toBeNull()
    expect(locateLine(lineMap, { line: 17, column: 1 })).toBeNull()
  })
})

describe('resolveErrorLocation for JavaScript', () => {
  it('uses the reported srcdoc line and column', () => {
    expect(resolveErrorLocation('javascript', lineMap, error({ line: 11, column: 7 }))).toEqual({
      file: 'a.js',
      line: 2,
      column: 7,
    })
  })

  it('returns null when the error has no line', () => {
    expect(resolveErrorLocation('javascript', lineMap, error({}))).toBeNull()
  })
})

describe('resolveErrorLocation for PaperScript', () => {
  const psMap: LineSegment[] = [{ file: 'ripple.js', startLine: 1, lineCount: 20 }]

  it('reads the position from the compiled source frame in the stack', () => {
    const stack = [
      'ReferenceError: undefinedScale is not defined',
      `    at Object.onMouseDown (${PAPERSCRIPT_URL}:7:16)`,
      '    at about:srcdoc:12:3',
    ].join('\n')
    expect(resolveErrorLocation('paperscript', psMap, error({ stack, line: 3, column: 1 }))).toEqual({
      file: 'ripple.js',
      line: 7,
      column: 16,
    })
  })

  it('reads the "(at url:line:column)" position Paper.js 0.17 adds to parse errors', () => {
    const parse = error({ message: `SyntaxError: Unexpected token (at ${PAPERSCRIPT_URL}:4:15)` })
    expect(resolveErrorLocation('paperscript', psMap, parse)).toEqual({ file: 'ripple.js', line: 4, column: 15 })
  })

  it('falls back to the compiler parse position, converting the column to 1-based', () => {
    const parse = error({ message: 'SyntaxError: Unexpected token (4:12)' })
    expect(resolveErrorLocation('paperscript', psMap, parse)).toEqual({ file: 'ripple.js', line: 4, column: 13 })
  })

  it('returns null when nothing points into the sketch', () => {
    const stack = 'TypeError: x\n    at about:srcdoc:400:10'
    expect(resolveErrorLocation('paperscript', psMap, error({ stack }))).toBeNull()
  })
})

describe('cleanErrorMessage', () => {
  it('drops the internal position suffix', () => {
    expect(cleanErrorMessage(`SyntaxError: Unexpected token (at ${PAPERSCRIPT_URL}:43:15)`)).toBe('SyntaxError: Unexpected token')
  })

  it('leaves other messages alone', () => {
    expect(cleanErrorMessage('ReferenceError: x is not defined')).toBe('ReferenceError: x is not defined')
  })
})

describe('formatLocation', () => {
  it('formats file, line and optional column', () => {
    expect(formatLocation({ file: 'a.js', line: 3, column: 9 })).toBe('a.js:3:9')
    expect(formatLocation({ file: 'a.js', line: 3, column: null })).toBe('a.js:3')
    expect(formatLocation(null)).toBe('')
  })
})
