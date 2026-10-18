# Plan 0469: `haveField`: a document has a value, and any rule can depend on it

## Status

- **State:** Draft — written 2026-10-18 from proposal 017's block 2.
- **Implements:** proposal 017
- **Priority:** High. All three adopters asked for it, and it is the block that lets a caller write
  "documents whose `Status` is `fixed` have a `Verification` section" in their own words (proposal
  017, "Consumer feedback").
- **Effort:** Medium. One dual-use method on `docs()`, a resolver for each document, and its findings.
- **Created:** 2026-10-18
- **Builds after:** [plan 0468](./0468-fields-read-a-labelled-value-in-the-callers-forms.md), whose
  reader it resolves.

## Problem

Block 1 yields every occurrence of a value. It cannot report a document that carries none, because
such a document yields no element. Two questions are still unanswered:

- whether a document has the value at all;
- which value counts when a document carries several.

Adopter 3 hit the second one: a `State:` in prose at line 220 beat the header at line 3. Today every
adopter answers both in code of its own.

## Design

```ts
export interface HaveFieldOptions extends FieldOptions {
  /** The allowed value, after the caller's normaliser: a set or a pattern. */
  readonly value?: readonly string[] | RegExp
}

docs(c).that().haveField(spec) // a predicate: documents whose resolved value exists (and matches)
docs(c).should().haveField(spec) // a condition: every selected document has it
```

The method is dual-use by phase, as `haveSection` is (`packages/md/src/builders/docs.ts:45`).

**The resolver**, one per document (`packages/md/src/model/field-resolve.ts`, internal). Block 5
will use it later, so precedence is decided in one place, never as a filter in the reader (proposal
017, decision 2). It reads the occurrences that plan 0468's reader yields for that document:

- **Structured forms** (`bold`, `heading`, `bold-value`) win over `plain`.
- **Exactly one structured occurrence** resolves the value. A `plain` occurrence that disagrees with
  it is a finding at its own line, and the resolved value stands.
- **Two or more structured occurrences**, whether they agree or not, are a conflict: one finding
  naming both lines.
- **Only `plain` occurrences:** one resolves the value. Several that disagree are a conflict.
- **No occurrence:** the document has no value.

A document in conflict is never matched by the predicate and never passes the condition. Its finding
is added by the builder's `collectViolations`, as `links()` adds its declaration findings
(`packages/md/src/builders/links.ts:141`). So a rule that uses `haveField` only as a selector still
reports the conflict instead of dropping the document without a word.

**Findings from the condition**, one cause each (ADR-009 rule 2):

```
work/bugs/0001.md: no Status field (read as bold, heading)
work/bugs/0001.md: found `## Status: open` at line 3, in a form this rule does not read (heading); add 'heading' to forms, or rewrite the line
work/bugs/0001.md:3: Status is 'Shipped', not one of: open, fixed
work/bugs/0001.md:3,9: Status is given twice (line 3 'open', line 9 'fixed'); keep one
work/bugs/0001.md:220: prose says Status 'open', but the field at line 3 says 'fixed'
```

A predicate that selects no document gives the kernel's zero-examined finding on a positive rule
(ADR-010).

**The example the block exists for:**

```ts
docs(c)
  .that()
  .resideInFolder('bugs/**')
  .and()
  .haveField({ label: 'Status', forms: ['bold', 'heading'], value: ['fixed'] })
  .should()
  .haveSection('Verification')
  .check()
```

**Dogfooding.** `check:corpus` gains a rule: every live plan, bug and proposal has a `State` field in
the `bold` form. Measured 2026-10-18, every one does today. The rule also gets a `check:nonvacuity`
row that removes the State line from one live bug. This is the first check here that reds when a
record carries no state at all: `honestyAtClose` counts such records but never refuses (bug 0444).

## Phases

1. **Resolver.** `field-resolve.ts` over plan 0468's reader, with its five outcomes.
2. **`haveField`.** The predicate and condition forms, the conflict findings in `collectViolations`,
   and the messages above.
3. **Dogfood and release.** The `check:corpus` rule, its `check:nonvacuity` row, the eess-md README
   (with the example above), a changeset, and an example under `examples/md/` if plan 0458 has
   shipped.

## Files changed

- `packages/md/src/model/field-resolve.ts` (new)
- `packages/md/src/predicates/document.ts`
- `packages/md/src/conditions/structure.ts`
- `packages/md/src/builders/docs.ts`
- `packages/md/tests/builders/have-field.test.ts` (new)
- `scripts/check-corpus.mjs`
- `scripts/check-nonvacuity.mjs`
- `packages/md/README.md`
- `.changeset/md-have-field.md`

## Test inventory

- **The resolver:** one row per outcome, plus a structured occurrence beating an earlier `plain` one
  (adopter 3's line 220 case).
- **The condition:** each message above, word for word.
- **The predicate:** selects the documents with the field; with a `value` set, only matching
  documents; a conflicted document is not selected and its finding is still reported.
- **The example:** red on a fixed bug with no `Verification` section, green once the section is
  added.
- **A selection of nothing:** the zero-examined finding.
- **Sabotage rows**, each turning its named test red:
  1. the resolver prefers the first occurrence over a structured one;
  2. `collectViolations` drops the conflict findings;
  3. the condition passes a document with no field.

## Release

`@nielspeter/eess-md` minor, additive.

## Out of scope

- **A value agreeing with its folder:** block 5, after its ADR. It will reuse this resolver.
- **`honestyAtClose` rebuilt on `haveField`:** proposal 017, second Review, decision 1, and bug 0444.
- **Making the dogfood rule cover `Severity`:** 22 live bugs carry none (measured 2026-10-18), and
  giving each one a level is a judgement per bug, not part of this build.

## Progress ledger

- [ ] Phase 1: resolver
- [ ] Phase 2: `haveField` and its findings
- [ ] Phase 3: dogfood rule, non-vacuity row, README, changeset, example
- [ ] Sabotage rows 1–3 red on their named tests; suites green; durations reported
- [ ] Close: this plan → `completed/`; boards

Deferred: none
