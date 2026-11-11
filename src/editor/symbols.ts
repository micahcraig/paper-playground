import { cursorCharLeft, cursorCharRight, indentMore, redo, undo } from '@codemirror/commands'
import { indentUnit } from '@codemirror/language'
import type { EditorView } from '@codemirror/view'

export type SymbolAction =
  | { kind: 'insert'; text: string }
  | { kind: 'indent' }
  | { kind: 'left' }
  | { kind: 'right' }
  | { kind: 'undo' }
  | { kind: 'redo' }

export interface SymbolKey {
  label: string
  ariaLabel: string
  action: SymbolAction
  /** Undo and redo sit apart from the typing keys. */
  group: 'keys' | 'history'
}

const insert = (text: string, ariaLabel = `Insert ${text}`): SymbolKey => ({
  label: text,
  ariaLabel,
  action: { kind: 'insert', text },
  group: 'keys',
})

/** The symbol strip, in order (UI spec in PLAN.md). */
export const SYMBOL_KEYS: SymbolKey[] = [
  { label: 'Tab', ariaLabel: 'Indent', action: { kind: 'indent' }, group: 'keys' },
  { label: '←', ariaLabel: 'Move left', action: { kind: 'left' }, group: 'keys' },
  { label: '→', ariaLabel: 'Move right', action: { kind: 'right' }, group: 'keys' },
  insert('{'),
  insert('}'),
  insert('('),
  insert(')'),
  insert('['),
  insert(']'),
  insert(';'),
  insert('='),
  insert('"', 'Insert double quote'),
  insert('=>'),
  { label: 'Undo', ariaLabel: 'Undo', action: { kind: 'undo' }, group: 'history' },
  { label: 'Redo', ariaLabel: 'Redo', action: { kind: 'redo' }, group: 'history' },
]

/**
 * Applies a symbol key. Tab indents the selected lines, or inserts one indent
 * unit at an empty caret, like a hardware Tab in the editor.
 */
export function applySymbol(view: EditorView, action: SymbolAction): void {
  switch (action.kind) {
    case 'insert':
      view.dispatch(view.state.replaceSelection(action.text), { scrollIntoView: true, userEvent: 'input.type' })
      break
    case 'indent': {
      const { state } = view
      const multiLine = state.selection.ranges.some(
        (range) => state.doc.lineAt(range.from).number !== state.doc.lineAt(range.to).number,
      )
      if (multiLine) indentMore(view)
      else view.dispatch(state.replaceSelection(state.facet(indentUnit)), { scrollIntoView: true, userEvent: 'input.type' })
      break
    }
    case 'left':
      cursorCharLeft(view)
      break
    case 'right':
      cursorCharRight(view)
      break
    case 'undo':
      undo(view)
      break
    case 'redo':
      redo(view)
      break
  }
}
