# Proposal 026 — md: a document has a section that satisfies a predicate

**State:** Draft — filed 2026-11-01 from an adopter's request, at the maintainer's request; not
reviewed.
**Priority:** Medium — no false green, but a rule a corpus states naturally ("every record has at
least one relation section that cites code") cannot be written without a hand step, and both
forms an adopter reaches for red documents that satisfy it.
**Origin:** inbound · consuming project, 2026-11-01, on eess-md 0.13.0 and eess 0.9.0.
**Affects:** `@nielspeter/eess-md`.

## Problem

A corpus wants every document in a scope to hold **at least one** section of a named group (say
`/^(Relates to|Code reality|Relation)/`) that holds a code pointer. A document may hold several
such sections, and a section of the group may hold only links to other records.

The two forms eess offers today:

- `sections(c).that().areNamed(G).should().haveCodePointer()` says **every** section of the group
  holds one: a red on a document whose second relation section only links records.
- `correspondence({ left: documents in scope, right: sections().areNamed(G).and().haveCodePointer() })
.should().beComplete({ direction: 'left-to-right' })` says each document has a matching section,
  but a document with two qualifying sections is reported `matches multiple … — the correspondence
is ambiguous` (`packages/core/src/correspondence.ts:228`): a red on a document that satisfies the
  rule.

The adopter first bridged the correspondence by collapsing its right side to one element per
document; it gave the right verdicts on planted cases and on 78 real documents. It has since moved
to a plain absence rule, because a `correspondence()` finding bypasses the adopter's own
reason-as-message handling and reports a document with no group section twice: documents in scope
that have a section of the group and of which no group section holds a code pointer should not
exist. The hand step left is a set of document paths, built per pattern from
`sections(c).that().areNamed(re).and().haveCodePointer()` and tested by a custom predicate.

## Measured

On `main` (eess-md 0.13.0), four records in `docs/r/`, the group
`/^(Relates to|Code reality|Relation)/`: `two.md` (two group sections, each citing code),
`mixed.md` (one citing code, one linking a record), `links-only.md` (one group section, linking a
record) and `none.md` (no group section). The rule wanted reds `links-only.md` only; whether a
record must have a group section at all is a second rule.

```text
sections().areNamed(G).should().haveCodePointer()   reds links-only.md and mixed.md        (mixed.md is a false red)
correspondence(records, group sections citing code)
  .beComplete({ direction: 'left-to-right' })       reds links-only.md, none.md and two.md (two.md: "matches multiple sections")
```

## Existing code survey

- **`inSections(p)`** ([plan 0503](../plans/completed/0503-in-sections-boxes-by-section.md)) lifts a section predicate onto any
  element that sits on a line (`packages/md/src/predicates/in-documents.ts:130`), with strong Kleene
  membership over the enclosing sections ([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)). It already computes, per document, whether any
  section satisfies `p` (`docMembership`), but only for its scope statistics.
- **`inDocuments(p)`** ([plan 0470](../plans/completed/0470-a-lifted-predicate-carries-its-findings.md))
  lifts a document predicate onto elements in it: the other direction of the same family.
- **`predicateHaveSection(name, { depth })`** (`packages/md/src/predicates/document.ts:53`) asks
  whether a document has a section by **name** only, not by what the section holds.
- **The dual-use section methods** (`haveCodePointer()` and its siblings,
  [plan 0522](../plans/completed/0522-the-rest-of-blocks-3-and-14-on-sections.md)) select or assert on
  `sections()`, so the hand step per pattern is
  `sections(c).that().areNamed(re).and().haveCodePointer()` and a set of the paths it yields.
- **The section predicates** `sectionsNamed`, `sectionsAtDepth` and `sectionsWithSubsection` are
  public (`packages/md/src/index.ts:71`); `sectionsHolding` (`packages/md/src/predicates/section.ts:74`),
  behind the dual-use `haveCodePointer()`, `haveLink()`, `haveCodeBlock()` and `haveListItem()`, is
  not. So "a section named G that holds a code pointer" cannot be composed as a predicate from the
  root today.
- **`correspondence()`** is the kernel's one-to-one join; ambiguity is its finding on purpose, for
  every dialect. The ask is a document fact, so it is asked of documents, not of the join.

## Asks

- **A — a document predicate that lifts a section predicate.** The inverse of `inSections`:
  documents that have at least one section satisfying `p`, with the same strong Kleene membership
  (a section `p` cannot judge leaves the document undecided, reported, never dropped), and the
  section names `p` reads recorded for the section-name scan, so a misspelt group name is reported
  rather than green on an absence rule. A group is named as `sectionsNamed` names one: a string
  (exact) or a `RegExp`, per pattern.
- **B — the holding predicates public.** The predicate forms behind `haveCodePointer()`,
  `haveLink()`, `haveCodeBlock()` and `haveListItem()`, so a section predicate can be composed:
  `and(sectionsNamed(G), <holds a code pointer>)`.

With both, the adopter's rule is one `docs()` rule:

```ts
docs(c)
  .that().resideInFolder('work/records/**')
  .and().satisfy(not(<have a section that>(and(sectionsNamed(G), <holds a code pointer>))))
  .should().notExist()
```

## Acceptance criteria

- **Break class:** a document in scope with no section of the group is red; one whose only group
  section links records but cites no code is red.
- **Break class (false red):** a document with two qualifying sections is green; one with one
  qualifying and one link-only section is green.
- **Break class:** a misspelt group name reports the name it read, not every document silently, and
  not green.
- **Undecided:** a section the inner predicate cannot judge leaves its document undecided and
  reported ([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)), at the section's line.
- **Evidence:** `examined` counts the documents in scope.
- **Non-vacuity:** a fixture row per break class.

## Dogfooding

This repository's plans carry a "Files changed" section per phase, which cites code; whether a rule
that every completed plan has at least one such section citing code is worth gating is the
review's to measure.

## Open questions

1. **Names.** The predicate's name in the family's vocabulary ([ADR-023](../../adr/023-a-predicate-and-a-condition-that-share-a-word.md)
   for a twin), and whether a condition form on `docs().should()` is wanted beside the predicate.

## Out of scope

- An "at least one" cardinality on `correspondence()`: the adopter's rule is an absence rule over
  documents, and the kernel's join stays one-to-one.

- Whether the cited code exists: `pointers(c).that().satisfy(inSections(…)).should().resolve()`, a
  second rule, as `haveCodePointer()`'s docs say.
