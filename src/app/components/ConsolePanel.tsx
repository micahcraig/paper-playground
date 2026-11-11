import type { ConsoleEntry } from '../console'
import { ChevronDownIcon, ChevronUpIcon } from './icons'

interface ConsolePanelProps {
  entries: ConsoleEntry[]
  /** Narrow layout: a peek bar that opens into a drawer. */
  drawer: boolean
  open: boolean
  onToggle: () => void
}

function summary(entries: ConsoleEntry[]): { text: string; tone: 'error' | 'warn' } | null {
  const errors = entries.filter((entry) => entry.level === 'error').length
  if (errors) return { text: errors === 1 ? '1 error' : `${errors} errors`, tone: 'error' }
  const warnings = entries.filter((entry) => entry.level === 'warn').length
  if (warnings) return { text: warnings === 1 ? '1 warn' : `${warnings} warns`, tone: 'warn' }
  return null
}

export function ConsolePanel({ entries, drawer, open, onToggle }: ConsolePanelProps) {
  const counts = summary(entries)
  const last = entries.at(-1)

  return (
    <section class={`console${drawer ? ' drawer' : ''}${open ? ' open' : ''}`} aria-label="Console">
      {drawer ? (
        <button type="button" class="console-peek" aria-expanded={open} aria-label={open ? 'Close console' : 'Open console'} onClick={onToggle}>
          {open ? <ChevronDownIcon size={20} /> : <ChevronUpIcon size={20} />}
          <span class="console-name">Console</span>
          <span class="console-last">{last?.text ?? ''}</span>
          {counts && <span class={`console-count ${counts.tone}`}>{counts.text}</span>}
        </button>
      ) : (
        <div class="console-head">
          <span>CONSOLE</span>
          {counts && <span class={`console-count ${counts.tone}`}>{counts.text}</span>}
        </div>
      )}
      <ol class="console-lines" data-testid="console">
        {entries.map((entry) => (
          <li key={entry.id} class={`level-${entry.level}`}>
            <span class="text">{entry.text}</span>
            {entry.location && <span class="location">{entry.location}</span>}
          </li>
        ))}
      </ol>
    </section>
  )
}
