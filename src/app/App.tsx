import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { createEditor, type CodeEditor } from '../editor/editor'
import { RunnerHost } from '../runner/host'
import { SAMPLES } from '../runner/samples'
import { appendEntry, entryFromEvent, type ConsoleEntry } from './console'
import { debounce } from './debounce'
import { THEME_NAMES, useTheme } from './theme'
import './app.css'

/** Live mode re-runs this long after the last keystroke. */
export const LIVE_DELAY_MS = 250

const MODE_NAMES = { paperscript: 'PaperScript', javascript: 'JavaScript' } as const

export function App() {
  const theme = useTheme()
  const editorRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<RunnerHost | null>(null)
  const editor = useRef<CodeEditor | null>(null)

  const [sampleId, setSampleId] = useState(SAMPLES[0].id)
  const sample = SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0]
  const file = sample.files[0]
  const [live, setLive] = useState(true)
  const [stale, setStale] = useState(false)
  const [entries, setEntries] = useState<ConsoleEntry[]>([])

  // Read by callbacks that outlive a render.
  const latest = useRef({ sample, live, code: file.code })
  latest.current.sample = sample
  latest.current.live = live

  const runNow = useMemo(
    () => () => {
      const { sample: current, code } = latest.current
      setEntries([])
      void hostRef.current?.run({ mode: current.mode, files: [{ name: current.files[0].name, code }] })
    },
    [],
  )
  const runSoon = useMemo(() => debounce(runNow, LIVE_DELAY_MS), [runNow])
  const runImmediately = () => {
    runSoon.cancel()
    runNow()
  }

  useEffect(() => {
    const host = new RunnerHost(previewRef.current!, (event) => {
      if (event.type === 'kept') setStale(true)
      else if (event.type === 'ran') setStale(false)
      const entry = entryFromEvent(event)
      if (entry) setEntries((list) => appendEntry(list, entry))
    })
    hostRef.current = host
    editor.current = createEditor({
      parent: editorRef.current!,
      code: latest.current.code,
      onChange: (code) => {
        latest.current.code = code
        if (latest.current.live) runSoon()
      },
    })
    return () => {
      runSoon.cancel()
      editor.current?.destroy()
      host.destroy()
    }
  }, [runSoon])

  // Loading a sample replaces the editor's code and runs it.
  useEffect(() => {
    latest.current.code = file.code
    editor.current?.setCode(file.code)
    setStale(false)
    runImmediately()
  }, [sampleId])

  const toggleLive = () => {
    const next = !live
    latest.current.live = next
    setLive(next)
    if (next) runImmediately()
    else runSoon.cancel()
  }

  const errorCount = entries.filter((entry) => entry.level === 'error').length

  return (
    <div class="app">
      <header class="bar">
        <div class="title">
          <h1>Paper Playground</h1>
          <span class="muted">
            {file.name} · {MODE_NAMES[sample.mode]} · <span data-testid="theme-name">{THEME_NAMES[theme]}</span>
          </span>
        </div>
        <button type="button" class="live" aria-pressed={live} onClick={toggleLive}>
          <span class="live-dot" aria-hidden="true" />
          Live
        </button>
        <button type="button" class="run" onClick={runImmediately}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">
            <path d="M8 5.5l11 6.5-11 6.5z" />
          </svg>
          Run
        </button>
      </header>

      <nav class="samples" aria-label="Sample sketches">
        {SAMPLES.map((s) => (
          <button key={s.id} type="button" aria-pressed={s.id === sampleId} onClick={() => setSampleId(s.id)}>
            {s.label}
          </button>
        ))}
      </nav>

      <main class="workspace">
        <section class="editor" aria-label="Editor" ref={editorRef} />
        <div class="output">
          <section class="preview" aria-label="Preview">
            <div class="frames" ref={previewRef} />
            {stale && (
              <p class="stale" role="status">
                Showing the last good run
              </p>
            )}
          </section>
          <section class="console" aria-label="Console">
            <div class="console-head">
              <span>CONSOLE</span>
              {errorCount > 0 && <span class="error">{errorCount === 1 ? '1 error' : `${errorCount} errors`}</span>}
            </div>
            <ol class="console-lines" data-testid="console">
              {entries.map((entry) => (
                <li key={entry.id} class={`level-${entry.level}`}>
                  <span class="text">{entry.text}</span>
                  {entry.location && <span class="location">{entry.location}</span>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </main>
    </div>
  )
}
