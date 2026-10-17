# Plan 0456: `notExist` across eess-md, on a kernel that cannot pass a broken selector

## Status

- **State:** Draft — written 2026-10-17 from proposal 017's maintainer acceptance (block 6);
  reworked twice on 2026-10-18 after PR #235's two review rounds (architect · product ·
  enforcement · method · testing). `beUniqueBy`, the eess-gherkin rebuild and the record-number
  dogfood moved to [plan 0459](./0459-kernel-beuniqueby-and-gherkins-unique-titles.md).
- **Implements:** proposal 017
- **Fixes:** [bug 0460](../bugs/0460-the-kernel-exempts-a-cardinality-rule-before-it-looks-for-a-dead-glob.md)
  (first, at the maintainer's decision 2026-10-18) and
  [bug 0462](../bugs/0462-a-notexist-whose-evaluate-is-replaced-keeps-its-exemption.md), by freezing
  a condition when it is marked (coordinator's decision 3 in the second rework brief, 2026-10-18,
  which reverses the first brief's narrower call).
- **Priority:** Medium. Block 6 ("a document no selection claims") is wanted by all three
  adopters (017, "Consumer feedback"), and every later block plan's example needs a `notExist()`
  on an md builder.
- **Effort:** Large. About 18 files and five new test files across two packages, eleven sabotage
  rows, and a flagged break re-run against four of this repository's gates. One pull request,
  reviewed in two parts: the kernel (Phase 1), then eess-md (Phase 2). Phase 1 alone ships an
  inert hook, so it is not a delivery on its own (method, round two m13).
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
  `modules()` builders), `conditions/function.ts:56`, `conditions/call.ts:58` and
  `conditions/jsx.ts:36`: four implementations behind six builder methods;
- eess-mermaid: `packages/mermaid/src/conditions/class.ts:110`.

017's decision 4 puts one owner in the kernel.

**2. The kernel lets a cardinality rule with a broken selector pass (bug 0460).**
`zeroExaminedFinding` (`packages/core/src/terminal-builder.ts:311`) returns no finding for a rule
whose condition asserts cardinality at line 318, before it consults any diagnosis of the selector
at line 319, and `.expectEmpty()` returns even earlier, at line 316. eess-ts guards against both in
its own `evidenceFloor` (`packages/ts/src/core/vacuity-diagnosis.ts:309`): there the cardinality
faults are checked before `declaresEmpty()`, under the rulings of
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
  declares no glob). Bug 0355's record lists "a ratchet with no path glob at all" first under
  "What this does NOT catch" (a `.notExist()` over `haveNameMatching(/…/)` reports 0). So the first
  row is the family's stated limit, not bug 0460.
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
`marksAssertsCardinality` (`packages/core/src/cardinality.ts:73`) protects the key, not the object.

**4. md's glob faults are not eess-ts's.** eess-ts matches globs against absolute paths, so its
`syntacticFault` (`packages/ts/src/core/glob-diagnosis.ts:56`) calls a `./` anywhere a fault. md
matches with `picomatch(glob)` against a repository-relative POSIX path
(`packages/md/src/predicates/document.ts:8`). Measured 2026-10-18 on main, picomatch 4.0.4, default
options, against `guides/a.md`, `guides/x/b.md` and `x/guides/a.md`:

| glob                  | matches                               |
| --------------------- | ------------------------------------- |
| `guides/**`           | `guides/a.md`, `guides/x/b.md`        |
| `./guides/**`         | `guides/a.md`, `guides/x/b.md` (same) |
| `./guides/a.md`       | `guides/a.md`                         |
| `/guides/**`          | nothing                               |
| `../guides/**`        | nothing                               |
| `guides/./x/**`       | nothing                               |
| `**/./guides/**`      | nothing                               |
| `guides/../guides/**` | nothing                               |
| `guides\**`           | nothing                               |

picomatch strips a leading `./`, so `resideInFolder('./guides/**')` is a working md selector.
The round-one draft of this plan called it a fault; that was wrong (enforcement, round two I1).
The faults md can decide from the text alone are a leading `/`, a `../` segment anywhere, a `./`
segment after the first, and a backslash.

## Design

### Kernel (1): marking a condition freezes it (bug 0462)

```ts
// packages/core/src/cardinality.ts
export function marksAssertsCardinality<T extends object>(condition: T): T {
  // Frozen at marking: the exemption attaches to an object nobody can change.
  // Before this, `notExist().evaluate = () => []` kept the exemption (bug 0462).
  Object.freeze(condition)
  CARDINALITY_ASSERTERS.add(condition)
  return condition
}
```

One line fixes all seven marked objects: the five `notExist` copies and the two `correspondence`
callables (`packages/core/src/correspondence.ts:111`, `:125`). Freezing a function freezes its own
properties only. Measured 2026-10-18 on main: no source in `packages/*/src` assigns to a
condition's `evaluate`, `description` or `test` (`grep -rnE '\.(evaluate|description|test)\s*=[^=]'
packages/*/src` finds nothing), and every copy returns the object straight from
`marksAssertsCardinality(…)` (e.g. `packages/ts/src/conditions/structural.ts:148`). So the freeze
changes no family code. It is a kernel minor without a break marker: mutating a returned condition
is not documented API, it is the forgery `cardinality.ts` exists to prevent. The changelog says so
in one line (Release).

### Kernel (2): a cardinality rule's selector fault outranks a declaration (bug 0460)

A new protected hook on `TerminalBuilder`, declared where `assertsCardinality()` is
(`packages/core/src/terminal-builder.ts:398`), so `zeroExaminedFinding` can call it and
`RuleBuilder` (`packages/core/src/rule-builder.ts:103`) and `CorrespondenceBuilder`
(`packages/core/src/correspondence.ts:87`) inherit the inert default:

```ts
// packages/core/src/terminal-builder.ts
/**
 * For a cardinality rule that examined zero: the selector fault that makes "zero" not the
 * assertion holding, or `undefined`. Bug 0355's ruling: a fault decidable from the glob text
 * (0362), or a path the instrument holds files under that the rule never saw. NEVER "the glob
 * matches nothing": that is also what a holding ratchet looks like.
 */
