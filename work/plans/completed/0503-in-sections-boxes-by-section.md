# Plan 0503: `inSections`, a rule limited to the elements inside matching sections

## Status

- **State:** Done — built on maintainer order 2026-10-19 (`340e051`), after plan 0496 and the
  fixes of bugs 0502 and 0507 in the same pull request (see "Build notes"). Written 2026-10-19 from
  [proposal 017](../../proposals/017-md-blocks-to-check-a-documents-shape.md) ask 18 and decision 6
  ("`inSections(predicate)`, the sibling of block 12's `inDocuments`, sharing its owner and memo,
  lifts a section predicate onto any element by its document and line, with no change to any element
  type. 'Under' means any enclosing section. … A section predicate that selects no section is a
  finding naming it, and a box finding names the section it was attributed to"), in PR #247 beside
  plan 0496; revised the same day after PR #247's verify round (see "Review response").
- **Accepted:** 2026-10-19 by the maintainer. Asked whether block 18 is in this release, the
  maintainer chose **"Include block 18"**.
- **Implements:** proposal 017
- **Priority:** Medium — it extends reach. With `haveTextMatching` below and bug 0507's fix, it makes
  the adopters' own section rules writable from public blocks: adopter 1's most-wanted rule ("11 and
  12 composed: a box rule limited by a value, inside matching sections", stated in 017's consumer
  feedback as "in a closed record, an open box under an acceptance-criteria section may carry only
  `validation-owed`") and adopter 3's three clauses (017, "Adopter 3's section input — 2026-10-18").
  Both adopters build these by hand today.
- **Effort:** Medium. One lift beside `inDocuments`, four section predicates on md's root, one
  box-text predicate and condition, 0457's scope diagnosis generalised to section scopes, one example
  per adopter rule. One pull request.
- **Created:** 2026-10-19
- **Builds after:**
  - [plan 0496](./0496-sections-as-elements.md): the section index (`sectionsOf`, `contains`), the
    section predicates, and the section-name scan with its registry in `CorpusRuleBuilder`;
  - [bug 0502](../../bugs/fixed/0502-links-and-tables-read-a-heading-in-a-list-differently.md)'s fix: until
    then `links().areInSection()` and `inSections` disagree on any document with a heading inside a
    container, and `links()` drops links under real sections;
  - [bug 0507](../../bugs/fixed/0507-a-boxs-text-stops-at-its-first-paragraph.md)'s fix: `haveTextMatching`
    reads a box's `text`, and adopter 3's "`done-otherwise` must not hide a deferral" fails open while
    a deferral on a box's second line is not part of it;
  - [plan 0457](./0457-a-rule-limited-to-the-documents-the-caller-chooses.md): `inDocuments`, its
    memo, and `scopeDiagnosis`, which this plan generalises;
  - the ADR-023 pull request (forthcoming): the names `predicateHaveField` and
    `predicateHaveSection` used below.

  All of them are in this release batch.

## Problem

"In a closed record, an open box under an `Acceptance criteria` section may carry only
`validation-owed`" is a rule over boxes, limited by the documents and the sections they sit in, and
by what each box says. Plan 0457 limits any element by its **document**; plan 0496 makes sections
elements. Nothing limits an element by its **section**, and nothing selects a box by its **text**:
`taskItems()` offers `areOpen()` and `areChecked()` only
(`packages/md/src/builders/task-items.ts:90-95`). So neither adopter's rule can be written from
public blocks, and the examples gate (plan 0458) cannot show it.

Adopter 3 rebuilds the heading chain from `doc.sections` by line, because every enclosing heading
counts, not only the nearest (017, "Adopter 3's section input — 2026-10-18", lesson 1). With plan 0496
alone an adopter could join `sections().select()` to a literal box predicate by hand; plan 0496's docs
do not teach that, because under `notExist()` a misspelt section name empties the join and the rule
passes.

## Design

### The adopters' rules, as they will be written

Each adopter passes its own patterns. eess-md exports no disposition words: they are a working-method
shape, which the md root does not fix (ADR-022, forthcoming PR, clause 1; 017's second Review,
decision 1). `honestyAtClose`'s private `DEFERRED_DISPOSITION_RE`
(`packages/md/src/rules/ledger.ts:253`) stays private.

```ts
// Each name and pattern is bound once, to a const that the rule and its guard both read. That is
// what makes a guard work: a typo in the const reaches both, so the ratchet stays green and the
// guard reds. A literal repeated in two places can be misspelt in one, and then both are green.

// Adopter 1: in a closed record, an open box under acceptance criteria may carry only validation-owed.
const CLOSED = predicateHaveField({ label: 'Status', forms: ['bold'], oneOf: /^(done|closed)$/i })
const ACCEPTANCE = /^Acceptance criteria$/i
const VALIDATION_OWED = /\bvalidation-owed\b/
taskItems(c)
  .that()
  .areOpen()
  .and()
  .satisfy(inDocuments(CLOSED))
  .and()
  .satisfy(inSections(sectionsNamed(ACCEPTANCE)))
  .and()
  .satisfy(not(haveTextMatching(VALIDATION_OWED)))
  .should()
  .notExist()
  .check()
// Its guard: some closed record has the section. The condition repeats the selection on purpose:
// it fails only when nothing is selected.
docs(c).that().satisfy(CLOSED).haveSection(ACCEPTANCE).should().haveSection(ACCEPTANCE).check()

// Adopter 3, in closed folders: (a) an open box under acceptance is only done-otherwise or
// validation-owed; (b) no box under open questions stays open; (c) done-otherwise hides no deferral.
const IN_CLOSED = resideInFolder('records/closed/**')
const ACCEPTANCE_3 = /^Acceptance/
const OPEN_QUESTIONS = /^Open questions$/i
const DISPOSED = /\b(done-otherwise|validation-owed)\b/
const DONE_OTHERWISE = /\bdone-otherwise\b/
const DEFERRAL = /deferred\s*(?:→|->|:)/
// (a)
taskItems(c)
  .that()
  .areOpen()
  .and()
  .satisfy(inDocuments(IN_CLOSED))
  .and()
  .satisfy(inSections(sectionsNamed(ACCEPTANCE_3)))
  .and()
  .satisfy(not(haveTextMatching(DISPOSED)))
  .should()
  .notExist()
  .check()
docs(c)
  .that()
  .satisfy(IN_CLOSED)
  .haveSection(ACCEPTANCE_3)
  .should()
  .haveSection(ACCEPTANCE_3)
  .check()
// (b)
taskItems(c)
  .that()
  .areOpen()
  .and()
  .satisfy(inDocuments(IN_CLOSED))
  .and()
  .satisfy(inSections(sectionsNamed(OPEN_QUESTIONS)))
  .should()
  .notExist()
  .check()
docs(c)
  .that()
  .satisfy(IN_CLOSED)
  .haveSection(OPEN_QUESTIONS)
  .should()
  .haveSection(OPEN_QUESTIONS)
  .check()
// (c)
taskItems(c)
  .that()
  .satisfy(inDocuments(IN_CLOSED))
  .and()
  .haveTextMatching(DONE_OTHERWISE)
  .and()
  .haveTextMatching(DEFERRAL)
  .should()
  .notExist()
  .check()
// Its guard: some closed box carries done-otherwise. The docs() guard cannot say "a box with this
// text exists", so the guard is a taskItems() rule of the same tautology shape.
taskItems(c)
  .that()
  .satisfy(inDocuments(IN_CLOSED))
  .haveTextMatching(DONE_OTHERWISE)
  .should()
  .haveTextMatching(DONE_OTHERWISE)
  .check()
```

Adopter 3's rules (a) and (c) carry the deferral rule it wrote by hand; (c) is the one that needs
bug 0507's fix, since its deferrals are often written on a box's second line.

**Which patterns a guard protects.** A pattern used to **exclude** (`not(haveTextMatching(VALIDATION_OWED))`,
`not(haveTextMatching(DISPOSED))`) fails closed when it is misspelt: it excludes nothing, so more
boxes are reported. A pattern or section name used to **select** in front of `notExist()` fails open
when it is misspelt: the rule examines nothing and stays green (ADR-010 §3). Each selecting name and
pattern above has a guard, except `DEFERRAL` in rule (c): its guard would have to fail when no closed
box carries a deferral, which a clean corpus may legitimately reach, so a typo in it, or the adopter's
notation drifting from it (`deferred to plan 0002`), stays green. That is stated in the docs beside
the example.

### The lift

`inSections<T extends { readonly doc: MdDocument; readonly line: number }>(p: Predicate<MdSectionElement>): Predicate<T>`

- **An element is in a section** when the section contains its line (plan 0496's `contains`: the
  heading line through `endLine`). **"Under" is any enclosing section** (decision 6; adopter 3's
  lesson 1): a box under `### X` inside `## Acceptance` is under both.
- **Membership is strong Kleene over the enclosing sections**, decided once by the kernel's
  `membership` (ADR-021): selected when `p` holds for some enclosing section; undecided when it holds
  for none and cannot judge one (a section predicate built from a lifted document predicate); otherwise
  not selected. Undecided elements are reported by the kernel, never dropped.
- **Owner and memo.** It lives in `packages/md/src/predicates/in-documents.ts` beside `inDocuments`,
  shares `liftToDocument`'s memo shape (a `WeakMap` keyed on the document object) and its scope
  registry. Per document it memoises the verdict of `p` for each of `sectionsOf(doc)`, so an element
  costs one lookup of the sections containing its line.
- **Which elements.** Any element with `doc` and a numeric `line`: boxes, links, pointers, rows,
  terms and fields. Code blocks carry `line: number | null` and are not accepted by the type.
- **No element type changes**, as decision 6 says.

### Box text: `haveTextMatching(re)`

- **On `taskItems()`, in both phases**, as `docs().haveSection()` is: after `.that()` it selects the
  boxes whose `text` matches; after `.should()` every selected box's text must match, and a box that
  does not is a finding naming the pattern and quoting the text.
- **On md's root as a predicate**, generic over any element with a text,
  `haveTextMatching<T extends { readonly text: string }>(re): Predicate<T>`, the way plan 0496 widens
  `areInSectionPredicate`, so it composes with `not()`, `and()` and `or()`, as the adopters' rules
  above need, and the plain name stays true when links, fields or terms (which also carry `text`,
  `packages/md/src/model/links.ts:12`, `packages/md/src/model/fields.ts:65`) gain the method later. It is first published as a
  predicate, so under ADR-023 (forthcoming) the plain name is the predicate; the builder method's
  condition phase is its twin by phase, as `haveSection` is on `docs()`.
- **The caller's pattern, read once:** `g` and `y` stripped, as plan 0496's section matcher does, so
  `lastIndex` never carries from one box to the next.
- **What `text` is** is bug 0507's to settle (all of the box's own content, a nested box excluded).
  Until it is fixed, a pattern cannot see a second paragraph, which is why the bug is a precondition.

### The section predicates on md's root

| root predicate                             | the `sections()` method it matches | why this name                                                      |
| ------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------ |
| `sectionsNamed(name)`                      | `areNamed(name)`                   | a root `areNamed` would not say what is named                      |
| `sectionsAtDepth(depth)`                   | `areAtDepth(depth)`                | as above                                                           |
| `sectionsInSection(name)`                  | `areInSection(name)`               | keeps the one word `links()` and `sections()` use for the relation |
| `sectionsWithSubsection(name, { depth? })` | `.that().haveSubsection(name)`     | mirrors `haveSubsection`                                           |

- **A new shape, acknowledged.** md's other root predicates are verb-first and share the builder
  method's name (`resideInFolder`, `areFrozen`, `inDocuments`). These put the element's noun first,
  because their only callers are lifts (`inSections(…)`) where a bare verb would be ambiguous between
  element kinds. ADR-023 (forthcoming) governs predicate/condition twins only, so this is the plan's
  choice; it is offered to that ADR's author as a rule for the next non-document element ("a root
  predicate over a non-document element carries the element's noun when the method name is generic").
- **They compose** with `and`, `or` and `not`. Each is registered in plan 0496's section-name
  registry by identity, so its name is recorded wherever it appears, under `not()` included (the scan
  asks whether the name exists, not the rule's polarity).

### A section scope that selects nothing

A section scope behaves exactly as 0457's document scope does. Decision 6's "a section predicate that
selects no section is a finding naming it" is narrowed the way 0457 narrowed block 12's condition, and
017's block-18 row records it.

- **On a positive rule**, a section scope that selects no section is named in the zero-examined
  finding through the kernel's `deadGlobDiagnosis()` hook, the same path 0457's `scopeDiagnosis`
  answers today (`CorpusRuleBuilder`). This plan generalises that one function to every registered
  scope, document or section; it adds no second hook. A dead section scope reads: "inSections(sections
  named /^Acceptance/) selected none of the corpus's 812 sections in 140 documents". A live scope whose
  sections hold none of the selected elements gives the three counts: "the section scope selected 12
  sections in 7 of 140 documents, and they hold none of the 96 task items the rest of this rule
  selects".
- **On `notExist()`**, an empty section scope is green: an absence rule's empty match is legitimate
  (ADR-010 §3), as for `inDocuments`. Two guards stand in front of it:
  - the corpus-wide near-miss scan (plan 0496): a heading that misses the name by case or spacing is
    a finding on this rule whatever it examined;
  - the positive guard rule above, which reds when no scoped document has the section.
- **What that leaves silent, stated plainly:** under `notExist()`, a section name that matches no
  heading and has no near miss by case or spacing (`'Acceptence'`), with no guard rule beside it, is
  green. **The same holds for a text pattern that selects** in front of `notExist()` (rule (c)'s
  `DONE_OTHERWISE` and `DEFERRAL`): a typo, or notation drifting from the pattern, examines nothing,
  and no near-miss scan exists for text. The guard is a positive rule reading the same `const`; the
  docs put one next to every absence-rule example, bound to the scope's const, and the example gate
  shows it. `DEFERRAL` stays unguarded, as stated above.

### What a finding says about its section

A finding about an element names the section it was attributed to, the innermost selected section
that contains it, **in its message**, not in its `element`: `… (under "Acceptance", line 40)`. The
kernel's `.excluding()` matches the `element` field (`packages/core/src/terminal-builder.ts:130`), so
putting the section there would change every exclusion and baseline key when a rule gains a section
scope, and move it whenever the heading moves; adopter 3 keys its exemptions by text for that reason
(lesson 3). `CorpusRuleBuilder` appends it when the rule holds a section scope, so `notExist()` and
every condition say it.

### ADR-010, ADR-014, ADR-021

The receipt is the kernel's: `examined` counts the elements selected, never the sections; the
scope's counts are in its diagnosis. Undecided elements are the kernel's to report.

### Dogfood

None in this plan, measured: this repository's box rule is `honestyAtClose` over whole records
(`check:ledger`), and no gate here limits boxes by section. The rebuild of `honestyAtClose` from public
blocks (017's second Review, decision 1) is where `haveTextMatching` would be dogfooded.

## Phases

1. **The lift and the predicates.** `inSections`, the four root section predicates, `haveTextMatching`
   (method and root predicate), the per-document memo.
2. **The findings.** `scopeDiagnosis` generalised to section scopes with the three counts; the
   attributed section in messages.
3. **Examples, docs, release.** One example per adopter rule, each with its guard; the README and
   `docs/markdown.md` replace 0496's "no hand-rolled lift" note with `inSections` and the guard, the
   two always reading one shared `const` for the name or pattern, and say that this is what makes the
   guard work; a changeset.

## Files changed

- `packages/md/src/predicates/in-documents.ts`
- `packages/md/src/predicates/section.ts` (the root predicates)
- `packages/md/src/predicates/task-item.ts` (new: `haveTextMatching`)
- `packages/md/src/builders/task-items.ts`
- `packages/md/src/builders/corpus-rule-builder.ts` (the generalised diagnosis, the attributed message)
- `packages/md/src/index.ts`
- `packages/md/tests/in-sections.test.ts`, `packages/md/tests/have-text-matching.test.ts` (new)
- `examples/md/an-open-acceptance-box-is-validation-owed.test.ts`,
  `examples/md/open-boxes-in-closed-records.test.ts` and their fixtures (new)
- `examples/public-surface.test.ts`, `scripts/vacuity-matrix.mjs` (the new exports classified)
- `packages/md/README.md`, `docs/markdown.md`
- `.changeset/md-in-sections.md` (new)

## Test inventory

**Proposal 017's acceptance rows for ask 18**, each a fixture:

- a box under a `###` beneath the chosen `##` is attributed to the `##`, and its message names it;
- a box before the first heading is in no section;
- a heading in a list (`- ## Acceptance` with a box under it) is not a section: the box is not
  selected, and the scan names the heading;
- a section predicate selecting nothing: on a positive rule, the zero-examined finding names it; on
  `notExist()`, green, with the guard rule red beside it (as narrowed).

**From the carried conditions:** the depth-skip fixture (`## Acceptance`, then `#### Detail` with a
box): the box is under `Acceptance`; the three counts (documents, sections, boxes) in the diagnosis,
asserted word for word.

**A break class per new way to fail:**

| way to fail                                           | corruption that must red                                                                        |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| an open box under a chosen section, without the token | one `- [ ] x` under `## Acceptance criteria` in a closed record (adopter 1)                     |
| the same, under a subsection of the chosen section    | the box under `### Detail` inside `## Acceptance criteria`                                      |
| a box whose text does not match, after `.should()`    | `haveTextMatching(/validation-owed/)` as a condition over that box                              |
| `done-otherwise` hiding a deferral                    | `- [ ] x — done-otherwise` with `deferred→plan 2` on its second line (needs 0507)               |
| a near miss of the section name in one document       | one `## acceptance criteria` among correct ones: the scan's finding                             |
| a section name under `not()`                          | `inSections(not(sectionsNamed('Deprecated')))` with `## deprecated`: the near miss is reported  |
| a misspelt name on an absence rule                    | `ACCEPTANCE` misspelt (`/^Acceptence/`): the ratchet green, **the guard rule red**              |
| a misspelt text pattern on an absence rule            | `DONE_OTHERWISE` misspelt (`/done-otherwse/`): rule (c) green, **its guard red**                |
| a guard that reads its own copy of the name           | the docs and examples use one `const` per name or pattern; a copied literal is a review finding |
| a scope that holds none of the selected elements      | a positive rule: the three-count diagnosis                                                      |
| a document whose Status cannot be read                | adopter 1's rule over a record with two Status values: undecided, reported                      |
| a `g`-flagged text pattern                            | `haveTextMatching(/owed/g)` over four boxes reads all four                                      |

**Also:** adopter 1's rule green on a closed record whose acceptance boxes are checked or carry
`validation-owed`, red on one open box without it, with an open box under `## Notes` left alone; a
box's `.excluding()` key unchanged when the rule gains a section scope (the attribution is in the
message); two corpora with the same `relPath` stay apart (the memo keyed on the object); `links()`
over a document with a container heading agrees with `inSections` (after bug 0502's fix, which is
why it is a precondition).

**The examples** (`examples/md/`): adopter 1's rule, and adopter 3's three, each with its guard
reading the same `const`, with `clean/` and a `violating-<judgement>/` per judgement. Among them a
misspelt-section fixture and a misspelt-pattern fixture, each asserting the ratchet green and the
guard red.

**Sabotage matrix**, run in a worktree at build, each red on its named test:

1. Only the nearest enclosing section is tested: the subsection row reds.
2. `contains` excludes the heading line: a link in a heading's text, scoped by that heading, reds.
3. `scopeDiagnosis` ignores section scopes: the positive dead-scope row reds.
4. Undecided treated as not selected: the two-Status row reds.
5. The memo keyed on `relPath`: the two-corpora row reds.
6. The attributed section written into `element`: the `.excluding()` key row reds.
7. `haveTextMatching` keeps `g`/`y`: the four-boxes row reads two and reds.
8. `haveTextMatching`'s condition phase filters instead of asserting: its condition row reds.
9. The section predicates not registered: the `not()` near-miss row reds.

**Non-vacuity:** the examples are picked up by `examples/md-fixtures-are-load-bearing`; the new
exports by the vacuity matrix's export enumeration.

## Release

`@nielspeter/eess-md` minor, additive: `inSections`, `sectionsNamed`, `sectionsAtDepth`,
`sectionsInSection`, `sectionsWithSubsection`, `haveTextMatching` (root predicate and the
`taskItems()` method). No existing rule changes verdict.

## Out of scope

- Code blocks in `inSections` (their `line` can be null).
- Exporting disposition words or `DEFERRED_DISPOSITION_RE`: ADR-022 clause 1; each caller passes its
  own pattern.
- How prose is read for a disposition beyond a box's text (017's adopter 3 input, lesson 6).
- Rebuilding `honestyAtClose` on these blocks: 017's second Review, decision 1.

