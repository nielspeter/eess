# Bug 0506: a section matcher with a `g` or `y` flag skips every other document

## Status

- **State:** Draft — reproduced 2026-10-19 on main's build (`9675402`); recorded from proposal 017's
  "Records owed" and PR #247's enforcement review (I1). No red test written yet.
- **Severity:** Medium — a silent drop in selector position, so a rule can be green on documents it
  never examined. It needs the caller to pass a `g` or `y` flag, which nothing refuses.
- **Origin:** self-found · proposal 017's second Review (records owed); reproduced while revising
  plan 0496.
- **Reported:** 2026-10-19

## Symptom

`matchName` calls `.test()` on the caller's `RegExp` as given, in two copies:

- `packages/md/src/model/query.ts:4-6`, used by `hasSection` (`docs().haveSection()` in both
  phases, the root `haveSection` condition, the root section predicate, `predicateHaveSection` once ADR-023's pull request lands) and by `inSection` (tables'
  `section` option and `links().areInSection()`);
- `packages/crossvalidate/src/md-ts.ts:31-33`, used to find the ADR table's section.

A `g` or `y` flag makes `.test()` stateful: `lastIndex` moves past a match and the next call
starts there. So one `RegExp` shared across documents matches, then fails on the next document's
heading, then matches again. The package already knows the hazard for terms
(`packages/md/src/builders/vocabulary.ts:122`: "Non-global copy: a caller's /g regex would carry
lastIndex across lines"), but `matchName` does not copy.

## Reproduction

Four documents, `p1.md` to `p4.md`, each holding only `## Phase N` and a line of text, read with
`corpus({ cwd, roots: ['**/*.md'] })`:

| rule                                                                              | result                                                                                                        |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `docs(c).should().haveSection(/^Phase \d/)`                                       | 0 findings                                                                                                    |
| `docs(c).should().haveSection(/^Phase \d/g)`                                      | 2 findings, `p2.md` and `p4.md` (false red)                                                                   |
| `docs(c).that().haveSection(/^Phase \d/g).should().haveTable({ columns: [/X/] })` | `examined` 2, findings on `p1.md` and `p3.md` only; `p2.md` and `p4.md` lack the table and are never examined |

The last row is the fail-open one: the rule is red, but on half the documents it should be, and a
corpus where only `p2.md` lacked the table would be green.

## Root cause

`matchName` reuses the caller's `RegExp` object without removing `g` and `y`.

## Fix

Strip `g` and `y` once, when the matcher is taken (a non-global copy, as `vocabulary.ts` makes), in
one place. Plan 0496 builds on md's `matchName` and strips the flags there in its build, with a test
row and a sabotage row, which closes the md copy: plan 0496's ledger disposes this bug's first box for md in the same pull
request and updates the board row, so the md half is never fixed without a record. This bug owns the crossvalidate copy: it should
import md's matcher (through `@nielspeter/eess-md/internal`, as it already does for `proseText`)
rather than keep a second one. The md verdict change ships in plan 0496's release note; if this bug
is fixed first, it takes both copies and plan 0496 only relies on it.

## Verification

- [ ] Red first: the third row above examines 4 and reports all four documents
- [ ] Red first: the crossvalidate ADR binding with a `g`-flagged section finds the table in every
      document
- [ ] One matcher for both packages; `npm run validate` green

Deferred: none
