import type { Door } from '@nielspeter/eess/internal'

/**
 * ADR-021's floor for eess-ts: its builders hand back no undecided findings of their own, so the
 * kernel's `matchingElements` refuses an undecided subject, and this says so truthfully here, where
 * `violations()` is the call that refused.
 */
const REMEDY =
  'or use a predicate that can judge every subject: eess-ts rules refuse an undecided subject ' +
  'rather than report it (ADR-021)'

export const TS_RULE: Door = { name: 'an eess-ts rule', remedy: REMEDY }

/** `.select()` on an eess-ts builder: the same remedy, since its `check()` refuses as well. */
export const TS_SELECT: Door = { name: 'select()', remedy: REMEDY }