## Review response — 2026-10-19 (PR #247's verify round)

The coordinator's settlements, recorded so they can be overruled:

- **The dead section scope (architect N2, enforcement N3, product N5, method N3).**
  `mayMatchNothing` and the separate findings channel are dropped. A section scope now behaves as a
  document scope: named through the one generalised diagnosis hook on positive rules, green under
  `notExist()` per ADR-010 §3, guarded by the near-miss scan and a positive guard rule, with what stays
  silent stated. That also removes the asymmetry with `inDocuments(predicateHaveSection(…))`
  (product N5) and the ADR-018 citation (method N3); decision 6 is cited and its narrowing recorded
  in 017.
- **The adopters' real rules (product N1).** `haveTextMatching` on `taskItems()`, in both phases and
  as a root predicate; the examples are the adopters' rules, with their own patterns; no disposition
  words exported. Box text beyond the first paragraph is bug 0507, a precondition.
- **The attribution (product N4)** is in the message, not the `element`.
- **Adopter 3's input (method N1)** is in 017 as "Adopter 3's section input — 2026-10-18"; this
  plan's quotes point at it.
- **Names (architect N3, method N7, product N6).** `sectionsWithin` became `sectionsInSection`; each
  name has its reason; the noun-first shape is acknowledged and offered to ADR-023.