protected cardinalitySelectorFault(): SelectorFault | undefined {
  return undefined
}
```

The order, for `examined === 0` (decision 2 of the second rework brief, eess-ts's `evidenceFloor`
order):

1. an empty source (ADR-010 §3), unchanged;
2. **new:** a cardinality rule whose hook returns a fault reds with
   `cardinalitySelectorFaultViolation`, before any declaration is read, so `.expectEmpty()` cannot
   silence a broken selector (enforcement, round two C1);
3. `.expectEmpty()`, then `.expectNonEmpty()`, then the cardinality exemption, then the dead-glob
   and generic findings, unchanged.

```ts
// packages/core/src/terminal-builder.ts, evidencedViolations, when examined === 0
const fault =
  examined === 0 && sourceEmpty !== true && this.assertsCardinality()
    ? this.cardinalitySelectorFault()
    : undefined
// …
declaredEmpty:
  fault === undefined &&
  (this._expectEmpty === true || (examined === 0 && this.assertsCardinality()))
    ? true
    : undefined,
// …
if (fault !== undefined) return withFinding(cardinalitySelectorFaultViolation(this.facts(), fault))
```

The receipt no longer claims "declared empty" beside a finding that says the emptiness is a fault
(architect, round two m3; enforcement, round two I2; ADR-014 §3).

eess-ts is unaffected because it has its own `TerminalBuilder`
(`packages/ts/src/core/terminal-builder.ts:701`), not because of `evidenceFloor` (architect, round
two I-1/m6). eess-mermaid declares no globs and does not override the hook, so for it the change is
inert.

**The finding.** A configuration finding (`bypassFilters`), so `.excluding()` cannot hide it.
`SelectorFault` carries the site, the cause and a corrected spelling where one exists:

```ts
// packages/core/src/vacuity-findings.ts
export interface SelectorFault {
  readonly origin: string // e.g. `resideInFolder("/guides/**")`
  readonly cause: string // one sentence, from the dialect
  readonly correction?: string // the corrected glob, when it is unique
}
```

The message reads: `This notExist() rule examined nothing because its selector ${origin} is
broken: ${cause}. It has not been enforcing anything. Correct the selector; do not delete the
rule.` The `suggestion` (the `Fix:` line) is the dialect's remedy for that cause (eess-md's are
below). Neither ever suggests `.expectEmpty()`: it no longer silences this finding, and on a
cardinality rule it would never lapse (enforcement, round two C1).

### Kernel (3): one `notExist` factory, behind `/internal`

```ts
// packages/core/src/not-exist.ts (new), exported from packages/core/src/internal.ts
export interface NotExistOptions<T> {
  /** How the message names the element: `class Foo`, `work/plans/0001-x.md`. */
  readonly name: (element: T) => string
  /** The dialect's own constructor, so a code frame or `identifyByArgument` survives. */
  readonly toViolation: (element: T, message: string, ctx: ConditionContext) => ArchViolation
}

