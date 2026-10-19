# Bug 0499: `corpus()` does not check its frozen globs, so a broken one stays green under `notExist()`

## Status

- **State:** Fixed — 2026-10-19, on branch `fix/fail-open-batch` (with bugs 0508 and 0506's
  crossvalidate half, and plan 0481). Recorded 2026-10-19 from PR #245's enforcement review.
- **Severity:** Medium — a false green on the shape adopters ask for first ("a closed record carries
  no open box", `honestyAtClose` rebuilt from blocks).
- **Origin:** self-found · PR #245's review (enforcement, I1)
- **Reported:** 2026-10-19

## Symptom

`areFrozen()`/`areLive()` (plan 0457) and `pointers().areFrozen()`/`.areLive()` read
`MdDocument.frozen`, which `corpus()` sets from `picomatch(options.frozen ?? DEFAULT_FROZEN)`
(`packages/md/src/corpus.ts:78`). Nothing checks those globs: `corpus()` validates `roots`
(bug 0465) but not `frozen`, and the predicates declare no `globs`, so plan 0456's
`cardinalitySelectorFault()` has nothing to judge. A text-faulted or over-broad `frozen` glob
empties a frozen or live scope without a word under an absence rule.

## Reproduction

Measured 2026-10-19 on PR #245's build, over a two-page corpus (`archive/old.md` with an open box,
`live.md` with a done box):

| rule                                                                                                     | findings | examined |
| -------------------------------------------------------------------------------------------------------- | -------- | -------- |
| `frozen: ['/archive/**']`, `taskItems().areOpen().satisfy(inDocuments(areFrozen())).should().notExist()` | 0        | 0        |
| the same glob as `inDocuments(resideInFolder('/archive/**'))`                                            | 1        | 0        |
| `frozen: ['**']`, `taskItems().areOpen().satisfy(inDocuments(areLive())).should().notExist()`            | 0        | 0        |
| `frozen: ['/archive/**']`, `links().satisfy(inDocuments(areFrozen())).should().resolve()`                | 1        | 0        |

