# Plan 0457: a rule limited to the documents the caller chooses

## Status

- **State:** Done — built 2026-10-18 on [plan 0486](./0486-a-predicate-that-cannot-judge-says-so.md)'s
  ADR-021, at the coordinator's order (the plan was still Draft; see Build notes). Written
  2026-10-17 at the maintainer's request ("plans in one pr"), from
  [proposal 017](../../proposals/017-md-blocks-to-check-a-documents-shape.md) block 12, as shaped by its
  second Review's decision 4 and the consumer-feedback decision 3; reworked 2026-10-18 after PR
  #235's five reviews, and again after the round-two to round-six reviews (see "Review response").
- **Implements:** proposal 017
- **Priority:** Medium — two of the three adopters asked for it (block 12 alone, and block 12
  composed with block 11). Today a rule over boxes, links, rows, terms or code blocks can be limited
  to a folder but not to "documents whose `Status` is `done`", so that judgement exists only inside
  `honestyAtClose`, with its fixed label.
- **Effort:** Medium. One lifting predicate (taking over `codeBlocks()`' private copy), two frozen
  predicates, one section predicate exported, a diagnosis override in the corpus builders' shared
  base and in `codeBlocks()` (the plan said six builders; see Build notes), one field on
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
  does not pre-empt it. (Since decided by plan 0496, PR #247: the name is final.) One dual-use object for
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
  folder (`inDocuments(resideInFolder('/work/**'))`, a leading `/` 0456 reports as `anchored`) is judged by 0456's selector-fault check
  exactly as the bare predicate is. Proposal 017's block-12 condition ("a predicate selecting no
  document is a finding naming the predicate") is narrowed to positive rules in the proposal
  (2026-10-18).

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
  declaration the first time the rule examines an element (`packages/core/src/terminal-builder.ts:294-296`),
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

**What ADR-021 asks of the lift (recorded 2026-10-18 from spike 0485).** A document predicate can
declare that it cannot judge a document (`Predicate.undecided`), as `haveField` does. The lift
forwards it: `undecided(e)` is `p.undecided(e.doc)`, memoized per document like the verdict, and the
lifted `test` never asks `p.test` of a document `p.undecided` reports. (This paragraph first said
what to do if this plan landed before [plan 0486](./0486-a-predicate-that-cannot-judge-says-so.md);
0486 landed first, so the lift forwards the member, as the Build notes record.) `SCOPES` has the
same combinator blindness ADR-021 rejected a registry for. It stays: it only changes the words of a
finding on a rule that is red anyway, never a verdict or its suppressibility (PR #245's enforcement
review checked this), and a scope inside a combinator gets the generic finding, pinned by a test.

**`.select()` with a dead scope** gives an empty `correspondence()` side with no scope named; the
correspondence's own empty-side finding speaks. Documented beside the combinator limit.

**What a green run reports.** Decision 4 says the predicate "reports both counts", and decision 3
says a rule's summary counts the frozen documents its selection excluded. No CLI prints a rule's
`examined` on a green run today; that is the open half of bug 0174. This plan reports documents
matched and elements on the zero path of a positive rule only, and pins that a green run's receipt
carries `examined` as the elements count. It computes no frozen-excluded count on any path. The
green-path printing and the frozen-excluded count are deferred to bug 0174 and recorded on that bug
in this PR. That is a narrowing of the proposal's wording.

**Dogfooded in `check:corpus`.** This plan first said nothing here could use it, which was wrong
(PR #245's enforcement review): `scripts/check-corpus.mjs` lifted a live-record test onto `fields()`
lines by hand, and wrote `!d.frozen` for `areLive()` on `docs()`. Its three State rules now select
live records with `areLive()`, `resideInFolder`/`resideInFile` and `not`/`or`, lifted onto lines with
`inDocuments`; see Build notes. `check:ledger`'s own judgement, made by `honestyAtClose`, still waits
on blocks 1, 2 and 5 (proposal 017, second Review decision 1).

## Phases

All in one PR.

**Phase 1: the predicates.** `liftToDocument`, `inDocuments` and `scopeDiagnosis` in a new
`predicates/in-documents.ts`; `onDocument` deleted and `codeBlocks()` moved onto `liftToDocument`;
`areFrozen()`/`areLive()` in `predicates/document.ts`; root exports for `inDocuments`, `areFrozen`,
`areLive`, `haveSectionPredicate`.

**Phase 2: the diagnosis.** `ParsedCodeBlocks.documents`; the `deadGlobDiagnosis()` override in
`TaskItemRuleBuilder`, `LinkRuleBuilder`, `PointerRuleBuilder`, `RowsRuleBuilder`, `TermRuleBuilder`
and `CodeBlockRuleBuilder`; the hook's docstring in `packages/core/src/rule-builder.ts`.

**Phase 3: the example and the docs.** Under plan 0458's gate, `examples/md/in-documents.test.ts`
states two judgements, from public blocks only: the ratchet "no open box in a live document that
has a `Verification` section", and its guard "some live document has that section". The guard
exists because the ratchet is a `notExist()` rule: if the heading is renamed in the documents, or
the string misspelt, the ratchet's scope matches nothing and stays green (ADR-010 §3). The guard is
a positive rule over the same scope, so the same mistake reds it with the zero-examined finding.
Both read one constant, so they cannot drift apart:

```ts
import {
  areLive,
  corpus,
  docs,
  haveSectionPredicate,
  inDocuments,
  taskItems,
} from '@nielspeter/eess-md'
import { fixture } from './fixture.js' // plan 0458's helper

const SECTION = 'Verification'
const load = (cwd: string) => corpus({ cwd, roots: ['**/*.md'], frozen: ['archive/**'] })

// The ratchet: no open box in a live document that has the section.
const ratchet = (cwd: string) =>
  taskItems(load(cwd))
    .that()
    .areOpen()
    .satisfy(inDocuments(areLive()))
    .satisfy(inDocuments(haveSectionPredicate(SECTION)))
    .should()
    .notExist()

// The guard: its scope is not empty. notExist() does not check a section name; this does.
// The condition repeats the selection on purpose: the rule fails only when nothing is selected.
const guard = (cwd: string) =>
  docs(load(cwd))
    .that()
    .satisfy(areLive())
    .haveSection(SECTION)
    .should()
    .haveSection(SECTION)
    .rule({ id: 'in-documents/verification-guard' })
```

Measured on main's build (2026-10-18), over a one-document corpus whose live document has a setext
`Verification` heading: `docs(c).that().haveSection(name).should().haveSection(name)` gives 0
violations for `'Verification'` and 1 for `'Verificaton'`, the kernel's "this rule examined zero
units" finding. So the guard reds on the exact mistake the ratchet cannot see, and the setext form
is read. Measured the same day, the finding's identity: `ruleId` is the rule's own id (the key is always
written, and is `undefined` unless `.rule({ id })` sets it, hence the id above), `file` is `''`, and `bypassFilters` is `true`: the
kernel's configuration finding (`packages/core/src/vacuity-findings.ts:39-52`).

`frozen: ['archive/**']` is passed explicitly: the example shows frozenness as the caller's choice
(decision 3), and does not lean on `DEFAULT_FROZEN` (`packages/md/src/corpus.ts:53`), which
proposal 017's decision 2 plans to remove.

Its fixtures, in the shape plan 0458 defines: `examples/md/fixtures/in-documents/clean/` and one
`violating-<judgement>/` folder per judgement. Each test's title starts with its folder's name and a
colon, as plan 0458's contract says (`clean: …`, `violating-open-box-in-scope: …`,
`violating-scope-matches-nothing: …`):

- **`clean/`:** an open box in a live document **without** `## Verification`, an open box in an
  `archive/` document **with** it, and a live document with `## Verification` whose boxes are all
  checked. The two open boxes are outside the scope. The `clean:` test asserts zero violations from
  both rules. The guard is positive, so it asserts `examined > 0`. The ratchet is a cardinality
  rule, so it proves its population the way plan 0458's contract says: the same builder without the
  two scopes, `taskItems(c).that().areOpen().select({ label, identify })`
  (`packages/core/src/rule-builder.ts:195`), is non-empty.
- **`violating-open-box-in-scope/`:** the clean set plus an open box in a live document whose
  `Verification` heading is setext (`Verification\n===`). A section predicate blind to setext would
  green this test, and the swap row would red. The `violating-open-box-in-scope:` test asserts the
  ratchet's exact violation (file, line, "should not exist"), not the exit code, and that the guard
  is green.
- **`violating-scope-matches-nothing/`:** the violating set above with every `Verification` heading
  renamed (`## Checks`). The ratchet is green on it, which the test asserts, pinning ADR-010 §3's
  ruling where an adopter will see it. The guard reds with the kernel's zero-examined finding. The
  `violating-scope-matches-nothing:` test uses plan 0458's configuration-finding form, which relaxes
  `file` only: it asserts exactly one finding, whose message is exactly `zeroExaminedViolation`'s
  text (`packages/core/src/vacuity-findings.ts:56-60`, the whole string, not a prefix, because
  `deadGlobViolation` begins the same way), whose `ruleId` is `in-documents/verification-guard`,
  and whose `bypassFilters` is `true`. The message is what tells this judgement apart from a corpus
  that failed to load: every kernel configuration finding shares the other fields.

`docs/markdown.md` and `packages/md/README.md` gain "Scoping a rule to documents". It teaches
`inDocuments(or(…))` before naming the combinator limit. It shows the ratchet and its guard as a
pair, the same code as the example (so `check:docs-code` compiles it), and says plainly: a
`notExist()` rule does not check that its scope's section name, or any other content predicate,
matches anything; a scope matching no document is green (ADR-010 §3, ADR-018 C3); the guard is what
catches it. It explains the guard's shape: its condition repeats its selection on purpose, so it
fails only when nothing is selected; the apparent simplification
`.that().satisfy(areLive()).should().haveSection(SECTION)` is a different, stronger claim (every
live document has the section). It also warns off the kernel's other candidate:
`.expectNonEmpty()` on the ratchet does not do this, because in eess-md a `notExist()` rule that
declares it can never be green (it reds on every element it examines, and on examining none), and
eess-ts reports that combination as a finding saying so. It also notes the one
asymmetry: `pointers(c).that().areFrozen()` is a method, everywhere else it is
`.satisfy(inDocuments(areFrozen()))`.

The README carries no bug numbers; an adopter on npm has no `work/bugs/`. For this plan's readers:
the kernel docstring that used to suggest `.expectNonEmpty()` for `notExist()` was
[bug 0466](../../bugs/fixed/0466-expectnonempty-is-offered-for-a-glob-typo-on-a-cardinality-rule.md), and eess-ts
reading the declaration was bug 0467, both fixed in PR #236.

## Files Changed

| file                                                                                     | change                                                           |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `packages/md/src/predicates/in-documents.ts`                                             | new: `liftToDocument`, `inDocuments`, `scopeDiagnosis`           |
| `packages/md/src/predicates/document.ts`                                                 | `areFrozen()`, `areLive()`                                       |
| `packages/md/src/builders/code-blocks.ts`                                                | `onDocument` removed; `liftToDocument`; override                 |
| `packages/md/src/model/code-block-parse.ts`                                              | `ParsedCodeBlocks.documents`                                     |
| `packages/md/src/builders/corpus-rule-builder.ts`                                        | the `deadGlobDiagnosis()` override, once for the corpus builders |
| `packages/md/src/builders/{docs,task-items,links,pointers,rows,vocabulary}.ts`           | each builder's `noun`                                            |
| `packages/md/src/index.ts`                                                               | four exports                                                     |
| `packages/md/tests/in-documents.test.ts`                                                 | new (its corpora are built in the test with `tree()`)            |
| `scripts/check-corpus.mjs`                                                               | live-record selection from the public predicates (PR #245)       |
| `examples/public-surface.test.ts`, checked by `scripts/check-surface.mjs`                | the new names                                                    |
| `examples/md/in-documents.test.ts`, `examples/md/fixtures/in-documents/` (three folders) | new (plan 0458's gate; no row of its own in `check:nonvacuity`)  |
| `docs/markdown.md`, `packages/md/README.md`                                              | the section                                                      |
| `work/bugs/0174-eess-ts-reports-a-clean-gate-with-no-denominator.md`                     | the owed green-path counts, recorded (this PR, at review)        |
| `packages/core/src/rule-builder.ts`                                                      | `deadGlobDiagnosis()`'s docstring (comment only)                 |
| `.changeset/md-in-documents.md`                                                          | `@nielspeter/eess-md`: minor; `'@nielspeter/eess': none`         |

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
- **A guard fixture that loads nothing** (the `violating-scope-matches-nothing/` corpus pointed at
  `roots` that match no file): the guard gives plan 0456's empty-source finding, whose message is
  not the zero-examined one, so the `violating-scope-matches-nothing:` test's exact-message
  assertion reds. This row moved here from plan 0458: on main both cases give the same
  zero-examined message (measured by PR #235's round-six enforcement review), and they differ only
  from plan 0456 on, which builds before this plan.
- **The guard pair** (the example's two rules over a corpus whose `Verification` heading is
  renamed): the ratchet is green and the guard reds with the zero-examined finding; with the
  heading restored both are green.
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

| sabotage                                        | row that reds                                                                             |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `inDocuments`' `test` returns `true`            | scoped green where unscoped red                                                           |
| `inDocuments`' `test` returns `false`           | scoped green where unscoped red; the example's `violating-open-box-in-scope:` test        |
| the memo keys on `relPath`                      | same `relPath`, opposite verdicts                                                         |
| `scopeDiagnosis` returns `undefined`            | dead scope under a positive rule                                                          |
| a content scope faulted under `notExist()`      | dead content scope under `notExist()` is green                                            |
| `liftToDocument` drops `globs`                  | folder scope judged by plan 0456's check                                                  |
| step 1 returns on the first dead scope          | two scopes, the second dead                                                               |
| step 2's `before` check removed                 | a non-scope predicate emptied it                                                          |
| the override removed from `TaskItemRuleBuilder` | that builder's row                                                                        |
| `areFrozen` reads `!d.frozen`                   | `areFrozen()`/`areLive()` rows                                                            |
| `codeBlocks()` counts documents from `blocks`   | the `codeBlocks()` row                                                                    |
| the guard's fixture loads nothing               | a guard fixture that loads nothing; the example's `violating-scope-matches-nothing:` test |

**Non-vacuity.** The example is discovered by plan 0458's one mechanism, which swaps the clean and
violating fixtures and requires the example's own assertion to fail; this plan adds the fixture
folders, not a row. Emptying `inDocuments` (the second sabotage row) is caught by the example's exact
assertion in `check:examples` and by the suite, not by that swap; the sabotage matrix is what proves
it, and it is listed above.

## Release

`@nielspeter/eess-md` minor: four new root names, one new readonly field on `ParsedCodeBlocks`,
nothing removed. (The changeset first said `haveSectionPredicate` might be renamed when block 11/3
settled section names; plan 0496 (PR #247) decided the name is final, and the hedge is gone.) The kernel's change is a docstring, declared `'@nielspeter/eess': none`. No existing rule's verdict or description changes: a rule that calls no
`inDocuments` takes no new branch (`scopeDiagnosis` returns `undefined` with no scope), and
`codeBlocks()`' own two predicates keep their descriptions. `eess-crossvalidate` lists eess-md as a
peer, not a dependency, so it does not move. The four names land in the surface census.

## Out of scope

- `inSections()` (block 18): not accepted; it needs block 11's section elements.
- md's predicate-and-condition naming: decided by plan 0496 (PR #247). In eess-md a plain name is
  the condition and `xPredicate` is the predicate form, so `haveSectionPredicate` is final.
  Superseded 2026-10-19 by [ADR-023](../../../adr/023-a-predicate-and-a-condition-that-share-a-word.md),
  before either name shipped: a twin takes a prefix, so the section predicate is `predicateHaveSection`
  and the root `haveField` predicate is `predicateHaveField`. The names elsewhere in this record are
  the ones it was built with.
- Green-path counts, the frozen-documents-excluded count included: bug 0174.
- Changing `corpus()`'s frozen default: proposal 017, second Review decision 2.
- `haveField` (block 2), the predicate the proposal's headline example uses: built since by plan
  0469 and plan 0486; this plan's lift carries it.
- Checking the `frozen` globs `corpus()` takes: a broken one empties `inDocuments(areFrozen())` or
  `inDocuments(areLive())` with no finding under `notExist()`. Recorded as
  [bug 0499](../../bugs/fixed/0499-corpus-does-not-check-its-frozen-globs.md); the docs say so.
- A kernel combinator for lifting a predicate along a projection: one dialect needs it today. When a
  second does, it belongs beside `not`/`and`/`or` rather than as a second hand copy (PR #245's
  architect review, m-5).
- The leftovers PR #245's architect review found (the kernel hook's name, two hand lifts beside
  `liftToDocument`, `documentsLoaded`): [bug 0501](../../bugs/0501-md-and-kernel-leftovers-from-plan-0457.md).
- eess-md's `notExist()` with `.expectNonEmpty()`, which can never be green:
  [bug 0500](../../bugs/0500-eess-md-notexist-with-expectnonempty-can-never-be-green.md).
- Teaching kernel combinators to forward a scope: the remedy is composing inside the scope.
- The kernel's `cardinalitySelectorFault()` (bug 0460), md's glob-based override of it, and the
  empty-corpus source finding: plan 0456.
- A cardinality-rule finding for a scope that matches no document: ADR-010 §3 (Accepted) makes
  it satisfaction, as ADR-018 C3 (still Proposed; its mechanism is gated) would. Changing that is an ADR amendment, not a plan.
- A positive "at least one element exists" condition. The family has none, so the guard is written
  as a selection repeated in its condition. Recorded here as an observed gap for a later block of
  proposal 017, not built.

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
  (`core/src/terminal-builder.ts:294-296`); the "lapses the day a document matches" sentence is gone; a row
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
  no path computes it; it is wholly bug 0174's, whose note agrees.
- **Architect m2 (use `matchingElements`):** `scopeDiagnosis` filters through the kernel's
  `matchingElements` (`packages/core/src/internal.ts:122`).
- **Architect M4, partly resolved in round one (the hook's docstring):** rewritten here, comment
  only, `'@nielspeter/eess': none`.
- **Product m1 (`haveSectionPredicate` costs block 11):** the changeset says the name may change,
  and why a dual-use object is not an option; 017's block-11 row records the shipped name.
- **Product m4 (`docs()`/`pointers()` asymmetry):** one sentence in the docs section.
- **Product m5 / method m2 ("six builders" vs seven; `isFrozen()` on the boards):** this plan's
  response says seven; the ROADMAP and 017 rows say `areFrozen()`/`areLive()`.

### Round three — 2026-10-18

The round-three reviews raised no Critical; each Important and Minor on this plan:

- **Product N-I2 / enforcement N3 (the guard for a scoped ratchet is prose only):** coordinator's
  decision 7. The example ships the guard as a second judgement with its own
  `violating-scope-matches-nothing/` fixture, so plan 0458's swap proves it fires. The README shows
  the pair and says that `notExist()` does not check a section name. The guard's behaviour was
  measured on main's build before it was written in (Phase 3).
- **Coordinator decision 1 (test titles):** each title starts with its fixture folder's name and a
  colon.
- **Architect m-new-1 / enforcement m-g (a `./work/` glob reads as a fault that is not one):** the
  illustration is now an anchored glob, a leading `/` before `work/`, which 0456 reports as
  `anchored`.
- **Architect m-new-6 (off-by-one pointer):** the expiry branch is
  `packages/core/src/terminal-builder.ts:294-296`.
- **Testing N1, second option (the lift row table-driven over six builders):** not taken. Decision 5
  gives 0456 test-local glob-declaring predicates for the four builders, so 0456's own rows cover
  them; this plan's one lift row proves the forwarding.
- **Architect "not counted" (three overrides in six builders):** noted for the build; a shared md
  base builder is a refactor neither this plan nor 0456 owns.

### Round four — 2026-10-18

No Critical; each finding on this plan:

- **Testing I2 (the guard's violating test cannot meet plan 0458's contract):** coordinator's
  decision 4. 0458 now allows the configuration-finding form for a judgement that a scope matches
  nothing; this test uses it, asserting `ruleId`, `bypassFilters: true` and `file: ''`. The guard
  takes an explicit rule id, because the finding carries none otherwise (measured on main's build).
- **Product m1 / decision 7 (the guard reads as a copy-paste slip):** the docs and the code comment
  say the condition repeats the selection on purpose and the rule fails only when nothing is
  selected, and name the stronger claim the "simplification" would make. The missing "at least one
  exists" condition is recorded under Out of scope.
- **Architect m4-4 (prettier damaged a code span):** reworded so the line carries no `**` inside a
  bold label, which is what prettier escaped.
- **Decision 8 (stale disagreement lines):** removed or rewritten to the fixed state (bug 0174's
  note, 017's block-11 row, the boards).

### Round five — 2026-10-18

No Critical; each finding on this plan:

- **Method R5-1 / testing N2 / enforcement / architect (the guard test no longer asserts the
  message):** decision 1. 0458's exception relaxes `file` only; the test asserts the exact
  zero-examined message beside `ruleId` and `bypassFilters`, so a fixture that fails to load (one
  finding, same id, same shape, a different message) reds it. The sabotage row for that is this
  plan's (round six).
- **Product n1 (`.expectNonEmpty()` is the trap an adopter will reach for):** decision 4. The docs
  section says a `notExist()` ratchet that declares it can never be green; the kernel docstring that
  suggests it is bug 0466.
- **Testing m1 (`ruleId` "absent"):** the key is always written; it is `undefined` without
  `.rule({ id })`.
- **Product (record the missing existence condition in 017 itself):** recorded in this plan's Out of
  scope and in proposal 017.

### Round six — 2026-10-18

- **Enforcement / method R6-1 / architect (0458's "loads nothing" row cannot fire before plan
  0456):** decision 1. The row is this plan's, in the test inventory and the sabotage table; 0458
  keeps a pointer.
- **Method R6-3 / architect N6-3 / product m1 (a broken sentence; a bug number in adopter text):**
  decision 2. The docs paragraph is split; the README keeps the warning without a bug number,
  notes that eess-ts behaves differently today without saying which way it will go, and the plan
  links bug 0466 and names bug 0467.
- **Method R6-2 (the round-five line said 017 was not updated):** corrected; 017 was updated in the
  same commit.

## Build notes

Where the build departed from the text above, each overrulable:

- **Built from Draft.** The plan's State was Draft when the coordinator ordered the build; the
  `plan-build` ritual would refuse that. Its review rounds had settled every open question, and the
  departures below are the ones the code met. Whether the maintainer approved skipping `Ready` is
  not recorded here: the order came from the coordinator, and this record does not claim more.
- **The lift is three-valued (ADR-021, built by plan 0486 since this plan was written).** The memo
  holds the kernel's `Membership` per document, computed by the kernel's `membership([p], 'all', d)`,
  not a boolean. `liftToDocument` declares `undecided` (`p.undecided(e.doc)`, from the same memo)
  only when `p` declares it, so a rule over a two-valued scope keeps the kernel's two-valued path.
  The lifted `test` never asks `p.test` of a document `p.undecided` reports: it reads the memo, and
  on an undecided document refuses through the kernel's `refuseUndecided` with the door `test()`.
  `docTest` became `docMembership`.
- **`scopeDiagnosis` uses the kernel's `partition`, not `matchingElements`.** `matchingElements` now
  takes a door and refuses undecided subjects. The kernel asks `deadGlobDiagnosis()` only when no
  subject was undecided, but removing the scopes can expose one a scope had decided false (strong
  Kleene: a decided false wins), so `partition` is the honest call: an element the rest of the rule
  cannot judge is not counted as selected.
- **A document a dead scope cannot judge is not a match, and the reason says so.** Step 1 counts a
  scope dead when no document is decided true; when some documents were undecided the message adds
  `(U could not be judged)`, so "matched none" never hides them. Not in the plan.
- **One override in the shared base, not six.** Plan 0456 built `CorpusRuleBuilder`, the base the
  five corpus builders and `docs()` share (round three recorded it as nobody's refactor). The
  override lives there once, plus one in `CodeBlockRuleBuilder`, which has its own base. Each
  builder declares the `noun` its finding uses (`'task items'`, `'links'`, `'blocks'` …);
  `DocsRuleBuilder` declares `'documents'` and never takes the branch, since a scope cannot be added
  to it (the type row). `scopeDiagnosis` is generic in `T` without `HasDoc`: it reads the documents,
  not the elements' `doc`. The sabotage row that removed `TaskItemRuleBuilder`'s override removes
  the base's instead, and reds all five corpus builders' rows; a second row removes
  `codeBlocks()`'.
- **`ParsedCodeBlocks.documents` broke one hand-built literal.** The plan said no caller constructs
  one; a test does (`code-block-parse.test.ts`, the forged object `codeBlocks()` must refuse). It
  gains `documents: []`. The changeset says a hand-built object typed as `ParsedCodeBlocks` needs the
  field to compile, and that `codeBlocks()` refuses it anyway.
- **Plan 0486's test-local lift is gone.** `have-field-undecided.test.ts` uses `inDocuments` in all
  four places it lifted `haveField`, block 12 among them: an unreadable Status is reported once and
  the document is not dropped. Two rows in `in-documents.test.ts` pin the lift's own contract with a
  counting predicate that declares `undecided`: each document judged once, `test` never asked of the
  undecided one, and the lifted `test` refusing it directly.
- **The setext fixtures are kept out of Prettier.** Prettier rewrites a setext heading as ATX, which
  would make the example's `violating-open-box-in-scope/` prove nothing about setext.
  `.prettierignore` lists the two `login.md` files, with the reason.
- **`check:vacuity` lists the four new names** as predicate factories (`SIBLING_NOT_CONSTRUCTORS`);
  the matrix requires every export to be probed or listed.
- **The docs' `haveField` paragraphs** said `inDocuments` was "not yet shipped"; both now point at
  the new section.
- **Red first, honestly:** the code and its tests were written in one pass, not test first. Against
  the base the new test file does not load (the names do not exist), which proves nothing per row.
  The red evidence is the sabotage matrix below: 19 rows, each red on the test it names.
- **Rows the plan did not list:** 7b (names only the first dead scope), 9b (`codeBlocks()`'
  override), 13 to 16 (ADR-021's forwarding, the lift never asking `test` of an undecided document,
  the lift's refusal, the memo) and 17 (`codeBlocks()`' own predicates registered as scopes, which
  would change their rule text).
- **Measured:** the md suite was 524 tests in about 2.5 s at the first build, with 32 in
  `in-documents.test.ts`; after PR #245's fixes it is 529, with 37 there.

### PR #245's review, 2026-10-19

The coordinator's decisions on the five reviews, each built here:

- **A rule with no scope no longer extracts its elements twice (architect I-1).** `scopeDiagnosis`
  takes the elements as a thunk and returns before calling it when the rule has no scope. Measured
  on this repository's corpus (523 documents under `work/`, `adr/`, `docs/`), best of 7 after a warm
  run: `links(c).that().satisfy(none).should().notExist()` took 39.7 ms before and 17.9 ms after
  (19.6 ms on a second run); the same rule on `taskItems` 23.2 ms before and 10.5 ms after (15.1 ms
  on a second run).
- **The docs say which scopes the selector check judges (enforcement I1, product M1).** Only
  `resideInFolder`/`resideInFile`; `areFrozen()`/`areLive()` read globs nothing checks, and the docs
  name `DEFAULT_FROZEN` (`**/completed/**`, `**/archived/**`). The defect is
  [bug 0499](../../bugs/fixed/0499-corpus-does-not-check-its-frozen-globs.md), with its measurements.
- **`check:corpus` dogfoods it (enforcement I2).** One `liveRecordIn(lane)`, built as
  `and(areLive(), resideInFolder(root), not(or(done folders)), not(or(board files)))`, serves the
  per-lane State rules (through `inDocuments`), `corpus/state-present` and
  `corpus/closed-records-sit-in-done-folders`. Its summary prints the same counts before and after
  (measured at dcff39f: 24 plans · 196 bugs State lines in 220 records; 0 closed of 220 live
  records, 0 undecided). The
  eight `check:nonvacuity` rows over those rules each fail on their violating input (49 s,
  `QA_ONLY`). The comment saying `rows()` has no per-document filter is corrected.
- **ADR-021's Enforcement paragraph** carries a dated correction note: the eess-md test drives
  `inDocuments`, and rows 13 to 16 below prove the forwarding.
- **The messages (product M5, architect m-4).** One scope says "the scope matched K of N"; several
  say "the scopes together matched K of N"; an empty intersection says "no document matches every
  scope (each matches some of the corpus's N)".
- **Testing M1 to M5.** New rows: two live scopes counted as their intersection, and the empty
  intersection; the "(U could not be judged)" note counting only dead scopes; `frozen: []` rebuilt
  on a `completed/` path the default would freeze, with identity assertions; a scope over a corpus
  that loaded nothing gives the empty-source finding; `.select()` through the lift refuses an
  undecided document; `not()` around a scope gives the generic finding; the memo rows assert
  elements, not counts. Rows 18 to 20 of the matrix are the reviewer's mutants, each red on its row.
- **Records:** bugs [0499](../../bugs/fixed/0499-corpus-does-not-check-its-frozen-globs.md),
  [0500](../../bugs/0500-eess-md-notexist-with-expectnonempty-can-never-be-green.md) (no earlier record
  covers eess-md; bug 0473 is eess-ts's) and
  [0501](../../bugs/0501-md-and-kernel-leftovers-from-plan-0457.md), on the board.
- **Not here:** the predicate-and-condition naming (product I1) is plan 0496's (PR #247).

## Progress ledger

- [x] Phase 1: predicates, `onDocument` folded in, exports
- [x] Phase 2: `ParsedCodeBlocks.documents` and the diagnosis (one base override and one in
      `codeBlocks()`, see Build notes)
- [x] Phase 3: example under plan 0458's gate, docs
- [x] Sabotage rows run, each red then green (22 rows below)
- [x] `deferred→bug 0174` green-path counts (documents matched, elements examined) and the
      frozen-documents-excluded count on every path, recorded on that bug in PR #235
- [x] `npm run validate` green, done otherwise: exit 0 in 897 s at 4625486, the branch head before
      the rebase onto main, whose tree is the same as 15a5d21's. PR #245's fixes after it are gated
      by CI on the PR.
- [x] Close: this plan → `completed/`; ROADMAP row

Deferred: bug 0174

**Sabotage matrix.** First run 2026-10-18 at 5b1e2f2, a commit from before the branch was rebased
onto main; its `packages/`, `examples/` and `scripts/` tree is identical to b1a193c's (`git diff`
empty). Run again 2026-10-19 at dcff39f, after PR #245's code fixes, with rows 18 to 20 added and
every row running all three test files, so each red set is whole; the commits after dcff39f change
nothing the three test files read. That run is the table below: 22 rows, 73 s, baseline green,
each sabotage applied, eess-md rebuilt, the three files run, the file restored by `git checkout`,
tree clean after. `in-documents` is `packages/md/tests/in-documents.test.ts` (37 tests);
`have-field-undecided` is `packages/md/tests/builders/have-field-undecided.test.ts`; `example` is
`examples/md/in-documents.test.ts`. The red column counts failing tests per file. Each mutant is
one line in `packages/md/src` unless the row says otherwise.

| row | mutant                                                                                                                    | red (failing tests)                                     | named test in the failure                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | `liftToDocument`'s `test` body becomes `return true`                                                                      | in-documents 26, have-field-undecided 2, example 3 (31) | the scoped rule is green where the unscoped one is red                              |
| 2   | `liftToDocument`'s `test` body becomes `return false`                                                                     | in-documents 11, have-field-undecided 2, example 1      | violating-open-box-in-scope: …                                                      |
| 3   | the memo is a `Map` keyed on `doc.relPath`                                                                                | in-documents 1                                          | two corpora holding the same relPath with opposite verdicts …                       |
| 4   | `scopeDiagnosis` returns `undefined` first                                                                                | in-documents 15                                         | a dead scope under a positive rule reds with the reason naming it                   |
| 5   | `CorpusRuleBuilder.cardinalitySelectorFault()` returns a fault when `scopeDiagnosis` gives a reason (does not type-check) | in-documents 5, have-field-undecided 2, example 2       | a dead content scope under notExist() is green …                                    |
| 6   | `liftToDocument` stops forwarding `globs`                                                                                 | in-documents 1                                          | a folder scope under notExist() is judged …                                         |
| 7   | step 1 filters `scopes.slice(0, 1)` (only the first scope checked)                                                        | in-documents 3                                          | two scopes, the second dead: …                                                      |
| 7b  | step 1 names `dead.slice(0, 1)` (only the first dead scope named)                                                         | in-documents 1                                          | every dead scope is named, not only the first                                       |
| 8   | step 2's `if (before === 0) return undefined` removed                                                                     | in-documents 1                                          | a non-scope predicate that emptied the selection …                                  |
| 9   | `CorpusRuleBuilder`'s `deadGlobDiagnosis()` override removed                                                              | in-documents 14                                         | taskItems(), links(), pointers(), rows(), terms()                                   |
| 9b  | `CodeBlockRuleBuilder`'s `deadGlobDiagnosis()` override removed                                                           | in-documents 1                                          | codeBlocks(), counting every document …                                             |
| 10  | `areFrozen`'s test reads `!d.frozen`                                                                                      | in-documents 2                                          | select by the corpus's frozen globs, lifted onto boxes                              |
| 11  | `codeBlocks()` passes the documents of its blocks, not `project.documents`                                                | in-documents 1                                          | codeBlocks(), counting every document …                                             |
| 12  | the example's `load` uses `roots: ['nothing/**']` (`examples/md/in-documents.test.ts`)                                    | example 3                                               | violating-scope-matches-nothing: …                                                  |
| 13  | `liftToDocument` stops declaring `undecided`                                                                              | in-documents 2, have-field-undecided 4                  | block 12: …; in in-documents, forwards undecided … and .select() through the lift … |
| 14  | the lifted `test` calls `p.test(element.doc)` before reading the memo                                                     | in-documents 3                                          | forwards undecided, memoized per document, and never asks test() …                  |
| 15  | the lifted `test` returns `false` for an undecided document instead of refusing                                           | in-documents 1                                          | the lifted test() refuses an undecided document, naming the cause                   |
| 16  | the memo's `if (known !== undefined) return known` removed                                                                | in-documents 2                                          | runs the inner predicate once per document, …                                       |
| 17  | `codeBlocks().resideInFolder` registers `inDocuments(p)` instead of `liftToDocument(p, p.description)`                    | in-documents 1                                          | codeBlocks() keeps its own predicates' rule text …                                  |
| 18  | step 2 counts documents with `scopes.some` for `scopes.every`                                                             | in-documents 2                                          | two live scopes count the documents that match every scope                          |
| 19  | `corpus()` falls back to `DEFAULT_FROZEN` when `frozen` is empty (`packages/md/src/corpus.ts`)                            | in-documents 1                                          | a corpus built with frozen: [] has no frozen document, …                            |
| 20  | the undecided note counts over `scopes.some`, not `dead.some`                                                             | in-documents 1                                          | only a dead scope counts the documents it could not judge                           |

The 2026-10-18 run at 5b1e2f2 ran each row's named files only, so its row 1 listed in-documents
alone; PR #245's enforcement review measured 29 failing tests on that tree (24, 2 and 3), and the run
above counts 31 (26, 2 and 3) with the five tests added since. The matrix script and its output are
this session's scratch files, not kept in the repository; the mutant column is written so a row can
be rebuilt.
