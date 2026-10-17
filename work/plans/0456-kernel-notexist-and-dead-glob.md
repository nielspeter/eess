# Plan 0456: `notExist` across eess-md, on a kernel that cannot pass a broken selector

## Status

- **State:** Draft — written 2026-10-17 from proposal 017's maintainer acceptance (block 6);
  reworked three times on 2026-10-18 after PR #235's review rounds (architect · product ·
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
- **Effort:** Large. Counted from this plan's own tables: 30 rows in Files changed, eight of
  them new test files, across four packages (core, ts, md, mermaid) plus `examples/` and `adr/`; 14
  sabotage rows; a flagged break re-run against four of this repository's gates. One pull request,
  reviewed in two parts: the kernel (Phase 1), then the dialects (Phase 2). Phase 1 alone ships an
  inert hook, so it is not a delivery on its own.
- **Created:** 2026-10-17
- **Builds after:** [plan 0458](./0458-the-examples-gate-a-document-shape-from-public-blocks-only.md)
  (the examples gate). Build order (maintainer, 2026-10-18): 0458 → **0456** → 0454 → 0457 →
  0455 → 0459.
- **Builds before:** 0454, 0457, 0459 and [0464](./0464-the-dialects-notexist-copies-move-onto-the-kernels.md).
  They use what this plan makes public (the contract below).

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

017's decision 4 puts one owner in the kernel ("mermaid and six ts builders each carry a copy, and
md would be the next").

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
(`packages/md/src/predicates/document.ts:8`). Measured 2026-10-18 on main, picomatch 4.0.4 as
`packages/md` resolves it, default options:

| glob                  | path tested           | matches |
| --------------------- | --------------------- | ------- |
| `guides/**`           | `guides/a.md`         | true    |
| `./guides/**`         | `guides/a.md`         | true    |
| `./guides/a.md`       | `guides/a.md`         | true    |
| `/guides/**`          | `guides/a.md`         | false   |
| `../guides/**`        | `guides/a.md`         | false   |
| `guides/./x/**`       | `guides/x/b.md`       | false   |
| `**/./guides/**`      | `guides/a.md`         | false   |
| `guides/../guides/**` | `guides/a.md`         | false   |
| `guides/\(x\)/**`     | `guides/(x)/a.md`     | true    |
| `guides/(x)/**`       | `guides/(x)/a.md`     | false   |
| `guides/\[draft\]/**` | `guides/[draft]/a.md` | true    |
| `docs/a\ b.md`        | `docs/a b.md`         | true    |
| `docs/\a.md`          | `docs/a.md`           | true    |
| `docs\a.md`           | `docs/a.md`           | false   |
| `docs\a.md`           | `docsa.md`            | true    |
| `guides\x/**`         | `guidesx/a.md`        | true    |

So:

- picomatch strips a leading `./`, so `resideInFolder('./guides/**')` is a working md selector.
  The round-one draft called it a fault; that was wrong (enforcement, round two I1).
- A leading `/`, a `../` segment anywhere, and a `./` segment after the first can never match a
  repository-relative path. These are decidable from the text.
- **A backslash is never decidable from the text.** Before a glob metacharacter it is a working
  escape, and the only way to name a folder such as `(x)` or `[draft]`. Before any other character
  it escapes that character, so `docs\a.md` names `docsa.md`: a glob that names a different path,
  not one that can never match. Round two's `backslash` text fault was prescribed from one row and
  would have failed a correct escaped glob with a remedy that breaks it. It is replaced by a check
  that needs evidence from the corpus (Design, the separator backslash).

Measured on the same build, for the separator check (round four):

| glob              | path tested       | matches |
| ----------------- | ----------------- | ------- |
| `guides\**`       | `guides/a.md`     | false   |
| `guides\**`       | `guides*a.md`     | true    |
| `guides/**`       | `guides/a.md`     | true    |
| `guides\x/**`     | `guides/x/a.md`   | false   |
| `guides/x/**`     | `guides/x/a.md`   | true    |
| `docs\*.md`       | `docs*.md`        | true    |
| `docs/*.md`       | `docs/a.md`       | true    |
| `docs[*].md`      | `docs*.md`        | true    |
| `docs[*].md`      | `docsa.md`        | false   |
| `docs[?].md`      | `docs?.md`        | true    |
| `guides//(x/)/**` | `guides/(x)/a.md` | false   |
| `guides//(x/)/**` | `guides/x/a.md`   | false   |
| `guides\(x)/**`   | `guides(x)/a.md`  | true    |
| `guides/(x)/**`   | `guides/x/a.md`   | true    |

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
packages/*/src` finds nothing; testing, round three, re-ran it over `packages/*/tests`, `examples`
and `scripts` with the same result), and every copy returns the object straight from
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
   silence a broken selector;
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
(ADR-014 §3).

eess-ts is unaffected because it has its own `TerminalBuilder`
(`packages/ts/src/core/terminal-builder.ts:701`). eess-mermaid declares no globs and does not
override the hook, so for it the change is inert.

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

The message reads: `This absence rule examined nothing because its selector ${origin} is broken:
${cause}. It has not been enforcing anything. Correct the selector; do not delete the rule.`
"Absence rule", not "`notExist()` rule": the hook fires for any condition the kernel marks as
cardinality (method, round three m-e). The `suggestion` (the `Fix:` line) is the dialect's remedy
for that cause (eess-md's are below). Neither ever suggests `.expectEmpty()`: it no longer silences
this finding, and on a cardinality rule it would never lapse.

### Kernel (3): one `notExist` factory, behind `/internal`

```ts
// packages/core/src/not-exist.ts (new), exported from packages/core/src/internal.ts
export interface NotExistOptions<T> {
  /**
   * How the message names the element: `class Foo`, `work/plans/0001-x.md`. Takes the context
   * because eess-ts's `calls()` names a call by `ctx.identifyByArgument`.
   */
  readonly name: (element: T, ctx: ConditionContext) => string
  /** The dialect's own constructor, so its finding's shape survives. */
  readonly toViolation: (element: T, message: string, ctx: ConditionContext) => ArchViolation
}

