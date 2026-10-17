# Plan 0457: a rule limited to the documents the caller chooses

## Status

- **State:** Draft — written 2026-10-17 at the maintainer's request ("plans in one pr"), from
  [proposal 017](../proposals/017-md-blocks-to-check-a-documents-shape.md) block 12, as shaped by its
  second Review's decision 4 and the consumer-feedback decision 3; reworked 2026-10-18 after PR
  #235's five reviews, and again after the round-two reviews (see "Review response").
- **Implements:** proposal 017
- **Priority:** Medium — two of the three adopters asked for it (block 12 alone, and block 12
  composed with block 11). Today a rule over boxes, links, rows, terms or code blocks can be limited
  to a folder but not to "documents whose `Status` is `done`", so that judgement exists only inside
  `honestyAtClose`, with its fixed label.
- **Effort:** Medium. One lifting predicate (taking over `codeBlocks()`' private copy), two frozen
  predicates, one section predicate exported, a diagnosis override in six builders, one field on
  `ParsedCodeBlocks`, one example. The kernel changes by one docstring only.
- **Created:** 2026-10-17
- **Builds after:** plans 0458, 0456 and 0454, in the build order the maintainer set on 2026-10-18
  (0458 → 0456 → 0454 → 0457 → 0455 → 0459). It needs from them:
  - plan 0458: the `examples/md/` gate this plan's example is written under;
  - plan 0456: `notExist()` on `taskItems()` (and the other builders below); the kernel hook
    `cardinalitySelectorFault()` (bug 0460's fix) and md's override of it, which judges declared
    globs, including the globs this plan's lift forwards (this plan does not override that hook);
    `globs` declared on `resideInFolder`/`resideInFile`; an empty corpus as an empty source; and
    `and`/`or`/`resideInFolder`/`resideInFile`/`haveNameMatching` on md's root;
  - plan 0454: nothing; it builds earlier by the maintainer's order only.

## Problem

Every eess-md element that belongs to a document carries that document as `doc`:

| element           | builder        | `doc` declared at                              |
| ----------------- | -------------- | ---------------------------------------------- |
| `MdTaskItem`      | `taskItems()`  | `packages/md/src/builders/task-items.ts:9`     |
| `MdLink`          | `links()`      | `packages/md/src/model/links.ts:216`           |
| `MdPointer`       | `pointers()`   | `packages/md/src/model/pointers.ts:90`         |
| `MdRow`           | `rows()`       | `packages/md/src/model/rows.ts:22`             |
| `MdTerm`          | `terms()`      | `packages/md/src/builders/vocabulary.ts:83`    |
| `ParsedCodeBlock` | `codeBlocks()` | `packages/md/src/model/code-block-parse.ts:83` |

None of their builders can be limited by a predicate over that document. A caller can say "open
boxes" and, after plan 0456, "no open boxes", and cannot say "no open boxes in documents that have a
`Verification` section" or "in documents that are not frozen". The document predicates exist
(`packages/md/src/predicates/document.ts`: `resideInFolder`, `resideInFile`, `haveNameMatching`,
`haveSectionPredicate`), but only `docs()` applies them. Plan 0456 exports the first three; the
section predicate stays private.

The lift itself exists once already, privately: `onDocument` (`packages/md/src/builders/code-blocks.ts:21`)
is `inDocuments` without a memo, used only for `codeBlocks()`' own `resideInFile`/`resideInFolder`
(`code-blocks.ts:136-142`). This plan makes it the one owner.

Frozen documents are the second gap. `corpus()` marks each document `frozen`
(`packages/md/src/model/document.ts:58`, from `DEFAULT_FROZEN` at `packages/md/src/corpus.ts:53`).
`pointers()` can select on it (`areLive()`/`areFrozen()`, `packages/md/src/builders/pointers.ts:10-17`,
methods at `:30-36`), and `links().haveLiveTargets()` reads the target's (`builders/links.ts:116`). The other
four builders cannot. Proposal 017's consumer-feedback decision 3 makes frozenness each rule's own
choice, through a document predicate that ships with block 12.

## Design

### `inDocuments(p)`, the one owner of the lift

```ts
// packages/md/src/predicates/in-documents.ts
import type { Predicate } from '@nielspeter/eess'
import type { MdDocument } from '../model/document.js'

type HasDoc = { readonly doc: MdDocument }

/** Package-internal: the lift, with the description the caller sees. Not a scope. */
export function liftToDocument<T extends HasDoc>(
  p: Predicate<MdDocument>,
  description: string,
): Predicate<T> & { readonly docTest: (d: MdDocument) => boolean } {
  // `globs` and `originLabel` forwarded, as plan 0456 makes `onDocument` do, so plan 0456's
  // `cardinalitySelectorFault()` judges a folder glob through the lift (through `not()`/`or()`
  // too: the kernel's `declaredGlobsOf` walks them in negation-normal form).
  const memo = new WeakMap<MdDocument, boolean>()
  const docTest = (doc: MdDocument): boolean => {
    const hit = memo.get(doc)
    if (hit !== undefined) return hit
    const verdict = p.test(doc)
    memo.set(doc, verdict)
    return verdict
  }
  return {
    description,
    test: (element) => docTest(element.doc),
    docTest,
    ...(p.globs === undefined ? {} : { globs: p.globs }),
    ...(p.originLabel === undefined ? {} : { originLabel: p.originLabel }),
  }
}

interface Scope {
  readonly inner: Predicate<MdDocument>
  readonly docTest: (d: MdDocument) => boolean
}
const SCOPES = new WeakMap<object, Scope>()

/** Lift a document predicate onto any element that carries its document. */
export function inDocuments<T extends HasDoc>(p: Predicate<MdDocument>): Predicate<T> {
  const lifted = liftToDocument<T>(p, `are in documents that ${p.description}`)
  SCOPES.set(lifted, { inner: p, docTest: lifted.docTest })
  return lifted
}
```

- **One owner.** `onDocument` is deleted; `codeBlocks()`' `resideInFile`/`resideInFolder` call
  `liftToDocument(p, p.description)`, so their rule descriptions, and every default rule id built
  from a description, stay byte-for-byte what they are, and the `globs` plan 0456 makes
  `onDocument` forward are forwarded the same way. Those two are not registered as scopes: a faulty
  folder glob there is plan 0456's `cardinalitySelectorFault()` finding, named as the caller wrote
  it, not as `inDocuments(…)`.
- **`pointers()`' `areLive()`/`areFrozen()` stay as they are.** Their descriptions ("are live (not
  in a frozen folder)") are user-visible in rule text; rebuilding them on the lift would change it
  for no gain. Their logic is one field read.
- **Used through the inherited `satisfy()`** (`packages/core/src/rule-builder.ts:172`), which
  dispatches on `test`, so no builder gains a method: `taskItems(c).that().satisfy(inDocuments(p))`.
  It applies inside `.select()` too, so a scoped side of `correspondence()` needs nothing more.
- **Memoised per document**, in a `WeakMap` keyed on the `MdDocument` object. A corpus document is
  built once and never mutated, so the verdict cannot go stale, and a predicate shared between two
  corpora keeps their documents apart. The memo is per call of `inDocuments`, so a builder that
  copies itself (`fork()`, `copy()`) shares a memo that is right for both.
- **Typed**, not checked at run time: `T extends HasDoc` makes `docs(c).that().satisfy(inDocuments(p))`
  a type error, where `p` alone is the answer.
- **No `as`** (ADR-005): `SCOPES` is keyed on `object`, and every lookup passes a predicate object.

### `areFrozen()`, `areLive()` and the section predicate

```ts
// packages/md/src/predicates/document.ts (added)
export function areFrozen(): Predicate<MdDocument> {
  return { description: 'are frozen', test: (d) => d.frozen }
}
export function areLive(): Predicate<MdDocument> {
  return { description: 'are live', test: (d) => !d.frozen }
}
```

- **`areFrozen`, not `isFrozen`.** Decision 3 wrote `isFrozen()` in passing. md already says
  `pointers().areFrozen()`/`areLive()`, and the family's standalone predicates use `are…`
  (`areExported`, `packages/ts/src/index.ts:86`). The lifted description reads "are in documents that
  are frozen". This deviates from the decision's word, and is recorded as such.
- **`haveSectionPredicate` is exported under that name, and block 11/3 may rename it.** The example below needs a public section
  predicate (plan 0458's gate allows no hand-built one). The bare `haveSection` is taken on md's root
  by the condition (`packages/md/src/index.ts`, `export { haveSection, haveTable } from
'./conditions/structure.js'`); taking it for the predicate would be a break. eess-ts names the
  other way round (a bare predicate, a `condition…` alias for the condition,
  `packages/ts/src/index.ts:91-96`). The name `haveSectionPredicate` already exists in md's source
  with that meaning, so nothing new is coined. Whether md's naming converges on eess-ts's is the
  public-name decision of block 11/3 (sections as elements), which proposal 017 holds; this plan
  does not pre-empt it, and its changeset says the name may change there. One dual-use object for
  both kinds is not an option: `satisfy()` treats any object with `test` as a predicate
  (`packages/core/src/rule-builder.ts:172-176`), so after `.should()` it would filter instead of
  assert.
- `corpus()`'s frozen default is not touched (proposal 017, second Review decision 2, has its own
  record).

### `ParsedCodeBlocks` gains `documents`

`codeBlocks()`' project carries `documentsLoaded: number` and no documents
(`packages/md/src/model/code-block-parse.ts:95-106`), so its diagnosis has nothing to count against.
Deriving documents from `blocks` would count only documents that hold a block of the language, and
would blame a working predicate. `parseCodeBlocks` already holds the corpus documents when it builds
the object (`code-block-parse.ts:352-357`); it adds `documents: Object.freeze([...documents])`.
Additive: the object is built only by `parseCodeBlocks` (`REGISTERED`, `code-block-parse.ts:360`),
so no caller constructs one by hand and none breaks.

### When a scoped rule examines nothing

A rule that examines nothing already earns the kernel's zero-examined finding unless it declared
`.expectEmpty()` (`packages/core/src/terminal-builder.ts:311`, ADR-010). What the kernel cannot say
is which cause it was, and proposal 017's block-12 conditions ask for two things by name: "a
predicate selecting no document is a finding naming the predicate", and "zero elements over matched
documents is a finding unless declared".

The two rule shapes are treated differently, and the difference is the ADRs', not this plan's:

- **Positive rules:** the seam is `RuleBuilder.deadGlobDiagnosis()`
  (`packages/core/src/rule-builder.ts:281`), called when nothing was examined and the source is not
  empty (`core/src/rule-builder.ts:389`); its reason replaces the generic zero-examined message. Plan 0456
  leaves it alone for md ("md's positive rules keep the generic zero-examined finding"), so this
  plan's override is the only one. Its docstring today says "a `globs()` tree diagnosably dead"
  (`core/src/rule-builder.ts:280`); this plan uses the slot for a reason that is not a glob, so it rewrites
  the comment to "a diagnosable reason the selection is empty" (comment only).
- **Cardinality rules (`notExist()`):** a scope that matches no document **stays green**. ADR-010
  §3 calls `.notExist()` over a loaded project with zero matching subjects "still legitimate
  satisfaction" (`adr/010-a-pass-is-constructed-from-evidence.md:176`), and ADR-018 C3 says "an
  absence rule may match nothing" (`adr/018-a-string-that-names-code-is-resolved-or-the-rule-says-why-not.md:83`). A content scope matching nothing ("no document is
  done yet") cannot be told apart from the absence being asserted, so it is not a finding, and this
  plan overrides no cardinality hook. What a cardinality rule does get is plan 0456's
  `cardinalitySelectorFault()`: the lift forwards a wrapped predicate's `globs`, so a scope over a
  folder (`inDocuments(resideInFolder('./work/**'))`) is judged by 0456's selector-fault check
  exactly as the bare predicate is. Proposal 017's block-12 condition ("a predicate selecting no
  document is a finding naming the predicate") is narrowed to positive rules in the proposal
  (coordinator's edit, 2026-10-18).

```ts
// in each of the six builders (codeBlocks() passes this.project.documents, the field above)
protected override deadGlobDiagnosis(): string | undefined {
  return scopeDiagnosis(this._predicates, this.getElements(), this.project.documents(), 'task items')
}
```

The helper, in the same file as `inDocuments`:

```ts
import { matchingElements } from '@nielspeter/eess/internal'

/** For a positive rule: every dead scope by name, else whether the scopes emptied the selection. */
export function scopeDiagnosis<T extends HasDoc>(
  predicates: readonly Predicate<T>[],
  elements: readonly T[],
  documents: readonly MdDocument[],
  noun: string,
): string | undefined {
  const scopes = predicates.flatMap((p) => {
    const s = SCOPES.get(p)
    return s === undefined ? [] : [s]
  })
  if (scopes.length === 0) return undefined
  const n = documents.length
  // 1. Every dead scope is named, not only the first.
  const dead = scopes.filter((s) => !documents.some(s.docTest))
  if (dead.length > 0) {
    const names = dead.map((s) => `inDocuments(${s.inner.description})`).join(', ')
    return (
      `${names} matched none of the corpus's ${String(n)} documents — the document predicate is ` +
      `dead; fix it, or declare .expectEmpty() if no document is meant to match yet (the ` +
      `declaration lapses the first time this rule examines an element)`
    )
  }
  // 2. Blame the scopes only if the rest of the rule selected something. The kernel's one
  //    owner of "apply a rule's predicates", not a hand-written `test` loop.
  const before = matchingElements(
    elements,
    predicates.filter((p) => !SCOPES.has(p)),
  ).length
  if (before === 0) return undefined
  const k = documents.filter((d) => scopes.every((s) => s.docTest(d))).length
  return (
    `the scopes matched ${String(k)} of ${String(n)} documents, and they hold none of the ` +
    `${String(before)} ${noun} the rest of this rule selects — declare .expectEmpty() if that is ` +
    `expected (the declaration lapses the first time this rule examines an element)`
  )
}
```

- **The counts on the zero path** are documents matched, the corpus total, and the elements the
  rest of the rule selected before the scopes. No path computes a count of frozen documents a
  selection excluded; that count is owed by bug 0174 (below).
- **`.expectEmpty()` is offered only where it can lapse.** On a positive rule the kernel expires the
  declaration the first time the rule examines an element (`packages/core/src/terminal-builder.ts:293-295`),
  so the remedy is real. On a cardinality rule `examined > 0` is already a violation, so a
  declaration there never lapses; this plan offers it nowhere on that shape, and no cardinality
  finding of its own exists to offer it on.
- **Attribution is exact.** Every dead scope is named; a live scope is blamed only when the
  non-scope predicates alone selected something. When a non-scope predicate emptied the selection
  (a typo'd folder, `areOpen` over an all-closed corpus), it returns `undefined` and the generic
  finding speaks.
- **Cost.** `getElements()` runs a second time, on the zero-examined path only.

**What it does not cover: a scope inside a combinator, on a positive rule.**
`or(inDocuments(p), inDocuments(q))` is not found by identity, so a positive rule over it gets the
generic zero-examined finding: still red, less specific. The remedy is to compose inside the scope,
`inDocuments(or(p, q))` or `inDocuments(not(p))`, which keeps the scope at the top level and names
it; this plan's docs teach that form first. On a cardinality rule the combinator makes no
difference: a dead scope is green either way (ADR-010 §3), and a wrapped folder glob is still judged
by plan 0456's check, because the lift forwards `globs` and the kernel walks combinators.

**`.select()` with a dead scope** gives an empty `correspondence()` side with no scope named; the
correspondence's own empty-side finding speaks. Documented beside the combinator limit.

**What a green run reports.** Decision 4 says the predicate "reports both counts", and decision 3
says a rule's summary counts the frozen documents its selection excluded. No CLI prints a rule's
`examined` on a green run today; that is the open half of bug 0174. This plan reports documents
matched and elements on the zero path of a positive rule only, and pins that a green run's receipt
carries `examined` as the elements count. It computes no frozen-excluded count on any path. The
green-path printing and the frozen-excluded count are deferred to bug 0174 and recorded on that bug
in this PR. That is a narrowing of the proposal's wording.

**Not dogfooded here.** This repository's one document-scoped judgement is `check:ledger`'s, made
by `honestyAtClose`; rebuilding it from public blocks waits on blocks 1, 2 and 5 (proposal 017,
second Review decision 1).

## Phases

All in one PR.

**Phase 1: the predicates.** `liftToDocument`, `inDocuments` and `scopeDiagnosis` in a new
`predicates/in-documents.ts`; `onDocument` deleted and `codeBlocks()` moved onto `liftToDocument`;
`areFrozen()`/`areLive()` in `predicates/document.ts`; root exports for `inDocuments`, `areFrozen`,
`areLive`, `haveSectionPredicate`.

**Phase 2: the diagnosis.** `ParsedCodeBlocks.documents`; the `deadGlobDiagnosis()` override in
`TaskItemRuleBuilder`, `LinkRuleBuilder`, `PointerRuleBuilder`, `RowsRuleBuilder`, `TermRuleBuilder`
and `CodeBlockRuleBuilder`; the hook's docstring in `packages/core/src/rule-builder.ts`.

**Phase 3: the example and the docs.** Under plan 0458's gate, `examples/md/in-documents.test.ts`:
"no open box in a live document that has a `Verification` section", from public blocks only:

```ts
import { areLive, corpus, haveSectionPredicate, inDocuments, taskItems } from '@nielspeter/eess-md'
import { fixture } from './fixture.js' // plan 0458's helper

