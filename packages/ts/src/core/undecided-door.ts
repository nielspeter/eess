import type { Door } from '@nielspeter/eess/internal'

/**
 * ADR-021's floor for eess-ts: its builders hand back no undecided findings of their own, so the
 * kernel's `matchingElements` refuses an undecided subject, and this says so truthfully here, where
 * `violations()` is the call that refused.
 */
export const TS_RULE: Door = {
  name: 'an eess-ts rule',
  remedy:
    'or use a predicate that can judge every subject: eess-ts rules refuse an undecided subject ' +
    'rather than report it (ADR-021)',
}
