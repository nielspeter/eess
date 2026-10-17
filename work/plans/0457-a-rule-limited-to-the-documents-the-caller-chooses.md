# Plan 0457: a rule limited to the documents the caller chooses

## Status

- **State:** Draft — written 2026-10-17 at the maintainer's request ("plans in one pr"), from
  [proposal 017](../proposals/017-md-blocks-to-check-a-documents-shape.md) block 12, as shaped by its
  second Review's decision 4 and the consumer-feedback decision 3.
- **Implements:** proposal 017
- **Priority:** Medium — two of the three adopters asked for it (block 12 alone, and block 12
  composed with block 11). Today a rule over boxes, links or pointers can be limited to a folder but
  not to "documents whose `Status` is `done`", so that judgement exists only inside `honestyAtClose`
  with its fixed label.
- **Effort:** Small to medium. One predicate, one document predicate, four existing document
  predicates exported, a diagnosis hook overridden in six builders, one example. No kernel change.
- **Created:** 2026-10-17
- **Builds after:** the plans for blocks 17, 7 and 6+13, in the agreed order. It needs nothing from
  them except the `examples/` completeness gate (proposal 017, second Review decision 3), which is
  plan 0458's. It must not merge before plan 0458 has.

## Problem

Every eess-md element that belongs to a document carries that document as `doc`:

| element           | builder        | `doc` declared at                              |
| ----------------- | -------------- | ---------------------------------------------- |
| `MdTaskItem`      | `taskItems()`  | `packages/md/src/builders/task-items.ts:9`     |
| `MdLink`          | `links()`      | `packages/md/src/model/links.ts:216`           |
| `MdPointer`       | `pointers()`   | `packages/md/src/model/pointers.ts:90`         |
| `MdRow`           | `rows()`       | `packages/md/src/model/rows.ts:22`             |
| `MdTerm`          | `terms()`      | `packages/md/src/builders/vocabulary.ts:83`    |
| `ParsedCodeBlock` | `codeBlocks()` | `packages/md/src/model/code-block-parse.ts:82` |

But none of their builders can be limited by a predicate over that document. A caller can say "open
boxes" and "boxes in `work/plans/**`" (through a folder glob), and cannot say "open boxes in
documents that have a `Verification` section", or "open boxes in documents that are not frozen".
The document predicates exist (`packages/md/src/predicates/document.ts`: `resideInFolder`,
`resideInFile`, `haveNameMatching`, `haveSectionPredicate`), but only `docs()` can use them, and
none is exported from the package root, so a caller cannot even name one to pass on.

Frozen documents are the second gap. `corpus()` marks each document `frozen`
(`packages/md/src/model/document.ts:58`, from `DEFAULT_FROZEN` at `packages/md/src/corpus.ts:53`),
and two md predicates read it internally (`pointers()`' `areLive`, `links()`'
`haveLiveTargets`). No rule can select on it. Proposal 017's decision 3 makes frozenness each rule's
own choice: "a caller selects on frozenness with an `isFrozen()` document predicate that ships with
block 12".

## Design

### `inDocuments(p)`

```ts
// packages/md/src/predicates/in-documents.ts
import type { Predicate } from '@nielspeter/eess'
import type { MdDocument } from '../model/document.js'

/** Lift a document predicate onto any element that carries its document. */
export function inDocuments<T extends { readonly doc: MdDocument }>(
  p: Predicate<MdDocument>,
): Predicate<T> {
  const memo = new WeakMap<MdDocument, boolean>()
  const test = (doc: MdDocument): boolean => {
    const hit = memo.get(doc)
    if (hit !== undefined) return hit
    const verdict = p.test(doc)
    memo.set(doc, verdict)
    return verdict
  }
  const lifted: Predicate<T> = {
    description: `are in documents that ${p.description}`,
    test: (element) => test(element.doc),
  }
  SCOPES.set(lifted, { inner: p, test })
  return lifted
}
```

- **Used through the inherited `satisfy()`** (`packages/core/src/rule-builder.ts:172`), which
  dispatches on `test`, so no builder gains a method: `taskItems(c).that().satisfy(inDocuments(p))`.
  It also applies inside `.select()`, so a scoped side of `correspondence()` needs nothing more.
- **Memoised per document**, in a `WeakMap` keyed on the `MdDocument` object. A corpus document is
  built once (`packages/md/src/model/document.ts:163`) and never mutated, so the verdict cannot go
  stale, and a predicate shared between two corpora keeps their documents apart. The memo is
  per call of `inDocuments`, so a rule that copies its builder (`fork()`, `copy()`) shares a memo
  that is already right for both.
- **Typed**, not checked at run time: `T extends { readonly doc: MdDocument }` makes
  `docs(c).that().satisfy(inDocuments(p))` a type error, where `p` alone is the answer.
- **No `as`** (ADR-005): `SCOPES` is a module-local `WeakMap<object, Scope>` from the returned
  predicate to its inner predicate, which is how the diagnosis below finds it.

