/**
 * `frozen` is the corpus's only subtraction — and nothing checked what it took.
 *
 * Bug 0249 widened `ROOTS` to `work/**`, which made the default COVERED rather
 * than uncovered: a directory added under `work/` is checked without anyone
 * remembering to list it. That moved the whole risk into `frozen`, the one
 * remaining place a region can leave the examined set — and `frozen` had no
 * guard at all.
 *
 * **Measured, on the tree that shipped the widening.** Appending `'work/**'` to
 * the frozen list drops live pointers from 463 to 18 — 96% of pointer checking
 * gone — and `check:corpus` still exits 0 with a green summary. The link half
 * does not notice either: a frozen document's links are still gated, so the
 * `work/`-rooted broken-link probe (`gateCorpusWorkRoot`) stays green through
 * that exact mutation. Only a *pointer* in a live region tells the two apart,
 * which is why `gateCorpusWorkPointer` exists beside it.
 *
 * The doctrine `frozen` actually encodes is narrow and already written down at
 * its call site: **a document is frozen because it sits in a terminal folder** —
 * a record that concluded (`completed/`, `wont-do/`, `fixed/`, `archived/`) or a
 * spike, whose dated report is not held to today's line numbers. Every glob in
 * the list today is that doctrine spelled as a path. Nothing enforced it, so the
 * doctrine was a comment and the list was free.
 *
 * This turns the comment into the check. It reads the globs, not the corpus: a
 * config guard has to fire on the edit that breaks it, including on a corpus too
 * empty to notice. It follows `unclassifiedRoots`' precedent in the same script —
 * refuse to run rather than guess — because a corpus gate that silently examines
 * 4% of what it claims is worth less than one that will not start.
 */

/**
 * The names that make a folder terminal. Adding to this list is the deliberate,
 * reviewable act of declaring a new kind of concluded record — which is the
 * point: it moves "freeze a lane" from an unremarkable glob edit to a change
 * that names what it is doing.
 */
export const TERMINAL_FOLDER_NAMES = ['completed', 'wont-do', 'fixed', 'archived', 'spikes']

export const FROZEN_SCOPE_RULE = 'corpus/frozen-scope'

/**
 * The folder a `frozen` glob ultimately freezes: the last real path segment,
 * with the trailing `/**` recursion stripped.
 *
 * Returns `null` when the glob does not end in a nameable folder — a single-star
 * segment or a bare recursion freezes by shape rather than by name, and a shape
 * cannot be checked against a doctrine written in names.
 */
export function frozenFolderName(glob) {
  const segments = glob.split('/').filter((s) => s !== '' && s !== '**')
  const last = segments.at(-1)
  if (last === undefined || last.includes('*')) return null
  return last
}

/**
 * Every `frozen` glob that does not reduce to a terminal folder name.
 *
 * Returns the offending globs, not a boolean: the caller names them in its
 * refusal, and a list of one is the common case worth reading exactly.
 */
export function nonTerminalFreezes(frozenGlobs) {
  return frozenGlobs.filter((glob) => {
    const name = frozenFolderName(glob)
    return name === null || !TERMINAL_FOLDER_NAMES.includes(name)
  })
}

/** The refusal text, kept here so the fixture asserts the message the gate prints. */
export function frozenScopeRefusal(offenders) {
  return (
    `check:corpus: ${offenders.join(', ')} in \`frozen\` does not name a terminal folder ` +
    `(${TERMINAL_FOLDER_NAMES.join(', ')}). Freezing is for records that concluded — a glob ` +
    `over a live lane silently stops examining its pointers while the gate still exits 0 ` +
    `(measured: \`work/**\` takes live pointers from 463 to 18, green). If this really is a ` +
    `new kind of concluded record, add its folder name to TERMINAL_FOLDER_NAMES in ` +
    `scripts/lib/frozen-scope.mjs and say so there.`
  )
}