const rule = (cwd: string) =>
  taskItems(corpus({ cwd, roots: ['**/*.md'], frozen: ['archive/**'] }))
    .that()
    .areOpen()
    .satisfy(inDocuments(areLive()))
    .satisfy(inDocuments(haveSectionPredicate('Verification')))
    .should()
    .notExist()
```

`frozen: ['archive/**']` is passed explicitly: the example shows frozenness as the caller's choice
(decision 3), and does not lean on `DEFAULT_FROZEN` (`packages/md/src/corpus.ts:53`), which
proposal 017's decision 2 plans to remove.

Its fixtures, in the shape plan 0458 defines (`examples/md/fixtures/in-documents/clean/` and one
`violating-open-box-in-scope/`, the one judgement this example states):

- **`clean/`:** an open box in a live document **without** `## Verification`, and an open box in an
  `archive/` document **with** it. Both are outside the scope. The `clean:` test asserts zero
  violations and, because this is a cardinality rule, proves its population the way plan 0458's
  contract says: the same builder without the two scopes, `taskItems(c).that().areOpen()
.select({ label, identify })` (`packages/core/src/rule-builder.ts:195`), is non-empty.
- **`violating-open-box-in-scope/`:** the clean set plus an open box in a live document whose
  `Verification` heading is setext (`Verification\n===`). A section predicate blind to setext would
  green this test, and the swap row would red. The `violating-open-box-in-scope:` test asserts that
  exact violation (file, line, "should not exist"), not the exit code.