### `isFrozen()` and the exported document predicates

```ts
// packages/md/src/predicates/document.ts (added)
export function isFrozen(): Predicate<MdDocument> {
  return { description: 'are frozen', test: (d) => d.frozen }
}
```

The package root exports `inDocuments`, `isFrozen`, and the existing `resideInFolder`,
`resideInFile` and `haveNameMatching`, so a caller can build `p` from public blocks, and the
examples' arch rule (no constructed predicate) can be met. This follows `eess-ts`, which exports its
predicate functions from its root (`packages/ts/src/index.ts:84`). `haveSectionPredicate` stays
internal: its public name is the open question below. The kernel's `not()` is already re-exported,
so "not frozen" is `not(isFrozen())`. `corpus()`'s frozen default is not touched (proposal 017,
second Review decision 2, has its own record).

### When a scoped rule examines nothing

A rule whose selection is empty already earns the kernel's zero-examined finding unless it declared
`.expectEmpty()` (`packages/core/src/terminal-builder.ts:311`, ADR-010). That covers proposal
017's condition "zero elements over matched documents is a finding unless declared" without new
code. What the kernel cannot say is which of the two causes it is, and the second-Review condition
asks for the first by name: "a predicate selecting no document is a finding naming the predicate".

The kernel already has the seam: `RuleBuilder.deadGlobDiagnosis()`
(`packages/core/src/rule-builder.ts:281`), a protected hook a dialect overrides to give a
zero-examined rule a specific reason, called only when nothing was examined and the source is not
empty (`:389`), whose reason replaces the generic message (`deadGlobViolation`,
`packages/core/src/vacuity-findings.ts:73`). Nothing overrides it today. The six builders above
override it with one call to a shared md helper:

```ts
// packages/md/src/predicates/in-documents.ts
export function scopeDiagnosis(
  predicates: readonly Predicate<unknown>[],
  documents: readonly MdDocument[],
  elementNoun: string,
): string | undefined {
  for (const pred of predicates) {
    const scope = SCOPES.get(pred)
    if (scope === undefined) continue
    const matched = documents.filter(scope.test).length
    if (matched === 0) {
      return (
        `inDocuments(${scope.inner.description}) matched none of the corpus's ` +
        `${documents.length} documents — the document predicate is dead; fix it, or declare ` +
        `.expectEmpty() if no document is meant to match`
      )
    }
    return (
      `inDocuments(${scope.inner.description}) matched ${matched} of ${documents.length} ` +
      `documents, and they hold no ${elementNoun} this rule selects — declare .expectEmpty() if ` +
      `that is expected`
    )
  }
  return undefined
}
```

Both counts the proposal asks for are in the reason: documents matched (against the corpus total)
and elements examined (zero, by the branch it runs on). `documents` is the corpus's
`documents()`; for `codeBlocks()`, whose project is `ParsedCodeBlocks`, it is the parsed
documents. The diagnosis is the dead-glob precedence the kernel already has, so `.expectEmpty()`
satisfies it, as it satisfies a dead glob (ADR-018: matching nothing is allowed when it is the
purpose and is declared).

**What it does not cover.** A scope inside a combinator (`not(inDocuments(p))`,
`or(inDocuments(p), …)`) is not found by identity, and its rule gets the generic zero-examined
finding: still red, with a less specific reason. A combinator that wraps a scope is uncommon
because `inDocuments(not(p))` says the same; the plan records the limit in the docs rather than
teaching `combinators.ts` about md.

**What a green run reports.** Proposal 017's decision 4 says the predicate "reports both counts".
On a green run there is no channel for it: no CLI prints a rule's `examined` today, which is the
open half of bug 0174. This plan reports both counts where a rule examined nothing, and leaves the
green-path counts, frozen documents excluded included (decision 3), to bug 0174's fix. That is a
narrowing of the proposal's wording, stated here so the review can refuse it.

## Phases

All in one PR.

**Phase 1: the predicates.** `isFrozen()` in `predicates/document.ts`; `inDocuments` and
`scopeDiagnosis` in a new `predicates/in-documents.ts`; root exports for `inDocuments`, `isFrozen`,
`resideInFolder`, `resideInFile`, `haveNameMatching`.

**Phase 2: the diagnosis.** `deadGlobDiagnosis()` overridden in `TaskItemRuleBuilder`,
`LinkRuleBuilder`, `PointerRuleBuilder`, `RowsRuleBuilder`, `TermRuleBuilder` and
`CodeBlockRuleBuilder`, each one line:

```ts
protected override deadGlobDiagnosis(): string | undefined {
  return scopeDiagnosis(this._predicates, this.project.documents(), 'task items')
}
```

**Phase 3: the example and the docs.** `examples/md/` (plan 0458's gate) gains "open boxes only in live documents that
have a `Verification` section", built from public blocks only, with a clean fixture and a violating
fixture, registered in `check:nonvacuity` as the examples gate requires. `docs/markdown.md` and
`packages/md/README.md` gain a section on scoping a rule to documents, naming the combinator limit.

## Files Changed

| file                                                                                  | change                               |
| ------------------------------------------------------------------------------------- | ------------------------------------ |
| `packages/md/src/predicates/in-documents.ts`                                          | new: `inDocuments`, `scopeDiagnosis` |
| `packages/md/src/predicates/document.ts`                                              | `isFrozen()`                         |
| `packages/md/src/index.ts`                                                            | five exports                         |
| `packages/md/src/builders/{task-items,links,pointers,rows,vocabulary,code-blocks}.ts` | `deadGlobDiagnosis()` override       |
| `packages/md/tests/in-documents.test.ts`                                              | new                                  |
| `packages/md/tests/public-surface.test.ts`, the md surface census                     | the new names                        |
| `examples/md/` (one example, two fixtures)                                            | new                                  |
| `scripts/check-nonvacuity.mjs`                                                        | the example's row                    |
| `docs/markdown.md`, `packages/md/README.md`                                           | the section                          |
| `.changeset/md-in-documents.md`                                                       | `@nielspeter/eess-md`: minor         |

## Test inventory

Each through the public entry points (`taskItems(corpus(…))`, `.check()` / `.violations()`), never a
hand-built element:

- **The scoped rule is green where the unscoped one is red:** a corpus with an open box in a
  document with `## Verification` and one in a document without; `taskItems().that().areOpen()
