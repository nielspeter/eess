# Bug 0512: a section name inside `not()`, `and()` or `or()` is not scanned

## Status

- **State:** Draft — found 2026-10-19 while building
  [plan 0503](../plans/completed/0503-in-sections-boxes-by-section.md), on its branch. No red test
  written yet.
- **Severity:** Medium — a silent pass in one composition. [Plan 0496](../plans/completed/0496-sections-as-elements.md)'s section-name scan reports a
  heading that misses a section name by case or spacing, and a heading of the name inside a list item
  or blockquote. It reads only the section predicates a rule holds directly, or passes directly to
  `inSections`. A name inside the kernel's `not()`, `and()` or `or()` is not read, so
  `taskItems(c).that().satisfy(inSections(and(sectionsNamed('Acceptance criteria'), sectionsAtDepth(2)))).should().notExist()`
  is green over a corpus that writes `## Acceptance Criteria`, with no finding.
- **Origin:** self-found · [plan 0503](../plans/completed/0503-in-sections-boxes-by-section.md)'s build, 2026-10-19.
- **Reported:** 2026-10-19

## Symptom

[Plans 0496](../plans/completed/0496-sections-as-elements.md) and 0503 say a registered section predicate "records wherever it appears, inside
`satisfy()`, `and()`, `or()` or `not()`, because the kernel's predicate walk reaches it". There is no
such walk. The registry keys each section predicate by its object
(`packages/md/src/model/section-declarations.ts`), and the kernel's combinators return a new object
that keeps no reference to its inputs (`packages/core/src/combinators.ts`, `not` and `combine`): they
carry `description`, `test`, `globs` and `undecided` only. So the rule, and `inSections`, see the
combinator's object and find nothing registered under it.

The same limit already holds for document scopes, and [plan 0457](../plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md) documents it ("compose inside the
scope, not around it"). For a section name there is no inside: `inSections(not(sectionsNamed(x)))`
is the composition.

## Reproduction

A corpus of `a.md` holding `## acceptance criteria` and `- [ ] x`, and `b.md` holding
`## Acceptance criteria`:

| rule (each `.should().notExist()`)                                                                       | findings                           |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `taskItems(c).that().satisfy(inSections(sectionsNamed('Acceptance criteria')))`                          | the near miss on `a.md`            |
| `taskItems(c).that().satisfy(inSections(and(sectionsNamed('Acceptance criteria'), sectionsAtDepth(2))))` | **none**: green                    |
| `taskItems(c).that().satisfy(inSections(not(sectionsNamed('Acceptance criteria'))))`                     | the box `a.md:3`, and no near miss |

Measured 2026-10-19 on [plan 0503](../plans/completed/0503-in-sections-boxes-by-section.md)'s branch build. The `and()` row is the fail-open one. The `not()`
row fails closed here (the misspelt section is selected by the negation, so its box is reported),
but the finding does not say why.

## Fix

Not designed. Two shapes, each with a cost:

- the kernel's combinators keep their inputs (an optional read-only field on the predicates they
  return), and the md registry walks them: a change to the kernel's public `Predicate` surface
  ([ADR-011](../../adr/011-the-kernels-public-api-is-explicit.md)), for one dialect's scan;
- eess-md's root exports its own `not`/`and`/`or` that call the kernel's and register the union of
  their inputs' section names: the same word with two behaviours depending on the import, which
  [ADR-017](../../adr/017-a-heritage-predicate-names-a-relation-not-a-clause.md)'s "one word means one thing across the family" argues against.

## Verification

- [ ] Red first: the second and third rows above report the near miss
- [ ] [Plan 0503](../plans/completed/0503-in-sections-boxes-by-section.md)'s break-class row "a section name under `not()`" written and green
- [ ] `npm run validate` green

Deferred: none
