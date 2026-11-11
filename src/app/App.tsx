import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { createEditor, type CodeEditor } from '../editor/editor'
import { formatLocation } from '../runner/errors'
import { RunnerHost } from '../runner/host'
import { PAPER_VERSION } from '../runner/libraries'
import { prepareFiles } from '../runner/typescript'
import {
  MAX_FILES,
  exportFileName,
  exportProject,
  moveFile,
  newId,
  parseProjectExport,
  uniqueFileName,
  validateFileName,
  validateProjectName,
  type Project,
  type ProjectSummary,
} from '../storage/model'
import { ProjectStore, indexedDbKeyValue, requestPersistentStorage, restoreRescued } from '../storage/store'
import { TEMPLATES } from '../storage/templates'
import { appendEntry, entryFromEvent, type ConsoleEntry } from './console'
import { debounce } from './debounce'
import { PREVIEW_TOOLBAR, THUMB_SIZE, WIDE_QUERY, thumbTransform, useMediaQuery, useViewport } from './layout'
import { THEME_NAMES, setThemeOverride, useTheme, useThemeOverride, type ThemeOverride } from './theme'
import { useProject } from './useProject'
import { ConsolePanel } from './components/ConsolePanel'
import { NameSheet, type NameRequest } from './components/NameSheet'
import { Sheet } from './components/Sheet'
import { SymbolStrip } from './components/SymbolStrip'
import {
  CollapseIcon,
  ConsoleIcon,
  ExpandIcon,
  MenuIcon,
  MoreIcon,
  PlayIcon,
  PlusIcon,
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

const IMMEDIATE = { immediate: true }

type SheetName = 'projects' | 'templates' | 'more' | 'file' | 'delete-project' | 'delete-file'

export function App({ store: givenStore }: { store?: ProjectStore }) {
  const store = useMemo(() => givenStore ?? new ProjectStore(indexedDbKeyValue()), [givenStore])
  const theme = useTheme()
  const themeOverride = useThemeOverride()
  const wide = useMediaQuery(WIDE_QUERY)
  const viewport = useViewport()
  const { project, ref: projectRef, update, replace, flush, saveFailed } = useProject(store)

  const editorRef = useRef<HTMLDivElement>(null)
  const framesRef = useRef<HTMLDivElement>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const hostRef = useRef<RunnerHost | null>(null)
  const editor = useRef<CodeEditor | null>(null)

  const [live, setLive] = useState(true)
  const liveRef = useRef(live)
  const [stale, setStale] = useState(false)
  /** A run is loading; the Preview region is aria-busy until it settles. */
  const [busy, setBusy] = useState(false)
  const [entries, setEntries] = useState<ConsoleEntry[]>([])
  const [fullPreview, setFullPreview] = useState(false)
  const [consoleShown, setConsoleShown] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sheet, setSheet] = useState<SheetName | null>(null)
  const [nameRequest, setNameRequest] = useState<NameRequest | null>(null)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [importError, setImportError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const runToken = useRef(0)
  const runNow = useMemo(
    () => async () => {
      const current = projectRef.current
      const host = hostRef.current
      if (!current || !host) return
      const token = ++runToken.current
      setEntries([])
      setBusy(true)
      const prepared = await prepareFiles(current.files.map(({ name, code }) => ({ name, code })))
      if (token !== runToken.current) return
      if (!prepared.ok) {
        const { file, line, column, message } = prepared.error
        host.supersede()
        const location = line === null ? `${file}` : formatLocation({ file, line, column })
        setEntries((list) => appendEntry(list, { level: 'error', text: message, location }))
        setStale(host.showingGood)
        setBusy(false)
        return
      }
      void host.run({ mode: current.mode, files: prepared.files })
    },
    [projectRef],
  )
  const runSoon = useMemo(() => debounce(() => void runNow(), LIVE_DELAY_MS), [runNow])
  const runImmediately = () => {
    runSoon.cancel()
    void runNow()
  }

  /** Shows a project in the editor and runs it. */
  const show = (next: Project) => {
    replace(next)
    editor.current?.clear()
    const file = next.files.find((f) => f.id === next.activeFileId) ?? next.files[0]
    editor.current?.open(file.id, file.code)
    setStale(false)
    void store.setLastOpened(next.id)
    runImmediately()
  }

  useEffect(() => {
    const host = new RunnerHost(framesRef.current!, (event) => {
      if (event.type === 'kept') setStale(true)
      else if (event.type === 'ran') setStale(false)
      const entry = entryFromEvent(event)
      if (entry) setEntries((list) => appendEntry(list, entry))
      if (event.type === 'ran' || event.type === 'kept' || event.type === 'error') setBusy(host.loading)
    })
    hostRef.current = host
    editor.current = createEditor({
      parent: editorRef.current!,
      onChange: (fileId, code) => {
        update((p) => ({ ...p, files: p.files.map((f) => (f.id === fileId ? { ...f, code } : f)) }))
        if (liveRef.current) runSoon()
      },
    })
    restoreRescued(store).then(() => store.openInitial()).then(show, (error: unknown) => {
      setLoadError(error instanceof Error ? error.message : String(error))
    })
    void requestPersistentStorage()
    return () => {
      runSoon.cancel()
      void flush()
      editor.current?.destroy()
      host.destroy()
    }
  }, [store])

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
    liveRef.current = next
    setLive(next)
    if (next) runImmediately()
    else runSoon.cancel()
  }

  // Projects

  const openSheet = (name: SheetName) => {
    if (name === 'projects') void store.list().then(setProjects)
    setImportError(null)
    setSheet(name)
  }

  const openProject = async (id: string) => {
    setSheet(null)
    if (id === projectRef.current?.id) return
    await flush()
    const next = await store.get(id)
    if (next) show(next)
  }

  const newProject = async (templateId: string) => {
    setSheet(null)
    await flush()
    show(await store.createFromTemplate(templateId))
  }

  const renameProject = () => {
    const current = projectRef.current
    if (!current) return
    setSheet(null)
    setNameRequest({
      title: 'Rename project',
      label: 'Project name',
      initial: current.name,
      submitLabel: 'Rename',
      submit: (value) => {
        const check = validateProjectName(value)
        if (!check.ok) return check.error
        update((p) => ({ ...p, name: check.name }), IMMEDIATE)
        return null
      },
    })
  }

  const deleteProject = async () => {
    const current = projectRef.current
    setSheet(null)
    if (!current) return
    replace(null)
    await store.delete(current.id)
    show(await store.openInitial())
  }

  const downloadProject = () => {
    const current = projectRef.current
    if (!current) return
    const blob = new Blob([JSON.stringify(exportProject(current), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = exportFileName(current)
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    setSheet(null)
  }

  const importProject = async (file: File | undefined) => {
    if (!file) return
    try {
      const data = parseProjectExport(await file.text())
      await flush()
      const imported = await store.importProject(data)
      setSheet(null)
      show(imported)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error))
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  const setMode = (mode: Project['mode']) => {
    if (projectRef.current?.mode === mode) return
    update((p) => ({ ...p, mode }), IMMEDIATE)
    runImmediately()
  }

  // Files

  const selectFile = (id: string) => {
    const current = projectRef.current
    const file = current?.files.find((f) => f.id === id)
    if (!current || !file) return
    if (id === current.activeFileId) {
      openSheet('file')
      return
    }
    editor.current?.open(file.id, file.code)
    update((p) => ({ ...p, activeFileId: id }), IMMEDIATE)
  }

  const addFile = () => {
    const current = projectRef.current
    if (!current) return
    const names = current.files.map((f) => f.name)
    setNameRequest({
      title: 'New file',
      label: 'File name (.js or .ts)',
      initial: uniqueFileName('sketch.js', names),
      submitLabel: 'Add',
      submit: (value) => {
        const check = validateFileName(value, names)
        if (!check.ok) return check.error
        const file = { id: newId(), name: check.name, code: `// ${check.name}\n` }
        editor.current?.open(file.id, file.code)
        update((p) => ({ ...p, files: [...p.files, file], activeFileId: file.id }), IMMEDIATE)
        runSoon()
        return null
      },
    })
  }

  const activeFile = project?.files.find((f) => f.id === project.activeFileId) ?? project?.files[0]
  const activeIndex = project && activeFile ? project.files.indexOf(activeFile) : -1

  const renameFile = () => {
    const current = projectRef.current
    if (!current || !activeFile) return
    setSheet(null)
    const others = current.files.filter((f) => f.id !== activeFile.id).map((f) => f.name)
    setNameRequest({
      title: 'Rename file',
      label: 'File name (.js or .ts)',
      initial: activeFile.name,
      submitLabel: 'Rename',
      submit: (value) => {
        const check = validateFileName(value, others)
        if (!check.ok) return check.error
        update((p) => ({ ...p, files: p.files.map((f) => (f.id === activeFile.id ? { ...f, name: check.name } : f)) }), IMMEDIATE)
        runSoon()
        return null
      },
    })
  }

  const moveActiveFile = (step: -1 | 1) => {
    if (!activeFile) return
    update((p) => ({ ...p, files: moveFile(p.files, activeFile.id, step) }), IMMEDIATE)
    runSoon()
  }

  const deleteFile = () => {
    const current = projectRef.current
    setSheet(null)
    if (!current || !activeFile || current.files.length < 2) return
    const index = current.files.indexOf(activeFile)
    const files = current.files.filter((f) => f.id !== activeFile.id)
    const next = files[Math.min(index, files.length - 1)]
    editor.current?.open(next.id, next.code)
    editor.current?.forget(activeFile.id)
    update((p) => ({ ...p, files, activeFileId: next.id }), IMMEDIATE)
    runImmediately()
  }

  // Layout

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

  return (
    <div class={`app ${wide ? 'wide' : 'narrow'}`} style={{ '--keyboard-inset': `${viewport.keyboardInset}px` }}>
      <header class="bar">
        <button type="button" class="icon-button" aria-label="Open projects" onClick={() => openSheet('projects')}>
          <MenuIcon />
        </button>
        <div class="title">
          <h1>{project?.name ?? ''}</h1>
          <span class="muted">{project ? `${MODE_NAMES[project.mode]} sketch` : loadError ?? 'Loading…'}</span>
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
            <button type="button" class="icon-button" aria-label="More options" onClick={() => openSheet('more')}>
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
            <button type="button" class="icon-button" aria-label="More options" onClick={() => openSheet('more')}>
              <MoreIcon />
            </button>
          </>
        )}
      </header>

      {saveFailed && (
        <p class="banner" role="alert">
          Could not save to this device. Export the project to keep a copy.
        </p>
      )}

      <nav class="tabs" aria-label="Files">
        <div class="tab-list">
          {project?.files.map((file) => (
            <button
              key={file.id}
              type="button"
              class="tab"
              aria-current={file.id === activeFile?.id ? 'true' : undefined}
              aria-haspopup={file.id === activeFile?.id ? 'dialog' : undefined}
              onClick={() => selectFile(file.id)}
            >
              {file.name}
            </button>
          ))}
          {project && project.files.length < MAX_FILES && (
            <button type="button" class="icon-button" aria-label="New file" onClick={addFile}>
              <PlusIcon size={20} />
            </button>
          )}
        </div>
        {wide && (
          <span class="chip" title="Libraries loaded into the sketch">
            paper {PAPER_VERSION}
          </span>
        )}
      </nav>

      <main class={`workspace${consoleShown ? '' : ' console-hidden'}`}>
        <div class="stage-area">
          <section class="editor" aria-label="Editor" ref={editorRef} />
          <section class={`preview ${previewMode}${stale ? ' stale' : ''}`} aria-label="Preview" aria-busy={busy ? 'true' : undefined} style={previewStyle}>
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
        <ConsolePanel entries={entries} drawer={!wide} open={drawerOpen} onToggle={() => setDrawerOpen((open) => !open)} />
      </main>

      <SymbolStrip editor={() => editor.current} />

      <Sheet open={sheet === 'projects'} title="Projects" onClose={() => setSheet(null)}>
        <div class="choice-list">
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              class="choice"
              aria-label={p.name}
              aria-describedby={`project-${p.id}`}
              aria-pressed={p.id === project?.id}
              onClick={() => void openProject(p.id)}
            >
              <span aria-hidden="true">{p.name}</span>
              <span class="muted" id={`project-${p.id}`}>
                {p.fileCount === 1 ? '1 file' : `${p.fileCount} files`} · {MODE_NAMES[p.mode]}
              </span>
            </button>
          ))}
        </div>
        <div class="sheet-actions">
          <button type="button" class="secondary" onClick={() => importRef.current?.click()}>
            Import
          </button>
          <button type="button" class="primary" onClick={() => openSheet('templates')}>
            New project
          </button>
        </div>
        {importError && (
          <p class="form-error" role="alert">
            {importError}
          </p>
        )}
        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          class="hidden-input"
          aria-label="Import project file"
          tabIndex={-1}
          onChange={(event) => void importProject((event.target as HTMLInputElement).files?.[0])}
        />
      </Sheet>

      <Sheet open={sheet === 'templates'} title="New project" onClose={() => setSheet(null)}>
        <div class="choice-list">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              class="choice stacked"
              aria-label={template.label}
              aria-describedby={`template-${template.id}`}
              onClick={() => void newProject(template.id)}
            >
              <span aria-hidden="true">{template.label}</span>
              <span class="muted" id={`template-${template.id}`}>
                {template.description}
              </span>
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === 'file'} title={activeFile?.name ?? 'File'} onClose={() => setSheet(null)}>
        <p class="sheet-note">Files run in tab order, in one shared scope.</p>
        <div class="choice-list">
          <button type="button" class="choice" onClick={renameFile}>
            Rename file
          </button>
          <button type="button" class="choice" disabled={activeIndex <= 0} onClick={() => moveActiveFile(-1)}>
            Move earlier
          </button>
          <button
            type="button"
            class="choice"
            disabled={!project || activeIndex >= project.files.length - 1}
            onClick={() => moveActiveFile(1)}
          >
            Move later
          </button>
          <button
            type="button"
            class="choice danger"
            disabled={!project || project.files.length < 2}
            onClick={() => openSheet('delete-file')}
          >
            Delete file
          </button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'delete-file'} title="Delete file?" onClose={() => setSheet(null)}>
        <p class="sheet-note">{activeFile?.name} will be removed from this project. This cannot be undone.</p>
        <div class="sheet-actions">
          <button type="button" class="secondary" onClick={() => setSheet(null)}>
            Cancel
          </button>
          <button type="button" class="primary danger" onClick={deleteFile}>
            Delete
          </button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'delete-project'} title="Delete project?" onClose={() => setSheet(null)}>
        <p class="sheet-note">
          {project?.name} and its files will be removed from this device. Export it first to keep a copy.
        </p>
        <div class="sheet-actions">
          <button type="button" class="secondary" onClick={() => setSheet(null)}>
            Cancel
          </button>
          <button type="button" class="primary danger" onClick={() => void deleteProject()}>
            Delete
          </button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'more'} title="Options" onClose={() => setSheet(null)}>
        <h3 class="sheet-label">Project</h3>
        <div class="choice-list">
          <button type="button" class="choice" onClick={renameProject}>
            Rename project
          </button>
          <button type="button" class="choice" onClick={downloadProject}>
            Export project
          </button>
          <button type="button" class="choice danger" onClick={() => openSheet('delete-project')}>
            Delete project
          </button>
        </div>
        <h3 class="sheet-label">Language</h3>
        <div class="choice-list">
          {(['paperscript', 'javascript'] as const).map((mode) => (
            <button key={mode} type="button" class="choice" aria-pressed={project?.mode === mode} onClick={() => setMode(mode)}>
              {MODE_NAMES[mode]}
            </button>
          ))}
        </div>
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

      <NameSheet request={nameRequest} onClose={() => setNameRequest(null)} />
    </div>
  )
}
