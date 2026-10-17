# Plan 0456: the kernel's `notExist` and `beUniqueBy`

## Status

- **State:** Draft — written 2026-10-17 from proposal 017's maintainer acceptance (blocks 6 and 13).
- **Implements:** proposal 017
- **Priority:** Medium — two of the three adopters want both blocks (017, "Consumer feedback"), and
  eess-md cannot state either judgement today.
- **Effort:** Medium — two kernel conditions, two eess-md builder methods, one gherkin condition
  rebuilt, one dogfood rule. One pull request.
- **Created:** 2026-10-17
- **Builds after:** plan 0458 (the examples gate, which this plan's example needs).

## Problem

Two judgements every corpus wants cannot be written in eess-md:

- **"No document matches this selection"** (017 block 6: "every document under this folder is
  matched by one of these selections"). That needs `.should().notExist()`, and eess-md has none.
  The family has the condition five times over, in two dialects:
  - eess-ts: `packages/ts/src/conditions/structural.ts:145` (generic, used by the `classes()`,
    `types()` and `modules()` builders), `packages/ts/src/conditions/function.ts:56`,
    `packages/ts/src/conditions/call.ts:58` and `packages/ts/src/conditions/jsx.ts:36`. That is
    four implementations behind six builder methods.
  - eess-mermaid: `packages/mermaid/src/conditions/class.ts:110`.

  eess-md would be the sixth. 017's decision 4 puts it in the kernel.

- **"No two elements carry the same value"** (017 block 13: a record's number, a page's slug).
  eess-gherkin has one, `haveUniqueTitles` (`packages/gherkin/src/builder.ts:21`), private to
  gherkin. Two dialects now ask, so 017's decision 4 makes it a kernel condition with gherkin's
  rebuilt on it.

**A defect the kernel version must not copy.** Measured on main's build:

```js
const c = notExist() // from @nielspeter/eess-ts
c.evaluate = () => []
assertsCardinality(c) // true
```

The output was `frozen false · still exempt true · evaluate replaced true`. Replacing `evaluate` on
a returned `notExist()` makes a condition that never reports, yet it keeps the cardinality
exemption. That exempts its rule from the empty-selection gate (ADR-010) with no `.expectEmpty()`.
The `WeakSet` in `packages/core/src/cardinality.ts` protects the key, not the object it is keyed
on. All five existing copies share this; it is recorded as a bug in this plan's PR (see Out of
scope).

## Design

### `notExist`: one kernel factory, frozen

```ts
// packages/core/src/set-conditions.ts (new)
import type { Condition, ConditionContext } from './condition.js'
import type { ElementInfo } from './correspondence.js'
import type { ArchViolation } from './violation.js'
import { marksAssertsCardinality } from './cardinality.js'

/** One element → one finding, carrying every field the rule declared. */
function elementViolation(
  info: ElementInfo,
  message: string,
  ctx: ConditionContext,
): ArchViolation {
  return {
    rule: ctx.rule,
    ...(ctx.ruleId !== undefined && { ruleId: ctx.ruleId }),
    element: info.name,
    file: info.file ?? '<selection>',
    line: info.line ?? 0,
    message,
    ...(ctx.because !== undefined && { because: ctx.because }),
    ...(ctx.suggestion !== undefined && { suggestion: ctx.suggestion }),
    ...(ctx.docs !== undefined && { docs: ctx.docs }),
  }
}

/**
 * The selection must be empty: every selected element is a finding. Satisfied by
 * zero elements, so it carries the kernel's cardinality exemption (ADR-010).
 * Frozen: replacing `evaluate` on an exempt condition would keep the exemption
 * and drop every finding.
 */
export function notExist<T>(identify: (element: T) => ElementInfo): Condition<T> {
  return Object.freeze(
    marksAssertsCardinality({
      description: 'not exist',
      evaluate: (elements: T[], ctx: ConditionContext): ArchViolation[] =>
        elements.map((e) => {
          const info = identify(e)
          return elementViolation(info, `${info.name} should not exist`, ctx)
        }),
    }),
  )
}
```

- **Why `identify` and not the dialect's own violation builder.** It is the shape
  `correspondence()` already takes (`Selection.identify`, `packages/core/src/correspondence.ts:25`),
  so a dialect writes one `identify` for both uses. The cost: no code frame, because the kernel
  cannot read source text. A frame at line 1 of a Markdown document shows nothing useful anyway.
  The five existing copies attach frames, which is one reason their migration is out of scope.
- **Mutation is closed.** Assigning to `evaluate` or `description` on the frozen object throws in
  strict mode (every ESM module is strict) and does nothing otherwise. The exemption still
  attaches to an object nobody can change.
- `ConditionContext.identifyByArgument` is a `calls()` concern and is ignored, as every non-call
  condition ignores it.

### `beUniqueBy`: the key is the caller's, every member is named

```ts
export interface UniqueByOptions<T> {
  /** The value compared. Exact string equality; normalisation is the caller's. */
  readonly key: (element: T) => string
  readonly identify: (element: T) => ElementInfo
  /** What the key is, for the message: "record number", "title within its feature file". */
  readonly label: string
}

export function beUniqueBy<T>(opts: UniqueByOptions<T>): Condition<T> {
  return Object.freeze({
    description: `be unique by ${opts.label}`,
    evaluate: (elements: T[], ctx: ConditionContext): ArchViolation[] => {
      const groups = new Map<string, T[]>()
      for (const e of elements) {
        const k = opts.key(e)
        const group = groups.get(k)
        if (group) group.push(e)
        else groups.set(k, [e])
      }
      const out: ArchViolation[] = []
      for (const group of groups.values()) {
        if (group.length < 2) continue
        const infos = group.map(opts.identify)
        for (const [i, info] of infos.entries()) {
          const others = infos
            .filter((_, j) => j !== i)
            .map((o) => `${o.file ?? '?'}:${o.line ?? 0}`)
          out.push(
            elementViolation(
              info,
              `${info.name} has the same ${opts.label} as ${others.length} other${others.length === 1 ? '' : 's'}: ${others.join(', ')}`,
              ctx,
            ),
          )
        }
      }
      return out
    },
  })
}
```

Decisions. Each can be overruled.

- **Exact keys.** `'066'` and `'0066'` are different keys. 017's block-13 condition says values
  compare "through block 1's normaliser". Block 1 is not built, so here the caller's `key` is the
  normaliser. When block 1 ships, its normalised value is what a caller passes as the key. No
  normalisation lives in the kernel.
- **Every member is a finding, at its own line, naming all the others.** Gherkin's version reports
  only the second and later occurrences, naming the first. Reporting every member is what 017's
  block-13 condition asks ("every member of a group is named"), and it means an exclusion or a
  baseline entry for one member cannot hide the group.
- **The denominator is values, not documents.** One element yields one key, so the rule's
  `examined` count is the number of values compared. When block 1 later yields one element per
  value, a multi-valued field counts each value.
- **A key is a string, never `undefined`.** An element with no value is removed with `.that()`
  before the condition sees it. A key function that may return nothing would let a broken key
  silently shrink the comparison.
- **Not cardinality-exempt.** Zero elements is the kernel's ordinary empty-selection finding.
  One element is evidence: one value is unique by construction, so it is green, and the
  denominator says 1. That settles 017's carried question, "a selection of one under block 13".
- **A key that throws** propagates. The rule fails as a thrown error, not as a pass.

### Placement and exports

Both are exported from the kernel root, `packages/core/src/index.ts`, with `UniqueByOptions` as a
type. They are condition factories for dialect authors, like `defineCondition`, not family plumbing
(ADR-011). `marksAssertsCardinality` stays behind `/internal`. The kernel's own factory marks its
own condition, which is the sanctioned path the `cardinality.ts` docstring names.

**A name already taken in the family.** eess-ts's root exports its own `notExist()` with no
argument (`packages/ts/src/index.ts:96`), and the kernel's takes `identify`. A file importing both
gets two `notExist`s. eess-ts does not import the kernel's, so `check:family` does not ask eess-ts
to re-export it, and the names never meet in one module unless an adopter imports both roots. This
is left as it is here, and taken up by the migration record below.

### eess-md: `docs().should().notExist()` and `.beUniqueBy(key, label)`

```ts
// packages/md/src/builders/docs.ts
const identifyDoc = (d: MdDocument): ElementInfo => ({ name: d.relPath, file: d.file, line: 1 })

/** The selection must be empty: each matched document is a finding. */
notExist(): this {
  return this.addCondition(notExist(identifyDoc))
}

/** No two matched documents share `key`'s value. Exact match; normalise in `key`. */
beUniqueBy(key: (d: MdDocument) => string, label: string): this {
  return this.addCondition(beUniqueBy({ key, identify: identifyDoc, label }))
}
```

Block 6's judgement becomes, in the caller's own words:

```ts
docs(c)
  .that()
  .resideInFolder('work/**')
  .and(not(or(isPlan, isBug, isProposal)))
  .should()
  .notExist()
```

`not` and `or` are the kernel combinators, applied through the inherited `.that()`/`.and()`. Each
unclaimed document is a finding naming its path.

Only `docs()` gains the two methods here. The other md builders (`links`, `pointers`, `rows`,
`taskItems`, `codeBlocks`) can take them later at one line each; no adopter asked for them.
`check:family` makes eess-md's root re-export `notExist`, `beUniqueBy` and `UniqueByOptions`, since
its source imports them (plan 0089).

### eess-gherkin: `haveUniqueTitles` rebuilt

```ts
const haveUniqueTitles = (): Condition<GherkinScenario> =>
  beUniqueBy({
    key: (s) => `${s.relPath}\0${s.title}`,
    identify: (s) => ({ name: `${s.relPath} › ${s.title}`, file: s.file, line: s.line }),
    label: 'title within its feature file',
  })
```

**A break for eess-gherkin.** Its own builder method and condition change behaviour:

- the first occurrence is now reported too, so a duplicate pair gives two findings, not one;
- the message changes from `duplicate scenario title "X" (first at line N) — ambiguous for citation
resolution` to `<file> › X has the same title within its feature file as 1 other: <file>:N`.

A baseline or a test keyed on the old message or count goes red. Under bug 0184's rule this is a
minor, `**Breaking (@nielspeter/eess-gherkin)**`. Measured: no workspace package lists eess-gherkin
in `dependencies` (eess-crossvalidate has it as a peer), so `release/break-names-dependents` names
nobody.

### Dogfood: this repository's record numbers

017 requires this repository to adopt block 13 for record numbers. `scripts/check-corpus.mjs` gains
one rule over `work/**`:

```ts
docs(c)
  .that()
  .resideInFolder('work/**')
  .and()
  .haveNameMatching(/^\d{3,4}-/)
  .should()
  .beUniqueBy((d) => d.relPath.split('/').pop().match(/^\d+/)[0], 'record number')
  .rule({ id: 'corpus/record-number-unique' })
```

The key is the digits as written, so `066` and `0066` stay distinct. That is the corpus's own rule:
one sequence per number width (`/plan`, step 2).

`check:numbers` (`kit/scripts/next-number.mjs --check`) already refuses a number claimed twice and
stays. It is the portable kit's script, and it may not depend on eess. The new rule is the
dialect's own statement of the same judgement, which is what 017's condition asks. If the two ever
disagree, that is a finding about one of them. To be overruled if double-gating is unwanted.

## Phases

All in one pull request; each phase is reviewable on its own.

### Phase 1: the kernel

- `packages/core/src/set-conditions.ts`: `notExist`, `beUniqueBy`, `UniqueByOptions`, and the
  private `elementViolation`.
- Export them from `packages/core/src/index.ts`.
- Add `notExist` and `beUniqueBy` to the public-surface census
  (`packages/core/tests/public-surface-is-nameable.test.ts`).

### Phase 2: eess-md

- `DocsRuleBuilder.notExist()` and `.beUniqueBy(key, label)`.
- Re-export from `packages/md/src/index.ts`.
- `packages/md/README.md`: the block-6 example above, and a uniqueness example.
- An example under plan 0458's gate, `examples/md/unclaimed-and-unique.test.ts`: "every document
  under `guides/` is claimed by a selection, and no two share a slug", from public blocks only,
  with a clean and a violating fixture.

### Phase 3: eess-gherkin

- Rebuild `haveUniqueTitles` on `beUniqueBy`, and re-export `beUniqueBy` if `check:family` asks for
  it.
- Update `packages/gherkin/tests/builder.test.ts` and `waiver-in-doc-string.test.ts` to the new
  count and message.

### Phase 4: dogfood

- Add the `corpus/record-number-unique` rule to `scripts/check-corpus.mjs`, with a non-vacuity
  fixture.

## Files Changed

| file                                                     | change                                        |
| -------------------------------------------------------- | --------------------------------------------- |
| `packages/core/src/set-conditions.ts`                    | new                                           |
| `packages/core/src/index.ts`                             | two exports, one type                         |
| `packages/core/tests/set-conditions.test.ts`             | new                                           |
| `packages/core/tests/public-surface-is-nameable.test.ts` | the new names                                 |
| `packages/md/src/builders/docs.ts`                       | `notExist()`, `beUniqueBy()`                  |
| `packages/md/src/index.ts`                               | re-exports                                    |
| `packages/md/tests/docs-set-conditions.test.ts`          | new                                           |
| `packages/md/README.md`                                  | two examples                                  |
| `examples/md/unclaimed-and-unique.test.ts` + fixtures    | new (plan 0458's gate)                        |
| `packages/gherkin/src/builder.ts`                        | `haveUniqueTitles` on `beUniqueBy`            |
| `packages/gherkin/src/index.ts`                          | re-export if `check:family` asks              |
| `packages/gherkin/tests/*.test.ts`                       | new count and message                         |
| `scripts/check-corpus.mjs`                               | `corpus/record-number-unique`                 |
| `scripts/check-nonvacuity.mjs` + a fixture               | one row                                       |
| `.changeset/*.md`                                        | kernel minor, md minor, gherkin minor (break) |

## Test inventory

Kernel (`set-conditions.test.ts`), each driving the public factory through a real `RuleBuilder`
subclass, not a hand-built stand-in:

- `notExist`: an empty selection is green, and through `collectViolations` it carries no
  empty-selection finding (the exemption works). Two elements give two findings, each with its own
  file and line, and with `because`, `suggestion`, `docs` and `ruleId` copied from the rule.
- `notExist` is frozen: assigning `evaluate` throws, and the rule still reports.
- `notExist` composed with a second condition: `.should().notExist().andShould()…` is not exempt
  over zero elements, a property of `RuleBuilder.assertsCardinality()`'s `.every()` pinned for the
  kernel factory.
- `beUniqueBy`:
  - a group of three gives three findings, each naming the other two;
  - two distinct groups are reported separately;
  - all-distinct keys are green;
  - `'066'` and `'0066'` are distinct;
  - one element is green with `examined` 1;
  - zero elements gives the kernel's empty-selection finding (it is not exempt);
  - a throwing key propagates.
- `beUniqueBy` is frozen.

eess-md (`docs-set-conditions.test.ts`), over `corpus()` on a fixture directory:

- `notExist()` reds each unclaimed document by path, and is green when every document is claimed.
- `beUniqueBy` names both documents of a duplicate.

eess-gherkin: the rebuilt `haveUniqueTitles` reports both members. The waiver-in-doc-string case
still reports, now with both members.

**Sabotage rows**, run in a worktree. Each must turn its test red:

1. `notExist`'s `evaluate` returns `[]`: the two-element test reds.
2. Drop `marksAssertsCardinality`: the empty-selection test reds with an empty-selection finding.
3. Drop `Object.freeze` from `notExist`: the mutation test reds.
4. `beUniqueBy` reports only `group[1..]`: the three-member test reds.
5. `beUniqueBy` lowercases keys: the `066`/`0066` test still passes, so this row needs a case-only
   pair (`'A'` and `'a'`), which reds.
6. `beUniqueBy` returns `[]`: the duplicate test reds.

**Non-vacuity:** one `check:nonvacuity` row for `corpus/record-number-unique`. A scratch corpus
with two `0001-` records must exit 1 and print the rule id and both paths.

**`check:family`:** green with the new re-exports. Its existing fixture already proves it reds
when md drops a kernel re-export.

## Release

- `@nielspeter/eess`: minor (two new exports).
- `@nielspeter/eess-md`: minor (two new builder methods).
- `@nielspeter/eess-gherkin`: minor, marked **Breaking (@nielspeter/eess-gherkin)** (findings and
  message change). No dependents name it in `dependencies`.
- eess-ts, eess-mermaid and eess-crossvalidate take the kernel range bump only (`patch`, by
  `updateInternalDependencies`).

## Out of scope

- **Migrating the five existing `notExist` copies** (eess-ts 4, eess-mermaid 1) onto the kernel's.
  They attach code frames, eess-ts's `calls()` copy honours `identifyByArgument`, and the eess-ts
  name collides with the kernel's signature. A migration is its own decision. Recorded as a Draft
  plan in this plan's pull request, so the deferral has a home.
- **The mutable-exemption defect in those five copies** (the measurement under Problem). Recorded
  as a bug in this plan's pull request. The fix is one `Object.freeze` per copy, and it is a red
  test first in its own lane.
- `notExist` and `beUniqueBy` on md builders other than `docs()`.
- Block 1's value reader and its normaliser (017: after bug 0403).

## Progress ledger

- [ ] Phase 1: kernel `notExist` and `beUniqueBy`, frozen, with tests and sabotage rows 1–6
- [ ] Phase 2: eess-md `docs().notExist()` and `.beUniqueBy()`, with README examples and the example under plan 0458's gate
- [ ] Phase 3: gherkin `haveUniqueTitles` on `beUniqueBy`, break declared
- [ ] Phase 4: `corpus/record-number-unique` in `check:corpus`, with a non-vacuity row
- [ ] The migration Draft plan and the mutable-exemption bug filed in this PR
- [ ] `check:family`, `check:release` and `npm run validate` green; durations reported

Deferred: none
