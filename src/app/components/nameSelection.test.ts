import { describe, expect, it } from 'vitest'
import { stemSelection } from './nameSelection'

const caret = (value: string, at = value.length) => ({ value, selectionStart: at, selectionEnd: at })

describe('stemSelection', () => {
  it('selects the stem and leaves the extension', () => {
    expect(stemSelection('untitled.js', caret('untitled.js'))).toEqual([0, 8])
  })

  it('selects the whole name when it has no extension', () => {
    expect(stemSelection('my sketch', caret('my sketch'))).toEqual([0, 9])
  })

  it('treats a leading dot as part of the stem', () => {
    expect(stemSelection('.env', caret('.env'))).toEqual([0, 4])
  })

  it('does nothing once the name was edited', () => {
    expect(stemSelection('untitled.js', caret('size.ts'))).toBeNull()
  })

  it('keeps a selection someone already made', () => {
    // Select-all before typing: narrowing it to the stem would turn "size.ts" into "size.ts.js".
    expect(stemSelection('untitled.js', { value: 'untitled.js', selectionStart: 0, selectionEnd: 11 })).toBeNull()
  })
})
