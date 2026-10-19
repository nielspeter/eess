# ADR-023: A predicate and a condition that share a word: the plain name keeps its first kind, the twin takes a prefix

- **Status:** Accepted (2026-10-19)
- **Extends:** [ADR-003](./003-fluent-builder-dsl.md)
- **Context:** [plan 0457](../work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md),
  plan 0496 (PR #247), PR #245's product review (I1)
- **Supersedes nothing.**

## The question

ADR-003's builders let one word be a predicate after `.that()` and a condition after `.should()`
(`haveSection`). Outside a builder, a free function is one kind or the other, so a word needed as both
needs two names. The family spelt the second name five ways:

- eess-ts prefixes a twin with its kind: `conditionResideInFile` beside the plain predicate
  `resideInFile` (`packages/ts/src/index.ts`). For `notImportFrom` there is no plain export at all:
  both kinds are prefixed, `predicateNotImportFrom` and `conditionNotImportFrom`.
- eess-ts also prefixes with the element kind: `functionHaveNameMatching`, `haveNameMatching` for
  functions.
- eess-ts's class builder prefixes some condition methods with `should`
  (`shouldHavePropertyNamed`), "to avoid collision with the `havePropertyNamed` predicate"
  (`docs/classes.md`).
- eess-md exported the `haveField` predicate under the plain word, beside the `docs().haveField()`
  builder method.
- eess-md's plan 0457 added the `haveSection` predicate as `haveSectionPredicate`, a suffix.

A reader could not predict a plain name's kind, nor how its twin is spelt.

**Scope.** The clauses govern names exported from a dialect's public entry points (not `/internal`).
A builder method is in scope as the word a free twin pairs with: `docs().haveField()` is the plain
word, so a free predicate of the same word is its twin. A builder method's own name is ADR-003's, and
the published ones (the `should`-prefixed methods, `functionHaveNameMatching`'s element prefix) keep
their names under clause 1.

## Decision

1. **In every dialect, a published plain name keeps the kind it was first published as** (predicate or
   condition). A rename that changes a published name's kind is not made for symmetry.
2. **Where a twin of the other kind is needed, it takes the prefix `predicate` or `condition`,** whether
   the plain word is a free export or a builder method: `conditionResideInFile`,
   `predicateHaveSection`, `predicateHaveField`. No suffix forms.
3. **The family accepts that the dialects' plain names may differ in kind.**
   [ADR-017](./017-a-heritage-predicate-names-a-relation-not-a-clause.md)'s "one word means one thing"
   still holds for meaning: a word's kind may differ between dialects; what it selects or asserts may
   not.

## Context, measured

**What clause 1 protects, honestly.** The first argument against renaming a plain name across kinds
was that it fails open: a caller's `.should().satisfy(haveSection(…))` would silently become a filter
once `haveSection` was a predicate, since `satisfy()` dispatches on the object's shape. Measured on
this branch's build (2026-10-19, eess-md and the kernel built from 108ba27): over a one-page corpus,
`docs(c).should().satisfy({ description, test })` alone, after `.haveSection(/.*/)` and before it each
give one finding, "Rule '…' selects subjects but asserts nothing about them, so it cannot fail". A
predicate added in the condition phase is recorded as misplaced (`recordPredicate` → `_misplaced`),
and `assertsSomething()` is false while any is, so the rule fails closed (PR #247's enforcement review
measured the same). The real reason for clause 1 is the cost: a rename that changes a released name's
kind breaks every adopter who wrote it, for a symmetry no adopter asked for.

**Applied before either name shipped.** The two names clause 2 forbids were unreleased (pending
changesets `md-in-documents` and `md-have-field`), so `haveSectionPredicate` became
`predicateHaveSection` and the root `haveField` predicate became `predicateHaveField`, both by clause 2
(the plain words are the `haveSection` condition and the `docs().haveField()` method), with no alias
and no Breaking marker; the list of sites is in PR #248.

## Why this, and not the alternatives

- **Converge eess-md on eess-ts (plain name = predicate).** It would rename the released `haveSection`
  and `haveTable` conditions: a break for every eess-md adopter. Clause 1 rules it out.
- **A suffix (`haveSectionPredicate`).** It reads as a different word, and the family already has the
  prefix form in its flagship dialect; two spellings for one idea is the inconsistency this ADR ends.
- **One dual-use object.** `satisfy()` treats any object with `test` as a predicate, so a free
  function cannot be both kinds.

## Consequences

- A reader learns one rule: a prefixed name is the twin, and its prefix says its kind.
- The plain names of eess-ts and eess-md differ in kind; the md README and the ts README each say
  which way theirs lean, in one sentence.
- A new twin in any dialect is named by prefix; `check:surface` blocks any value export ending in
  `Predicate` or `Condition` that a reviewer has not listed as not a twin.

## Enforcement

| Clause                                                                                                    | Tier | Mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Status |
| --------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1 — a published plain name keeps its first kind                                                           | 5    | Review: a rename across kinds is a release decision. `check:release` requires a Breaking marker for a break it is told about; it cannot see a kind change.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | manual |
| 2 — a twin takes the prefix `predicate`/`condition`, never a suffix, of a free export or a builder method | 1    | `scripts/check-surface.mjs` reads every public entry point (not `/internal`) of every package in `scripts/lib/public-surface.mjs`'s list and fails on any value export whose name ends in `Predicate` or `Condition`, unless it is on the reviewed `NOT_A_TWIN` list there (`definePredicate`, `defineCondition`, `satisfyPairCondition`, each with its reason). `check:nonvacuity`'s rows `surface/suffix-twin` (a twin of the free `haveSection` condition) and `surface/suffix-twin-of-a-method` (a twin of `docs().haveField()`), in `scripts/nonvacuity/bad-waived-gates.mjs`, each re-export the pre-ADR name and require the gate to name it and exit non-zero. Not seen: a member of an `export * as ns` namespace. | gated  |
| 3 — the dialects' plain names may differ in kind                                                          | 5    | A permission; nothing to check.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | n/a    |
| 3 — ADR-017's meaning rule still holds across dialects                                                    | 4    | Review, against ADR-017's own rows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | manual |
