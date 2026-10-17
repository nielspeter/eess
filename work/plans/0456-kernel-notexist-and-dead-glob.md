# Plan 0456: `notExist` across eess-md, on a kernel that cannot pass a broken selector

## Status

- **State:** Draft — written 2026-10-17 from proposal 017's maintainer acceptance (block 6);
  reworked 2026-10-18 after PR #235's review (architect · product · enforcement · method ·
  testing). `beUniqueBy`, the eess-gherkin rebuild and the record-number dogfood moved to
  [plan 0459](./0459-kernel-beuniqueby-and-gherkins-unique-titles.md).
- **Implements:** proposal 017
- **Fixes:** [bug 0460](../bugs/0460-the-kernel-exempts-a-cardinality-rule-before-it-looks-for-a-dead-glob.md)
  (first, at the maintainer's decision 2026-10-18). It does not fix
  [bug 0462](../bugs/0462-a-notexist-whose-evaluate-is-replaced-keeps-its-exemption.md) for the
  five existing copies: the new kernel factory is frozen, and the copies are fixed when they
  migrate onto it (coordinator's decision, 2026-10-18).
- **Priority:** Medium. Block 6 ("a document no selection claims") is wanted by all three
  adopters (017, "Consumer feedback"), and every later block plan's example needs a `notExist()`
  on an md builder.
- **Effort:** Medium. Three kernel changes, `notExist()` on seven md builders, an empty-source
  check and a selector-fault check on md's corpus builders, three predicate exports and two
  combinator re-exports, one example. One pull request.
- **Created:** 2026-10-17
- **Builds after:** [plan 0458](./0458-the-examples-gate-a-document-shape-from-public-blocks-only.md)
  (the examples gate). Build order (maintainer, 2026-10-18): 0458 → **0456** → 0454 → 0457 →
  0455 → 0459.
- **Builds before:** 0454, 0457 and 0459. They use what this plan makes public (the contract
  below).

## Problem

**1. eess-md cannot say "this selection is empty".** 017's block 6 is two judgements over a
folder and the caller's own selections: every document is claimed by one of them, and no
document is claimed by two. Both are `.should().notExist()` over a selection, and no md builder
has a condition of that shape. `TaskItemRuleBuilder` (`packages/md/src/builders/task-items.ts:24`)
has two predicates and no condition at all, and blocks 12 and 17 ("documents whose `Status` is
`done` hold no open box") need one there too. Under plan 0458's gate an example cannot hand-build
the condition, so it has to be public.

The family already has the condition five times, in two dialects:

- eess-ts: `packages/ts/src/conditions/structural.ts:145` (behind the `classes()`, `types()` and
  `modules()` builders), `conditions/function.ts:56`, `conditions/call.ts:58` and `conditions/jsx.ts:36`: four implementations
  behind six builder methods;
- eess-mermaid: `packages/mermaid/src/conditions/class.ts:110`.

017's decision 4 puts one owner in the kernel.

**2. The kernel lets a cardinality rule with a broken selector pass (bug 0460).**
`zeroExaminedFinding` (`packages/core/src/terminal-builder.ts:311`) returns no finding for a rule
whose condition asserts cardinality at line 318, before it consults any diagnosis of the selector
at line 319. eess-ts guards against this in its own `evidenceFloor`
(`packages/ts/src/core/vacuity-diagnosis.ts:309`), with the rulings of
[bug 0355](../bugs/fixed/0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md)
and [bug 0362](../bugs/fixed/0362-a-typod-ratchet-is-green-in-both-tools.md). Every dialect on the
kernel's `TerminalBuilder` has neither. Adding `notExist()` to md without the guard would ship a
ratchet that a one-character selector fault turns permanently green.

Measured 2026-10-18 on main's build, for this plan:

| dialect      | rule                                                      | today                                  |
| ------------ | --------------------------------------------------------- | -------------------------------------- |
| eess-mermaid | `notExist`, a class-name selector matching nothing        | 0 findings, examined 0 → green         |
| eess-mermaid | `notExist` over an empty diagram (`classDiagram` alone)   | 0 findings, examined 0 → green         |
| eess-mermaid | a positive rule over the same empty diagram               | 1 finding, the generic "examined zero" |
| eess-md      | `corpus({ roots: ['gudies-typo/**'] })`: documents loaded | 0, no error                            |
| eess-md      | a positive `docs()` rule over that empty corpus           | 1 finding, the generic "examined zero" |

What the table says about exposure:

- **eess-mermaid's selectors are names, not paths** (`packages/mermaid/src/builders/class-rule-builder.ts`
  declares no glob). A name selector matching nothing on a cardinality rule stays green in eess-ts
  too: bug 0355's ruling covers path selectors only, and calls the name shape "uncovered". So the
  first row is not bug 0460's; it is the family's stated limit.
- **Neither eess-mermaid nor eess-md reports an empty source.** Only `codeBlocks()` overrides
  `sourceEmpty()` (`packages/md/src/builders/code-blocks.ts:109`). ADR-010 §3 says an empty source
  outranks every declaration, and the kernel applies that first (`core/src/terminal-builder.ts:315`), but
  only when the dialect says so. For md this plan adds it, because block 6's recipe depends on it
  (Design, "What a broken selector does now"). For eess-mermaid it is a separate defect, not this
  plan's scope: [bug 0463](../bugs/0463-a-mermaid-notexist-over-an-empty-diagram-passes.md).
- **eess-md's location predicates declare no globs.** `resideInFolder` and `resideInFile`
  (`packages/md/src/predicates/document.ts:7`, `:12`) return a bare `{ description, test }`, so no
  glob-based diagnosis can see them, and the kernel's plan-0069 machinery (`Predicate.globs`,
  `packages/core/src/predicate.ts:23`) is unused in md.

**3. A returned `notExist()` can be emptied and keep its exemption (bug 0462).** Reproduced on
main: assigning `evaluate = () => []` on eess-ts's `notExist()` gives a condition that passes over
an empty selection where a plain no-op condition reds, and `Object.isFrozen` is `false`.
`marksAssertsCardinality` (`packages/core/src/cardinality.ts:72`) protects the key, not the object.
The new kernel factory must not copy this; the five existing copies keep it until they migrate.

## Design

### Kernel (1): the new factory is frozen; marking is unchanged

`marksAssertsCardinality` (`packages/core/src/cardinality.ts:72`) stays as it is. Freezing there
would fix bug 0462 for all seven marked objects at once (the five `notExist` copies and the two
`correspondence` callables, `packages/core/src/correspondence.ts:111`, `:125`), but it makes
assigning to a returned eess-ts or eess-mermaid `notExist()` throw, which is a kernel break that
every dialect would have to name (coordinator's decision, 2026-10-18). Instead only the new
factory freezes its own condition (Kernel (3)). Bug 0462 stays open for the five copies, and is
fixed by their migration onto `notExistCondition` (Out of scope).

### Kernel (2): a cardinality rule consults its dialect first (bug 0460)

A new protected hook beside `deadGlobDiagnosis()` (`packages/core/src/rule-builder.ts:281`), and one
line in `zeroExaminedFinding`:

```ts
// packages/core/src/rule-builder.ts
/**
 * For a cardinality rule that examined zero: the selector fault that makes "zero" not the
 * assertion holding, or `undefined`. Bug 0355's ruling: a fault decidable from the glob text
 * (0362), or a path the instrument holds files under that the rule never saw. NEVER "the glob
 * matches nothing": that is also what a holding ratchet looks like.
 */
protected cardinalitySelectorFault(): string | undefined {
  return undefined
}
```

```ts
// packages/core/src/terminal-builder.ts, zeroExaminedFinding
if (this.assertsCardinality()) {
  const fault = this.cardinalitySelectorFault()
  return fault === undefined ? undefined : cardinalitySelectorFaultViolation(this.facts(), fault)
}
```

The order is otherwise unchanged: an empty source, then `.expectEmpty()`, then `.expectNonEmpty()`,
then this. The default is `undefined`, so no dialect changes until it overrides the hook. eess-ts
does not inherit this path (it keeps `evidenceFloor`), and eess-mermaid declares no globs, so for
both the change is inert. The finding is a configuration finding (`bypassFilters`), like the
dead-glob finding it sits beside, so `.excluding()` cannot hide it.

### Kernel (3): one `notExist` factory, behind `/internal`

```ts
// packages/core/src/not-exist.ts (new), exported from packages/core/src/internal.ts
export interface NotExistOptions<T> {
  /** How the message names the element: `class Foo`, `work/plans/0001-x.md:12`. */
  readonly name: (element: T) => string
  /** The dialect's own constructor, so a code frame or `identifyByArgument` survives. */
  readonly toViolation: (element: T, message: string, ctx: ConditionContext) => ArchViolation
}

export function notExistCondition<T>(opts: NotExistOptions<T>): Condition<T> {
  // Frozen before it is marked: the exemption attaches to an object nobody can change.
  // The five older copies do not do this yet (bug 0462); they inherit it by migrating here.
  return marksAssertsCardinality(
    Object.freeze({
      description: 'not exist',
      evaluate: (elements: T[], ctx: ConditionContext): ArchViolation[] =>
        elements.map((e) => opts.toViolation(e, `${opts.name(e)} should not exist`, ctx)),
    }),
  )
}
```

Decisions, each overrulable:

- **The dialect's violation constructor, not `identify`.** The five existing copies attach a code
  frame and eess-ts's `calls()` copy honours `identifyByArgument`. A factory taking `identify`
  would drop both, so it could never absorb them and would be a sixth copy (architect, Important
  2). With `toViolation`, each copy's later migration is one line, and the message stays
  byte-identical (`${name} should not exist`; mermaid passes `class ${c.name}`).
- **`/internal`, named `notExistCondition`.** It is family plumbing in ADR-011's sense: a dialect
  writes it, and an adopter writes `docs(c).…should().notExist()`. A root export named `notExist`
  would meet eess-ts's zero-argument root `notExist()` (`packages/ts/src/index.ts:96`) with a
  different signature, the name-collision class of bug 0192. `/internal` imports are not
  re-exported by `check:family` (md already imports `walkFiles` and `pathSuffixIndex` from there:
  `packages/md/src/corpus.ts:1`, `conditions/pointer-resolve.ts:4`).
- **Migrating the five copies is out of scope** (Out of scope, with its home). Until they migrate,
  bug 0462 stays open for them: a returned eess-ts or eess-mermaid `notExist()` is still mutable.

### eess-md: `notExist()` on every builder whose element carries a document

Seven builders: `docs()`, `links()`, `pointers()`, `rows()`, `terms()`, `taskItems()` and
`codeBlocks()` (`packages/md/src/builders/docs.ts:24`, `builders/links.ts:32`, `builders/pointers.ts:22`,
`builders/rows.ts:18`, `vocabulary.ts:154`, `builders/task-items.ts:24`, `code-blocks.ts:91`). Each element carries
its document and a line. One shared helper:

```ts
// packages/md/src/conditions/not-exist.ts (new)
import { notExistCondition } from '@nielspeter/eess/internal'
import { mdViolation } from '../model/violation.js'

/** `notExist()` for any md element: named `relPath:line`, reported at its own line. */
export function mdNotExist<T>(locate: (e: T) => { doc: MdDocument; line: number }): Condition<T> {
  return notExistCondition({
    name: (e) => {
      const { doc, line } = locate(e)
      return `${doc.relPath}:${String(line)}`
    },
    toViolation: (e, message, context) => {
      const { doc, line } = locate(e)
      return mdViolation({
        element: `${doc.relPath}:${String(line)}`,
        file: doc.file,
        line,
        message,
        context,
      })
    },
  })
}
```

```ts
// each builder, e.g. packages/md/src/builders/task-items.ts
/** The selection must be empty: each selected box is a finding, at its own line. */
notExist(): this {
  return this.addCondition(mdNotExist((t: MdTaskItem) => ({ doc: t.doc, line: t.line })))
}
```

A document is named by its `relPath` alone and reported at line 1. A code block uses
`b.block.line`. No code frame: `mdViolation` attaches one only when given the source text, and a
frame for "this should not exist" adds nothing (`packages/md/src/model/violation.ts:13`).

### eess-md: the predicates and combinators an example needs

Plan 0458's gate allows an example to import `@nielspeter/eess-md`'s root only. What block 6 needs
from it, and every later example after it, is exported here (the cross-plan contract):

- `resideInFolder`, `resideInFile`, `haveNameMatching` as standalone `Predicate<MdDocument>`
  (`packages/md/src/predicates/document.ts:7`, `:12`, `:17`). The same three names exist on
  eess-ts's root for its own elements (`packages/ts/src/index.ts:80-84`). That is one word for one
  meaning across the family (ADR-017), not a clash with a kernel name; a file importing both roots
  aliases one, as it would any two dialects' builders.
- `and` and `or`, as explicit documented re-exports beside `not` (`packages/md/src/index.ts:29`),
  the way `correspondence` is (`md/src/index.ts:50`). `check:family` cannot ask for them, because md's
  own source does not import them.

`haveSectionPredicate` stays unexported: plan 0457 decides the public name of a section predicate.

### eess-md: what a broken selector does now

Two additions to md's corpus builders, so that block 6's `notExist()` cannot pass on a broken
instrument or a broken selector:

1. **An empty corpus is an empty source.** `docs()`, `links()`, `pointers()`, `rows()`, `terms()`
   and `taskItems()` override `sourceEmpty()` to `this.project.documents().length === 0`, as
   `codeBlocks()` already does (`code-blocks.ts:109`). The kernel then reports the empty source
   first, ahead of `.expectEmpty()` and the cardinality exemption (ADR-010 §3). This is a
   behaviour change, and a break (Release).
2. **The location predicates declare their globs, and the builders diagnose them.**
   `resideInFolder` and `resideInFile` declare `globs: globNode({ glob, kind: 'file-path', base:
'normalized' })` (`globNode` is a kernel root export, `packages/core/src/index.ts:126`, so
   `check:family` makes md's root re-export it) (`packages/core/src/glob-site.ts:137`; `'normalized'` because md globs are
   repo-relative, so "unanchored" is the correct spelling, `glob-site.ts:125`). The corpus
   builders override `cardinalitySelectorFault()` with one shared helper,
   `mdSelectorFault(builder)` in `packages/md/src/builders/selector-fault.ts` (internal; plan 0457
   composes its scope fault before it), walking their positive selector sites through
   the kernel's `declaredGlobsOf` (`packages/core/src/internal.ts:114`), which already handles
   `not()`/`or()` by negation-normal form:
   - **a fault in the glob text** (bug 0362's class): a `./` segment, or a leading `/`. Such a
     glob matches no `relPath` in any corpus.
   - **the repository holds Markdown under the glob that the corpus did not load** (bug 0355's
     class): the glob matches a `.md` path in `corpus.fileIndex` (`packages/md/src/corpus.ts:50`)
     and no loaded document. The finding names the count and the cause (outside `roots`, or
     ignored).
   - **a glob that matches nothing in the repository stays green.** That is also what a holding
     ratchet looks like (a deleted `legacy/`), and bug 0355's ruling is that the two cannot be
     told apart. Its record names the consequence: a typo that names nothing stays green. This
     plan keeps that ruling. It does not re-decide it.

   `codeBlocks()` gets the text check only. `ParsedCodeBlocks` carries no file index
   (`packages/md/src/model/code-block-parse.ts:96-100`), and its folder methods wrap the document
   predicate in `onDocument` (`code-blocks.ts:21`), which this plan makes forward `globs`. Plan
   0457 replaces `onDocument` with `inDocuments`, which must forward them too.

**So a typo is caught by the recipe, not by the selector.** Block 6's documented shape loads the
folder as the corpus's root, so a mistyped root gives an empty corpus, which is an empty source and
red (1. above). The selection glob inside it can then only be a text fault (red) or a live folder.
Measured on main: `corpus({ roots: ['gudies-typo/**'] })` loads 0 documents with no error.

```ts
import { and, corpus, docs, haveNameMatching, not, or, resideInFolder } from '@nielspeter/eess-md'

const c = corpus({ roots: ['guides/**'] }) // a typo here is an empty source: red
const howTo = resideInFolder('guides/how-to/**')
const reference = resideInFolder('guides/reference/**')
const tutorial = haveNameMatching(/^tutorial-/)

// Every page is claimed by a selection.
docs(c)
  .that()
  .satisfy(not(or(howTo, reference, tutorial)))
  .should()
  .notExist()

// No page is claimed by two.
docs(c)
  .that()
  .satisfy(or(and(howTo, reference), and(howTo, tutorial), and(reference, tutorial)))
  .should()
  .notExist()
```

The second rule grows with the square of the selections (three pairs for three); that is written
in the recipe, not hidden. It also guards the first: a selection widened to match everything
claims every page twice, so the second rule reds where the first goes quiet.

### What this does not change

- `deadGlobDiagnosis()` and the order for positive rules. md's positive rules keep the generic
  zero-examined finding; a named dead-glob finding for them is not this plan's (Out of scope).
- eess-ts's own floor.

## Phases

All in one pull request. Each phase is reviewable on its own.

### Phase 1: the kernel

- `cardinalitySelectorFault()` and its use in `zeroExaminedFinding`, with
  `cardinalitySelectorFaultViolation` beside `deadGlobViolation` in
  `packages/core/src/vacuity-findings.ts` (bug 0460).
- `notExistCondition` in `packages/core/src/not-exist.ts`, frozen, exported from `internal.ts`.

### Phase 2: eess-md

- `mdNotExist` and `notExist()` on the seven builders.
- `sourceEmpty()` on the six corpus builders.
- `globs` on `resideInFolder` and `resideInFile`; `onDocument` forwards them; the
  `cardinalitySelectorFault()` override.
- Root exports: `resideInFolder`, `resideInFile`, `haveNameMatching`, `and`, `or`.
- `packages/md/README.md`: block 6's recipe above, compiled by `check:docs-code`.
- The example, `examples/md/unclaimed-and-double-claimed.test.ts`, with fixture folders `clean/`,
  `violating-unclaimed/` and `violating-double/` registered as plan 0458's mechanism specifies (one
  violating fixture per judgement).
- Run `check:corpus`, `check:ledger`, `check:spec` and `check:crossval` on this repository: they
  are md rules, and the empty-source change is the one most likely to move them.

## Files changed

| file                                                          | change                                                      |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| `packages/core/src/rule-builder.ts`                           | `cardinalitySelectorFault()` hook                           |
| `packages/core/src/terminal-builder.ts`                       | consult it for a cardinality rule                           |
| `packages/core/src/vacuity-findings.ts`                       | `cardinalitySelectorFaultViolation`                         |
| `packages/core/src/not-exist.ts`                              | new                                                         |
| `packages/core/src/internal.ts`                               | export `notExistCondition`, `NotExistOptions`               |
| `packages/core/tests/not-exist.test.ts`                       | new                                                         |
| `packages/core/tests/cardinality-selector-fault.test.ts`      | new                                                         |
| `packages/md/src/conditions/not-exist.ts`                     | new                                                         |
| `packages/md/src/builders/*.ts` (seven)                       | `notExist()`; `sourceEmpty()` and the fault override on six |
| `packages/md/src/predicates/document.ts`                      | `globs` on two predicates                                   |
| `packages/md/src/builders/code-blocks.ts`                     | `onDocument` forwards `globs`                               |
| `packages/md/src/index.ts`                                    | five exports, and `globNode` for `check:family`             |
| `packages/md/tests/not-exist.test.ts`                         | new                                                         |
| `packages/md/tests/selector-fault.test.ts`                    | new                                                         |
| `packages/md/README.md`                                       | block 6 recipe                                              |
| `examples/md/unclaimed-and-double-claimed.test.ts` + fixtures | new (plan 0458's gate)                                      |
| `.changeset/*.md`                                             | see Release                                                 |

## Test inventory

Every test drives the public entry point and the terminal (`.violations()` or `.check()`), never
`collectViolations`: the empty-selection and selector-fault findings are added in
`TerminalBuilder.evidencedViolations`, after `collectViolations` returns (testing, 0456-I4).

**Kernel**, through a minimal `RuleBuilder` subclass in the test file:

- `notExistCondition`: an empty selection is green with no finding; two elements give two
  findings through the dialect's `toViolation`, each with its own file and line, and the rule's
  `because`, `suggestion`, `docs` and `ruleId`.
- `notExistCondition` composed: `.should().notExist().andShould()…` over zero elements is not
  exempt (pins `RuleBuilder.assertsCardinality()`'s `.every()`).
- Freeze: assigning `evaluate` on a condition returned by `notExistCondition` throws, and its rule
  still reds over a selected element.
- Known gap, pinned: a returned eess-ts `notExist()` is still mutable, and with `evaluate = () =>
[]` it still passes over an empty selection where a plain no-op condition reds. The test asserts
  today's behaviour and names bug 0462, so the copies' migration turns it red and must update it.
- `cardinalitySelectorFault`: a cardinality rule whose hook returns a fault reds with that text and
  `bypassFilters`; `.excluding()` matching the rule does not hide it; with the hook returning
  `undefined` the rule is green; an empty source still outranks it.
- A positive rule's order is unchanged (an existing dead-glob test stays green unedited).

**eess-md**, over `corpus()` on fixture directories:

- `notExist()` on each of the seven builders: one selected element gives one finding at its own
  `relPath:line`; an empty selection is green.
- Block 6, unclaimed: a page outside every selection is a finding naming its path; when all are
  claimed, green.
- Block 6, claimed by two: a page in two selections is a finding; a selection widened to `'**'`
  reds the second rule.
- Empty source: `corpus({ roots: ['gudies-typo/**'] })` with `docs(c).should().notExist()` reds
  with the empty-source finding; so does the same rule with `.expectEmpty()` (ADR-010 §3).
- Text fault: `resideInFolder('./guides/**')` on a `notExist()` rule reds, naming the `./`
  segment; `resideInFolder('/guides/**')` reds naming the leading `/`.
- Unloaded Markdown: the repository holds `guides/a.md` and the corpus's roots are `['docs/**']`;
  `docs(c).that().resideInFolder('guides/**').should().notExist()` reds, naming one Markdown file
  the corpus did not load.
- Reverse control, the ratchet holding: a corpus over `docs/**` with no `legacy/` anywhere in the
  repository; `resideInFolder('legacy/**')…notExist()` is green.
- Reverse control under negation: `satisfy(not(resideInFolder('./x/**')))` is not a fault (a
  negative site is never dead).
- `codeBlocks().resideInFolder('./x/**').should().notExist()` reds with the text fault (globs
  forwarded through `onDocument`).
- This repository's `check:corpus`, `check:ledger`, `check:spec` and `check:crossval` are green and
  print the same counts as on main.

**Sabotage rows**, run in a worktree. Each must turn its named test red:

1. `notExistCondition`'s `evaluate` returns `[]`: the two-element kernel test reds.
2. Drop `marksAssertsCardinality` from `notExistCondition`: the empty-selection test reds.
3. Drop the `Object.freeze` in `notExistCondition`: the freeze test reds.
4. Restore the old order (cardinality returns before the hook): the kernel fault test and the md
   text-fault and unloaded-Markdown tests red.
5. md's `sourceEmpty()` returns `false`: the empty-source test reds.
6. The fault override ignores `fileIndex`: the unloaded-Markdown test reds.
7. The fault override treats "matches nothing in the repository" as a fault: the ratchet-holding
   control reds.
8. `onDocument` drops `globs`: the `codeBlocks()` text-fault test reds.
9. `taskItems().notExist()` uses `mdNotExist` with `line: 1`: the per-element line assertion reds.

**Non-vacuity.** This plan adds a library capability, not a gate of this repository. Its proof is
the sabotage matrix above and the example's violating fixtures, registered through plan 0458's
mechanism. No row of its own in `check:nonvacuity`.

## Release

- `@nielspeter/eess`: minor, not breaking: a new `/internal` export (`notExistCondition`) and a
  new protected hook whose default changes nothing. The kernel's zero-examined order changes only
  for a dialect that overrides the hook. Freezing at marking, which would have been a kernel break
  naming all five dialects, is not done (Kernel (1)).
- `@nielspeter/eess-md`: minor, marked **Breaking (@nielspeter/eess-md)**: a corpus that loaded no
  document is an empty source, which `.expectEmpty()` no longer satisfies and which outranks a
  `notExist()` pass; the finding text for a positive rule over an empty corpus changes from
  "examined zero units" to the empty-source message. New: `notExist()` on seven builders, five
  root exports. No workspace package lists eess-md in `dependencies` (eess-crossvalidate has it as
  a peer).
- eess-ts, eess-mermaid, eess-gherkin and eess-crossvalidate take the kernel range bump only
  (`patch`, by `updateInternalDependencies`). The only break in this plan is eess-md's.
- Migration line, in the changeset: "If a rule over a corpus that loads nothing relied on
  `.expectEmpty()`, fix the corpus's `roots`; an empty corpus is now a configuration finding."

## Out of scope

- **Migrating the five `notExist` copies onto `notExistCondition`.** Each is one line after this
  plan; doing five dialect migrations here would double the review. The migration is also what
  fixes bug 0462 for them, since the kernel factory is frozen. Home: a Draft plan filed with this
  plan's build PR, named in the close box below.
- **eess-mermaid's missing empty-source check** (the measured empty-diagram row). Not bug 0460's
  kernel order. Home: [bug 0463](../bugs/0463-a-mermaid-notexist-over-an-empty-diagram-passes.md).
- **A named dead-glob finding for md's positive rules.** They keep the generic finding; plan 0457
  overrides `deadGlobDiagnosis()` for its scopes.
- **A typo that names nothing in the repository**, on a cardinality rule. Bug 0355's ruling, kept;
  the recipe's roots-scoped corpus is the remedy.
- `beUniqueBy`, the gherkin rebuild and the record-number dogfood: [plan 0459](./0459-kernel-beuniqueby-and-gherkins-unique-titles.md).

## Records this plan depends on

- [bug 0463](../bugs/0463-a-mermaid-notexist-over-an-empty-diagram-passes.md): eess-mermaid reports no empty source, so
  `classes(diagram('classDiagram\n')).should().notExist()` passes (measured above).
- Bug 0460's verification rows are being rewritten by the coordinator to follow bug 0355's ruling,
  as this plan does: a text fault and unloaded Markdown red, an absent folder green, a typo that
  names nothing caught by the roots-scoped recipe.

## Review response — 2026-10-18

- **architect C1 / product I4 / enforcement I1 / method B4 / testing 0456-C2** (block-6 example
  does not compile, cannot be built from md's root): fixed. `.and().satisfy(…)` and `satisfy(…)`
  forms; `and`/`or` and the three document predicates exported here.
- **architect I2** (kernel `notExist` cannot absorb the copies): fixed. It takes the dialect's
  `toViolation`.
- **architect I3 / product I3 / testing 0456-I1** (half of block 6 missing): fixed. "Claimed by
  two" has a recipe, a test and a violating fixture.
- **architect I4 / product I2** (name collision with eess-ts's root `notExist`): fixed.
  `notExistCondition` behind `/internal`.
- **product I1 / product (0457 Critical)** (no `notExist` on other builders): fixed. Seven
  builders.
- **enforcement C1 / testing 0456-C1** (no 0355/0362 discriminator): fixed as bug 0460, with the
  0355 ruling kept and the typo case handled by the recipe and the empty-source check.
- **method B1** (mutable exemption unrecorded): recorded as bug 0462 in this PR. The new kernel
  factory is frozen; the five copies keep the gap until they migrate (coordinator's decision: no
  kernel break), and a test pins it.
- **method B2** (too big): split. 13, the gherkin break and the dogfood are plan 0459.
- **method B3** (gherkin break not shown to the maintainer): the maintainer accepted it
  2026-10-18; it now lives in 0459.
- **testing 0456-I4** (tests on `collectViolations`): fixed. Tests drive `.violations()`/`.check()`.
- **enforcement I2, I3 / testing 0456-I2, I3, I5 / product I5 / M1–M4** (dogfood probe,
  denominator, case-only key, gherkin rows, migration line, message paths): moved with their
  subject to plan 0459.
- **method minors** (no Close box; `Deferred: none` beside a deferral; `ts` fence for `.mjs`; one
  violating fixture for two judgements): fixed. Close box added; deferrals named; the `.mjs`
  snippet moved to 0459; two violating fixtures.
- **architect M5–M6** (`elementViolation` copy; made-up locations): gone. The kernel builds no
  violation; the dialect does, with a real file and line.

## Progress ledger

- [ ] Phase 1: `cardinalitySelectorFault`, `notExistCondition` (frozen), kernel tests, the bug-0462
      known-gap test
- [ ] Phase 2: md `notExist()` ×7, `sourceEmpty()` ×6, declared globs and the fault override, five
      exports, README recipe, the example with three fixtures
- [ ] Sabotage rows 1–9, each red on its named test; durations reported
- [ ] Bug 0460 red-first on main, green here, → `fixed/`; bug 0462 stays open, its gap pinned
- [ ] `check:family`, `check:release`, `check:docs-code`, `check:examples` and `npm run validate`
      green; durations reported
- [ ] Close: this plan → `completed/`; proposal 017's block-6 row; the copies' migration Draft
      plan filed and named here; boards

Deferred: the five copies' migration and with it bug 0462 (a Draft plan filed with this build);
eess-mermaid's empty source (bug 0463)