export function notExistCondition<T>(opts: NotExistOptions<T>): Condition<T> {
  // Frozen by `marksAssertsCardinality` (Kernel (1)).
  return marksAssertsCardinality({
    description: 'not exist',
    evaluate: (elements: T[], ctx: ConditionContext): ArchViolation[] =>
      elements.map((e) => opts.toViolation(e, `${opts.name(e, ctx)} should not exist`, ctx)),
  })
}
```

Decisions, each overrulable:

- **The dialect's violation constructor, not `identify`.** The five copies each build their
  finding their own way: four through a constructor (`createViolation`, `createCallViolation`,
  `createJsxViolation`, `classViolation`), and eess-ts's `function.ts` copy as a literal with no code
  frame and no `ruleId` (`packages/ts/src/conditions/function.ts:56-73`). A factory taking `identify`
  would impose one shape on all of them. With `toViolation`, each copy's migration keeps its own
  shape. That migration is [plan 0464](./0464-the-dialects-notexist-copies-move-onto-the-kernels.md).
- **`name` takes the context** (architect, round three N-2). eess-ts's `calls()` copy names the
  element with `callNameForMessage(archCall, context)`, which reads `context.identifyByArgument`
  (`packages/ts/src/conditions/call.ts:50-52`). A `name` without `ctx` could not produce that
  string, and the kernel would own nothing for that copy. Free before this plan ships; a break of an
  `/internal` signature after.
- **`/internal`, named `notExistCondition`.** It is family plumbing in ADR-011's sense: a dialect
  writes it, and an adopter writes `docs(c).…should().notExist()`. A root export named `notExist`
  would meet eess-ts's zero-argument root `notExist()` (`packages/ts/src/index.ts:96`) with a
  different signature, the name-collision class of bug 0192. `/internal` imports are not
  re-exported by `check:family` (md already imports `walkFiles` and `pathSuffixIndex` from there:
  `packages/md/src/corpus.ts:1`, `conditions/pointer-resolve.ts:4`). This departs from 017's
  decision 4 wording ("re-exported per dialect, gated by `check:family`"); the coordinator records
  it on 017's block-6 row as `Accepted, reshaped`.

### Kernel (4): one owner of the glob-text rules, under its own name

eess-ts's `syntacticFault` (`packages/ts/src/core/glob-diagnosis.ts:56`) is "one source of truth
for the syntax rules". md would otherwise be a second, disagreeing one. The rules move to the
kernel under their own name (coordinator's decision 2, round three), so eess-ts's public surface
does not move:

```ts
// packages/core/src/glob-syntax.ts (new), exported from packages/core/src/internal.ts
/** Kernel-internal: the bases the text rules know. Not a root type. */
export type TextBase = GlobBase | 'repo-relative'
export type GlobTextFault = 'dot-segment' | 'unanchored' | 'anchored' | 'parent-segment'