The second row's finding is plan 0456's: "This absence rule examined nothing because its selector
resideInFolder("/archive/\*\*") is broken: a leading `/` …". The fourth row's finding blames the
predicate ("inDocuments(are frozen) matched none of the corpus's 2 documents — the document
predicate is dead"), where the fault is the `frozen` option.

## Root cause

The `frozen` globs are judged nowhere: not at load, as `roots` are, and not at rule time, since
`areFrozen()`/`areLive()` carry no `globs` for the selector-fault check to read. A text check alone
would not be enough: a frozen glob with no text fault that matches no loaded document is dead too.
Measured 2026-10-19 over the same corpus: `frozen: ['archve/**']` (a typo, no leading `/`, not
over-broad) marks 0 documents frozen, and
`taskItems().areOpen().satisfy(inDocuments(areFrozen())).should().notExist()` gives 0 findings with
examined 0, green.

## Fix

Undecided in detail, two checks at load beside each other: `corpus()` judges each `frozen` glob's
text with `globTextFault`, as it does for `roots`; and, as bug 0465 does for a root that matches no
file, it reports a `frozen` glob that matches no loaded document. A dead frozen glob does not fail
closed: it empties `inDocuments(areFrozen())`, so an absence rule over it is green. (It turns
`areLive()` into every document, which is over-strict and visible, but the frozen side is the one
the adopters' ratchet reads.)

## Resolution

`corpus()` judges each frozen glob the caller passes, after it loads the documents
(`frozenGlobFaults` in `packages/md/src/corpus.ts`), and refuses with one `ArchConfigError`
(subject `corpus`) naming every faulted glob:

- a text fault (`/archive/**`, `../archive/**`, a `./` after the first segment), judged always,
  with the corrected glob where one exists. The words are the selector-fault check's: both read
  `repoRelativeTextProblem` (`packages/md/src/builders/selector-fault.ts`), so the two cannot
  describe the same glob differently;
- a glob that marks none of the documents the corpus loaded (`archve/**`), judged only when the
  corpus loaded one.

Decided in the build, from bug 0465's fix and ADR-016/018:

- **A refusal at load, not a finding on each rule's receipt.** Bug 0465 measured the receipt route:
  the kernel's dedupe key includes the rule id, so ten rules over one corpus would report one glob
  ten times. One authored mistake, one refusal, on every door that loads a corpus.
- **"Marks no loaded document", not "matches no file".** A frozen glob outside the roots, or one
  matching only non-Markdown files, freezes nothing a rule reads; it is as dead as a typo.
- **A declaration for an empty frozen folder, `expectEmptyFrozen`** (corrected after review; the
  first build had none). The first build argued that removing a dead frozen glob fails closed, since
  its documents are read as live. That holds only for rules over live documents. For the rule this
  bug exists to protect, an absence rule over the frozen documents
  (`taskItems(c).that().areOpen().satisfy(inDocuments(areFrozen())).should().notExist()`), removal
  fails open: the first record filed in the folder is outside `areFrozen()`, and its open box reds
  nothing. So the remedy is a declaration, as `expectEmptyRoots` is for a root (bug 0475):
  `corpus({ expectEmptyFrozen })` names frozen globs that may mark nothing. A name that is not one of
  `frozen` is refused (with `frozen` omitted, every name is, since the default is not the caller's
  to declare); a declared glob that marks a document is refused, telling the caller to drop the
  declaration (ADR-010 §3); a declaration does not excuse a text fault.
- **The default globs are not judged when `frozen` is omitted.** `**/completed/**` and
  `**/archived/**` are eess-md's convention (ADR-018 C4), not a string the caller wrote, and most
  corpora lack one of them. Written out, the same list is the caller's and is judged; the docs'
  quickstarts passed it explicitly and were changed to omit it (review, PR for this batch).
- **A corpus that loads nothing is not judged for dead frozen globs.** Every glob marks nothing
  there; the empty source is its own finding (bug 0465's precedent). Text faults are still refused.
- **Flagged as an eess-md break** (a minor): it reds corpora that loaded before. It red this
  repository's own `check:corpus`, whose `FROZEN` listed `**/wont-do/**` and `**/archived/**` with
  no record under either. The first build removed both; after review they are back, declared in
  `EMPTY_FROZEN` (`scripts/check-corpus.mjs`), so the first record filed in either folder is
  frozen, and the declaration then expires.
- **Plan 0457's guard-pair test** loaded `frozen: ['archive/**']` over a corpus with no archive; it
  now holds an archived page outside the ratchet's live scope (`packages/md/tests/in-documents.test.ts`).

The reproduction's rows after the fix: the first and fourth are refused at load, naming the
`frozen` option; the second is plan 0456's finding, unchanged; the third (`frozen: ['**']`, every
document frozen, `areLive()` empty) is not refused, because a corpus frozen throughout can be
intended. Re-measured on this branch (0 findings, examined 0) and recorded as
[bug 0510](../0510-a-frozen-glob-that-marks-every-document-empties-arelive.md).

## Verification

- [x] Red test written first: the first table row reds once the glob is judged — `packages/md/tests/corpus-frozen-globs.test.ts`; 4 of its 8 tests failed on the unfixed code (the leading-slash, dead, both-named and text-over-empty rows)
- [ ] validation-owed: `npm run validate` green (it runs after this record is written, at the branch's head; its result is reported on the PR, and CI is the gate)
- [ ] deferred→bug 0510 — a frozen glob that marks every loaded document is not refused

Sabotage matrix (mutant applied to `packages/md/src/corpus.ts`, then restored with `git checkout`):

| row | mutant                          | red in `corpus-frozen-globs.test.ts`                                                                                                                |
| --- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | the text check skipped          | `a frozen glob with a leading slash is refused, with its correction`, `a text-faulted frozen glob is refused even over a corpus that loads nothing` |
| 2   | the dead check skipped          | `a frozen glob that marks no loaded document is refused, naming it`, `every faulted frozen glob is named, in one refusal`                           |
| 3   | the loads-nothing guard removed | `a corpus that loads nothing is left to the empty-source report`                                                                                    |
| 4   | the default globs judged too    | `the default frozen globs are a convention and are not judged`                                                                                      |

`expectEmptyFrozen` (review fix), red first: 5 of its 6 tests failed before the option existed
(the text-fault row already held). Mutants applied to `packages/md/src/corpus.ts`, restored with
`git checkout`:

| row | mutant                             | red in `corpus-frozen-globs.test.ts`                                                                                                                            |
| --- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | the declaration's expiry removed   | `the declaration expires: a declared glob that marks a document is refused`                                                                                     |
| 6   | a name outside `frozen` accepted   | `a declared glob that is not one of the frozen globs is refused`, `declaring a glob with frozen omitted is refused: the default is not the caller's to declare` |
| 7   | a declaration excuses a text fault | `a declaration does not excuse a text fault`                                                                                                                    |
| 8   | the declaration ignored            | `a declared frozen glob that marks no document loads`, `the declaration expires: a declared glob that marks a document is refused`                              |

Deferred: bug 0510