export function notExistCondition<T>(opts: NotExistOptions<T>): Condition<T> {
  // Frozen by `marksAssertsCardinality` (Kernel (1)).
  return marksAssertsCardinality({
    description: 'not exist',
    evaluate: (elements: T[], ctx: ConditionContext): ArchViolation[] =>
      elements.map((e) => opts.toViolation(e, `${opts.name(e)} should not exist`, ctx)),
  })
}
```

Decisions, each overrulable:

- **The dialect's violation constructor, not `identify`.** The five existing copies attach a code
  frame and eess-ts's `calls()` copy honours `identifyByArgument`. A factory taking `identify`
  would drop both, so it could never absorb them and would be a sixth copy. With `toViolation`,
  each copy's later migration is one line, and the message stays byte-identical
  (`${name} should not exist`; mermaid passes `class ${c.name}`).
- **`/internal`, named `notExistCondition`.** It is family plumbing in ADR-011's sense: a dialect
  writes it, and an adopter writes `docs(c).…should().notExist()`. A root export named `notExist`
  would meet eess-ts's zero-argument root `notExist()` (`packages/ts/src/index.ts:96`) with a
  different signature, the name-collision class of bug 0192. `/internal` imports are not
  re-exported by `check:family` (md already imports `walkFiles` and `pathSuffixIndex` from there:
  `packages/md/src/corpus.ts:1`, `conditions/pointer-resolve.ts:4`). This departs from 017's
  decision 4 wording ("re-exported per dialect, gated by `check:family`"); the coordinator records
  it on 017's block-6 row as `Accepted, reshaped` (architect, round two m8; product, round two
  minor 3).
- **Migrating the five copies is not needed for bug 0462** any more (Kernel (1) fixes them in
  place). It is now a pure de-duplication, out of scope with a home (Out of scope).

### Kernel (4): `syntacticFault` moves to the kernel, with md's base

eess-ts's `syntacticFault` (`packages/ts/src/core/glob-diagnosis.ts:56`) is "one source of truth
for the syntax rules". md would otherwise be a second, disagreeing one (architect, round two I-3).
It moves to `packages/core/src/glob-syntax.ts`, exported from `/internal`; eess-ts imports it from
there and keeps re-exporting it from its root (`packages/ts/src/index.ts:492`), unchanged for every
existing base.

`GlobBase` (`packages/core/src/glob-site.ts:125`) gains `'repo-relative'`: "matched by picomatch,
default options, against a repository-relative POSIX path as written, never rewritten". For that
base only, the faults are the measured ones (Problem 4), not the absolute-path ones:

| fault            | text                                    | correction                         |
| ---------------- | --------------------------------------- | ---------------------------------- |
| `anchored`       | a leading `/`                           | the glob without it                |
| `parent-segment` | a `../` segment anywhere                | none (a path above the corpus cwd) |
| `dot-segment`    | a `./` segment after the first          | the glob with that segment removed |
| `backslash`      | a `\` (an escape to picomatch on POSIX) | the glob with `/` for `\`          |

A leading `./` is not a fault for `'repo-relative'`. For `'absolute'`, `'tsconfig-relative'` and
`'normalized'` the function returns exactly what it returns today. eess-ts's `FAULT_ADVICE`
(`glob-diagnosis.ts:240`, a `Record` over the fault union) gains entries for the three new kinds;
eess-ts never declares `'repo-relative'`, so they are unreachable there, and the type requires them.

### eess-md: `notExist()` on every builder whose element carries a document

Seven builders: `docs()`, `links()`, `pointers()`, `rows()`, `terms()`, `taskItems()` and
`codeBlocks()` (`packages/md/src/builders/docs.ts:24`, `builders/links.ts:32`,
`builders/pointers.ts:22`, `builders/rows.ts:18`, `builders/vocabulary.ts:154`,
`builders/task-items.ts:24`, `builders/code-blocks.ts:91`). Each element carries its document and
a line. One shared helper:

```ts
// packages/md/src/conditions/not-exist.ts (new)
import { notExistCondition } from '@nielspeter/eess/internal'
import { mdViolation } from '../model/violation.js'