export function globTextFault(
  glob: string,
  kind: GlobKind,
  base: TextBase = 'absolute',
): GlobTextFault | undefined
```

- For `'absolute'`, `'tsconfig-relative'` and `'normalized'` it returns exactly what eess-ts's
  `syntacticFault` returns on main (`'dot-segment'` for a `./` anywhere; `'unanchored'` for an
  unanchored path glob on `'absolute'`).
- For `'repo-relative'`, the faults Problem 4 measured: `'anchored'` (a leading `/`; correction:
  the glob without it), `'parent-segment'` (a `../` anywhere; no correction), `'dot-segment'` (a
  `./` after the first segment; correction: the segment removed). A leading `./` is not a fault.
  There is no backslash fault (Problem 4).
- **eess-ts keeps `syntacticFault` and `GlobFault` as its own declarations.** `syntacticFault`
  becomes a wrapper: its parameter type is eess-ts's three bases only, it calls `globTextFault`,
  and it narrows the result back to `'dot-segment' | 'unanchored'` with a type guard (ADR-005, no
  `as`). `FAULT_ADVICE` (`glob-diagnosis.ts:240`) and `deadSiteRoute`'s `never` witness
  (`glob-diagnosis.ts:148-170`) stay untouched. The name `globTextFault` differs from
  `syntacticFault`, so ADR-011 §2's gated test,
  `it('no symbol behind @nielspeter/eess/internal is reachable from eess-ts')`
  (`packages/ts/tests/standalone-surface.test.ts:91`), stays green (architect, round three N-1;
  product, round three N-I1).
- **`GlobBase`, a kernel root type, does not change.** `TextBase` is kernel-internal. md's
  predicates declare the nearest existing base (next section), and md's own check calls
  `globTextFault` with `'repo-relative'` directly.

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
    name: (e) => locate(e).name, // md names nothing by context
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
is named `relPath:line` at its own line; a code block uses `b.block.line`. No code frame:
`mdViolation` attaches one only when given the source text (`packages/md/src/model/violation.ts:13`),
and a frame for "this should not exist" adds nothing.

### eess-md: the predicates and combinators an example needs

Plan 0458's gate allows an example to import `@nielspeter/eess-md`'s root only. What block 6 needs
from it, and every later example after it, is exported here (the cross-plan contract):

- `resideInFolder`, `resideInFile`, `haveNameMatching` as standalone `Predicate<MdDocument>`
  (`packages/md/src/predicates/document.ts:7`, `:12`, `:17`). The same three names exist on
  eess-ts's root for its own elements (`packages/ts/src/index.ts:80-84`), with the same meaning but
  a different anchor: eess-ts matches against absolute paths (`'**/guides/**'`), eess-md against the
  repository-relative path (`'guides/**'`). The README says so in one line, so a glob is not copied
  across dialects unchanged. A file importing both roots aliases one.
- `and` and `or`, as explicit documented re-exports beside `not` (`packages/md/src/index.ts:29`),
  the way `correspondence` is (`packages/md/src/index.ts:50`). `check:family` cannot ask for them,
  because md's own source does not import them.
- `globNode`, which `check:family` forces: md's predicates now import it from the kernel root
  (`packages/core/src/index.ts:126`). That makes six root exports. Whether `globNode` belongs at the
  kernel root at all is not this plan's question.

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
   (`packages/md/src/rules/ledger.ts:653-656`) gains one sentence saying so.
2. **The location predicates declare their globs.** `resideInFolder` and `resideInFile` declare
   `globs: globNode({ glob, kind: 'file-path', base: 'normalized' })`
   (`packages/core/src/glob-site.ts:137`). `'normalized'` is the nearest existing root base ("a
   base whose entry point rewrites or relativises it": md matches the path relativised from the
   corpus's `cwd`), and it keeps `GlobBase` unchanged (Kernel (4)). It does not describe md
   exactly: for `'normalized'` the shared rules call a leading `./` a fault and a leading `/` fine,
   and md is the other way round. Today the only other reader of md's declared globs is eess-ts's
   `diagnose()` (`packages/ts/src/core/diagnose.ts:329`, `rule.globs?.()`), and on any md builder
   it crashes before reading them: `npx eess-ts doctor spec.rules.ts` exits 1 with
   `project.getSourceFiles is not a function`, which is
   [bug 0396](../bugs/0396-doctor-assumes-every-rule-has-a-ts-morph-project.md). So the mismatch
   reaches nobody now; it is a condition on bug 0396's fix, which must not judge md's sites by
   eess-ts's rules (bug 0396 carries that condition, added 2026-10-18). md's own check never reads
   the declared base.
3. **The corpus builders diagnose a cardinality rule's selector.** They override
   `cardinalitySelectorFault()` with one shared helper, `mdSelectorFault(builder)` in
   `packages/md/src/builders/selector-fault.ts` (internal). It walks the positive selector sites
   through the kernel's `declaredGlobsOf` (`packages/core/src/internal.ts:114`), which handles
   `not()`/`or()` by negation-normal form, so a negative site is never dead. For each site, three
   checks, in order:
   - **a fault in the glob text:** `globTextFault(glob, 'file-path', 'repo-relative')`
     (Kernel (4)). Remedy (`suggestion`): "Write the glob as `<correction>`" when there is one; for
     `parent-segment`, "md globs are matched against paths under the corpus's `cwd`; name the
     folder relative to it, or change `cwd`".
   - **the repository holds Markdown under the glob that the corpus did not load** (bug 0355's
     class). What is matched, exactly (method, round three m-d): the site's glob string, compiled
     once as `picomatch(glob)` with default options (the predicate's own matcher, so no dotfile is
     counted that the predicate could never match), over two sets of paths: the `relPath`s of the
     loaded documents, and the `.md` paths in `corpus.fileIndex` (`packages/md/src/corpus.ts:50`).
     The check fires when the glob selects at least one `.md` path in `fileIndex` and no loaded
     document's `relPath`. It does not apply the site's predicate to anything: on the six
     non-`docs()` builders the predicate is over the element type, not over documents. The cause is
     read with the same function link resolution uses: the reason logic in `fileTarget`
     (`packages/md/src/model/resolve-link.ts:177-192`) is extracted as
     `notInCorpusReasons(corpus, path)` and reused, so `outside-roots` and `ignored` mean one thing.
     Remedy: "The corpus's `roots` do not include K Markdown files this glob names (first:
     `<path>`). Add the folder to `roots`, or narrow the glob to folders under them." For
     `ignored`: "K files this glob names are excluded by the corpus's `ignore`; remove that pattern,
     or narrow the glob."
   - **a separator backslash, on evidence** (coordinator's decision 1, round four). The
     candidates are a `\` before an ordinary character, or before `*` or `?`: the Windows habit
     (`guides\**`, `guides\x/**`). A `\` before any other glob metacharacter (`[](){}!@+|\` or a
     space) is an escape and never a candidate, so `guides/\(x\)/**` stays green. A candidate is a
     fault when both hold, by the same matching as above (`picomatch`, default options, over the
     loaded documents' `relPath`s and the `.md` paths in `fileIndex`):
     - the glob as written selects no path; and
     - the glob with that `\` replaced by `/` selects at least one.

     Then the author almost certainly meant a path separator, and the correction is the replaced
     glob. When the replaced glob also selects nothing, the rule stays green under bug 0355's
     ruling, like any glob that names nothing. The check runs after the unloaded-Markdown check, so
     a glob as written that selects unloaded files is reported by that check first; the first
     condition only decides which cause is named, not whether the rule reds.

     **The cost, stated.** A file whose name holds a literal `*` or `?`, named by escaping it
     (`docs\*.md` for a file `docs*.md`), next to a real folder of the same stem: once `docs*.md`
     is deleted, the ratchet holds, but `docs/*.md` selects `docs/a.md`, so the rule reds with a
     correction that changes its meaning. The remedy is to name the literal with a character class,
     which leaves no backslash to consider: `docs[*].md` matches `docs*.md` and nothing else, and
     `docs[?].md` likewise (measured, Problem 4). The finding's `suggestion` says so beside the
     correction: "If you meant a literal `*` or `?`, write it as `[*]` or `[?]`." A literal star
     or question mark in a Markdown file name is rare; a Windows separator is the common case.

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

Two shapes the recipe does not protect, stated in the README beside it:

- **A folder named in `.that()` over a wider corpus.** `docs(c).that().resideInFolder('gudies/**')
.should().notExist()` over `roots: ['**/*.md']` is green when no `gudies/` exists anywhere: bug
  0355's ruling, and bug 0460's own symptom row, which stays green after this plan.
- **A corpus with several roots, one of them mistyped.** `corpus({ roots: ['guides/**',
'gudies-ref/**'] })` loads documents, so it is not an empty source, and the dead root drops its
  half without a word. That is a silent pass in `corpus()` itself, recorded as
  [bug 0465](../bugs/0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md) and deferred
  there (ledger). A test here pins today's behaviour, titled for the bug, so its fix turns the test
  red on purpose.