.should().notExist()` reds on both, and the same rule with `.satisfy(inDocuments(
haveSectionPredicate…))` reds on the first only. (The predicate the test passes is whatever
  public name the open question settles.)
- **A predicate selecting no document** reds with the reason naming `inDocuments(…)`, the
  predicate's description, and `0 of N`.
- **Documents matched, no elements:** reds with "matched K of N documents, and they hold no task
  items"; the same rule with `.expectEmpty()` is green.
- **A dead scope under `.expectEmpty()`** is green, pinned, so a later change to the precedence is a
  decision and not an accident.
- **`isFrozen()`:** `inDocuments(not(isFrozen()))` drops a box in `completed/` and keeps one
  outside it; `inDocuments(isFrozen())` the reverse; a corpus built with `frozen: []` has no frozen
  document.
- **Memo:** the inner predicate's `test` runs once per document over a rule examining many
  elements of one document (a counting predicate), and two corpora sharing one `inDocuments`
  instance get each corpus's own verdicts.
- **Each of the six builders** gets the named reason, one row each, so a builder that loses its
  override reds.
- **`.select()`:** a scoped `rows()` side of `correspondence()` holds only the matched documents'
  rows.
- **Combinator limit:** `not(inDocuments(p))` over nothing reds with the generic zero-examined
  finding, pinned as the documented behaviour.
- **Type:** `docs(c).that().satisfy(inDocuments(p))` fails `tsc` (a `// @ts-expect-error` line in
  the test file).

**Sabotage rows**, each run once in a worktree and each turning a row above red:

| sabotage                                       | row that reds                    |
| ---------------------------------------------- | -------------------------------- |
| `inDocuments`' `test` returns `true`           | scoped green where unscoped red  |
| the memo keys on `relPath` across corpora      | two corpora sharing one instance |
| `scopeDiagnosis` returns `undefined`           | predicate selecting no document  |
| the override removed from `PointerRuleBuilder` | that builder's row               |
| `isFrozen` reads `!d.frozen`                   | `isFrozen()` rows                |

**Non-vacuity.** The example is registered in `check:nonvacuity` (proposal 017, second Review
decision 3), so emptying `inDocuments` reds the gate as well as the suite.

## Release

`@nielspeter/eess-md` minor: new exports, nothing removed, no rule's verdict changes (a rule that
does not call `inDocuments` takes no new branch; `deadGlobDiagnosis()` returns `undefined` for it,
as before). `eess-crossvalidate` takes the dependency bump only. Five new root names land in the
surface census.

## Out of scope

- `inSections()` (block 18): not accepted; it needs block 11's section elements.
- Green-path counts: bug 0174.
- Changing `corpus()`'s frozen default: proposal 017, second Review decision 2.
- `haveField` (block 2), the predicate the proposal's headline example uses: blocks 1 and 2 are not
  yet plannable.
- Teaching kernel combinators to forward a diagnosis.

## Open questions

1. The public name of the section predicate: export `haveSectionPredicate` as is, rename it (to
   match `docs().haveSection`'s dual use, an alias as `eess-ts` does at
   `packages/ts/src/index.ts:93`), or leave it unexported until block 11 makes sections elements.
2. Whether "reports both counts" may be met on the zero path alone until bug 0174 (see "What a
   green run reports").

## Progress ledger

- [ ] Open questions 1 and 2 decided at review
- [ ] Phase 1: predicates and exports
- [ ] Phase 2: the diagnosis in six builders
- [ ] Phase 3: example, nonvacuity row, docs
- [ ] Sabotage rows run, each red then green

Deferred: none