/** `notExist()` for any md element, reported at its own line under the name `locate` gives. */
export function mdNotExist<T>(
  locate: (e: T) => { doc: MdDocument; line: number; name: string },
): Condition<T> {
  return notExistCondition({
    name: (e) => locate(e).name,
    toViolation: (e, message, context) => {
      const { doc, line, name } = locate(e)
      return mdViolation({ element: name, file: doc.file, line, message, context })
    },
  })
}
```

```ts
// e.g. packages/md/src/builders/task-items.ts
/** The selection must be empty: each selected box is a finding, at its own line. */
notExist(): this {
  return this.addCondition(
    mdNotExist((t: MdTaskItem) => ({ doc: t.doc, line: t.line, name: `${t.doc.relPath}:${String(t.line)}` })),
  )
}
```

One naming rule: a document is named by its `relPath` and reported at line 1; every other element
is named `relPath:line` at its own line; a code block uses `b.block.line` (enforcement, round two
m3). No code frame: `mdViolation` attaches one only when given the source text
(`packages/md/src/model/violation.ts:13`), and a frame for "this should not exist" adds nothing.

### eess-md: the predicates and combinators an example needs

Plan 0458's gate allows an example to import `@nielspeter/eess-md`'s root only. What block 6 needs
from it, and every later example after it, is exported here (the cross-plan contract):

- `resideInFolder`, `resideInFile`, `haveNameMatching` as standalone `Predicate<MdDocument>`
  (`packages/md/src/predicates/document.ts:7`, `:12`, `:17`). The same three names exist on
  eess-ts's root for its own elements (`packages/ts/src/index.ts:80-84`), with the same meaning but
  a different anchor: eess-ts matches against absolute paths (`'**/guides/**'`), eess-md against the
  repository-relative path (`'guides/**'`). The README says so in one line, so a glob is not copied
  across dialects unchanged (product, round two minor 2). A file importing both roots aliases one.
- `and` and `or`, as explicit documented re-exports beside `not` (`packages/md/src/index.ts:29`),
  the way `correspondence` is (`packages/md/src/index.ts:50`). `check:family` cannot ask for them,
  because md's own source does not import them.
- `globNode`, which `check:family` forces: md's predicates now import it from the kernel root
  (`packages/core/src/index.ts:126`). That makes six root exports, not five (product, round two
  minor 1). Whether `globNode` belongs at the kernel root at all is not this plan's question.

`haveSectionPredicate` stays unexported: plan 0457 decides the public name of a section predicate.

### eess-md: what a broken selector does now

Three additions to md's corpus builders, so that block 6's `notExist()` cannot pass on a broken
instrument or a broken selector:

1. **An empty corpus is an empty source.** `docs()`, `links()`, `pointers()`, `rows()`, `terms()`
   and `taskItems()` override `sourceEmpty()` to `this.project.documents().length === 0`, as
   `codeBlocks()` already does (`code-blocks.ts:109`). The kernel then reports the empty source
   first, ahead of `.expectEmpty()`, the selector fault and the cardinality exemption (ADR-010 §3).
   This is a behaviour change, and a break (Release). It reaches `honestyAtClose`: a lane whose
   `roots` match no file now reds even with `expectEmptyHeaders`, whose docstring
   (`packages/md/src/rules/ledger.ts:653-656`) gains one sentence saying so (product, round two I2).
2. **The location predicates declare their globs.** `resideInFolder` and `resideInFile` declare
   `globs: globNode({ glob, kind: 'file-path', base: 'repo-relative' })`
   (`packages/core/src/glob-site.ts:137`), which states how md actually matches.
   - Declaring globs makes md rules visible to eess-ts's `diagnose()`
     (`packages/ts/src/core/diagnose.ts:329`, `rule.globs?.()`). That path already crashes on any
     md builder: `npx eess-ts doctor spec.rules.ts` exits 1 with
     `project.getSourceFiles is not a function`, which is
     [bug 0396](../bugs/0396-doctor-assumes-every-rule-has-a-ts-morph-project.md). When bug 0396 is
     fixed, md's globs must not be evaluated against a ts-morph path universe; this plan does not
     make that worse, and names it so the fix knows (architect, round two m4).
3. **The corpus builders diagnose a cardinality rule's selector.** They override
   `cardinalitySelectorFault()` with one shared helper, `mdSelectorFault(builder)` in
   `packages/md/src/builders/selector-fault.ts` (internal; plan 0457 composes its scope fault after
   it). It walks the positive selector sites through the kernel's `declaredGlobsOf`
   (`packages/core/src/internal.ts:114`), which handles `not()`/`or()` by negation-normal form, so a
   negative site is never dead. For each site:
   - **a fault in the glob text:** the kernel's `syntacticFault(glob, 'file-path',
'repo-relative')` (Kernel (4)). Remedy (`suggestion`): "Write the glob as `<correction>`"
     when there is a correction; for `parent-segment`, "md globs are matched against paths under
     the corpus's `cwd`; name the folder relative to it, or change `cwd`".
   - **the repository holds Markdown under the glob that the corpus did not load** (bug 0355's
     class): the glob, matched with the predicate's own matcher (`picomatch(glob)`, default
     options, so no dotfile is counted that the predicate could never match; architect, round two
     m1), selects one or more `.md` paths in `corpus.fileIndex` (`packages/md/src/corpus.ts:50`) and
     no loaded document (checked through the kernel's `matchingElements`,
     `packages/core/src/correspondence.ts:313`, not by calling `test` directly). The cause is read
     with the same function link resolution uses: the reason logic in `fileTarget`
     (`packages/md/src/model/resolve-link.ts:177-192`) is extracted as
     `notInCorpusReasons(corpus, path)` and reused, so `outside-roots` and `ignored` mean one thing.
     Remedy: "The corpus's `roots` do not include K Markdown files this glob names (first:
     `<path>`). Add the folder to `roots`, or narrow the glob to folders under them." For
     `ignored`: "K files this glob names are excluded by the corpus's `ignore`; remove that pattern,
     or narrow the glob."
   - **a glob that matches nothing in the repository stays green.** That is also what a holding
     ratchet looks like (a deleted `legacy/`), and bug 0355's ruling is that the two cannot be
     told apart. A typo that names nothing therefore stays green. This plan keeps that ruling.

   `codeBlocks()` gets the text check only. `ParsedCodeBlocks` carries no file index
   (`packages/md/src/model/code-block-parse.ts:96-100`), and its folder methods wrap the document
   predicate in `onDocument` (`code-blocks.ts:21`), which this plan makes forward `globs`. Plan
   0457 replaces `onDocument` with `inDocuments`, which must forward them too.

**So a typo is caught by the recipe, not by the selector.** Block 6's documented shape loads the
folder as the corpus's only root, so a mistyped root gives an empty corpus, which is an empty source
and red (1. above). The selection globs inside it can then only be a text fault (red) or live
folders. Measured on main: `corpus({ roots: ['gudies-typo/**'] })` loads 0 documents with no error.

Two shapes the recipe does not protect, stated in the README beside it (enforcement, round two I3;
product, round two I1):

- **A folder named in `.that()` over a wider corpus.** `docs(c).that().resideInFolder('gudies/**')
.should().notExist()` over `roots: ['**/*.md']` is green when no `gudies/` exists anywhere: bug
  0355's ruling, and bug 0460's own symptom row, which stays green after this plan.
- **A corpus with several roots, one of them mistyped.** `corpus({ roots: ['guides/**',
'gudies-ref/**'] })` loads documents, so it is not an empty source, and the dead root drops its
  half without a word. Narrowed, not fixed: reporting a root that matches no file is a change to
  `corpus()` itself, not to a selector, and is not block 6's scope. A test pins today's behaviour
  (Test inventory), so a later fix turns it red on purpose.

The README line: "A `notExist()` rule cannot tell a folder that names nothing from a ratchet that
holds. Load the folder as the corpus's only root, as here, so a typo is an empty source."

```ts
import { and, corpus, docs, haveNameMatching, not, or, resideInFolder } from '@nielspeter/eess-md'

const c = corpus({ cwd: process.cwd(), roots: ['guides/**'] }) // its only root: a typo is an empty source
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
  zero-examined finding; a named dead-glob finding for them is plan 0457's, for its scopes.
- eess-ts's own floor.
- `.expectEmpty()` on a cardinality rule still lapses only when something is examined, which on a
  `notExist()` rule means it is already red (enforcement, round two C1). After this plan it can no
  longer hide a selector fault, which was the harm; it remains a declaration that adds nothing on
  that rule shape.

