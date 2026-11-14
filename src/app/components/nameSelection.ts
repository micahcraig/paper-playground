export interface TextField {
  value: string
  selectionStart: number | null
  selectionEnd: number | null
}

/**
 * The range to select when a name sheet opens: the stem of the suggested
 * name, so typing replaces it but keeps the extension. Null when the field
 * has moved on (edited, or a range already selected), so a late call never
 * narrows a selection the user made.
 */
export function stemSelection(initial: string, field: TextField): [number, number] | null {
  if (field.value !== initial) return null
  if (field.selectionStart !== field.selectionEnd) return null
  const dot = initial.lastIndexOf('.')
  return [0, dot > 0 ? dot : initial.length]
}
