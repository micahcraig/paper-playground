import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { bracketMatching, indentOnInput, indentUnit } from '@codemirror/language'
import { EditorState, type Extension } from '@codemirror/state'
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { editorHighlighting, editorTheme } from './theme'

/**
 * Attributes on the editable element. Gboard would otherwise autocorrect,
 * capitalise and suggest words inside code.
 */
export const CONTENT_ATTRIBUTES = {
  autocorrect: 'off',
  autocapitalize: 'off',
  autocomplete: 'off',
  spellcheck: 'false',
  writingsuggestions: 'false',
  translate: 'no',
  'aria-label': 'Code editor',
} as const

export interface CodeEditor {
  view: EditorView
  /** Scrolls the caret into view, with room around it, if the editor has focus. */
  revealCaret(): void
  /**
   * Shows the document for `key` (a file id). Each key keeps its own undo
   * history and selection; `code` is used the first time a key is opened.
   * Switching does not report a change.
   */
  open(key: string, code: string): void
  /** Drops a key's saved state, for a deleted file. */
  forget(key: string): void
  /** Drops every saved state, for a project switch. */
  clear(): void
  destroy(): void
}

export interface EditorOptions {
  parent: HTMLElement
  onChange: (key: string, code: string) => void
}

/**
 * The selection is the browser's own (no drawSelection), so Android's
 * touch handles, caret drag and Gboard composition work as they do anywhere.
 */
export function createEditor({ parent, onChange }: EditorOptions): CodeEditor {
  let currentKey: string | null = null
  const states = new Map<string, EditorState>()
  const extensions: Extension[] = [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    indentOnInput(),
    bracketMatching(),
    highlightActiveLine(),
    javascript(),
    editorHighlighting,
    editorTheme,
    EditorView.lineWrapping,
    EditorState.tabSize.of(2),
    indentUnit.of('  '),
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    EditorView.contentAttributes.of(CONTENT_ATTRIBUTES),
    EditorView.updateListener.of((update) => {
      if (update.docChanged && currentKey !== null) onChange(currentKey, update.state.doc.toString())
    }),
  ]
  const view = new EditorView({ parent, state: EditorState.create({ doc: '', extensions }) })
  return {
    view,
    revealCaret() {
      if (!view.hasFocus) return
      const head = view.state.selection.main.head
      view.dispatch({ effects: EditorView.scrollIntoView(head, { y: 'nearest', yMargin: 48 }) })
    },
    open(key, code) {
      if (key === currentKey) return
      if (currentKey !== null) states.set(currentKey, view.state)
      currentKey = key
      view.setState(states.get(key) ?? EditorState.create({ doc: code, extensions }))
    },
    forget(key) {
      states.delete(key)
    },
    clear() {
      states.clear()
      currentKey = null
      view.setState(EditorState.create({ doc: '', extensions }))
    },
    destroy() {
      view.destroy()
    },
  }
}