The README also gives the separator rule and its cost: picomatch reads a backslash as an escape;
a `guides\**` that selects nothing while `guides/**` selects files is reported as a separator; a
literal `*` or `?` in a file name is written `[*]` or `[?]`.

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
- eess-ts's own floor, and eess-ts's public surface and types.
- `.expectEmpty()` on a cardinality rule still lapses only when something is examined, which on a
  `notExist()` rule means it is already red. After this plan it can no longer hide a selector
  fault, which was the harm; it remains a declaration that adds nothing on that rule shape.

## Phases

All in one pull request, reviewed in two parts.

### Phase 1: the kernel (review part 1)

- `marksAssertsCardinality` freezes (bug 0462).
- `cardinalitySelectorFault()` on `TerminalBuilder`, the new order in `evidencedViolations`, the
  withheld `declaredEmpty`, `SelectorFault` and `cardinalitySelectorFaultViolation` in
  `packages/core/src/vacuity-findings.ts` (bug 0460).
- `notExistCondition` in `packages/core/src/not-exist.ts`, exported from `internal.ts`.
- `globTextFault` and `TextBase` in `packages/core/src/glob-syntax.ts`, exported from
  `internal.ts`; eess-ts's `syntacticFault` becomes a narrowing wrapper over it.
- Run the whole suite once: the freeze and the wrapped `syntacticFault` are the two changes that can
  surprise an existing test.

### Phase 2: the dialects (review part 2)

- `mdNotExist` and `notExist()` on the seven md builders.
- `sourceEmpty()` on the six corpus builders; `honestyAtClose`'s `expectEmptyHeaders` docstring.
- `globs` on `resideInFolder` and `resideInFile`; `onDocument` forwards them;
  `notInCorpusReasons` extracted from `fileTarget`; `mdSelectorFault` and the override.
- Root exports: `resideInFolder`, `resideInFile`, `haveNameMatching`, `and`, `or`, `globNode`.
- `packages/md/README.md`: block 6's recipe, the two unprotected shapes, and the anchor line,
  compiled by `check:docs-code`.
- The example, `examples/md/unclaimed-and-double-claimed.test.ts`, in the shape plan 0458's
  contract gives a cardinality example: fixture folders `clean/`, `violating-unclaimed/` and
  `violating-double/`; test titles that start with the folder's name and a colon (`clean: …`,
  `violating-unclaimed: …`, `violating-double: …`), as 0458 lines 101 and 300 say; and the clean
  test proving its population through a wider selection:
  `docs(c).select({ label: 'page', identify: (d) => ({ name: d.relPath }) })` is non-empty, the
  same shape plans 0454 and 0457 use.
- eess-ts: bug 0462's rows (red-first and green) in `packages/ts/tests/conditions/not-exist-frozen.test.ts`.
- eess-mermaid: one `Object.isFrozen` assertion in
  `packages/mermaid/tests/builders/class-rule-builder.test.ts`, on the condition imported from
  `../../src/conditions/class.js` (mermaid's `notExist` condition is not on its root; that test
  file already imports from `../../src`).
- Run `check:corpus`, `check:ledger`, `check:spec` and `check:crossval` on this repository, and
  eess-crossvalidate's suite explicitly: they drive md builders, and the empty-source change is the
  one most likely to move them.

## Files changed

| file                                                                       | change                                                                                      |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `packages/core/src/cardinality.ts`                                         | freeze at marking                                                                           |
| `packages/core/src/terminal-builder.ts`                                    | `cardinalitySelectorFault()`; the new order; `declaredEmpty`                                |
| `packages/core/src/vacuity-findings.ts`                                    | `SelectorFault`, `cardinalitySelectorFaultViolation`                                        |
| `packages/core/src/not-exist.ts`                                           | new                                                                                         |
| `packages/core/src/glob-syntax.ts`                                         | new: `globTextFault`, `TextBase`, `GlobTextFault`                                           |
| `packages/core/src/internal.ts`                                            | export `notExistCondition`, `NotExistOptions`, `globTextFault`, `TextBase`, `GlobTextFault` |
| `packages/core/tests/cardinality.test.ts`                                  | new: the freeze, on an object and on a function                                             |
| `packages/core/tests/not-exist.test.ts`                                    | new                                                                                         |
| `packages/core/tests/cardinality-selector-fault.test.ts`                   | new                                                                                         |
| `packages/core/tests/glob-syntax.test.ts`                                  | new                                                                                         |
| `packages/ts/src/core/glob-diagnosis.ts`                                   | `syntacticFault` wraps `globTextFault`                                                      |
| `packages/ts/tests/conditions/not-exist-frozen.test.ts`                    | new: bug 0462's rows                                                                        |
| `packages/mermaid/tests/builders/class-rule-builder.test.ts`               | one freeze assertion                                                                        |
| `packages/md/src/conditions/not-exist.ts`                                  | new                                                                                         |
| `packages/md/src/builders/selector-fault.ts`                               | new                                                                                         |
| `packages/md/src/builders/*.ts` (seven)                                    | `notExist()`; `sourceEmpty()` and the fault override on six                                 |
| `packages/md/src/predicates/document.ts`                                   | `globs` on two predicates                                                                   |
| `packages/md/src/model/resolve-link.ts`                                    | `notInCorpusReasons` extracted                                                              |
| `packages/md/src/builders/code-blocks.ts`                                  | `onDocument` forwards `globs`                                                               |
| `packages/md/src/rules/ledger.ts`                                          | `expectEmptyHeaders` docstring                                                              |
| `packages/md/src/index.ts`                                                 | six exports                                                                                 |
| `packages/md/tests/not-exist.test.ts`                                      | new                                                                                         |
| `packages/md/tests/selector-fault.test.ts`                                 | new                                                                                         |
| `packages/md/README.md`                                                    | block 6 recipe, its limits, the anchor line                                                 |
| `examples/md/unclaimed-and-double-claimed.test.ts` + fixtures              | new (plan 0458's gate)                                                                      |
| `adr/010-a-pass-is-constructed-from-evidence.md`                           | an Enforcement row (below)                                                                  |
| `adr/018-a-string-that-names-code-is-resolved-or-the-rule-says-why-not.md` | C3's Mechanism cites the kernel test (below)                                                |
| `.changeset/kernel-not-exist.md`                                           | kernel minor; eess-ts, eess-mermaid patch (see Release)                                     |
| `.changeset/md-not-exist.md`                                               | eess-md minor, marked Breaking                                                              |
| `.changeset/` (existing release flow)                                      | range bumps for eess-gherkin and eess-crossvalidate                                         |

**ADR row.** ADR-010 §3 and ADR-018's C3 ("an absence rule may match nothing") now have a
kernel-wide qualification: on a dialect that overrides the hook, a cardinality rule with a selector
fault is red even when declared empty. ADR-010's Enforcement table gains a row, `gated`, citing
`packages/core/tests/cardinality-selector-fault.test.ts` and its title for the
fault-outranks-declaration case. ADR-018's C3 Enforcement row cites the same test in its Mechanism
cell, beside eess-ts's mechanisms (coordinator's decision 3, round four), so both rows name the
kernel test that holds the qualification. Each is a ledger box.

