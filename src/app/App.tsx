import { useEffect, useRef, useState } from 'preact/hooks'
import { RunnerHost } from '../runner/host'
import { SAMPLES } from '../runner/samples'
import { appendEntry, entryFromEvent, type ConsoleEntry } from './console'
import { THEME_NAMES, useTheme } from './theme'
import './app.css'

/** M1 runner spike: runs hardcoded sketches in the sandboxed runner. */
export function App() {
  const theme = useTheme()
  const previewRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<RunnerHost | null>(null)
  const [sampleId, setSampleId] = useState(SAMPLES[0].id)
  const [runCount, setRunCount] = useState(0)
  const [entries, setEntries] = useState<ConsoleEntry[]>([])

  useEffect(() => {
    const host = new RunnerHost(previewRef.current!, (event) => {
      const entry = entryFromEvent(event)
      if (entry) setEntries((list) => appendEntry(list, entry))
    })
    hostRef.current = host
    return () => host.destroy()
  }, [])

  useEffect(() => {
    const sample = SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0]
    setEntries([])
    void hostRef.current?.run({ mode: sample.mode, files: sample.files })
  }, [sampleId, runCount])

  const errorCount = entries.filter((entry) => entry.level === 'error').length

  return (
    <div class="spike">
      <header class="bar">
        <div class="title">
          <h1>Paper Playground</h1>
          <span class="muted">
            Runner spike · <span data-testid="theme-name">{THEME_NAMES[theme]}</span>
          </span>
        </div>
        <button type="button" class="run" onClick={() => setRunCount((n) => n + 1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">
            <path d="M8 5.5l11 6.5-11 6.5z" />
          </svg>
          Run
        </button>
      </header>

      <nav class="samples" aria-label="Sample sketches">
        {SAMPLES.map((sample) => (
          <button
            key={sample.id}
            type="button"
            aria-pressed={sample.id === sampleId}
            onClick={() => setSampleId(sample.id)}
          >
            {sample.label}
          </button>
        ))}
      </nav>

      <section class="preview" aria-label="Preview" ref={previewRef} />

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
  )
}