## Phases

All in one pull request, reviewed in two parts.

### Phase 1: the kernel (review part 1)

- `marksAssertsCardinality` freezes (bug 0462).
- `cardinalitySelectorFault()` on `TerminalBuilder`, the new order in `evidencedViolations`, the
  withheld `declaredEmpty`, `SelectorFault` and `cardinalitySelectorFaultViolation` in
  `packages/core/src/vacuity-findings.ts` (bug 0460).
- `notExistCondition` in `packages/core/src/not-exist.ts`, exported from `internal.ts`.
- `syntacticFault` moved to `packages/core/src/glob-syntax.ts` with the `'repo-relative'` base;
  eess-ts imports it and adds three `FAULT_ADVICE` entries.
- Run the whole suite once: the freeze and the moved `syntacticFault` are the two changes that can
  surprise an existing test.

### Phase 2: eess-md (review part 2)

- `mdNotExist` and `notExist()` on the seven builders.
- `sourceEmpty()` on the six corpus builders; `honestyAtClose`'s `expectEmptyHeaders` docstring.
- `globs` on `resideInFolder` and `resideInFile`; `onDocument` forwards them;
  `notInCorpusReasons` extracted from `fileTarget`; `mdSelectorFault` and the override.
- Root exports: `resideInFolder`, `resideInFile`, `haveNameMatching`, `and`, `or`, `globNode`.
- `packages/md/README.md`: block 6's recipe, the two unprotected shapes, and the anchor line,
  compiled by `check:docs-code`.
- The example, `examples/md/unclaimed-and-double-claimed.test.ts`, with fixture folders `clean/`,
  `violating-unclaimed/` and `violating-double/`, in the shape plan 0458's contract gives a
  cardinality example: one `violating-<judgement>/` folder per judgement, a `clean:` and a
  `violating <judgement>:` test for each, and the clean test proving its population through a wider
  selection (the same corpus, `docs(c)` with no narrowing, examines more than zero).
- Run `check:corpus`, `check:ledger`, `check:spec` and `check:crossval` on this repository, and
  eess-crossvalidate's suite explicitly: they drive md builders, and the empty-source change is the
  one most likely to move them (enforcement, round two m4).

## Files changed

