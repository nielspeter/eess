# Proposal 026 — md: a document has a section that satisfies a predicate

**State:** Draft — filed 2026-11-01 from an adopter's request, at the maintainer's request;
reviewed 2026-11-01, Ship with changes (see "Review — 2026-11-01").
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

## Review — 2026-11-01

**Ruling: Ship with changes**

Reviewed by the architect, product and enforcement lenses, each on its own survey of the code. Each
lens measured against the built `packages/md/dist` with throwaway scripts, which ran in 0.15–0.18 s
each; the two dogfood counts over `work/plans/completed/` took 1.9–2.0 s. No gate, suite or
`validate` was run for the review. All three reached Ship with changes independently. The capability
is generic and belongs in eess-md. The rule shape the submission teaches fails three of its own
acceptance criteria (the misspelt name, the evidence, and which cause a finding names), and the
record states two different rules. The fix is to the shape and the record, not to the capability.

The reviews asked for one revision pass of the submission before a plan. The coordinator records the
corrections here instead, keeps the submission as filed, and writes
[plan 0582](../plans/0582-md-a-document-has-a-section-that-satisfies-a-predicate.md) to them. The
coordinator made the decisions below; each is recorded with its basis so it can be overruled.

### Existing code survey

- **Ask A is new as public API, but its engine exists.** `inSections` already computes, per
  document and memoised, whether some section satisfies `p` under strong Kleene
  (`verdictsOf` and `docMembership`, `packages/md/src/predicates/in-documents.ts:132-139` and
  `:159-164`). It publishes that result only for scope diagnosis. `elementMembership` (`:141-152`)
  is a second hand-written Kleene `any` in the same function, so ask A reuses that fold rather than
  writing a third. No sibling dialect has a container predicate that takes a member predicate:
  eess-ts's `haveMethodNamed`/`havePropertyNamed` and eess-mermaid's `haveMemberNamed` select by
  name only, as `predicateHaveSection` does (`packages/md/src/predicates/document.ts:53`). The word
  that ships becomes the family's precedent for a later `have<Member>(name, { … })`, under
  [ADR-017](../../adr/017-a-heritage-predicate-names-a-relation-not-a-clause.md)'s "one word means
  one thing". This ruling builds nothing for that.
- **Ask B exists, unexported.** `sectionsHolding(h)` (`packages/md/src/predicates/section.ts:74`)
  sits behind the dual-use methods (`packages/md/src/builders/sections.ts:88-92`). It is useful
  without A: `inSections(<holds a code pointer>)` works as soon as it is exported.
- **Today's hand step** (`sections().…select()`, a path set, a custom predicate) gives the right
  verdicts in four lines (product, measured). It loses the idiom, the scope diagnosis and the
  undecided path.
- **`correspondence()` stays one-to-one,** as the submission says: its ambiguity finding
  (`packages/core/src/correspondence.ts:228`) is right for every dialect.

### Placement

Both asks go in `@nielspeter/eess-md`, as one minor release. Both are additive. Nothing goes in the
kernel: it has no containment relation
([ADR-013](../../adr/013-the-kernel-takes-the-fact-not-the-project.md): it takes the fact a dialect
materialises), and the value is in md's own registries (the section-name scan, scope diagnosis,
attribution), not in the quantifier. eess-crossvalidate's peer range `>=0.13.0` still covers the
release, and no other package moves. No new ADR: taking the member's name as its own argument
works around [bug 0512](../bugs/0512-a-section-name-inside-a-kernel-combinator-is-not-scanned.md)
(a section name inside a kernel combinator is not scanned).
[Bug 0512](../bugs/0512-a-section-name-inside-a-kernel-combinator-is-not-scanned.md) stays open
and owns the general fix. The plan cross-references it and does not fix it.

### Decisions

