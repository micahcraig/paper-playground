import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

/**
 * One theme for both Tokyo Night variants: every colour is a custom property
 * from src/theme/tokens.css, so the editor follows the app theme by itself.
 */
export const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    color: 'var(--text)',
    backgroundColor: 'var(--bg)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--font-code)',
    // Off by default so => matches the key that types it; Options can turn them on.
    fontVariantLigatures: 'var(--code-ligatures)',
    fontSize: 'var(--code-size)',
    lineHeight: 'var(--code-line)',
  },
  '.cm-content': {
    caretColor: 'var(--accent)',
    // --editor-tail lets the app leave room under the last line (the floating preview).
    padding: '8px 0 var(--editor-tail, 32px)',
  },
  '.cm-line': { padding: '0 12px 0 8px' },
  '.cm-gutters': {
    backgroundColor: 'var(--bg)',
    color: 'var(--line-number)',
    border: 'none',
  },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 4px 0 12px', minWidth: '2ch' },
  '.cm-activeLine': { backgroundColor: 'var(--current-line)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--current-line)', color: 'var(--text)' },
  '&.cm-focused .cm-matchingBracket': {
    backgroundColor: 'var(--raised)',
    outline: '1px solid var(--border)',
  },
  '&.cm-focused .cm-nonmatchingBracket': { color: 'var(--warn)' },
})

export const highlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword], color: 'var(--syn-keyword)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.function(t.definition(t.variableName))], color: 'var(--syn-function)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--syn-string)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--syn-number)' },
  { tag: [t.propertyName, t.definition(t.propertyName)], color: 'var(--syn-property)' },
  { tag: [t.standard(t.variableName), t.self, t.className, t.typeName, t.namespace], color: 'var(--syn-builtin)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: t.invalid, color: 'var(--warn)' },
])

export const editorHighlighting = syntaxHighlighting(highlightStyle)
