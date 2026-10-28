# Bug 0510: a frozen glob that marks every document empties `areLive()` without a word

## Status

- **State:** Draft — recorded 2026-10-19 as [bug 0499](./fixed/0499-corpus-does-not-check-its-frozen-globs.md)'s residual; measured on branch
  `fix/fail-open-batch`, no red test yet.
- **Severity:** Low — it needs a frozen glob as wide as the corpus, which a reviewer sees; the
  narrower faults (a glob that can never match, or marks nothing) are refused since [bug 0499](./fixed/0499-corpus-does-not-check-its-frozen-globs.md).
- **Origin:** self-found · [bug 0499](./fixed/0499-corpus-does-not-check-its-frozen-globs.md)'s build (its reproduction's third row)
- **Reported:** 2026-10-19

## Symptom

`corpus({ cwd, roots: ['**/*.md'], frozen: ['**'] })` marks every loaded document frozen, so
`areLive()` selects none, and an absence rule scoped to it is green with nothing examined. [Bug 0499](./fixed/0499-corpus-does-not-check-its-frozen-globs.md)
judges a caller's frozen glob for text faults and for marking no document; a glob that marks every
document passes both.

## Reproduction

Measured 2026-10-19 over `archive/old.md` (an open box) and `live.md` (a done box):
`taskItems(c).that().areOpen().satisfy(inDocuments(areLive())).should().notExist()` gives 0
findings, examined 0.

## Root cause

`areLive()` and `areFrozen()` carry no globs for the selector-fault check, and `corpus()` judges
only the dead side of a frozen glob. A frozen set equal to the corpus is not refused because it can
be intended: a corpus rooted only in a done folder (`roots: ['work/plans/completed/**']`) is frozen
throughout under the default globs.

## Fix

Undecided. The two candidates: judge "every loaded document frozen" at load when the caller's globs
did it and the roots name a live folder, or make `areLive()`/`areFrozen()` report through the
selector-fault hook which frozen globs emptied them. The second answers on the rule that would pass,
not on every corpus.

## Verification

- [ ] Red test written first: the reproduction above reds.
- [ ] `npm run validate` green.

Deferred: none