1. **Shape: the group name is its own argument, through an option on the existing dual-use
   `haveSection` / `predicateHaveSection`.** The option takes a section predicate that the matching
   section must satisfy. The name stays a parameter the predicate records itself
   (`packages/md/src/predicates/document.ts:53-68`), so the section-name scan sees it, and a
   misspelt string name is reported as a near miss. The dual-use dispatch already exists
   (`packages/md/src/builders/docs.ts:85-90`). The
   [ADR-023](../../adr/023-a-predicate-and-a-condition-that-share-a-word.md) twins already exist,
   so no new name is published. **The condition form on `docs().should()` is required, not
   optional** (the submission's open question treats it as optional). It is the only form with no
   `not()`, the only one whose `examined` counts the documents in scope, and the only one with a
   finding per document.
   _Basis:_ the architect and product lenses both chose this shape over a new name-free lift (whose
   name has to travel through `and()`, which is
   [bug 0512](../bugs/0512-a-section-name-inside-a-kernel-combinator-is-not-scanned.md)) and over
   a quantifier on `sections()` (a second join engine, whose `examined` would count sections). The
   enforcement lens measured that only the condition form fails closed (Corrections, items 2 and 3).
2. **The rule the submission states is the conditional one,** shipped with a guard rule as
   [plan 0503](../plans/completed/0503-in-sections-boxes-by-section.md) did. The conditional rule:
   documents in scope that have a section of the group must have one that cites code. Its guard
   reads the same `const G`, in 0503's shape: some document in scope has the group section
   (`.that()…haveSection(G).should().haveSection(G)`), which fails only when nothing is selected.
   The strict form, "every document in scope has a group section that cites code", is the same
   condition with the selecting `haveSection(G)` dropped. It needs no guard: a misspelt group reds
   every document in scope.
   _Basis:_ the submission's Problem (`:30-32`) and Measured block (`:40-41`) both say so, and
   leave `none.md` to "a second rule". [Plan 0503](../plans/completed/0503-in-sections-boxes-by-section.md)'s break-class row reads "the ratchet green, **the
   guard rule red**" (`work/plans/completed/0503-in-sections-boxes-by-section.md:330`). Measured
   here: the conditional absence rule is fully green on a misspelt group, with `examined=0` and
   `.check()` passing.
3. **B first.** Exporting the section-holding predicates, all five kinds, is phase 1 of
   [plan 0582](../plans/0582-md-a-document-has-a-section-that-satisfies-a-predicate.md), closable
   on its own. A follows.
   _Basis:_ B promotes code that already exists (about an hour), is useful without A, and A's
   acceptance rule needs it. Product would split them; the architect would keep them together only
   by that relationship. Either way B closes by itself.
4. **Naming detail follows [ADR-023](../../adr/023-a-predicate-and-a-condition-that-share-a-word.md)
   in the plan:** the option's key and B's factory names. The reviewers' arguments go to the plan as
   input. For the key, `that` reads like the `.that()` phase word inside a `should()` call, and
   `satisfying` mirrors `satisfy()` (product). For B, five noun-first factories that mirror the
   builder words (`sectionsWithCodePointer()`, `sectionsWithLink()`,
   `sectionsWithCodeBlock({ lang? })`, `sectionsWithListItem()`, `sectionsWithContent()`), as
   `haveSubsection` maps to `sectionsWithSubsection`, rather than one `sectionsHolding` over an
   exported union whose `kind` strings carry spaces (product; the architect left it to product).
   Either way `lang` stays routed through `tagIsLanguage`
   ([ADR-019](../../adr/019-a-code-blocks-language-tag-is-read-in-any-letter-case.md),
   `packages/md/src/model/section-holds.ts:71`), and the plan runs `check:surface` ([ADR-023](../../adr/023-a-predicate-and-a-condition-that-share-a-word.md) clause
   2).
   _Basis:_ this is the submission's own open question, and
   [ADR-023](../../adr/023-a-predicate-and-a-condition-that-share-a-word.md) is the rule that decides
   it. The ruling fixes the shape; the plan fixes the words.
5. **Dogfooding: this repository does not adopt the rule.** Measured by the enforcement and
   product lenses (1.9–2.0 s each): of 63 completed plans, 32 have a `## Files changed` section,
   and **0** of those 32 hold a `path:line` pointer. They list backticked paths with no line. Of the
   rest, 8 use a bold `**Files changed:**` label, which is not a section, and 23 have neither.
   `completed/` is frozen, so the gate would red every plan with no remedy. The convention this
   repository does hold is already an example (`examples/md/each-phase-lists-its-files.test.ts`),
   and no rule file here uses section predicates. The capability's proof is its `examples/md/`
   fixtures, below.
   _Basis:_ the measurement.

### What the plan also carries, from the reviews

- **The option is absent-safe.** Without it, `predicateHaveSection`'s description and the
  `haveSection` message (`packages/md/src/conditions/structure.ts:23` and `:34`) stay
  byte-identical, pinned by a test, because baselines and `.excluding()` keys depend on them. It
  stays two-valued unless `p` declares `undecided`. It does not register in scope diagnosis,
  or `admittedDocuments` (`packages/md/src/predicates/in-documents.ts:223`) starts narrowing the
  scan's documents.
- **The option takes a `Predicate<MdSectionElement>`, not a `SectionHolding`.** Every stock section
  predicate is two-valued, so only a caller's predicate can be undecided; a holding-kind option
  would make the undecided criterion unreachable.
- **The finding names its cause per document.** Today's absence form prints "should not exist" for
  three documents that need three different fixes. The condition form separates them:
  - no section matches `G`: line 1, with the near-miss and container notes, as `haveSection` does
    (`packages/md/src/conditions/structure.ts:28-38`);
  - sections match `G` and none satisfies `p`: each such section's line, recorded with
    `citesHeadings` so the scan does not report the heading again.

  Each remedy has a test that applies it and shows the finding clears
  ([ADR-009](../../adr/009-agent-first-failure-surfaces.md) rule 2).

- **Undecided, as [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)
  says.** Under strong Kleene `any`, one decided-true section decides the document, so a cause is
  reported only where the verdict depends on it. A cause carries its own `file` and `line`
  (`packages/core/src/predicate.ts:7-13`) and is forwarded, never re-keyed to line 1 of the
  document. The condition form follows `haveField`'s precedent
  (`packages/md/src/builders/field-findings.ts:54`). No shipped section predicate declares
  `undecided`, so the fixture builds one.
- **Non-vacuity has a named mechanism.** `scripts/vacuity-matrix.mjs` exempts md's section
  predicates and lifts as "used inside a builder" (`:451-459`), so new exports would be exempted
  too. The mechanism that worked for
  [plan 0503](../plans/completed/0503-in-sections-boxes-by-section.md) is `examples/md/` with
  `clean/` and `violating-<x>/` fixtures, made load-bearing by `check:nonvacuity`
  (`scripts/check-nonvacuity.mjs:5506`), plus a recorded sabotage matrix. The mutants, committed up
  front:
  1. only the first group section is tested (the mixed record reds: a false red);
  2. every group section is required instead of one;
  3. undecided is treated as false;
  4. the name is not recorded (run on the name-argument form, or the row is as unfalsifiable as
     [bug 0512](../bugs/0512-a-section-name-inside-a-kernel-combinator-is-not-scanned.md)'s);
  5. an exported holding predicate wired to the wrong kind (pointer to link): a real false green, so
     it must red a test of the export itself, not only of the dual-use method that shares the
     function;
  6. the condition form on a dead scope;
  7. the guard over a misspelt `const G`.
- **"Cites code" means a `path.ext:line` pointer** (`packages/md/src/model/pointers.ts`), not a
  backticked path. A pointer in a subsection counts for its parent section
  (`packages/md/src/model/section-holds.ts:27`), so a group section whose subsection cites code
  qualifies. This is inherited from `haveCodePointer()` and is named as a residual.
- **The description reads as "at least one"** section. The every-section and some-section forms
  are documented side by side in `docs/markdown.md` and `packages/md/README.md`, beside the "three
  rules reading one `const`" block. The adopter's heading vocabulary stays out of API docs, the
  README and JSDoc ([ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md): the caller
  names the section).
- **Frozen folders.** The second rule, `pointers().…resolve()`, examines nothing in a frozen folder
  under the default `areLive()`. The docs tell an adopter whose records have a `completed/`
  subfolder.
- **Tier 1 static** is the honest tier, and the submission claims no more.

### Corrections to the submission (recorded here, not edited away)

1. **Two rules in one record.** The Problem (`:30-32`) and the Measured block (`:40-41`) state the
   conditional rule: only `links-only.md` red. The first acceptance criterion (`:94-95`) and the
   example (`:86-89`) state the strict rule, which also reds `none.md` and a misspelt record
   (measured by all three lenses). The two fail in opposite directions on a misspelt group (green,
   or red on every document) and differ on a dead scope. Decision 2 settles which one the adopter's
   is; the plan gives one acceptance row per rule.
2. **The misspelling criterion (`:98-99`) cannot be met as written,** and fixing
   [bug 0512](../bugs/0512-a-section-name-inside-a-kernel-combinator-is-not-scanned.md) would not be
   enough. The example hides the group name three ways. The inner `and()` hides `sectionsNamed(G)`
   from the lift ([bug 0512](../bugs/0512-a-section-name-inside-a-kernel-combinator-is-not-scanned.md), re-measured on dist). The outer `not()` hides the lift's own
   registration from the `docs()` rule's scan, whatever the lift registers
   (`packages/md/src/model/section-declarations.ts:21`, read in
   `packages/md/src/builders/corpus-rule-builder.ts:77-90`). And a `RegExp` name never gets a near
   miss, even held directly (`packages/md/src/model/sections.ts:189`), while the adopter's group is a
   `RegExp` alternation. Measured: the strict example reds every document with an unattributed
   "should not exist"; the conditional rule is fully green. The criterion holds for a string name
   held directly. A misspelt `RegExp` group is caught by the guard (decision 2), or by the strict
   form's red on every document. Accepting several names natively would be a widening of published
   `haveSection`; if the plan takes it, it is its own listed item. `or(sectionsNamed…)` is not an
   escape: it is [bug 0512](../bugs/0512-a-section-name-inside-a-kernel-combinator-is-not-scanned.md)
   again.
3. **The evidence criterion (`:102`) is false for the example.** Under
   `satisfy(not(…)).should().notExist()`, `examined` counts the offenders, not the documents in
   scope: 3 against 5, and 0 on a clean corpus. A wrong folder glob gives `examined=0` and green,
   exactly like a clean run. The condition form counts every document in scope (5 of 5), and on a
   dead scope it reds with the kernel's zero-examined finding
   ([ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md)). The criterion holds for the
   condition form only, which is why decision 1 makes it required.
4. **The dogfooding claim (`:107`) is false.** The plans' "Files changed" sections do not cite code
   in the sense the rule reads: 0 of 32 hold a `path:line` pointer (decision 5).
5. **Ask B lists four kinds; there are five** (`:79-80`). `SectionHolding` also has `content`,
   behind `haveContent()` (`packages/md/src/model/section-holds.ts:13-18`). Phase 1 exports all
   five.

### Disposition, per ask

| ask                                                 | disposition            | owner or condition                                                                                                                                                                                                                                               |
| --------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** — a document has a section that satisfies `p` | **Accepted, reshaped** | [plan 0582](../plans/0582-md-a-document-has-a-section-that-satisfies-a-predicate.md), after phase 1: an option on `haveSection`/`predicateHaveSection` (decision 1), the condition form required, the conditional rule and its guard in the example (decision 2) |
| **B** — the holding predicates public               | **Accepted**           | [plan 0582](../plans/0582-md-a-document-has-a-section-that-satisfies-a-predicate.md), phase 1, closable on its own: all five kinds, names under [ADR-023](../../adr/023-a-predicate-and-a-condition-that-share-a-word.md) (decision 4)                           |