### Final round — 2026-10-19 (PR #247)

- **One `const` per name and pattern (product 1, enforcement minor):** every example and the docs
  bind each section name and selecting pattern once, read by the rule and its guard.
- **`haveTextMatching` is generic (product 2):** `<T extends { readonly text: string }>`.
- **Text patterns under `notExist()` (enforcement 0503-A):** the residual stated for patterns as for
  section names; rule (c) guarded on `DONE_OTHERWISE` by a `taskItems()` tautology rule; `DEFERRAL`
  stated as unguarded; a row for a pattern typo (ratchet green, guard red).

## Build notes — 2026-10-19

Built on maintainer order 2026-10-19. Decisions taken against the record, each so it can be
overruled:

- **A section name under the kernel's `not()`, `and()` or `or()` is not scanned.** The break-class
  row "a section name under `not()`" and sabotage row 9's `not()` form rest on a predicate walk the
  kernel does not have: its combinators keep no reference to their inputs. A section predicate is
  registered when the rule holds it, or when it is `inSections`' own argument. Recorded as
  [bug 0512](../../bugs/0512-a-section-name-inside-a-kernel-combinator-is-not-scanned.md), measured
  there: under `and()` the near miss goes unreported and the rule is green; under `not()` the
  misspelt section is selected, so the rule reds, without saying why. Row 9 is run on the direct form.
  The docs state the limit.
