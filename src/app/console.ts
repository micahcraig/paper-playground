import { formatLocation } from '../runner/errors'
import type { RunnerEvent } from '../runner/host'
import type { LogLevel } from '../runner/protocol'

export type EntryLevel = LogLevel | 'system'

export interface ConsoleEntry {
  id: number
  level: EntryLevel
  text: string
  /** "file:line:column" for errors inside the user's files. */
  location: string
}

/** The console keeps only the most recent entries. */
export const MAX_ENTRIES = 200

/** The console line for a runner event, or null for events that are not shown. */
export function entryFromEvent(event: RunnerEvent): Omit<ConsoleEntry, 'id'> | null {
  switch (event.type) {
    case 'ready':
    case 'kept':
      return null
    case 'ran':
      return { level: 'system', text: `ran in ${event.elapsedMs} ms`, location: '' }
    case 'log':
      return { level: event.level, text: event.args.join(' '), location: '' }
    case 'error':
      return { level: 'error', text: event.message, location: formatLocation(event.location) }
  }
}

let nextId = 1

export function appendEntry(entries: ConsoleEntry[], entry: Omit<ConsoleEntry, 'id'>): ConsoleEntry[] {
  const next = [...entries, { ...entry, id: nextId++ }]
  return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next
}
