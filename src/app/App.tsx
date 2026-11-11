import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { createEditor, type CodeEditor } from '../editor/editor'
import { RunnerHost } from '../runner/host'
import { PAPER_VERSION } from '../runner/libraries'
import { SAMPLES } from '../runner/samples'
import { appendEntry, entryFromEvent, type ConsoleEntry } from './console'
import { debounce } from './debounce'
import { PREVIEW_TOOLBAR, THUMB_SIZE, WIDE_QUERY, thumbTransform, useMediaQuery, useViewport } from './layout'
import { THEME_NAMES, setThemeOverride, useTheme, useThemeOverride, type ThemeOverride } from './theme'
import { ConsolePanel } from './components/ConsolePanel'
import { Sheet } from './components/Sheet'
import { SymbolStrip } from './components/SymbolStrip'
import {
  CollapseIcon,
  ConsoleIcon,
  ExpandIcon,
  MenuIcon,
  MoreIcon,
  PlayIcon,
  ReloadIcon,
} from './components/icons'
import './app.css'

/** Live mode re-runs this long after the last keystroke. */
export const LIVE_DELAY_MS = 250

const MODE_NAMES = { paperscript: 'PaperScript', javascript: 'JavaScript' } as const

const THEME_CHOICES: { value: ThemeOverride; label: string }[] = [
  { value: null, label: 'Match system' },
  { value: 'dark', label: THEME_NAMES.dark },
  { value: 'light', label: THEME_NAMES.light },
]