- **Which documents the scan's container notes read** stays as plan 0496 built it: the rule's
  `inDocuments` scopes. A section scope does not narrow them.
- **The diagnosis wording** names the inner predicate's description: `inSections(are named
"Acceptence") selected none of the corpus's 2 sections in 2 documents — the section predicate is
dead; …`, and for a live scope `the section scope selected 2 sections in 2 of 2 documents, and they
hold none of the 1 task items the rest of this rule selects`. A document scope's wording is
  unchanged.
- **The attribution** is computed only when the rule holds a section scope: the rule's predicates are
  run once more over its elements, to find which findings are about a selected element. A rule with
  no section scope pays nothing.
- **`haveTextMatching`'s finding** reads `the box's text does not match /validation-owed/: "y"`, at
  the box. **`sectionsAtDepth`'s refusal** names `areAtDepth`, the method it backs.
- **The adopters' rules are the examples**, with their own patterns:
  `examples/md/an-open-acceptance-box-is-validation-owed.test.ts` (adopter 1) and
  `examples/md/open-boxes-in-closed-records.test.ts` (adopter 3's three), each name and pattern a
  `const` read by the rule and its guard; a misspelt-section and a misspelt-pattern fixture each
  assert the ratchet green and the guard red. The row "a guard that reads its own copy of the name"
  has no mechanism; it is held by review, as the plan says.
- **Red first.** The tests were written after the code, so their red is the sabotage matrix below.

**Sabotage matrix**, run 2026-10-19 at `6f18c34` (row 6 again with its test name matched), each mutant
applied to one file under `packages/md/src`, the named test in `packages/md/tests/in-sections.test.ts`
run, the file restored by `git checkout`, tree clean after; 9 rows, every one red:

| row | mutant                                                        | red (named test)                                                    |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | only the innermost enclosing section is tested                | adopter 1: an open box without the token, under a subsection …      |
| 2   | `contains` excludes the heading line                          | a link in a heading's text is inside that heading's section         |
| 3   | the section scope is not registered for the diagnosis         | a positive rule whose section scope selects nothing …; three counts |
| 4   | an undecided enclosing section is treated as not selected     | an undecided section predicate leaves the box undecided …           |
| 5   | the memo is a `Map` keyed on `relPath`                        | two corpora with the same relPath keep their own verdicts           |
| 6   | the attributed section written into `element`                 | the .excluding() key does not change …                              |
| 7   | `haveTextMatching` keeps `g`/`y`                              | a g-flagged pattern reads every box                                 |
| 8   | `taskItems().haveTextMatching` filters in the condition phase | as a condition, a box whose text does not match …                   |
| 9   | `sectionsNamed` records no name                               | a near miss of the section name is reported by the scan             |

## Progress ledger

- [x] Phase 1: `inSections`, the four root section predicates, `haveTextMatching`, the memo
- [x] Phase 2: the generalised scope diagnosis with the three counts, the attributed message
- [x] Phase 3: the adopters' examples with their guards, docs, changeset
- [x] Sabotage rows 1–9, each red on its named test
- [ ] The break-class row "a section name under `not()`" — deferred→bug 0512
- [ ] `check:examples`, `check:vacuity`, `check:family`, `check:release` and `npm run validate`
      green — validation-owed: `npm run validate` runs once, at the pull request's final head; its
      exit, duration and SHA are in the pull request's description
- [x] Close: this plan → `completed/`; ROADMAP and proposal 017's row

Deferred: bug 0512
