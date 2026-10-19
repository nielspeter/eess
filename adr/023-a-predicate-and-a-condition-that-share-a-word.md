# ADR-023: A predicate and a condition that share a word: the plain name keeps its first kind, the twin takes a prefix

- **Status:** Accepted (2026-10-19)
- **Extends:** [ADR-003](./003-fluent-builder-dsl.md)
- **Context:** [plan 0457](../work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md),
  plan 0496 (PR #247), PR #245's product review (I1)
- **Supersedes nothing.**

## The question

ADR-003's builders let one word be a predicate after `.that()` and a condition after `.should()`
(`haveSection`). Outside a builder, a free function is one kind or the other, so a word that is needed
as both needs two names. The family had three conventions for the second name:

- eess-ts: the plain name is mostly the predicate, and the condition twin is prefixed
  (`conditionResideInFile`), or the predicate twin is (`predicateNotImportFrom`), both in
  `packages/ts/src/index.ts`;
- eess-md's `haveField`: the plain name was the predicate;
- eess-md's `haveSection`: the plain name is the condition, and plan 0457 added the predicate as
  `haveSectionPredicate`, a suffix.

A reader could not predict which kind a plain name is, nor how its twin is spelt.

## Decision

1. **In every dialect, a published plain name keeps the kind it was first published as** (predicate or
   condition). A rename that changes a published name's kind is not made for symmetry.
2. **Where a twin of the other kind is needed, it takes the prefix `predicate` or `condition`:**
   `predicateNotImportFrom`, `conditionResideInFile`. No suffix forms.
3. **The family accepts that the dialects' plain names differ:** in eess-ts a plain name is mostly a
   predicate, in eess-md mostly a condition. [ADR-017](./017-a-heritage-predicate-names-a-relation-not-a-clause.md)'s
   "one word means one thing" still holds for meaning: a word's kind may differ between dialects; what
   it selects or asserts may not.

## Context, measured

**What clause 1 protects, honestly.** The first argument against renaming a plain name across kinds
was that it fails open: a caller's `.should().satisfy(haveSection(…))` would silently become a
filter once `haveSection` was a predicate, since `satisfy()` dispatches on the object's shape. PR
#247's enforcement review measured otherwise: a predicate added in the condition phase is recorded as
misplaced (`recordPredicate` → `_misplaced`) and the rule asserts nothing (`assertsSomething()`), so
the kernel refuses it and the rule fails closed. The real reason for clause 1 is the cost: a rename
that changes a released name's kind breaks every adopter who wrote it, for a symmetry no adopter asked
for.

**Applied before either name shipped.** eess-md's two suffix-or-ambiguous names were unreleased when
this was decided (pending changesets `md-in-documents` and `md-have-field`), so they were renamed with
no alias and no Breaking marker:

- `haveSectionPredicate` → `predicateHaveSection` (the plain `haveSection` is the condition);
- the root `haveField` predicate → `predicateHaveField` (the plain name is `docs().haveField()`, the
  dual-use builder method, which keeps its name; as a free function the condition came first in the
  family's reading, so the free predicate is the twin).

The rename touched 50 occurrences in 14 files: source, tests, `scripts/check-corpus.mjs`,
`scripts/vacuity-matrix.mjs`, the examples, `docs/markdown.md`, the md README and both changesets
(27 of `predicateHaveSection`, 23 of `predicateHaveField`, the latter including the internal
`haveFieldPredicate` function, renamed to match).

## Why this, and not the alternatives

- **Converge eess-md on eess-ts (plain name = predicate).** It would rename the released `haveSection`
  and `haveTable` conditions: a break for every eess-md adopter. Clause 1 rules it out.
- **A suffix (`haveSectionPredicate`).** It reads as a different word, and the family already has the
  prefix form in its flagship dialect; two spellings for one idea is the inconsistency this ADR ends.
- **One dual-use object.** `satisfy()` treats any object with `test` as a predicate, so a free
  function cannot be both kinds.

## Consequences

- A reader learns one rule: a prefixed name is the twin, and its prefix says its kind.
- The plain names of eess-ts and eess-md differ in kind, and the docs of each dialect say which.
- A new twin in any dialect is named by prefix; `check:surface` blocks a suffix twin.

## Enforcement

| Clause                                                                               | Tier | Mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Status |
| ------------------------------------------------------------------------------------ | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1 — a published plain name keeps its first kind                                      | 5    | Review: a rename across kinds is a release decision. `check:release` requires a Breaking marker for a break it is told about; it cannot see a kind change.                                                                                                                                                                                                                                                                                                | manual |
| 2 — a twin takes the prefix `predicate`/`condition`, never a suffix                  | 1    | `scripts/check-surface.mjs` reads every published entry point of every package (`scripts/lib/public-surface.mjs`) and fails when a value export is named `<base>Predicate` or `<base>Condition` and `<base>` is an export of the same package. `check:nonvacuity`'s row `surface/suffix-twin` (`scripts/nonvacuity/bad-waived-gates.mjs`) re-exports `predicateHaveSection` as `haveSectionPredicate` and requires the gate to name it and exit non-zero. | gated  |
| 3 — the dialects' plain names may differ in kind; ADR-017's meaning rule still holds | 4    | Review, against ADR-017's own rows.                                                                                                                                                                                                                                                                                                                                                                                                                       | manual |