export function App() {
  const theme = useTheme()
  const themeOverride = useThemeOverride()
  const wide = useMediaQuery(WIDE_QUERY)
  const viewport = useViewport()

  const editorRef = useRef<HTMLDivElement>(null)
  const framesRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<RunnerHost | null>(null)
  const editor = useRef<CodeEditor | null>(null)

  const [sampleId, setSampleId] = useState(SAMPLES[0].id)
  const sample = SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0]
  const file = sample.files[0]
  const [live, setLive] = useState(true)
  const [stale, setStale] = useState(false)
  const [entries, setEntries] = useState<ConsoleEntry[]>([])
  const [fullPreview, setFullPreview] = useState(false)
  const [consoleShown, setConsoleShown] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sheet, setSheet] = useState<'sketches' | 'more' | null>(null)

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
    const host = new RunnerHost(framesRef.current!, (event) => {
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

  // When the keyboard opens or the fold changes the viewport, keep the caret in view.
  useEffect(() => {
    const frame = requestAnimationFrame(() => editor.current?.revealCaret())
    return () => cancelAnimationFrame(frame)
  }, [viewport, wide, drawerOpen])

  // Escape closes the full preview. Registered once, so it works straight away.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullPreview(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const toggleLive = () => {
    const next = !live
    latest.current.live = next
    setLive(next)
    if (next) runImmediately()
    else runSoon.cancel()
  }

  const pickSample = (id: string) => {
    setSheet(null)
    setSampleId(id)
  }

  // The narrow layout renders the sketch at full-preview size and scales it
  // into the floating thumbnail, so expanding it does not resize the sketch.
  const fullWidth = viewport.width
  const fullHeight = Math.max(0, viewport.height - viewport.keyboardInset - PREVIEW_TOOLBAR)
  const thumb = thumbTransform(THUMB_SIZE, fullWidth, fullHeight)
  const previewMode = fullPreview ? 'full' : wide ? 'docked' : 'thumb'
  const previewStyle = {
    '--full-w': `${fullWidth}px`,
    '--full-h': `${fullHeight}px`,
    '--thumb-scale': String(thumb.scale),
    '--thumb-x': `${thumb.x}px`,
    '--thumb-y': `${thumb.y}px`,
  }

  const projectName = file.name.replace(/\.[^.]+$/, '')

  return (
    <div
      class={`app ${wide ? 'wide' : 'narrow'}`}
      style={{ '--keyboard-inset': `${viewport.keyboardInset}px` }}
    >
      <header class="bar">
        <button type="button" class="icon-button" aria-label="Open sketches" onClick={() => setSheet('sketches')}>
          <MenuIcon />
        </button>
        <div class="title">
          <h1>{projectName}</h1>
          <span class="muted">{MODE_NAMES[sample.mode]} sketch</span>
        </div>
        <button type="button" class="live" aria-pressed={live} onClick={toggleLive}>
          <span class="live-dot" aria-hidden="true" />
          Live
        </button>
        {wide && (
          <button
            type="button"
            class="icon-button"
            aria-label="Toggle console"
            aria-pressed={consoleShown}
            onClick={() => setConsoleShown((shown) => !shown)}
          >
            <ConsoleIcon />
          </button>
        )}
        {wide ? (
          <>
            <button type="button" class="icon-button" aria-label="More options" onClick={() => setSheet('more')}>
              <MoreIcon />
            </button>
            <button type="button" class="run" onClick={runImmediately}>
              <PlayIcon size={20} />
              Run
            </button>
          </>
        ) : (
          <>
            <button type="button" class="run round" aria-label="Run" onClick={runImmediately}>
              <PlayIcon size={22} />
            </button>
            <button type="button" class="icon-button" aria-label="More options" onClick={() => setSheet('more')}>
              <MoreIcon />
            </button>
          </>
        )}
      </header>

      <nav class="tabs" aria-label="Files">
        <button type="button" class="tab" aria-current="true" onClick={() => editor.current?.view.focus()}>
          {file.name}
        </button>
        <div class="tabs-gap" />
        {wide && (
          <span class="chip" title="Libraries loaded into the sketch">
            paper {PAPER_VERSION}
          </span>
        )}
      </nav>

      <main class={`workspace${consoleShown ? '' : ' console-hidden'}`}>
        <div class="stage-area">
          <section class="editor" aria-label="Editor" ref={editorRef} />
          <section
            class={`preview ${previewMode}${stale ? ' stale' : ''}`}
            aria-label="Preview"
            style={previewStyle}
          >
            <div class="preview-toolbar">
              <span class="preview-name">Preview</span>
              <div class="tabs-gap" />
              <button type="button" class="icon-button" aria-label="Reload sketch" onClick={runImmediately}>
                <ReloadIcon size={20} />
              </button>
              <button
                type="button"
                class="icon-button"
                aria-label={fullPreview ? 'Close full preview' : 'Full-screen preview'}
                onClick={() => setFullPreview((full) => !full)}
              >
                {fullPreview ? <CollapseIcon size={20} /> : <ExpandIcon size={20} />}
              </button>
            </div>
            <div class="stage">
              <div class="frames" ref={framesRef} />
            </div>
            <button type="button" class="thumb-expand" aria-label="Open full preview" onClick={() => setFullPreview(true)}>
              <ExpandIcon size={18} />
            </button>
            {stale && (
              <p class="stale-notice" role="status">
                Showing the last good run
              </p>
            )}
          </section>
        </div>
        <ConsolePanel
          entries={entries}
          drawer={!wide}
          open={drawerOpen}
          onToggle={() => setDrawerOpen((open) => !open)}
        />
      </main>

      <SymbolStrip editor={() => editor.current} />

      <Sheet open={sheet === 'sketches'} title="Sketches" onClose={() => setSheet(null)}>
        <p class="sheet-note">Paper Playground · saved projects arrive in a later release.</p>
        <div class="choice-list">
          {SAMPLES.map((s) => (
            <button key={s.id} type="button" class="choice" aria-pressed={s.id === sampleId} onClick={() => pickSample(s.id)}>
              <span>{s.label}</span>
              <span class="muted">{s.files[0].name}</span>
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === 'more'} title="Options" onClose={() => setSheet(null)}>
        <h3 class="sheet-label">Theme</h3>
        <p class="sheet-note">
          Showing <span data-testid="theme-name">{THEME_NAMES[theme]}</span>
        </p>
        <div class="choice-list">
          {THEME_CHOICES.map((choice) => (
            <button
              key={choice.label}
              type="button"
              class="choice"
              aria-pressed={themeOverride === choice.value}
              onClick={() => setThemeOverride(choice.value)}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  )
}
