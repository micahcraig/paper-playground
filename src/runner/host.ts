import { cleanErrorMessage, resolveErrorLocation, type SourceLocation } from './errors'
import { PAPER_URL, loadLibrary } from './libraries'
import { settlePending } from './preview'
import {
  isRunnerMessage,
  type ErrorMessage,
  type LogMessage,
  type RanMessage,
  type ReadyMessage,
  type SketchMode,
} from './protocol'
import { buildSrcdoc, type LineSegment, type SketchFile } from './srcdoc'

export interface RunRequest {
  mode: SketchMode
  files: SketchFile[]
}

/** The new run failed before finishing, so the previous render stays on screen. */
export interface KeptMessage {
  type: 'kept'
  runId: string
}

export type RunnerEvent =
  | ReadyMessage
  | (RanMessage & { elapsedMs: number })
  | LogMessage
  | (ErrorMessage & { location: SourceLocation | null })
  | KeptMessage

interface Run {
  runId: string
  mode: SketchMode
  lineMap: LineSegment[]
  startedAt: number
  iframe: HTMLIFrameElement
  /** Finished its first pass without an error. */
  good: boolean
}

/** Class on an iframe that is still loading behind the one on screen. */
export const PENDING_CLASS = 'pending'

let runCounter = 0
function nextRunId(): string {
  runCounter += 1
  return `${Date.now().toString(36)}-${runCounter}`
}

/**
 * Owns the sandboxed runner iframes. Each run gets a fresh iframe built from
 * srcdoc, so no state leaks between runs. The new iframe loads hidden on top
 * of the current one and replaces it only when its first pass succeeds.
 */
export class RunnerHost {
  private shown: Run | null = null
  private pending: Run | null = null
  private latestRunId: string | null = null
  private readonly container: HTMLElement
  private readonly listener: (event: RunnerEvent) => void

  constructor(container: HTMLElement, listener: (event: RunnerEvent) => void) {
    this.container = container
    this.listener = listener
    window.addEventListener('message', this.onMessage)
  }

  /** Starts a run and resolves with its id once its iframe is in place. */
  async run(request: RunRequest): Promise<string> {
    const runId = nextRunId()
    const startedAt = performance.now()
    this.latestRunId = runId

    let libraries: string[]
    try {
      libraries = [await loadLibrary(PAPER_URL)]
    } catch (error) {
      if (this.latestRunId === runId) {
        const message = error instanceof Error ? error.message : String(error)
        this.listener({ type: 'error', runId, message, line: null, column: null, stack: null, location: null })
      }
      return runId
    }
    // A newer run started while the libraries were loading.
    if (this.latestRunId !== runId) return runId

    const { html, lineMap } = buildSrcdoc({ runId, mode: request.mode, files: request.files, libraries })
    const iframe = document.createElement('iframe')
    iframe.setAttribute('sandbox', 'allow-scripts')
    iframe.title = 'Sketch preview'
    iframe.className = PENDING_CLASS
    iframe.dataset.runId = runId
    iframe.srcdoc = html

    // A newer run supersedes one that is still loading.
    this.pending?.iframe.remove()
    this.pending = { runId, mode: request.mode, lineMap, startedAt, iframe, good: false }
    this.container.append(iframe)
    return runId
  }

  stop(): void {
    this.latestRunId = null
    this.shown = null
    this.pending = null
    this.container.replaceChildren()
  }

  destroy(): void {
    this.stop()
    window.removeEventListener('message', this.onMessage)
  }

  private show(run: Run): void {
    if (this.shown) this.shown.iframe.remove()
    run.iframe.classList.remove(PENDING_CLASS)
    this.shown = run
    this.pending = null
  }

  private readonly onMessage = (event: MessageEvent) => {
    const run = [this.pending, this.shown].find((r) => r !== null && r.iframe.contentWindow === event.source)
    if (!run) return
    const data: unknown = event.data
    if (!isRunnerMessage(data) || data.runId !== run.runId) return

    switch (data.type) {
      case 'error':
        this.listener({
          ...data,
          message: cleanErrorMessage(data.message),
          location: resolveErrorLocation(run.mode, run.lineMap, data),
        })
        break
      case 'ran':
        run.good = true
        this.listener({ ...data, elapsedMs: Math.round(performance.now() - run.startedAt) })
        break
      default:
        this.listener(data)
    }

    if (run !== this.pending) return
    const action = settlePending(data.type, this.shown?.good ?? false)
    if (action === 'show') {
      this.show(run)
    } else if (action === 'discard') {
      run.iframe.remove()
      this.pending = null
      this.listener({ type: 'kept', runId: run.runId })
    }
  }
}
