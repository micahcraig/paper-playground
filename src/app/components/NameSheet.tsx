import { useEffect, useRef, useState } from 'preact/hooks'
import { Sheet } from './Sheet'

export interface NameRequest {
  title: string
  label: string
  initial: string
  submitLabel: string
  /** Returns an error to show, or null when the name was accepted. */
  submit: (value: string) => string | null | Promise<string | null>
}

/** Asks for a name: a new file, or renaming a file or project. */
export function NameSheet({ request, onClose }: { request: NameRequest | null; onClose: () => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!request) return
    setValue(request.initial)
    setError(null)
    // Select the stem so typing replaces the name but keeps the extension.
    requestAnimationFrame(() => {
      const el = input.current
      if (!el) return
      el.focus()
      const dot = request.initial.lastIndexOf('.')
      el.setSelectionRange(0, dot > 0 ? dot : request.initial.length)
    })
  }, [request])

  const onSubmit = async (event: Event) => {
    event.preventDefault()
    if (!request) return
    const problem = await request.submit(value)
    if (problem) setError(problem)
    else onClose()
  }

  return (
    <Sheet open={request !== null} title={request?.title ?? ''} onClose={onClose}>
      <form class="name-form" onSubmit={onSubmit}>
        <label class="sheet-label" for="name-input">
          {request?.label}
        </label>
        <input
          id="name-input"
          ref={input}
          class="text-input"
          value={value}
          autocomplete="off"
          autocapitalize="off"
          spellcheck={false}
          aria-invalid={error !== null}
          aria-describedby={error ? 'name-error' : undefined}
          onInput={(event) => {
            setValue((event.target as HTMLInputElement).value)
            setError(null)
          }}
        />
        {error && (
          <p id="name-error" class="form-error" role="alert">
            {error}
          </p>
        )}
        <div class="sheet-actions">
          <button type="button" class="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" class="primary">
            {request?.submitLabel}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
