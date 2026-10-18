# Spike 0470: how a predicate lifted through `inDocuments` carries its findings

Measured 2026-10-18, for [plan 0470](../plans/0470-a-lifted-predicate-carries-its-findings.md), after
plan 0469 shipped `haveField` as a `docs()` method only. Time-boxed to about an hour; it reads the
code and brings a design back for a decision. Nothing here is built.

## The question

`haveField` reports the causes that make a document's value unreadable (a conflict, an empty value,
a label in a form the rule does not read, a value after a code fence that never closes, a value
outside the header) in either position, through `docs()`'s `collectViolations` (plan 0469). Block
12's example, "documents whose Status is done hold no open box", needs the same judgement one level
down:

```ts
taskItems(c)
  .that()
  .satisfy(inDocuments(haveField({ label: 'Status', forms: ['bold'], oneOf: /done/ })))
  .and()
  .areOpen()
  .should()
  .notExist()
```

Plan 0457's `inDocuments(p)` lifts a `Predicate<MdDocument>` onto any element that carries its
document. Lifted that way, `haveField` would drop a document whose Status cannot be read, and its
boxes with it, without a word (ADR-009). The spike asks where the diagnosis lives, what `.select()`
and `correspondence()` do with it, and which public predicate `haveField` then exports.

## What the code does today (measured)

- **Plan 0469 keys findings on predicate identity.** `DocsRuleBuilder.haveField()` records
  `{ spec, predicate }` on the builder; `collectViolations` reports a spec's unreadable causes for the
  documents the rule's _other_ predicates keep, found by identity
  (`packages/md/src/builders/docs.ts`).
- **The kernel's combinators build new objects.** `not()`, `and()` and `or()`
  (`packages/core/src/combinators.ts:26-120`) return a fresh `{ description, test, globs }`. They
  forward one optional structured field, `globs` (through `negateGlobs`/`combineGlobs`), and nothing
  else. Anything keyed on a predicate's identity — plan 0469's spec list, plan 0457's `SCOPES`
  registry — is lost inside a combinator, silently.
- **`.select()` has no findings channel.** `RuleBuilder.select()` is
  `selectMatching(this.getElements(), this._predicates, opts)`
  (`packages/core/src/rule-builder.ts:195-197`, `correspondence.ts:286-296`): it returns
  `{ elements, label, identify }` and never runs `collectViolations`. `correspondence()` consumes
  selections, so a side built with `haveField` (or anything lifted from it) drops unreadable
  documents without a finding. Plan 0469 states this as a limit; plan 0457 states the same for its
  scopes.
- **There is a precedent for a field the combinators carry.** `globs` is optional on `Predicate`,
  declared by the predicates that have it, forwarded by every combinator in negation-normal form,
  and read by the kernel (`declaredGlobsOf`) at check time. A diagnosis channel would be the same
  shape.

## Candidates

**A. An eess-md registry, as plan 0457's `SCOPES`.** `haveField(spec)` is exported as a
`Predicate<MdDocument>` factory that registers its verdict in a module `WeakMap`; `inDocuments`
carries the registration to the lifted predicate; `CorpusRuleBuilder.collectViolations` consults the
registry for the rule's predicates.

- No kernel change.
- **Fails open** in two places: inside any combinator (`or(inDocuments(haveField(a)), …)`,
  `not(haveField(a))`), and through `.select()`. Each is a silent drop, the very defect the plan
  exists to prevent. Documenting it as a limit, as 0457 does for scopes, is not enough here: a dead
  scope still reds as zero examined, while a dropped unreadable document reds nothing.

**B. A kernel field on `Predicate`, carried like `globs`.** An optional
`unread?(subjects: readonly T[]): readonly ArchViolation[]` (name to settle), declared by a
predicate that can fail to judge a subject, forwarded by `not()`/`and()`/`or()` (the union of their
inputs) and by `inDocuments` (mapping each element to its document, once per document). The base
`RuleBuilder.collectViolations` adds the findings for the elements it read, without raising
`examined`, as `links()` and `docs()` do now.

- **Closes the combinator door by construction:** a wrapped predicate still declares what it could
  not judge, whatever the combinator decides about the subject.
- **Scope:** "the documents the rule's other predicates keep" (0469's rule) cannot be computed
  inside a combinator. The fail-closed reading is to report every unreadable subject among the
  elements the rule read, before filtering. It over-reports (a README under a rule meant for bugs)
  rather than under-reports; a caller narrows with the rule's own corpus or a scope that is not a
  diagnosing predicate. The maintainer should weigh that cost.
- **`.select()` and `correspondence()`:** `Selection` gains the findings
  (`readonly findings?: readonly ArchViolation[]`), and `correspondence()` reports them beside its
  own. That is ADR-014's "every door that hands nothing back" applied to the selection door, so it
  needs an ADR-014 amendment, not just a plan.
- Kernel minor, additive for adopters; eess-md moves `haveField`'s verdict onto the field and
  `docs().haveField` becomes `satisfy(haveField(spec))` underneath.

**C. Refuse the lift.** `inDocuments` refuses a predicate that diagnoses (an `ArchConfigError`
naming it), and `haveField` stays a `docs()` method. Block 12's example is written as two rules: a
`docs()` rule that requires a readable Status, and a `taskItems()` rule scoped by the Status read
through a predicate that cannot fail to judge (or by folder).

- Fail-closed, no kernel change.
- Adopter 1's most-wanted rule is not one rule.

## Recommendation

**B**, with **C** as the behaviour until B lands: plan 0457's `inDocuments` refuses a diagnosing
predicate from day one, so the lift never ships fail-open, and B lifts the refusal. A is not
recommended: it adds a second identity-keyed registry beside `SCOPES`, and both fail silently inside
combinators.

B is a binding decision about the kernel's `Predicate` shape and about what a selection carries, so
the ruling is the maintainer's, recorded as an amendment to ADR-014 (and a note in ADR-011 if the
field is root API). After the ruling the build is filed as its own plan, as plan 0470 says.

## Questions for the ruling

1. B's scope: report every unreadable subject the rule read (fail-closed, may over-report), or keep
   0469's "other predicates" rule where no combinator is involved and fall back to every subject
   only inside one?
2. Does `Selection` carry findings (B), or does `.select()` refuse a diagnosing predicate (C for
   that door only)?
3. Is the field root API (a third-party dialect can declare it) or `/internal`?
