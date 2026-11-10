/**
 * Messages the sandboxed runner iframe posts to the app.
 *
 * Code goes in through the iframe's srcdoc, so the app never posts to the
 * runner: to run new code it replaces the iframe, and resizing the iframe
 * resizes the sketch's canvas.
 */

export type SketchMode = 'paperscript' | 'javascript'

export type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

/** Libraries are loaded and the canvas is set up; user code is about to run. */
export interface ReadyMessage {
  type: 'ready'
  runId: string
}

/** User code finished its first synchronous pass without throwing. */
export interface RanMessage {
  type: 'ran'
  runId: string
}

export interface LogMessage {
  type: 'log'
  runId: string
  level: LogLevel
  /** Each console argument, already formatted as text inside the iframe. */
  args: string[]
}

/**
 * An uncaught error. `line` and `column` are in the runner's coordinates
 * (srcdoc lines for JavaScript, compiled-source lines for PaperScript);
 * resolve them to a file with `resolveErrorLocation`.
 */
export interface ErrorMessage {
  type: 'error'
  runId: string
  message: string
  line: number | null
  column: number | null
  stack: string | null
}

export type RunnerMessage = ReadyMessage | RanMessage | LogMessage | ErrorMessage

const LOG_LEVELS: readonly string[] = ['log', 'info', 'warn', 'error', 'debug']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
}

/** Validates data from a `message` event; anything else on the channel is ignored. */
export function isRunnerMessage(data: unknown): data is RunnerMessage {
  if (!isRecord(data) || typeof data.runId !== 'string') return false
  switch (data.type) {
    case 'ready':
    case 'ran':
      return true
    case 'log':
      return (
        typeof data.level === 'string' &&
        LOG_LEVELS.includes(data.level) &&
        Array.isArray(data.args) &&
        data.args.every((arg) => typeof arg === 'string')
      )
    case 'error':
      return (
        typeof data.message === 'string' &&
        isNullableNumber(data.line) &&
        isNullableNumber(data.column) &&
        (data.stack === null || typeof data.stack === 'string')
      )
    default:
      return false
  }
}
