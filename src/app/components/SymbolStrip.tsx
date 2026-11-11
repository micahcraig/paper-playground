import type { CodeEditor } from '../../editor/editor'
import { SYMBOL_KEYS, applySymbol } from '../../editor/symbols'

/** Keeps focus (and the on-screen keyboard) in the editor when a key is pressed. */
const keepFocus = (event: Event) => event.preventDefault()

export function SymbolStrip({ editor }: { editor: () => CodeEditor | null }) {
  const press = (index: number) => {
    const current = editor()
    if (!current) return
    applySymbol(current.view, SYMBOL_KEYS[index].action)
    current.view.focus()
  }

  const keys = SYMBOL_KEYS.map((key, index) => ({ key, index }))
  const render = ({ key, index }: (typeof keys)[number]) => (
    <button
      key={key.ariaLabel}
      type="button"
      class={key.label.length > 2 ? 'key wide-key' : 'key'}
      aria-label={key.ariaLabel}
      onPointerDown={keepFocus}
      onMouseDown={keepFocus}
      onClick={() => press(index)}
    >
      {key.label}
    </button>
  )

  return (
    <footer class="symbols" aria-label="Symbol keys">
      {keys.filter(({ key }) => key.group === 'keys').map(render)}
      <div class="symbols-gap" />
      {keys.filter(({ key }) => key.group === 'history').map(render)}
    </footer>
  )
}
