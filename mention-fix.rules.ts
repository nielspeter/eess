/**
 * mention-fix.rules.ts — plan 0542's lanes: this repository's plain record mentions are linked with
 * plan 0550's fix, one lane per PR, the way an adopter runs it.
 *
 *   eess-ts check mention-fix.rules.ts --fix            the dry run: what each fix would write
 *   eess-ts check mention-fix.rules.ts --fix --apply    writes them
 *
 * The rule, its records and the left-out list are `scripts/lib/record-mention.mjs`'s, which
 * `check:corpus` judges with, so the gate and the fix read a mention the same way. One rule per
 * `LANE` glob: a glob that matches nothing is then named as a dead glob, not hidden by the others.
 * Two globs that share a document are refused, since two rules would fix it.
 *
 * Between lanes `LANE` is empty and the file declares no rule. Phase 9 deletes it.
 */
import { corpus } from '@nielspeter/eess-md'
import {
  CORPUS_ROOTS,
  anachronismsByGlob,
  assertLaneDisjoint,
  mentionFixRule,
} from './scripts/lib/record-mention.mjs'

/** The lane being migrated, its globs. */
const LANE: readonly string[] = []

/**
 * The lane's anachronisms, and only this lane's: the output of
 * `node scripts/lib/mention-anachronisms.mjs <LANE's globs>` at the lane's base. Each rule holds the
 * entries under its own glob; an entry under none or under two throws, and one its rule does not
 * match prints "Unused exclusion". Each stops the lane.
 */
const ANACHRONISMS: readonly string[] = []

/**
 * Fixes the lane's judge read as wrong, left out by element before applying, each with its cause (the
 * plan records it). Split by glob as the anachronisms are.
 */
const JUDGED_WRONG: readonly string[] = []

const c = corpus({ roots: CORPUS_ROOTS })
assertLaneDisjoint(LANE, c.fileIndex)
const excluded = anachronismsByGlob(LANE, [...ANACHRONISMS, ...JUDGED_WRONG])

export default LANE.map((glob) =>
  mentionFixRule(c, glob)
    .excluding(...(excluded.get(glob) ?? []))
    .because('a record named by number is one click from what it names only when it is a link')
    .rule({ id: `mention-fix/${glob}` }),
)