| file                                                          | change                                                          |
| ------------------------------------------------------------- | --------------------------------------------------------------- |
| `packages/core/src/cardinality.ts`                            | freeze at marking                                               |
| `packages/core/src/terminal-builder.ts`                       | `cardinalitySelectorFault()`; the new order; `declaredEmpty`    |
| `packages/core/src/vacuity-findings.ts`                       | `SelectorFault`, `cardinalitySelectorFaultViolation`            |
| `packages/core/src/not-exist.ts`                              | new                                                             |
| `packages/core/src/glob-syntax.ts`                            | new: `syntacticFault`, moved                                    |
| `packages/core/src/glob-site.ts`                              | `GlobBase` gains `'repo-relative'`                              |
| `packages/core/src/internal.ts`                               | export `notExistCondition`, `NotExistOptions`, `syntacticFault` |
| `packages/core/tests/not-exist.test.ts`                       | new                                                             |
| `packages/core/tests/cardinality-selector-fault.test.ts`      | new                                                             |
| `packages/core/tests/glob-syntax.test.ts`                     | new                                                             |
| `packages/ts/src/core/glob-diagnosis.ts`                      | import `syntacticFault`; three `FAULT_ADVICE` entries           |
| `packages/md/src/conditions/not-exist.ts`                     | new                                                             |
| `packages/md/src/builders/selector-fault.ts`                  | new                                                             |
| `packages/md/src/builders/*.ts` (seven)                       | `notExist()`; `sourceEmpty()` and the fault override on six     |
| `packages/md/src/predicates/document.ts`                      | `globs` on two predicates                                       |
| `packages/md/src/model/resolve-link.ts`                       | `notInCorpusReasons` extracted                                  |
| `packages/md/src/builders/code-blocks.ts`                     | `onDocument` forwards `globs`                                   |
| `packages/md/src/rules/ledger.ts`                             | `expectEmptyHeaders` docstring                                  |
| `packages/md/src/index.ts`                                    | six exports                                                     |
| `packages/md/tests/not-exist.test.ts`                         | new                                                             |
| `packages/md/tests/selector-fault.test.ts`                    | new                                                             |
| `packages/md/README.md`                                       | block 6 recipe, its limits, the anchor line                     |
| `examples/md/unclaimed-and-double-claimed.test.ts` + fixtures | new (plan 0458's gate)                                          |
| `adr/010-a-pass-is-constructed-from-evidence.md`              | an Enforcement row (below)                                      |
| `.changeset/*.md`                                             | see Release                                                     |

**ADR row.** ADR-010 §3 and ADR-018's C3 ("an absence rule may match nothing") now have a
kernel-wide qualification: on a dialect that overrides the hook, a cardinality rule with a selector
fault is red even when declared empty. ADR-010's Enforcement table gains a row, `gated`, citing
`packages/core/tests/cardinality-selector-fault.test.ts` and its title for the
fault-outranks-declaration case (architect, round two m5). ADR-018's C3 mechanism cell stays
eess-ts's; the coordinator decides whether it names the kernel too.

## Test inventory

Every test drives the public entry point and the terminal (`.violations()` or `.check()`), never
`collectViolations`: the empty-selection and selector-fault findings are added in
`TerminalBuilder.evidencedViolations`, after `collectViolations` returns.

**Kernel**, through a minimal `RuleBuilder` subclass in the test file:

- `notExistCondition`: an empty selection is green with no finding; two elements give two
  findings through the dialect's `toViolation`, each with its own file and line, and the rule's
  `because`, `suggestion`, `docs` and `ruleId`.
- `notExistCondition` composed: `.should().notExist().andShould()…` over zero elements is not
  exempt (pins `RuleBuilder.assertsCardinality()`'s `.every()`).
- Freeze, over all seven marked objects (testing, round two I7): for each of the five `notExist`
  copies (eess-ts's four, eess-mermaid's one), the kernel's `notExistCondition`, and the two
  `correspondence` callables, `Object.isFrozen` is true and assigning `evaluate` (or a property, for
  the callables) throws. Bug 0462's red-first row, run on main first, drives the public entry it
  was reproduced through: eess-ts's `classes(p).that().haveNameMatching(/^NoSuchClassXyz$/)
.should().satisfy(c)` with `c = notExist(); c.evaluate = () => []` passes on main; here the
  assignment throws.
- `cardinalitySelectorFault`:
  - a cardinality rule whose hook returns a fault reds with the message above, the fault's
    `suggestion`, and `bypassFilters`;
  - the same rule with `.expectEmpty()` still reds (the fault outranks the declaration), and its
    receipt carries no `declaredEmpty`;
  - `.excluding()` matching the rule does not hide it;
  - with the hook returning `undefined` the rule is green;
  - an empty source still outranks it.
- A positive rule's order is unchanged (an existing dead-glob test stays green unedited).
- `syntacticFault`, table-driven over Problem 4's measured rows for `'repo-relative'`: `./guides/**`
  is no fault; `/guides/**` is `anchored` with correction `guides/**`; `../guides/**` is
  `parent-segment`; `guides/./x/**` is `dot-segment` with correction `guides/x/**`; `guides\**` is
  `backslash`. For `'absolute'` every existing eess-ts case returns what it returns on main.

**eess-md**, over `corpus({ cwd, roots })` on fixture directories:

- `notExist()` on each of the seven builders: one selected element gives one finding named per the
  naming rule, at its own line; an empty selection is green.
- Block 6, unclaimed: a page outside every selection is a finding naming its path; when all are
  claimed, green.
- Block 6, claimed by two: a page in two selections is a finding; a selection widened to `'**'`
  reds the second rule.
- Empty source and the selector fault, table-driven over the six corpus builders (testing, round
  two I5): for each, a corpus whose roots match nothing reds a `notExist()` rule with the
  empty-source finding, with and without `.expectEmpty()`; and a `resideInFile('/x/**')` or
  `resideInFolder('/x/**')` selector (whichever the builder offers through `satisfy`) reds with the
  `anchored` fault.
- `honestyAtClose` over an empty corpus with `expectEmptyHeaders: true` reds with the empty-source
  finding (product, round two I2).
- Text faults, through `resideInFolder` and `resideInFile` both (testing, round two M12):
  `'/guides/**'` (anchored), `'../guides/**'` (parent segment), `'guides/./x/**'` (dot segment) each
  red with their remedy; applying the remedy's correction turns the same rule green (the remedy
  remediates; enforcement, round two I2).
- `'./guides/**'` on a `notExist()` rule over a populated `guides/` examines its documents and reds
  with ordinary findings, not a fault: picomatch strips a leading `./`.
- Unloaded Markdown: the repository holds `guides/a.md` and the corpus's roots are `['docs/**']`;
  `docs(c).that().resideInFolder('guides/**').should().notExist()` reds naming one file and
  `outside-roots`; adding `guides/**` to `roots` turns it green. The same with `guides/` in `ignore`
  names `ignored`.
- A dotfile control: the repository holds `guides/.draft.md` only; the predicate cannot match it,
  so the rule is green, not "unloaded Markdown" (architect, round two m1).
- Reverse control, the ratchet holding: a corpus over `docs/**` with no `legacy/` anywhere in the
  repository; `resideInFolder('legacy/**')…notExist()` is green.
- Pinned limits, each a test whose title names the limit so a later fix reads as progress:
  - a folder in `.that()` naming nothing over a wide corpus is green (bug 0355's ruling; bug 0460's
    symptom row);
  - a two-root corpus with one mistyped root loads the other half and is not an empty source.
- Reverse control under negation: `satisfy(not(resideInFolder('/x/**')))` is not a fault (a negative
  site is never dead).
- `codeBlocks().resideInFolder('/x/**').should().notExist()` reds with the `anchored` fault (globs
  forwarded through `onDocument`).
- This repository's `check:corpus`, `check:ledger`, `check:spec` and `check:crossval` are green and
  print the same counts as on main; eess-crossvalidate's suite is green.

**Sabotage rows**, run in a worktree. Each must turn its named test red:

1. `notExistCondition`'s `evaluate` returns `[]`: the two-element kernel test reds.
2. Drop `marksAssertsCardinality` from `notExistCondition`: the empty-selection test reds.
3. Drop the `Object.freeze` in `marksAssertsCardinality`: the seven-object freeze test reds.
4. Restore the old order (`.expectEmpty()` and the exemption before the hook): the kernel
   fault-outranks-declaration test and the md text-fault tests red.
5. Keep `declaredEmpty: true` when the fault fires: the receipt assertion reds.
6. `TaskItemRuleBuilder.sourceEmpty()` returns `false`: its row in the six-builder empty-source
   table reds (testing, round two I5).
7. `TaskItemRuleBuilder` drops its `cardinalitySelectorFault()` override: its row in the six-builder
   fault table reds.
8. The fault helper ignores `fileIndex`: the unloaded-Markdown test reds.
9. The fault helper counts `fileIndex` with `dot: true`: the dotfile control reds.
10. The fault helper treats "matches nothing in the repository" as a fault: the ratchet-holding
    control reds.
11. The fault helper treats negative sites as positive: the negation control reds (testing, round
    two M12).
12. `syntacticFault` flags a leading `./` for `'repo-relative'`: the `./guides/**` test reds.
13. `onDocument` drops `globs`: the `codeBlocks()` fault test reds.

**Non-vacuity.** This plan adds a library capability, not a gate of this repository. Its proof is
the sabotage matrix above and the example's violating fixtures, registered through plan 0458's
mechanism. No row of its own in `check:nonvacuity`.

## Release

- `@nielspeter/eess`: minor, no break marker.
  - New: `notExistCondition` and `syntacticFault` on `/internal`; the protected
    `cardinalitySelectorFault()` hook, inert by default; `GlobBase` gains `'repo-relative'`.
  - Changelog line: "A condition marked as asserting cardinality (a `notExist()`, a
    `correspondence` side) is now frozen. Assigning to one was never supported: it let a no-op
    condition keep the empty-selection exemption (bug 0462)."
- `@nielspeter/eess-ts`: patch. `syntacticFault` moves behind the kernel and is re-exported
  unchanged; its return type gains three members eess-ts never produces. The kernel range bump
  comes with it.
- `@nielspeter/eess-md`: minor, marked **Breaking (@nielspeter/eess-md)**: a corpus that loaded no
  document is an empty source, which `.expectEmpty()` and `honestyAtClose`'s `expectEmptyHeaders`
  no longer satisfy, and which outranks a `notExist()` pass; the finding text for a positive rule
  over an empty corpus changes from "examined zero units" to the empty-source message. New:
  `notExist()` on seven builders, six root exports. No workspace package lists eess-md in
  `dependencies` (eess-crossvalidate has it as a peer).
- eess-mermaid, eess-gherkin and eess-crossvalidate take the kernel range bump only (`patch`, by
  `updateInternalDependencies`). The only break in this plan is eess-md's.
- Migration lines, in eess-md's changeset:
  - "If a rule over a corpus that loads nothing relied on `.expectEmpty()`, fix the corpus's
    `roots`; an empty corpus is now a configuration finding."
  - "A `honestyAtClose` lane whose roots match no file now reds even with `expectEmptyHeaders`;
    create the folder with its board file, or remove the lane."
  - "Plan 0454 ships a second eess-md break (undeclared box marks). If both land in one release,
    read both lines." (product, round two minor 4: the two changesets are held for one release if
    the build cadence allows; each names the other either way.)

## Out of scope

- **Migrating the five `notExist` copies onto `notExistCondition`.** Bug 0462 no longer depends on
  it (Kernel (1)); it is de-duplication only, one line per copy, and five dialect migrations here
  would double the review. Home: [plan 0464](./0464-the-dialects-notexist-copies-move-onto-the-kernels.md)
  (method, round two m9).
- **eess-mermaid's missing empty-source check** (the measured empty-diagram row). Not bug 0460's
  kernel order. Home: [bug 0463](../bugs/0463-a-mermaid-notexist-over-an-empty-diagram-passes.md).
- **A named dead-glob finding for md's positive rules.** They keep the generic finding; plan 0457
  overrides `deadGlobDiagnosis()` for its scopes.
- **A typo that names nothing in the repository**, on a cardinality rule. Bug 0355's ruling, kept;
  the recipe's roots-scoped corpus is the remedy, and the README states the limit.
- **A corpus root that matches no file, in a multi-root corpus.** A change to `corpus()`, pinned by
  a test here; not filed by this plan (the coordinator decides whether it is a bug).
- `beUniqueBy`, the gherkin rebuild and the record-number dogfood: [plan 0459](./0459-kernel-beuniqueby-and-gherkins-unique-titles.md).

## Records this plan depends on

- [Bug 0463](../bugs/0463-a-mermaid-notexist-over-an-empty-diagram-passes.md): eess-mermaid reports
  no empty source, so `classes(diagram('classDiagram\n')).should().notExist()` passes (measured
  above).
- [Bug 0396](../bugs/0396-doctor-assumes-every-rule-has-a-ts-morph-project.md): eess-ts's `doctor`
  crashes on md rules; md rules start declaring globs here.
- Bug 0460's verification rows follow bug 0355's ruling, as this plan does: a text fault and
  unloaded Markdown red, an absent folder green, the symptom table's `gudies/**` row green by ruling,
  a typo caught by the roots-scoped recipe. The coordinator rewrote them; its red-first row drives
  the entry that exists on main (a public `docs()` builder with a condition marked through
  `/internal`).

## Review response — 2026-10-18

- **architect C1 / product I4 / enforcement I1 / method B4 / testing 0456-C2** (block-6 example
  does not compile, cannot be built from md's root): fixed. `satisfy(…)` forms; `and`/`or` and the
  three document predicates exported here.
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
- **method B1** (mutable exemption unrecorded): recorded as bug 0462, fixed here by the freeze at
  marking (round two).
- **method B2** (too big): split. 13, the gherkin break and the dogfood are plan 0459.
- **method B3** (gherkin break not shown to the maintainer): accepted 2026-10-18; it lives in 0459.
- **testing 0456-I4** (tests on `collectViolations`): fixed. Tests drive `.violations()`/`.check()`.
- **enforcement I2, I3 / testing 0456-I2, I3, I5 / product I5 / M1–M4**: moved with their subject
  to plan 0459.
- **method minors** (no Close box; deferrals; `ts` fence for `.mjs`; one violating fixture for two
  judgements): fixed.
- **architect M5–M6** (`elementViolation` copy; made-up locations): gone. The kernel builds no
  violation; the dialect does, with a real file and line.

### Round two

- **architect I-1 / enforcement m1 / method m5** (hook on the wrong class): declared on
  `TerminalBuilder` beside `assertsCardinality()`; the eess-ts reason corrected.
- **enforcement C1** (`.expectEmpty()` silences the fault and never lapses): the fault is checked
  before any declaration (eess-ts's order); neither remedy offers `.expectEmpty()`; the lapse
  behaviour on a cardinality rule is stated. The content-scope expiry half is plan 0457's, dropped
  there by coordinator decision 1.
- **enforcement I1** (the `./` premise is false in md): measured (Problem 4) and fixed; `./` is not
  a fault; the faults are re-derived and every row and sabotage row re-pointed.
- **architect I-3** (duplicated syntax rules; a base that says the opposite of md's matching):
  `syntacticFault` moved to the kernel with a `'repo-relative'` base; md calls it.
- **enforcement I2** (no message or remedy): specified per cause, each with a remedy-remediates
  test.
- **architect m3 / enforcement I2** (`declaredEmpty: true` on a faulted rule): withheld, with a
  test and a sabotage row.
- **enforcement I3 / product I1** (the recipe protects one shape; adopters not told): the two
  unprotected shapes are in the README and pinned by tests; the multi-root case is narrowed with a
  reason.
- **enforcement I4 / method I3** (bug 0460's symptom row stays green): stated here; the bug's rows
  are the coordinator's, rewritten.
- **architect I-4 / method I4 / testing I7 / enforcement m2** (bug 0462's records disagree):
  freeze at marking (coordinator's decision 3), measured as changing no family code, closing the
  bug for all seven marked objects, with a seven-object test.
- **architect I-2 / enforcement I5, I6 / method C / testing C1, C2** (0458's contract cannot be met
  by a `notExist()` example; three fixture folders): the example follows 0458's revised contract
  (coordinator's decision 5): `violating-<judgement>/` folders and a wider-selection population
  proof.
- **testing I5** (overrides tested on two builders of six): table-driven over six, with two
  `taskItems()` sabotage rows.
- **testing M12** (`resideInFile` and negation unproven): rows and a sabotage row added.
- **product I2** (`honestyAtClose` and `expectEmptyHeaders`): a migration line, a docstring sentence
  and a test row.
- **architect m1** (dotfiles counted with another matcher): the predicate's own matcher, with a
  dotfile control and a sabotage row.
- **architect m4** (bug 0396): named.
- **architect m5** (no ADR row): an ADR-010 Enforcement row.
- **architect m8 / product minor 3** (017 says "re-exported per dialect"): the deviation is stated;
  017's row is the coordinator's.
- **enforcement m3** (`relPath` vs `relPath:1`): one naming rule.
- **enforcement m4** (eess-crossvalidate's suite): run explicitly.
- **product minors 1, 2, 4** (`globNode` uncounted; anchoring differs between dialects; two md
  breaks in a row): six exports; a README anchor line; each changeset names the other.
- **method m6, m7, m9, m10, m13** (`cardinality.ts:72`; the 0355 quote; deferral boxes; Close box;
  Effort): `:73`; paraphrased from 0355's "What this does NOT catch"; a deferral box; the 017 row
  dropped from Close; Effort Large, reviewed in two parts.
- **coordinator decision 7** (`matchingElements`; `corpus({ root })`): the fault helper uses
  `matchingElements`; every example uses `corpus({ cwd, roots })`.

## Progress ledger

- [ ] Phase 1 (review part 1): freeze at marking, `cardinalitySelectorFault` on `TerminalBuilder`
      with its order and receipt, `notExistCondition`, `syntacticFault` moved with
      `'repo-relative'`, kernel tests, whole suite once
- [ ] Phase 2 (review part 2): md `notExist()` ×7, `sourceEmpty()` ×6, declared globs,
      `notInCorpusReasons`, the fault helper, six exports, README, `honestyAtClose`'s docstring,
      the example with three fixtures
- [ ] Sabotage rows 1–13, each red on its named test; durations reported
- [ ] Bug 0460 and bug 0462 red-first on main, green here, both → `fixed/`
- [ ] The ADR-010 Enforcement row
- [ ] `check:family`, `check:release`, `check:docs-code`, `check:examples`, eess-crossvalidate's
      suite and `npm run validate` green; durations reported
- [ ] Close: this plan → `completed/`; boards
- [ ] deferred→[plan 0464](./0464-the-dialects-notexist-copies-move-onto-the-kernels.md) the five
      copies' migration onto `notExistCondition`
- [ ] deferred→bug 0463 (eess-mermaid reports no empty source)

Deferred: plan 0464 (the five copies' migration); bug 0463
