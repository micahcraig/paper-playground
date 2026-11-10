import { resolveErrorLocation, type SourceLocation } from './errors'
import { PAPER_URL, loadLibrary } from './libraries'
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

export type RunnerEvent =
  | ReadyMessage
  | (RanMessage & { elapsedMs: number })
  | LogMessage
  | (ErrorMessage & { location: SourceLocation | null })

interface CurrentRun {
  runId: string
  mode: SketchMode
  lineMap: LineSegment[]
  startedAt: number
}

let runCounter = 0
function nextRunId(): string {
  runCounter += 1
  return `${Date.now().toString(36)}-${runCounter}`
}

/**
 * Owns the sandboxed runner iframe. Each run replaces the iframe with a fresh
 * one built from srcdoc, so no state leaks from one run to the next.
 */
export class RunnerHost {
  private iframe: HTMLIFrameElement | null = null
  private current: CurrentRun | null = null
  private latestRunId: string | null = null
  private readonly container: HTMLElement
  private readonly listener: (event: RunnerEvent) => void

  constructor(container: HTMLElement, listener: (event: RunnerEvent) => void) {
    this.container = container
    this.listener = listener
    window.addEventListener('message', this.onMessage)
  }

  /** Starts a run and resolves with its id once the iframe is in place. */
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
    iframe.srcdoc = html

    this.current = { runId, mode: request.mode, lineMap, startedAt }
    this.iframe = iframe
    this.container.replaceChildren(iframe)
    return runId
  }

  stop(): void {
    this.latestRunId = null
    this.current = null
    this.iframe = null
    this.container.replaceChildren()
  }

  destroy(): void {
    this.stop()
    window.removeEventListener('message', this.onMessage)
  }

  private readonly onMessage = (event: MessageEvent) => {
    const current = this.current
    if (!current || !this.iframe || event.source !== this.iframe.contentWindow) return
    const data: unknown = event.data
    if (!isRunnerMessage(data) || data.runId !== current.runId) return

    switch (data.type) {
      case 'error':
        this.listener({ ...data, location: resolveErrorLocation(current.mode, current.lineMap, data) })
        break
      case 'ran':
        this.listener({ ...data, elapsedMs: Math.round(performance.now() - current.startedAt) })
        break
      default:
        this.listener(data)
    }
  }
}
