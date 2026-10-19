# Bug 0499: `corpus()` does not check its frozen globs, so a broken one stays green under `notExist()`

## Status

- **State:** Draft — recorded 2026-10-19 from PR #245's enforcement review; measured on the PR's
  build, no red test yet.
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

## Verification

- [ ] Red test written first: the first table row reds once the glob is judged.
- [ ] `npm run validate` green.

Deferred: none
