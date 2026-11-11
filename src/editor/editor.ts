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
  /** Replaces the whole document and its undo history, without reporting a change. */
  setCode(code: string): void
  destroy(): void
}

export interface EditorOptions {
  parent: HTMLElement
  code: string
  onChange: (code: string) => void
}

/**
 * The selection is the browser's own (no drawSelection), so Android's
 * touch handles, caret drag and Gboard composition work as they do anywhere.
 */
export function createEditor({ parent, code, onChange }: EditorOptions): CodeEditor {
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
      if (update.docChanged) onChange(update.state.doc.toString())
    }),
  ]
  const view = new EditorView({ parent, state: EditorState.create({ doc: code, extensions }) })
  return {
    view,
    setCode(next) {
      view.setState(EditorState.create({ doc: next, extensions }))
    },
    destroy() {
      view.destroy()
    },
  }
}
