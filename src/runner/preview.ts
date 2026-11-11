import type { RunnerMessage } from './protocol'

/**
 * What to do with a run that is loading behind the one on screen:
 * - wait: keep it hidden,
 * - show: swap it in,
 * - discard: throw it away and keep the current render.
 */
export type PendingAction = 'wait' | 'show' | 'discard'

/**
 * A new run replaces the preview only once its first pass has finished
 * cleanly, so a syntax or startup error never blanks a good render. When
 * nothing good is on screen, a failing run is shown anyway, since whatever
 * it drew before failing beats an empty preview.
 */
export function settlePending(message: RunnerMessage['type'], shownIsGood: boolean): PendingAction {
  if (message === 'ran') return 'show'
  if (message === 'error') return shownIsGood ? 'discard' : 'show'
  return 'wait'
}