## Test inventory

Every test drives the public entry point and the terminal (`.violations()` or `.check()`), never
`collectViolations`: the empty-selection and selector-fault findings are added in
`TerminalBuilder.evidencedViolations`, after `collectViolations` returns. Package tests may
hand-build predicates; only `examples/md/` may not.

**Kernel**, through a minimal `RuleBuilder` subclass in the test file:

- `notExistCondition`: an empty selection is green with no finding; two elements give two
  findings through the dialect's `toViolation`, each with its own file and line, and the rule's
  `because`, `suggestion`, `docs` and `ruleId`.
- `notExistCondition` passes the context to `name`: a `name` that reads a field from `ctx` sees it,
  and the message carries it.
- `notExistCondition` composed: `.should().notExist().andShould()…` over zero elements is not
  exempt (pins `RuleBuilder.assertsCardinality()`'s `.every()`).
- The freeze, on `marksAssertsCardinality` itself (testing, round three N2): a marked object and a
  marked function are each `Object.isFrozen`, and assigning a property to either throws a
  `TypeError`. That is the test sabotage row 3 reds, because the freeze lives in that one function.
  `notExistCondition`'s condition is frozen through it. The two `correspondence` callables are
  covered by this test and not tested separately: they sit in a private `_checks` list
  (`packages/core/src/correspondence.ts:110-128`) that no public entry returns.
- `cardinalitySelectorFault`:
  - a cardinality rule whose hook returns a fault reds with the "absence rule" message above, the
    fault's `suggestion`, and `bypassFilters`;
  - the same rule with `.expectEmpty()` still reds (the fault outranks the declaration), and its
    receipt carries no `declaredEmpty`;
  - `.excluding()` matching the rule does not hide it;
  - with the hook returning `undefined` the rule is green;
  - an empty source still outranks it.
- A positive rule's order is unchanged (an existing dead-glob test stays green unedited).
- `globTextFault`, table-driven over Problem 4's measured rows for `'repo-relative'`: `./guides/**`
  is no fault; `/guides/**` is `anchored` with correction `guides/**`; `../guides/**` is
  `parent-segment`; `guides/./x/**` is `dot-segment` with correction `guides/x/**`; every backslash
  row is no fault. This table's `./guides/**` row is the one sabotage row 14 names. For `'absolute'`, `'tsconfig-relative'` and `'normalized'` it returns what
  eess-ts's `syntacticFault` returns on main for every case in eess-ts's existing tests.

**Bug 0460, red-first on main** (coordinator's decision 2, round four). The test drives an entry
that compiles on main, so it fails on the defect and not on a missing API. md has no `notExist()`
on main, so the rule is the public `docs()` builder with a condition marked through `/internal`
(`marksAssertsCardinality` is exported there today, `packages/core/src/internal.ts:56`):
`docs(c).that().resideInFolder('/guides/**').should().satisfy(marksAssertsCardinality({
description: 'cardinality probe', evaluate: () => [] }))`, over a corpus holding `guides/a.md`. On
main it passes (examined 0, exempt). After this plan the same test, unedited, reds with the
`anchored` selector fault.

**eess-ts** (`packages/ts/tests/conditions/not-exist-frozen.test.ts`):

- Bug 0462, red-first on main, through the entry it was reproduced on:
  `classes(p).that().haveNameMatching(/^NoSuchClassXyz$/).should().satisfy(c)` with
  `c = notExist(); c.evaluate = () => []` passes on main. Here the assignment throws a `TypeError`,
  and the no-op condition on its own still reds with "examined 0".
- `syntacticFault`'s existing tests pass unedited; its declared return type is still
  `'dot-segment' | 'unanchored' | undefined`.

**eess-mermaid**: `Object.isFrozen(notExist())` is true (one assertion, so this package's test
change has its own changeset entry).

**eess-md**, over `corpus({ cwd, roots })` on fixture directories:

- `notExist()` on each of the seven builders: one selected element gives one finding named per the
  naming rule, at its own line; an empty selection is green.
- Block 6, unclaimed: a page outside every selection is a finding naming its path; when all are
  claimed, green.
- Block 6, claimed by two: a page in two selections is a finding; a selection widened to `'**'`
  reds the second rule.
- Empty source and the selector fault, table-driven over the six corpus builders: for each, a
  corpus whose roots match nothing reds a `notExist()` rule with the empty-source finding, with and
  without `.expectEmpty()`; and, over a corpus that loads documents (so the empty source cannot
  outrank it), a selector glob of `'/x/**'` reds with a fault whose cause is `anchored`, asserted
  by identity, not merely as red. `docs()` and `terms()` use their own `resideInFolder`/`resideInFile`.
  `links()`, `pointers()`, `rows()` and `taskItems()` offer no location method and cannot take a
  `Predicate<MdDocument>` (`satisfy` takes a `Predicate<T>`, `packages/core/src/rule-builder.ts:172`),
  so their rows use a test-local `Predicate<Element>` over `e.doc.relPath` that declares
  `globs: globNode({ glob: '/x/**', kind: 'file-path', base: 'normalized' })`. That is what lets
  sabotage row 7 fire on `taskItems()`.
- `honestyAtClose` over an empty corpus with `expectEmptyHeaders: true` reds with the empty-source
  finding.
- Text faults, through `resideInFolder` and `resideInFile` both: `'/guides/**'` (anchored),
  `'../guides/**'` (parent segment), `'guides/./x/**'` (dot segment) each red with their remedy;
  applying the remedy's correction turns the same rule green (the remedy remediates).
- `'./guides/**'` on a `notExist()` rule over a populated `guides/` examines its documents and reds
  with ordinary findings, not a fault: picomatch strips a leading `./`.
- Escaped metacharacters, the reverse control (enforcement, round three N1): the repository holds
  `guides/(x)/a.md` and `guides/[draft]/b.md`; `resideInFolder('guides/\\(x\\)/**')` and
  `resideInFolder('guides/\\[draft\\]/**')` on a `notExist()` rule examine their documents (no
  fault); with those folders absent, both are green.
- The separator backslash (round four):
  - the corpus loads `guides/a.md`; `resideInFolder('guides\\**')` on a `notExist()` rule reds with
    the separator fault and the correction `guides/**`; applying the correction gives a rule that
    examines `guides/a.md` (and reds on it, as a `notExist()` over a real page should);
  - the corpus loads `guides/x/a.md`; `resideInFolder('guides\\x/**')` reds with the correction
    `guides/x/**`;
  - with no `guides/` anywhere, `resideInFolder('guides\\**')` is green (bug 0355's ruling);
  - the escaped-paren control, for sabotage row 13: the corpus loads `guides/x/a.md` and nothing
    named `guides(x)/`; `resideInFolder('guides\\(x)/**')` examines zero and is green, because `\(`
    is an escape and never a candidate, although its `/` reading `guides/(x)/**` selects
    `guides/x/a.md` (measured, Problem 4);
  - the pinned cost, titled for it: the corpus loads `docs/a.md` and nothing named `docs*.md`;
    `resideInFile('docs\\*.md')…notExist()` reds with the separator fault, its `suggestion` names
    `[*]`, and rewriting the glob as `docs[*].md` turns the rule green.
- Unloaded Markdown: the repository holds `guides/a.md` and the corpus's roots are `['docs/**']`;
  `docs(c).that().resideInFolder('guides/**').should().notExist()` reds naming one file and
  `outside-roots`; adding `guides/**` to `roots` turns it green.
- The `ignored` cause, with its own remedy-remediates row (method, round three m-f): the same
  corpus with `roots: ['**/*.md']` and `ignore: ['guides/**']` reds naming `ignored`; removing that
  pattern turns it green.
- A dotfile control: the repository holds `guides/.draft.md` only; the predicate cannot match it,
  so the rule is green, not "unloaded Markdown".
- Reverse control, the ratchet holding: a corpus over `docs/**` with no `legacy/` anywhere in the
  repository; `resideInFolder('legacy/**')…notExist()` is green.
- Pinned limits, each a test whose title names the limit so a later fix reads as progress:
  - a folder in `.that()` naming nothing over a wide corpus is green (bug 0355's ruling; bug 0460's
    symptom row);
  - `it('a corpus root that matches no file is dropped without a word (bug 0465)')`: a two-root
    corpus with one mistyped root loads the other half and is not an empty source.
- Reverse control under negation: `satisfy(not(resideInFolder('/x/**')))` is not a fault (a negative
  site is never dead).
- `codeBlocks().resideInFolder('/x/**').should().notExist()` reds with the `anchored` fault (globs
  forwarded through `onDocument`).
- This repository's `check:corpus`, `check:ledger`, `check:spec` and `check:crossval` are green and
  print the same counts as on main; eess-crossvalidate's suite is green.

**Sabotage rows**, run in a worktree. Each must turn its named test red:

1. `notExistCondition`'s `evaluate` returns `[]`: the two-element kernel test reds.
2. Drop `marksAssertsCardinality` from `notExistCondition`: the empty-selection test reds.
3. Drop the `Object.freeze` in `marksAssertsCardinality`: the kernel freeze test reds (and eess-ts's
   and eess-mermaid's freeze assertions with it).
4. Move `.expectEmpty()` back ahead of the hook: only the with-`.expectEmpty()` fault test reds
   (testing, round three m5).
5. Move the cardinality exemption back ahead of the hook: the plain kernel fault test and the md
   text-fault tests red.
6. Keep `declaredEmpty: true` when the fault fires: the receipt assertion reds.
7. `TaskItemRuleBuilder` drops its `cardinalitySelectorFault()` override: its row in the
   six-builder fault table reds (through the test-local glob-declaring predicate).
8. `TaskItemRuleBuilder.sourceEmpty()` returns `false`: its row in the six-builder empty-source
   table reds.
9. The fault helper ignores `fileIndex`: the unloaded-Markdown test reds.
10. The fault helper counts `fileIndex` with `dot: true`: the dotfile control reds.
11. The fault helper treats "matches nothing in the repository" as a fault: the ratchet-holding
    control reds.
12. The fault helper treats negative sites as positive: the negation control reds.
13. The separator check takes a `\` before `(` as a candidate: the escaped-paren control
    (`guides\(x)/**`, whose `/` reading selects `guides/x/a.md`) reds. The round-three control
    could fire nothing, because neither of its states reaches the check.
14. `globTextFault` flags a leading `./` for `'repo-relative'`: the `./guides/**` row of the
    kernel's `globTextFault` table reds. The md `./guides/**` test examines documents, so the hook
    never runs there.

`onDocument` dropping `globs` is caught by the `codeBlocks()` fault test without a row of its own
here; plan 0457 replaces `onDocument` and carries the equivalent row for `inDocuments`.

**Non-vacuity.** This plan adds a library capability, not a gate of this repository. Its proof is
the sabotage matrix above and the example's violating fixtures, registered through plan 0458's
mechanism. No row of its own in `check:nonvacuity`.

## Release

- `@nielspeter/eess`: minor, no break marker.
  - New: `notExistCondition`, `globTextFault` and the type `TextBase` on `/internal`; the protected
    `cardinalitySelectorFault()` hook, inert by default. No root export or root type changes.
  - Changelog line: "A condition marked as asserting cardinality (a `notExist()`, a
    `correspondence` side) is now frozen. Assigning to one was never supported: it let a no-op
    condition keep the empty-selection exemption (bug 0462)."
- `@nielspeter/eess-ts`: patch, in this plan's kernel changeset. `syntacticFault` becomes a wrapper
  over the kernel's rules; its signature, its return type, `GlobFault` and `FAULT_ADVICE` are
  unchanged, and a returned `notExist()` is now frozen (the kernel changelog line covers it). New
  test file.
- `@nielspeter/eess-mermaid`: patch, named in the same changeset (testing, round three N2: a test
  added under `packages/mermaid` needs a declaration for `check:release`). Its returned `notExist()`
  is now frozen.
- `@nielspeter/eess-md`: minor, marked **Breaking (@nielspeter/eess-md)**: a corpus that loaded no
  document is an empty source, which `.expectEmpty()` and `honestyAtClose`'s `expectEmptyHeaders`
  no longer satisfy, and which outranks a `notExist()` pass; the finding text for a positive rule
  over an empty corpus changes from "examined zero units" to the empty-source message. New:
  `notExist()` on seven builders, six root exports. No workspace package lists eess-md in
  `dependencies` (eess-crossvalidate has it as a peer).
- eess-gherkin and eess-crossvalidate take the kernel range bump only (`patch`, by
  `updateInternalDependencies`). The only break in this plan is eess-md's.
- Migration lines, in eess-md's changeset:
  - "If a rule over a corpus that loads nothing relied on `.expectEmpty()`, fix the corpus's
    `roots`; an empty corpus is now a configuration finding."
  - "A `honestyAtClose` lane whose roots match no file now reds even with `expectEmptyHeaders`;
    create the folder with its board file, or remove the lane."
  - "Plan 0454 ships a second eess-md break (undeclared box marks). If both land in one release,
    read both lines." (The two changesets are held for one release if the build cadence allows;
    each names the other either way.)

## Out of scope

- **Migrating the five `notExist` copies onto `notExistCondition`.** Bug 0462 no longer depends on
  it (Kernel (1)); it is de-duplication only. Home:
  [plan 0464](./0464-the-dialects-notexist-copies-move-onto-the-kernels.md).
- **eess-mermaid's missing empty-source check** (the measured empty-diagram row). Not bug 0460's
  kernel order. Home: [bug 0463](../bugs/0463-a-mermaid-notexist-over-an-empty-diagram-passes.md).
- **A corpus root that matches no file, in a multi-root corpus.** A silent pass in `corpus()`,
  pinned by a test here. Home: [bug 0465](../bugs/0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md).
- **A named dead-glob finding for md's positive rules.** They keep the generic finding; plan 0457
  overrides `deadGlobDiagnosis()` for its scopes.
- **A typo that names nothing in the repository**, on a cardinality rule. Bug 0355's ruling, kept;
  the recipe's roots-scoped corpus is the remedy, and the README states the limit.
- **Making md's declared base exact.** `GlobBase` stays unchanged (Kernel (4)); the gap reaches no
  reader until bug 0396 is fixed, and is a condition on that fix.
- `beUniqueBy`, the gherkin rebuild and the record-number dogfood: [plan 0459](./0459-kernel-beuniqueby-and-gherkins-unique-titles.md).

## Records this plan depends on

- [Bug 0463](../bugs/0463-a-mermaid-notexist-over-an-empty-diagram-passes.md): eess-mermaid reports
  no empty source, so `classes(diagram('classDiagram\n')).should().notExist()` passes (measured
  above).
- [Bug 0465](../bugs/0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md): a mistyped
  root in a multi-root corpus drops its half silently.
- [Bug 0396](../bugs/0396-doctor-assumes-every-rule-has-a-ts-morph-project.md): eess-ts's `doctor`
  crashes on md rules; md rules start declaring globs here, with an inexact base.
- Bug 0460's verification rows follow bug 0355's ruling, as this plan does: a text fault and
  unloaded Markdown red, an absent folder green, the symptom table's `gudies/**` row green by ruling,
  a typo caught by the roots-scoped recipe. Its Fix line was corrected to this plan's fault set on
  2026-10-18, and its separator wording to "and does not escape a metacharacter other than `*`
  or `?`".

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
  behaviour on a cardinality rule is stated.
- **enforcement I1** (the `./` premise is false in md): measured (Problem 4) and fixed.
- **architect I-3** (duplicated syntax rules): one owner in the kernel (renamed in round three).
- **enforcement I2** (no message or remedy): specified per cause, each with a remedy-remediates
  test.
- **architect m3 / enforcement I2** (`declaredEmpty: true` on a faulted rule): withheld, with a
  test and a sabotage row.
- **enforcement I3 / product I1** (the recipe protects one shape; adopters not told): the two
  unprotected shapes are in the README and pinned by tests.
- **enforcement I4 / method I3** (bug 0460's symptom row stays green): stated here.
- **architect I-4 / method I4 / testing I7 / enforcement m2** (bug 0462's records disagree):
  freeze at marking, measured as changing no family code.
- **architect I-2 / enforcement I5, I6 / method C / testing C1, C2** (0458's contract and a
  `notExist()` example): the example follows 0458's revised contract.
- **testing I5, M12; product I2; architect m1, m4, m5, m8; enforcement m3, m4; product minors 1, 2,
  4; method m6, m7, m9, m10, m13; coordinator decision 7**: fixed as listed in round two.

### Round three

- **architect N-1 / product N-I1 / coordinator decision 2** (`syntacticFault` behind `/internal` and
  re-exported by eess-ts breaks ADR-011 §2's gated test and widens three public unions): the kernel
  function is `globTextFault`, with a kernel-internal `TextBase`; eess-ts's `syntacticFault` and
  `GlobFault` are its own narrow wrappers, so its public surface and types do not change and its
  patch is honest; `GlobBase` is unchanged, so the kernel root does not move. Narrowed: md declares
  `'normalized'`, which is inexact, and the gap is recorded as a condition on bug 0396's fix.
- **enforcement N1 / architect m-new-2 / coordinator decision 3** (the backslash fault fires on a
  correct escape): measured (Problem 4); an escape is never a fault; a backslash before an ordinary
  character is not a text fault either, because the glob can still match, so it is a fault only on
  corpus evidence (the separator check), with escaped-folder rows both ways and sabotage row 13.
  This narrows decision 3's wording ("only a backslash that does not escape a metacharacter is a
  fault") by the measured `docs\a.md` → `docsa.md` row.
- **architect N-2 / coordinator decision 4** (`name` without `ctx` cannot express `calls()`):
  `name: (element, ctx) => string`, with a test; plan 0464 carries the `calls()` row.
- **testing N1 / coordinator decision 5** (four builders cannot take a location predicate):
  test-local glob-declaring predicates, so sabotage row 7 fires.
- **testing N2 / coordinator decision 5** (no home reaches seven objects): the freeze is tested on
  `marksAssertsCardinality`; bug 0462's rows in `packages/ts/tests`; one eess-mermaid assertion with
  a changeset entry; the `correspondence` callables dropped from the test, with the reason.
- **method N4 / enforcement m-c / coordinator decision 5** (the multi-root silent pass has no home):
  [bug 0465](../bugs/0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md), a deferral box,
  and a test titled for it.
- **method N5** (Effort figures not this plan's counts): counted from the tables (29 Files-changed
  rows, seven new test files, 14 sabotage rows; round four recounted: eight new test files, with
  the example).
- **method m-b / testing m2 / coordinator decision 1** (`violating <judgement>:` with a space):
  titles start with the folder name and a colon.
- **method m-d** (`matchingElements` over a bare glob): the check is `picomatch(glob)` over
  `relPath`s and `fileIndex`, stated exactly.
- **method m-e** (the message hardcodes "notExist()"): "This absence rule".
- **method m-f** (`ignored` has no remedy-remediates row): added.
- **product minor 1** (stale "plan 0457 composes its scope fault"): removed.
- **testing m5** (sabotage row 4 bundled two reverts): split into rows 4 and 5.
- **testing m6, m7 / method N1** (bug 0460's Fix line and bug 0462's green row): both records were
  corrected on 2026-10-18.
- **product minor 2** (ROADMAP said Medium): corrected on the board.

### Round four

- **enforcement R4-1, R4-2 / architect R4-1 / method R4-1 / testing I1 / coordinator decision 1**
  (the separator rule exempted its own test's glob, and sabotage row 13 could fire nothing): `\*`
  and `\?` are candidates; a candidate is a fault when the glob as written selects nothing and the
  `/` reading selects files; measured rows added (Problem 4); positive tests on `guides\**` and
  `guides\x/**`; the literal-star cost stated, with the measured `[*]`/`[?]` remedy in the finding's
  `suggestion` and a pinned test; row 13 re-pointed at an escaped-paren control the sabotaged check
  does red (measured: `guides/(x)/**` selects `guides/x/a.md`).
- **coordinator decision 2** (bug 0460's red-first must compile on main): the row drives
  `docs()` with a condition marked through `/internal`, which exists on main.
- **coordinator decision 3** (ADR-018 C3): a ledger box updates its Mechanism; the open question is
  gone.
- **architect m4-1** (`/internal` surface listed in two places): the `internal.ts` row lists
  `TextBase` and `GlobTextFault`.
- **method R4-2 / coordinator decision 8** (stale lines about bug 0396 and bug 0460): rewritten as
  done, dated.
- **testing m1** (six-builder fault rows over an empty corpus): over a corpus that loads documents,
  asserting the fault's cause.
- **testing m2** (row 14 named an md test the hook never reaches): it names the kernel table row.
- **testing m4** (vague population proof): `.select({ label, identify })` non-empty.
- **testing m5** (test-file count; mermaid's `notExist` not on its root): eight new test files,
  counting the example (30 Files-changed rows with the ADR-018 row); the mermaid test imports the
  condition from `../../src`.
- Not adopted: a sabotage row for the separator check's "as written selects no path" condition.
  The unloaded-Markdown check runs first, so that condition only decides which cause is named; no
  control can make it decide red or green.

## Progress ledger

- [ ] Phase 1 (review part 1): freeze at marking, `cardinalitySelectorFault` on `TerminalBuilder`
      with its order and receipt, `notExistCondition`, `globTextFault` with eess-ts's wrapper,
      kernel tests, whole suite once
- [ ] Phase 2 (review part 2): md `notExist()` ×7, `sourceEmpty()` ×6, declared globs,
      `notInCorpusReasons`, the fault helper with the separator check, six exports, README,
      `honestyAtClose`'s docstring, the example with three fixtures; eess-ts's and eess-mermaid's
      freeze tests
- [ ] Sabotage rows 1–14, each red on its named test; durations reported
- [ ] Bug 0460 and bug 0462 red-first on main, green here, both → `fixed/`
- [ ] The ADR-010 Enforcement row, `gated`, citing the kernel fault-outranks-declaration test
- [ ] ADR-018's C3 Enforcement row: its Mechanism cites the same kernel test, beside eess-ts's
- [ ] `check:family`, `check:release`, `check:docs-code`, `check:examples`, eess-crossvalidate's
      suite and `npm run validate` green; durations reported
- [ ] Close: this plan → `completed/`; boards
- [ ] deferred→[plan 0464](./0464-the-dialects-notexist-copies-move-onto-the-kernels.md) (the five
      copies' migration)
- [ ] deferred→bug 0463 (eess-mermaid reports no empty source)
- [ ] deferred→bug 0465 (a corpus root that matches no file is dropped silently)

Deferred: plan 0464; bug 0463; bug 0465
