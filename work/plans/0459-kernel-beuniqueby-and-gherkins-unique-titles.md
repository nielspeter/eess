# Plan 0459: the kernel's `beUniqueBy`, and eess-gherkin's unique titles rebuilt on it

## Status

- **State:** Draft — written 2026-10-18, split from
  [plan 0456](./0456-kernel-notexist-and-dead-glob.md) after PR #235's review (method, B2: one
  plan held two independent kernel conditions, a break in a third package and a dogfood rule).
- **Implements:** proposal 017
- **Priority:** Medium. Two of the three adopters want block 13 (017, "Consumer feedback"), and
  this repository adopts it for record numbers (017, second Review's conditions).
- **Effort:** Medium. One kernel condition, one eess-md builder method, one eess-gherkin condition
  rebuilt (a break), one rule in `check:corpus` with its non-vacuity row. One pull request.
- **Created:** 2026-10-18
- **Builds after:** [plan 0456](./0456-kernel-notexist-and-dead-glob.md) (it uses 0456's `/internal`
  shape and md's root exports) and [plan 0458](./0458-the-examples-gate-a-document-shape-from-public-blocks-only.md)
  (the examples gate). Build order (maintainer, 2026-10-18): 0458 → 0456 → 0454 → 0457 → 0455 →
  **0459**.

## Problem

**"No two elements carry the same value"** (017 block 13: a record's number, a page's slug)
cannot be written in eess-md. eess-gherkin has one, `haveUniqueTitles`
(`packages/gherkin/src/builder.ts:20`), private to gherkin. Two dialects now ask, so 017's
decision 4 makes it a kernel condition with gherkin's rebuilt on it.

Gherkin's today (`packages/gherkin/src/builder.ts:20-44`) reports the second and later occurrences
of a title within one feature file, each naming the first, with the reason "ambiguous for
citation resolution" (`builder.ts:35`). It builds its violation inline, the third copy of the
context-to-violation spread (md's `mdViolation`, `packages/md/src/model/violation.ts:13`, and
`packages/md/src/builders/vocabulary.ts:146` are the others).

This repository's record numbers are checked today by `check:numbers`
(`kit/scripts/next-number.mjs --check`), the portable kit's script, which may not depend on eess.
017's condition is that this repository's own gate states block 13 in eess-md.

## Design

### Kernel: `uniqueByCondition`, behind `/internal`

Placed by the same rule as plan 0456's `notExistCondition`: it is a factory a dialect writes, and
an adopter writes `docs(c).…should().beUniqueBy(…)`. So it is family plumbing (ADR-011), exported
from `packages/core/src/internal.ts`, and it takes the dialect's own violation constructor so a
code frame survives.

```ts
// packages/core/src/unique-by.ts (new)
export interface UniqueByOptions<T> {
  /** The value compared. Exact string equality; normalisation is the caller's. */
  readonly key: (element: T) => string
  /** How a message names an element and where it is: `guides/a.md:1`. */
  readonly locate: (element: T) => { readonly name: string; readonly at: string }
  /** What the key is, for the message: "record number", "title within its feature file". */
  readonly what: string
  /** Optional: why a duplicate matters, appended to the message. */
  readonly why?: string
  readonly toViolation: (element: T, message: string, ctx: ConditionContext) => ArchViolation
}

export function uniqueByCondition<T>(opts: UniqueByOptions<T>): Condition<T> {
  return Object.freeze({
    description: `be unique by ${opts.what}`,
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
        for (const [i, e] of group.entries()) {
          const others = group.filter((_, j) => j !== i).map((o) => opts.locate(o).at)
          const tail = opts.why === undefined ? '' : `; ${opts.why}`
          const msg = `${opts.locate(e).name} has the same ${opts.what} as ${String(others.length)} other${others.length === 1 ? '' : 's'}: ${others.join(', ')}${tail}`
          out.push(opts.toViolation(e, msg, ctx))
        }
      }
      return out
    },
  })
}
```

Decisions, each overrulable:

- **Exact keys. Narrowed from 017's block-13 condition.** The condition says values compare
  "through block 1's normaliser", so `066` and `0066` collide. Block 1 is not built; here the
  caller's `key` is the normaliser, and the kernel compares strings exactly. When block 1 ships,
  its normalised value is what a caller passes as `key`. This is a narrowing, stated as one
  (enforcement M1).
- **Every member is a finding, at its own line, naming all the others.** 017's condition ("every
  member of a group is named"). An exclusion or a baseline entry for one member cannot hide the
  group.
- **The denominator is values, not documents.** One element yields one key, so `examined` is the
  number of values compared.
- **A key is a string, never `undefined`.** An element without a value is removed with `.that()`
  first; a key function that may return nothing would let a broken key shrink the comparison.
- **Not cardinality-exempt.** Zero elements is the kernel's ordinary zero-examined finding. One
  element is evidence: green, `examined` 1. That settles 017's carried question, "a selection of
  one under block 13".
- **A key that throws** propagates: the rule fails as a thrown error, not as a pass.
- **Messages name `relPath`, not the absolute file** (enforcement M4, testing 0456-M3), so a
  message is the same on every machine.
- **Frozen** like every kernel condition factory, though it carries no exemption, so mutating it
  can only make a rule wrong, not silently exempt. One test pins it; no sabotage row claims more.

### eess-md: `docs().beUniqueBy(key, what)`

```ts
// packages/md/src/builders/docs.ts
/** No two matched documents share `key`'s value. Exact match: normalise in `key`. */
beUniqueBy(key: (d: MdDocument) => string, what: string): this {
  return this.addCondition(
    uniqueByCondition({
      key,
      what,
      locate: (d) => ({ name: d.relPath, at: `${d.relPath}:1` }),
      toViolation: (d, message, context) =>
        mdViolation({ element: d.relPath, file: d.file, line: 1, message, context }),
    }),
  )
}
```

`what` rather than `label`: in eess-md "label" already means a field's label (`**Label:**`,
`links().areLabelled(label)`), and one word should mean one thing (product, minor; ADR-017).
Only `docs()` gains it; a value-level `beUniqueBy` waits for block 1's field elements.

### eess-gherkin: `haveUniqueTitles` rebuilt

```ts
const haveUniqueTitles = (): Condition<GherkinScenario> =>
  uniqueByCondition({
    key: (s) => `${s.relPath}\0${s.title}`,
    locate: (s) => ({ name: `${s.relPath} › ${s.title}`, at: `${s.relPath}:${String(s.line)}` }),
    what: 'title within its feature file',
    why: 'ambiguous for citation resolution',
    toViolation: scenarioViolation,
  })
```

`scenarioViolation` replaces the inline spread at `builder.ts:29-39`, so gherkin's conditions keep
one constructor.

**A break for eess-gherkin, accepted by the maintainer 2026-10-18.** What changes:

- the first occurrence is now reported too, so a duplicate pair gives two findings, not one;
- the message changes from `duplicate scenario title "X" (first at line N) — ambiguous for
citation resolution` to `<relPath> › X has the same title within its feature file as 1 other:
<relPath>:N; ambiguous for citation resolution`;
- a waiver on the second occurrence used to hide the pair entirely; now the first occurrence still
  reds (product, Important 5).

Migration line, in the changeset: "`haveUniqueTitles` now reports every member of a duplicate
group, each naming the others. Update tests or baselines keyed on the old message or count. A
waiver on one occurrence no longer hides the pair: rename the scenario." Measured: no workspace
package lists eess-gherkin in `dependencies` (eess-crossvalidate has it as a peer), so
`release/break-names-dependents` names nobody.

### Dogfood: this repository's record numbers

`scripts/check-corpus.mjs` gains one rule over `work/**`, with a per-check count line like its
other checks:

```js
// scripts/check-corpus.mjs (.mjs, so fenced as js)
const recordNumber = (d) => /(?:^|\/)(\d{3,4})-[^/]*(?:\/README)?\.md$/.exec(d.relPath)?.[1] ?? ''

const records = docs(c)
  .that()
  .resideInFolder('work/**')
  .and()
  .satisfy({ description: 'are numbered records', test: (d) => recordNumber(d) !== '' })

records
  .should()
  .beUniqueBy(recordNumber, 'record number')
  .rule({ id: 'corpus/record-number-unique' })
// prints: "record numbers  N values across N documents · ✓ no number claimed twice"
```

- The key reads the digits as written, so `066` and `0066` stay distinct: the corpus's own rule,
  one sequence per number width (`/plan`, step 2).
- Directory-form records (`work/spikes/0001-eess-over-ts-archunit/README.md`) are keyed by their
  folder, so they are in the denominator (testing, 0456-I3). Measured 2026-10-18 with
  `git ls-files` on main: 409 numbered record files and 1 directory-form record, no number
  claimed twice, so the rule lands green.
- The key cannot throw: the predicate guarantees a match, and the key falls back to `''`
  (architect M8). A hand-built predicate is fine here: `scripts/` is not under plan 0458's gate.
- The rule is not filtered by `isProbeArtifact` (`scripts/check-corpus.mjs:517`), or its
  non-vacuity probe would be invisible to it.
- `check:numbers` stays. It is the kit's script; this is the dialect's own statement of the same
  judgement, which 017's condition asks for. Double-gating is deliberate; if the two disagree, that
  is a finding about one of them.

## Phases

All in one pull request.

### Phase 1: the kernel

- `packages/core/src/unique-by.ts`; export `uniqueByCondition` and `UniqueByOptions` from
  `internal.ts`.

### Phase 2: eess-md

- `DocsRuleBuilder.beUniqueBy(key, what)`.
- `packages/md/README.md`: a uniqueness example, compiled by `check:docs-code`.
- The example under plan 0458's gate, `examples/md/unique-slugs.test.ts`: "no two pages under
  `guides/` share a slug", with a clean and a violating fixture.

### Phase 3: eess-gherkin

- Rebuild `haveUniqueTitles` on `uniqueByCondition`; `scenarioViolation` replaces the inline
  spread.
- Update `packages/gherkin/tests/builder.test.ts` and `waiver-in-doc-string.test.ts`.

### Phase 4: dogfood

- `corpus/record-number-unique` in `scripts/check-corpus.mjs`, with its count line.
- Its non-vacuity row (Test inventory).

## Files changed

| file                                          | change                                        |
| --------------------------------------------- | --------------------------------------------- |
| `packages/core/src/unique-by.ts`              | new                                           |
| `packages/core/src/internal.ts`               | export `uniqueByCondition`, `UniqueByOptions` |
| `packages/core/tests/unique-by.test.ts`       | new                                           |
| `packages/md/src/builders/docs.ts`            | `beUniqueBy()`                                |
| `packages/md/tests/docs-unique-by.test.ts`    | new                                           |
| `packages/md/README.md`                       | one example                                   |
| `examples/md/unique-slugs.test.ts` + fixtures | new (plan 0458's gate)                        |
| `packages/gherkin/src/builder.ts`             | `haveUniqueTitles` on `uniqueByCondition`     |
| `packages/gherkin/tests/*.test.ts`            | new count, message and rows                   |
| `scripts/check-corpus.mjs`                    | `corpus/record-number-unique`, count line     |
| `scripts/check-nonvacuity.mjs`                | one `gateCorpusProbe` row                     |
| `.changeset/*.md`                             | kernel minor, md minor, gherkin minor (break) |

## Test inventory

Every test drives the public entry point and the terminal (`.violations()`/`.check()`).

**Kernel** (`unique-by.test.ts`), through a minimal `RuleBuilder` subclass:

- a group of three gives three findings, each naming the other two by `relPath:line`;
- two distinct groups are reported separately;
- all-distinct keys are green;
- exact keys: `'066'`/`'0066'` distinct; `'A'`/`'a'` distinct; `'7'`/`'7 '` distinct (testing,
  0456-I2);
- one element is green, with `examined` 1;
- zero elements is the kernel's zero-examined finding, asserted by its message prefix and
  `bypassFilters`, not by a count (testing, 0456-M2);
- a throwing key propagates;
- `why` is appended when given and absent when not;
- the condition is frozen (assigning `evaluate` throws).

**eess-md** (`docs-unique-by.test.ts`), over `corpus()` on a fixture directory: a duplicate names
both documents by `relPath`; distinct values are green.

**eess-gherkin**:

- a duplicate pair in one feature file gives two findings, each at its own line;
- the same title in two different feature files is green (pins the per-file key; testing,
  0456-I5);
- `waiver-in-doc-string.test.ts` keeps its original point: a waiver inside a doc string does not
  suppress, asserted on the line of the member it targets.

**Sabotage rows**, run in a worktree. Each must turn its named test red:

1. `uniqueByCondition` returns `[]`: the duplicate test reds.
2. It reports only `group[1..]`: the three-member test reds.
3. It lowercases keys: the `'A'`/`'a'` test reds.
4. It trims keys: the `'7'`/`'7 '` test reds.
5. gherkin's key drops `relPath`: the two-files test reds.
6. `recordNumber` returns the same value for every record: `check:corpus` reds on this repository.

**Non-vacuity**: one row in `scripts/check-nonvacuity.mjs` through `gateCorpusProbe`
(`scripts/check-nonvacuity.mjs:1260`), which runs the real `scripts/check-corpus.mjs` in json and
terminal modes. The probe is `work/__nonvacuity_probe_dup__/0001-dup.md`, which reuses an
existing number; the row requires exit 1 in both modes and `firedOn` the rule id and the probe's
path (enforcement I2, testing 0456-I3).

## Release

- `@nielspeter/eess`: minor (new `/internal` export).
- `@nielspeter/eess-md`: minor (`docs().beUniqueBy()`).
- `@nielspeter/eess-gherkin`: minor, marked **Breaking (@nielspeter/eess-gherkin)**, with the
  migration line above. No package names it in `dependencies`.

## Out of scope

- `beUniqueBy` on md builders other than `docs()`; a value-level form waits for block 1.
- Normalising keys in the kernel (block 1's normaliser).
- Retiring `check:numbers`.

## Review response — 2026-10-18

These findings were made against plan 0456 before the split; they apply here.

- **method B2** (0456 too big): split into this plan.
- **method B3** (gherkin break settled in a Draft): put to the maintainer, accepted 2026-10-18.
- **product I5** (no migration line; the waived-second-occurrence change missing): both added.
- **enforcement I2 / testing 0456-I3** (dogfood probe unnamed, must drive the real gate, directory
  records): `gateCorpusProbe` on the real script, both modes; directory-form records keyed.
- **enforcement I3** (denominator not printed): the rule prints its count line.
- **enforcement M1** (`066`/`0066` reads as compliance): stated as a narrowing.
- **enforcement M3 / product minor** (gherkin drops its reason): carried as `why`.
- **enforcement M4 / testing 0456-M3** (absolute paths in messages): `relPath`.
- **testing 0456-I2** (case-only row missing): case and whitespace pairs, with sabotage rows.
- **testing 0456-I5** (gherkin key and waiver rows): added.
- **testing 0456-M1, M2** (freeze row decoration; zero-elements assertion): the freeze is one test
  with no sabotage row claiming more; zero elements asserts the finding.
- **product minor** (`label` means something else in md): renamed `what`.
- **architect I4 / product I2** (root name collision): `uniqueByCondition` behind `/internal`,
  by the same rule as 0456.
- **architect M5** (fourth copy of the violation spread): gherkin gets `scenarioViolation`; the
  kernel builds no violation.
- **architect M8 / method minor** (a key that throws; `ts` fence on `.mjs`): a non-throwing key;
  fenced `js`.

## Progress ledger

- [ ] Phase 1: `uniqueByCondition` with its kernel tests
- [ ] Phase 2: `docs().beUniqueBy()`, README, the example
- [ ] Phase 3: gherkin rebuilt, break declared with its migration line
- [ ] Phase 4: `corpus/record-number-unique` with its count line and non-vacuity row
- [ ] Sabotage rows 1–6, each red on its named test; durations reported
- [ ] `check:family`, `check:release`, `check:docs-code`, `check:examples` and `npm run validate`
      green; durations reported
- [ ] Close: this plan → `completed/`; proposal 017's block-13 row; boards

Deferred: none
