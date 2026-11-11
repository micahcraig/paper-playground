import type { ComponentChildren } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { CloseIcon } from './icons'

interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ComponentChildren
}

/** A modal sheet built on <dialog>, so focus, Escape and the backdrop behave natively. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const openRef = useRef(open)
  openRef.current = open

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      class="sheet"
      aria-label={title}
      // Closing from code (open became false) also fires "close"; only report
      // closes the user made, such as Escape, or the next sheet would close too.
      onClose={() => {
        if (openRef.current) onClose()
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === ref.current) onClose()
      }}
    >
      <div class="sheet-head">
        <h2>{title}</h2>
        <button type="button" class="icon-button" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <div class="sheet-body">{children}</div>
    </dialog>
  )
}
