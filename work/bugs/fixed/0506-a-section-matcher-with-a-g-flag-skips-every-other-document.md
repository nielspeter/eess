# Bug 0506: a section matcher with a `g` or `y` flag skips every other document

## Status

- **State:** Fixed — 2026-10-19: the crossvalidate half on branch `fix/fail-open-batch` (#251), the
  md half by [plan 0496](../../plans/completed/0496-sections-as-elements.md), built on maintainer
  order the same day; one shared matcher is [bug 0511](../0511-a-g-flagged-column-or-table-matcher-skips-tables.md)'s. Reproduced 2026-10-19 on main's build (`9675402`); recorded from
  [proposal 017](../../proposals/017-md-blocks-to-check-a-documents-shape.md)'s "Records owed" and PR #247's enforcement review (I1).
- **Severity:** Medium — a silent drop in selector position, so a rule can be green on documents it
  never examined. It needs the caller to pass a `g` or `y` flag, which nothing refuses.
- **Origin:** self-found · [proposal 017](../../proposals/017-md-blocks-to-check-a-documents-shape.md)'s second Review (records owed); reproduced while revising
  [plan 0496](../../plans/completed/0496-sections-as-elements.md).
- **Reported:** 2026-10-19

## Symptom

`matchName` calls `.test()` on the caller's `RegExp` as given, in two copies:

- `packages/md/src/model/query.ts` at `9675402` (since [plan 0496](../../plans/completed/0496-sections-as-elements.md) `packages/md/src/model/name-match.ts:21-23`, without `g`/`y`), used by `hasSection` (`docs().haveSection()` in both
  phases, the root `haveSection` condition, the root section predicate, `predicateHaveSection` once [ADR-023](../../../adr/023-a-predicate-and-a-condition-that-share-a-word.md)'s pull request lands) and by `inSection` (tables'
  `section` option and `links().areInSection()`);
- `packages/crossvalidate/src/md-ts.ts:31-33`, used to find the ADR table's section.

A `g` or `y` flag makes `.test()` stateful: `lastIndex` moves past a match and the next call
starts there. So one `RegExp` shared across documents matches, then fails on the next document's
heading, then matches again. The package already knows the hazard for terms
(`packages/md/src/builders/vocabulary.ts:132`: "Non-global copy: a caller's /g regex would carry
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
one place. [Plan 0496](../../plans/completed/0496-sections-as-elements.md) builds on md's `matchName` and strips the flags there in its build, with a test
row and a sabotage row, which closes the md copy: [plan 0496](../../plans/completed/0496-sections-as-elements.md)'s ledger disposes this bug's first box for md in the same pull
request and updates the board row, so the md half is never fixed without a record. This bug owns the crossvalidate copy: it should
import md's matcher (through `@nielspeter/eess-md/internal`, as it already does for `proseText`)
rather than keep a second one. The md verdict change ships in [plan 0496](../../plans/completed/0496-sections-as-elements.md)'s release note; if this bug
is fixed first, it takes both copies and [plan 0496](../../plans/completed/0496-sections-as-elements.md) only relies on it.

## Progress

**The crossvalidate half (2026-10-19, branch `fix/fail-open-batch`).** `extractCitations`
(`packages/crossvalidate/src/md-ts.ts`) takes the `section` option once through `nonGlobal`, which
drops `g` and `y`; `adrCitationsResolve` and `adrCitationStats` both read through it. Measured red
first: four ADRs, each holding only `## Enforcement` and a table citing a missing test, gave
`citations` 2 and reported `gone-1` and `gone-3` only under `/^enforcement$/gi`. A title heading
above `## Enforcement` hides the defect: the non-matching heading is tested first and resets
`lastIndex`, so the test's ADRs carry none.

Released as a marked break (`minor`, `**Breaking:**`), corrected after review: a green
`adrCitationsResolve` with a `g`-flagged `section` can now red on a citation it used to skip, the
same reason [plan 0496](../../plans/completed/0496-sections-as-elements.md) marks md's half a break.

Decided against the record: crossvalidate keeps a non-global copy of its own instead of importing
md's matcher. md's `matchName` is not exported, and `packages/md/src/model/query.ts` is [plan 0496](../../plans/completed/0496-sections-as-elements.md)'s
to change in a build running beside this one. The third box below is [bug 0511](../0511-a-g-flagged-column-or-table-matcher-skips-tables.md)'s: it owns the one
shared non-global helper both packages read (moved from [plan 0496](../../plans/completed/0496-sections-as-elements.md) after review, since that plan's
ledger never took the crossvalidate side).

The same hazard on paths this bug does not name (a caller's column matchers in eess-md and
eess-crossvalidate, and `md-mermaid-er`'s section matcher) is
[bug 0511](../0511-a-g-flagged-column-or-table-matcher-skips-tables.md).

Sabotage matrix (mutant applied to `packages/crossvalidate/src/md-ts.ts`, then restored):

| row | mutant                     | red in `packages/crossvalidate/tests/md-ts.test.ts`                                                                                                        |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `section` taken as given   | `finds the table in every ADR, whatever flags the section matcher carries`, `reports the dangling citation in every ADR under a g-flagged section matcher` |
| 2   | only `g` dropped, `y` kept | `finds the table in every ADR, whatever flags the section matcher carries`                                                                                 |

## Verification

- [x] Red first: the third row above examines 4 and reports all four documents — done-otherwise
      for eess-md by [plan 0496](../../plans/completed/0496-sections-as-elements.md): md's matcher strips `g`/`y` once per `RegExp` (`stateless`,
      `packages/md/src/model/name-match.ts`); the row is `bug 0506, md: a g-flagged haveSection
selector examines all four documents` (`packages/md/tests/sections.test.ts`), red with `g`
      kept (`examined` 2) and green with it stripped; [plan 0496](../../plans/completed/0496-sections-as-elements.md)'s changeset carries the verdict
      change
- [x] Red first: the crossvalidate ADR binding with a `g`-flagged section finds the table in every
      document — `packages/crossvalidate/tests/md-ts.test.ts`, red on the unfixed code
- [ ] One matcher for both packages — deferred→[bug 0511](../0511-a-g-flagged-column-or-table-matcher-skips-tables.md) (it owns one shared non-global helper, exported through `@nielspeter/eess-md/internal`, that md's `matchName` and crossvalidate's `nonGlobal` are both replaced by)

Deferred: [bug 0511](../0511-a-g-flagged-column-or-table-matcher-skips-tables.md)