`docs/markdown.md` and `packages/md/README.md` gain "Scoping a rule to documents". It teaches
`inDocuments(or(…))` before naming the combinator limit; says that under `notExist()` a scope
matching no document is green (ADR-010 §3, ADR-018 C3), so a ratchet's scope is best checked by a
positive rule beside it; and notes the one asymmetry: `pointers(c).that().areFrozen()` is a method,
everywhere else it is `.satisfy(inDocuments(areFrozen()))`.

## Files Changed

| file                                                                                 | change                                                          |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `packages/md/src/predicates/in-documents.ts`                                         | new: `liftToDocument`, `inDocuments`, `scopeDiagnosis`          |
| `packages/md/src/predicates/document.ts`                                             | `areFrozen()`, `areLive()`                                      |
| `packages/md/src/builders/code-blocks.ts`                                            | `onDocument` removed; `liftToDocument`; override                |
| `packages/md/src/model/code-block-parse.ts`                                          | `ParsedCodeBlocks.documents`                                    |
| `packages/md/src/builders/{task-items,links,pointers,rows,vocabulary}.ts`            | `deadGlobDiagnosis()` override                                  |
| `packages/md/src/index.ts`                                                           | four exports                                                    |
| `packages/md/tests/in-documents.test.ts`, `packages/md/tests/fixtures/in-documents/` | new                                                             |
| `examples/public-surface.test.ts`, checked by `scripts/check-surface.mjs`            | the new names                                                   |
| `examples/md/in-documents.test.ts`, `examples/md/fixtures/in-documents/`             | new (plan 0458's gate; no row of its own in `check:nonvacuity`) |
| `docs/markdown.md`, `packages/md/README.md`                                          | the section                                                     |
| `work/bugs/0174-eess-ts-reports-a-clean-gate-with-no-denominator.md`                 | the owed green-path counts, recorded (this PR, at review)       |
| `packages/core/src/rule-builder.ts`                                                  | `deadGlobDiagnosis()`'s docstring (comment only)                |
| `.changeset/md-in-documents.md`                                                      | `@nielspeter/eess-md`: minor; `'@nielspeter/eess': none`        |

## Test inventory

Each through the public entry points (`taskItems(corpus(…))`, `.check()` / `.violations()`), never a
hand-built element, in `packages/md/tests/in-documents.test.ts`:

- **The scoped rule is green where the unscoped one is red:** a corpus with an open box in a
  document with `## Verification` and one in a document without. `taskItems().that().areOpen()
.should().notExist()` reds on both; the same rule with `.satisfy(inDocuments(haveSectionPredicate(
'Verification')))` reds on the first only.
- **A dead content scope under `notExist()` is green** (`inDocuments(haveSectionPredicate(
'Verificaton'))` over a corpus with open boxes): ADR-010 §3 and ADR-018 C3, pinned so a change is
  a decision and not an accident.
- **A folder scope under `notExist()` is judged by plan 0456's check through the lift:** a scope
  whose glob plan 0456's text check faults reds with 0456's finding, exactly as the bare
  `resideInFolder` does on `docs()`, which proves `liftToDocument` forwards `globs`; a scope over a
  folder that does not exist is green (bug 0355's ruling).
- **A dead scope under a positive rule** (`links().satisfy(inDocuments(haveSectionPredicate(
'Verificaton'))).should().resolve()`) reds with the reason naming `inDocuments(have section
"Verificaton")` and `0 of N`.
- **Two scopes, the second dead:** the reason names the second, not the first.
- **Live scope, no elements, positive rule:** reds with "the scopes matched K of N documents, and
  they hold none of the M task items the rest of this rule selects"; with `.expectEmpty()` it is
  green.
- **Live scope, no elements, `notExist()`:** green: the assertion holding, pinned as the control.
- **A non-scope predicate emptied it** (a live scope, `areOpen()` over a corpus whose boxes are all
  checked): the reason is not the scope's; the generic finding speaks.
- **A dead scope on a positive rule under `.expectEmpty()`** is green, and the same rule over a
  corpus where the scope's documents hold a selected element reds with the kernel's expired
  declaration: the remedy the message offers really lapses.
- **`areFrozen()`/`areLive()`:** over a corpus built with `frozen: ['archive/**']`,
  `inDocuments(areLive())` drops a box in `archive/` and keeps one outside it;
  `inDocuments(areFrozen())` the reverse; a corpus built with `frozen: []` has no frozen document.
- **Memo:** the inner predicate's `test` runs once per document over a rule examining many elements
  of one document (a counting predicate). Two fixture corpora holding **the same `relPath`** with
  **opposite verdicts** under one shared `inDocuments` instance each get their own verdict.
- **Each of the six builders** gets the named dead-scope reason on a positive rule, one row each,
  so a builder that loses its override reds. The `codeBlocks()` row counts all corpus documents,
  including those with no block of the language.
- **`codeBlocks()` descriptions unchanged:** `codeBlocks(p).that().resideInFolder('x/**')`'s rule
  description is the same string before and after (`onDocument` → `liftToDocument`).
- **`.select()`:** a scoped `rows()` side of `correspondence()` holds only the matched documents'
  rows.
- **Combinator limit, pinned:** under a positive rule, `or(inDocuments(dead1), inDocuments(dead2))`
  reds with the generic zero-examined finding, and `inDocuments(or(dead1, dead2))` reds naming the
  scope.
- **Green-run receipt:** a green scoped rule's `.violations()` receipt carries `examined` equal to
  the element count (not the document count), the number bug 0174 will print.
- **Type:** `docs(c).that().satisfy(inDocuments(p))` fails to compile (a `// @ts-expect-error` line).
  Enforced by `npm run typecheck`, which includes `packages/md/tests`, not by vitest.

**Sabotage rows**, each run once in a worktree and each turning a row above red:

| sabotage                                        | row that reds                                                                      |
| ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| `inDocuments`' `test` returns `true`            | scoped green where unscoped red                                                    |
| `inDocuments`' `test` returns `false`           | scoped green where unscoped red; the example's `violating-open-box-in-scope:` test |
| the memo keys on `relPath`                      | same `relPath`, opposite verdicts                                                  |
| `scopeDiagnosis` returns `undefined`            | dead scope under a positive rule                                                   |
| a content scope faulted under `notExist()`      | dead content scope under `notExist()` is green                                     |
| `liftToDocument` drops `globs`                  | folder scope judged by plan 0456's check                                           |
| step 1 returns on the first dead scope          | two scopes, the second dead                                                        |
| step 2's `before` check removed                 | a non-scope predicate emptied it                                                   |
| the override removed from `TaskItemRuleBuilder` | that builder's row                                                                 |
| `areFrozen` reads `!d.frozen`                   | `areFrozen()`/`areLive()` rows                                                     |
| `codeBlocks()` counts documents from `blocks`   | the `codeBlocks()` row                                                             |

**Non-vacuity.** The example is discovered by plan 0458's one mechanism, which swaps the clean and
violating fixtures and requires the example's own assertion to fail; this plan adds the fixture
folders, not a row. Emptying `inDocuments` (the second sabotage row) is caught by the example's exact
assertion in `check:examples` and by the suite, not by that swap; the sabotage matrix is what proves
it, and it is listed above.

## Release

`@nielspeter/eess-md` minor: four new root names, one new readonly field on `ParsedCodeBlocks`,
nothing removed. The changeset says `haveSectionPredicate` may be renamed when block 11/3 settles
section names. The kernel's change is a docstring, declared `'@nielspeter/eess': none`. No existing rule's verdict or description changes: a rule that calls no
`inDocuments` takes no new branch (`scopeDiagnosis` returns `undefined` with no scope), and
`codeBlocks()`' own two predicates keep their descriptions. `eess-crossvalidate` lists eess-md as a
peer, not a dependency, so it does not move. The four names land in the surface census.

## Out of scope

- `inSections()` (block 18): not accepted; it needs block 11's section elements.
- md's predicate-and-condition naming converging on eess-ts's (`haveSection` as a predicate):
  block 11/3's public-name decision, held in proposal 017.
- Green-path counts, the frozen-documents-excluded count included: bug 0174.
- Changing `corpus()`'s frozen default: proposal 017, second Review decision 2.
- `haveField` (block 2), the predicate the proposal's headline example uses: blocks 1 and 2 are not
  yet plannable.
- Teaching kernel combinators to forward a scope: the remedy is composing inside the scope.
- The kernel's `cardinalitySelectorFault()` (bug 0460), md's glob-based override of it, and the
  empty-corpus source finding: plan 0456.
- A cardinality-rule finding for a scope that matches no document: ADR-010 §3 and ADR-018 C3 make
  it satisfaction. Changing that is an ADR amendment, not a plan.

## Review response — 2026-10-18

PR #235's reviews, each Critical and Important finding on this plan, and what changed:

- **Enforcement C2 / testing C1 (a dead scope is silent under `notExist()`):** round one made a
  dead content scope a fault; round two withdrew it (below). A folder scope is judged by plan 0456's
  `cardinalitySelectorFault()` through forwarded globs.
- **Product C1 / testing C2 / enforcement C2(a) (`taskItems().notExist()` does not exist):** plan
  0456 now adds `notExist()` to seven builders, `docs()` included (maintainer's reorder,
  2026-10-18); this plan
  builds after it.
- **Architect I1 (`inDocuments` duplicates `onDocument`):** `onDocument` deleted; one owner,
  descriptions preserved. `pointers()`' methods stay, with the reason. The Problem's "no rule can
  select on frozen" narrowed.
- **Architect I2 / enforcement I4 / testing I3 (`codeBlocks()` has no documents):**
  `ParsedCodeBlocks.documents` added, additive.
- **Architect I3 / enforcement I7 / testing C2 / method (open question 1):** decided: the section
  predicate is exported as `haveSectionPredicate`. Product's "leave it unexported" is narrowed: it
  would make the example unbuildable under plan 0458's gate.
- **Product I1 (`isFrozen` is a second word):** `areFrozen()`/`areLive()`, deviation recorded.
- **Product I2 (`and`/`or` unreachable from md):** plan 0456 re-exports them.
- **Enforcement I5 (attribution):** every scope checked; a scope blamed only when the rest selected
  something.
- **Enforcement I6 / testing I1 / method X3 (non-vacuity claims):** the example adds a fixture pair
  under plan 0458's single mechanism; its assertion matches the exact violation; the clean fixture
  holds the elements the scope excludes; the inDocuments-emptied case is the sabotage matrix's.
- **Testing I2 (memo row):** same `relPath`, opposite verdicts.
- **Method X1/X2, product cross-plan, enforcement cross-plan (order):** "Builds after" names the
  maintainer's order and what each earlier plan supplies.
- **Open question 2 (all lenses):** accepted as a narrowing; recorded on bug 0174 in this PR.
- **Minors:** the surface census named correctly (`examples/public-surface.test.ts`,
  `scripts/check-surface.mjs`); the positive-rule hook is md's only override of it and the cardinality hook composes
  with 0456's;
  the K-of-N wording is true whichever predicate emptied the selection; `scopeDiagnosis` keyed on
  objects (no variance cast); `.select()` limit documented; setext fixture; the `@ts-expect-error`
  row names its gate; the dogfood note; `eess-crossvalidate` does not move (a peer, not a
  dependency).

### Round two — 2026-10-18

The round-two reviews (architect, product, enforcement, method, testing), each finding on this plan:

- **Architect I-6 (the content-scope fault overturns ADR-010 §3 inside a plan), enforcement C2
  (the content/location split keys on `globs`, which `and`/`or` always set), architect m10
  (per-conjunct):** coordinator's decision 1: the content-scope fault under `notExist()` is
  dropped. ADR-010 §3 and ADR-018 C3 bind; a dead scope under a cardinality rule is green, pinned;
  positive rules keep the dead-scope finding. `scopeFault` and the `cardinalitySelectorFault()`
  override are gone, so the split C2 measured no longer exists. 017's block-12 condition is
  narrowed in the proposal by the coordinator.
- **Architect I-5 / enforcement C1 / m7 (`.expectEmpty()` never lapses on `notExist()`):** the
  remedy is offered only on positive rules, where the kernel expires it
  (`core/src/terminal-builder.ts:293-295`); the "lapses the day a document matches" sentence is gone; a row
  pins that the positive-rule remedy lapses. The kernel order for selector faults (decision 2) is
  plan 0456's.
- **Architect I-2 / enforcement I5 / method C1 / testing C1 (`examined > 0` on a `notExist()`
  clean test):** decision 5: the clean test proves its population through `.select()` without the
  scopes.
- **Testing I6 (twelve overrides, which seam each row drives):** six overrides now, all positive;
  each builder's row is a positive rule; the sabotage removes `TaskItemRuleBuilder`'s.
- **Product m2 / architect m9 / method m4 / testing M1 (`corpus({ root })` does not compile):**
  `corpus({ cwd, roots: ['**/*.md'], frozen: ['archive/**'] })`.
- **Product m3 (the example leans on `DEFAULT_FROZEN`):** `frozen` passed explicitly.
- **Testing M2 (setext on a document whose verdict it cannot change):** moved to the violating
  folder's in-scope document.
- **Enforcement m5 / testing M3 (the `test → false` sabotage names the wrong row):** it now names
  "scoped green where unscoped red" and the example's violating test.
- **Architect m11 / enforcement m6 / method I6 (the frozen-excluded count):** the plan states that
  no path computes it; it is wholly bug 0174's. The note on bug 0174 that says 0457 reports it on
  the zero path is the coordinator's to correct.
- **Architect m2 (use `matchingElements`):** `scopeDiagnosis` filters through the kernel's
  `matchingElements` (`packages/core/src/internal.ts:122`).
- **Architect M4, partly resolved in round one (the hook's docstring):** rewritten here, comment
  only, `'@nielspeter/eess': none`.
- **Product m1 (`haveSectionPredicate` costs block 11):** the changeset says the name may change,
  and why a dual-use object is not an option; the note on 017's block-11 row is the coordinator's.
- **Product m4 (`docs()`/`pointers()` asymmetry):** one sentence in the docs section.
- **Product m5 / method m2 ("six builders" vs seven; ROADMAP and 017 say `isFrozen()`):** this
  plan's response now says seven; the ROADMAP row and the 017 disposition row are the
  coordinator's.

## Progress ledger

- [ ] Phase 1: predicates, `onDocument` folded in, exports
- [ ] Phase 2: `ParsedCodeBlocks.documents` and the diagnosis in six builders
- [ ] Phase 3: example under plan 0458's gate, docs
- [ ] Sabotage rows run, each red then green
- [ ] `deferred→bug 0174` green-path counts (documents matched, elements examined) and the
      frozen-documents-excluded count on every path, recorded on that bug in PR #235

Deferred: bug 0174
