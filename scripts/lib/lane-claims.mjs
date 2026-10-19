/**
 * Plan 0481 — every document under `work/` is claimed by exactly one selection: one of `LANES`, or
 * one of `UNLANED`. Proposal 017's block 6, stated in eess-md's own blocks rather than by hand: two
 * `notExist()` rules over the selections (plan 0456's recipe, `examples/md/unclaimed-and-double-claimed.test.ts`).
 *
 * Beside `findUncoveredLanes`, not instead of it. Measured when this landed: the rules judge
 * documents by path, so a new folder under `work/` reds here whether or not it holds records,
 * which `findUncoveredLanes` (records only, folders only) does not see; and a `State:` record
 * written into an unlaned folder (`work/spikes/`) is claimed here, so only `findUncoveredLanes`,
 * which reads the State the way `ledgerStats` does, reds it. Each states what the other cannot.
 *
 * The corpus's only root is `work/**`, so a mistyped root loads nothing and is an empty source
 * rather than a pass; a lane glob with a text fault is reported on the second rule, whose
 * selection is positive (plan 0456's selector-fault check).
 */
import { and, corpus, docs, not, or, resideInFile, resideInFolder } from '@nielspeter/eess-md'

export const UNCLAIMED_DOCUMENT_RULE = 'ledger/unclaimed-document'
export const CLAIMED_TWICE_RULE = 'ledger/claimed-twice'

/**
 * @param {ReadonlyArray<{ name: string, roots: readonly string[] }>} lanes
 * @param {ReadonlyArray<{ name: string, glob: string }>} unlaned
 * @param {string} [root] - the folder whose documents must be claimed; default `work`
 * @returns {{ unclaimed: import('@nielspeter/eess').CollectResult, claimedTwice: import('@nielspeter/eess').CollectResult, documents: number, selections: number }}
 */
export function laneClaims(lanes, unlaned, root = 'work') {
  const c = corpus({ roots: [`${root}/**`] })
  const selections = [
    ...lanes.map((lane) => or(...lane.roots.map((glob) => resideInFolder(glob)))),
    ...unlaned.map((u) => (u.glob.endsWith('/**') ? resideInFolder(u.glob) : resideInFile(u.glob))),
  ]
  const pairs = []
  for (let i = 0; i < selections.length; i++) {
    for (let j = i + 1; j < selections.length; j++) pairs.push(and(selections[i], selections[j]))
  }
  const unclaimed = docs(c)
    .that()
    .satisfy(not(or(...selections)))
    .should()
    .notExist()
    .rule({
      id: UNCLAIMED_DOCUMENT_RULE,
      because:
        'a document under work/ that no lane reads and no one declared unlaned is unread by ' +
        'this gate without a word (plan 0481)',
      suggestion:
        'Move it into a lane, or add its folder to UNLANED in scripts/lib/ledger-lanes.mjs ' +
        'if it is meant to sit outside every lane.',
    })
    .violations()
  const claimedTwice = docs(c)
    .that()
    .satisfy(or(...pairs))
    .should()
    .notExist()
    .rule({
      id: CLAIMED_TWICE_RULE,
      because: "a document two selections claim is read under two lanes' words (plan 0481)",
      suggestion:
        'Narrow LANES or UNLANED in scripts/lib/ledger-lanes.mjs so one selection claims it.',
    })
    .violations()
  return { unclaimed, claimedTwice, documents: c.documents().length, selections: selections.length }
}
