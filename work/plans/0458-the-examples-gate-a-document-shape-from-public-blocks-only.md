# Plan 0458: the examples gate — a document's shape, from public blocks only

## Status

- **State:** Draft — written 2026-10-17 from proposal 017's second Review, decision 3, and the
  maintainer's acceptance of blocks 6, 7, 12, 13 and 17 (each adds its example under this gate).
- **Implements:** proposal 017
- **Priority:** Medium. It builds first, before plans 0454 (block 17), 0455 (block 7), 0456 (blocks
  6 and 13) and 0457 (block 12). 017 holds the examples "with the first block that ships", and this
  plan is the gate those four add to, so none of them has to grow during its build to create it.
- **Effort:** Small — two arch rules over one new folder, one seed example with two fixtures, one
  non-vacuity row, a docs section. No package source changes.
- **Created:** 2026-10-17

## Problem

Proposal 017's principle is that eess-md fixes no document's shape: a plan, a bug or a wiki page is
something a caller builds out of the blocks. Its second Review, decision 3, says how that claim is
held: worked examples, "built from public blocks only", in `examples/`, under an arch rule that
"forbids constructing any predicate or condition (`defineCondition`, `definePredicate`, or a literal
with `test` or `evaluate`) and importing `@nielspeter/eess/internal`". Each example has a clean
fixture and a violating fixture per judgement it states, and is registered in `check:nonvacuity`.
"This makes the completeness test a gate rather than a claim." Nothing like it exists. Measured
2026-10-17:

- `examples/` holds 10 test files, 1,486 lines. `check:examples` (`package.json:17`) type-checks the
  top-level `*.test.ts` (`examples/tsconfig.json`, `"include": ["*.test.ts"]`) and executes only
  `cross-dialect.*.test.ts` and `public-surface.test.ts` (`examples/vitest.config.ts:16`). It runs in
  `validate` and in CI (`.github/workflows/ci.yml:89`). Locally it takes 1.9 s.
- No example uses eess-md's document builders. The four cross-dialect examples drive
  eess-crossvalidate presets.
- No arch rule reads `examples/`: `arch.rules.ts:15` builds its workspace from the six packages'
  `tsconfig.build.json` only.
- One example constructs predicates and conditions, on purpose: `examples/custom-rules.test.ts`
  makes 2 `definePredicate` and 3 `defineCondition` calls (lines 27, 33, 64, 87, 113). It is the
  template for writing a custom rule, which is exactly what a document-shape example must not do. So
  the rule cannot cover all of `examples/` without excluding the one file that exists to break it.
- `check:nonvacuity` registers `check:examples` against one row, `examples/does-not-compile`
  (`scripts/check-nonvacuity.mjs:3941`), which proves the type-check can fail, not that any
  example's violating fixture is load-bearing.

## Design

**One folder, all of it under the rule.** Document-shape examples live in `examples/md/`. The rule
covers that folder whole, with no exclusions; the rest of `examples/` is untouched. A folder rather
than "all of `examples/` minus `custom-rules.test.ts`" because an exclusion list is a second
vocabulary to keep in step, and because the claim being gated, "built from public blocks only", is
about eess-md's blocks, which is what the folder holds.

**The contract an example meets**, which plans 0454, 0455, 0456 and 0457 follow:

- `examples/md/<name>.test.ts`, one judgement or a few related ones, built from `@nielspeter/eess-md`'s
  root and nothing else from the family.
- `examples/md/fixtures/<name>/clean/` and `examples/md/fixtures/<name>/violating/`, each non-empty.
  An example on a text corpus (plan 0455's `corpusFromText`) keeps its documents as files in the same
  two folders and reads them in, so every example is sabotaged the same way.
- In the test: the clean fixture gives no violation and examines more than zero elements; the
  violating fixture gives at least one violation whose message the test matches. The cross-dialect
  examples already have this shape (`examples/cross-dialect.md-gherkin.test.ts:28-37`).

**Rule 1, `eess/examples-md-public-blocks-only`** (in `arch.rules.ts`): the modules under
`examples/md/` import only from `@nielspeter/eess-md`, `vitest`, `node:*` and each other.

```ts
const ex = project('examples/tsconfig.json')

modules(ex)
  .that()
  .resideInFolder('**/examples/md/**')
  .should()
  .onlyImportFrom('@nielspeter/eess-md', 'vitest', 'node:*', '**/examples/md/**')
  .rule({
    id: 'eess/examples-md-public-blocks-only',
    because:
      'a document-shape example proves the blocks are enough (proposal 017, decision 3); ' +
      'a kernel, dialect-internal or deep import is a block eess-md does not offer',
  })
```

An allowlist rather than a denylist of `/internal`: it shuts out `@nielspeter/eess/internal`,
`@nielspeter/eess-md/internal`, and the kernel root, which is where `definePredicate` and
`defineCondition` live. eess-md's root does not re-export either (`packages/md/src/index.ts:25-49`
re-exports `not`, `RuleBuilder`, `finishPreset` and the reporting seams, not the `define*`
constructors), so the allowlist alone keeps both out of reach. `onlyImportFrom` matches a bare
specifier as well as the resolved path (`packages/ts/src/core/import-candidates.ts:137`), so
`@nielspeter/eess-md` names the root exactly and `@nielspeter/eess-md/internal` does not match it.
That reading is proven by a sabotage row, not assumed.

**Rule 2, `eess/examples-md-no-hand-built-rules`**: structural typing means a `Predicate` or
`Condition` (`packages/core/src/predicate.ts:7`, `packages/core/src/condition.ts:77`) can be built as
a plain object without any import. The rule reports an object literal with a member named `test` or
`evaluate`, and any class declaration or class expression (which also covers extending the
re-exported `RuleBuilder`). Same mechanism as `langTagComparison` (`arch.rules.ts:34`): an
`ExpressionMatcher` read by node kind name, through `notContain`.

```ts
const handBuiltRule: ExpressionMatcher = {
  description:
    'a hand-built predicate, condition or builder (an object with `test`/`evaluate`, or a class)',
  matches(node) {
    const kind = node.getKindName()
    if (kind === 'ClassDeclaration' || kind === 'ClassExpression') return true
    if (kind !== 'ObjectLiteralExpression') return false
    return node
      .getChildren()
      .flatMap((c) => c.getChildren())
      .some(
        (m) =>
          /^(test|evaluate)\b/.test(m.getText()) &&
          ['PropertyAssignment', 'MethodDeclaration', 'ShorthandPropertyAssignment'].includes(
            m.getKindName(),
          ),
      )
  },
}
```

The boundary, stated so review can move it: a callback a public block takes (for example
`haveTableRowsSatisfying(fn)`) is the caller's logic inside a block and is allowed; an object that
is itself a predicate or condition is not.

**Neither rule can be green on an empty folder.** Both select modules under `examples/md/`; with no
module there they examine nothing, which is ADR-010's finding. So this plan ships one example, which
also gives the four later plans a template to copy.

**The seed example**, `examples/md/a-page-has-a-required-section.test.ts`: "every page under
`guides/` has a `Prerequisites` section", one rule in the caller's words.

```ts
import { corpus, docs } from '@nielspeter/eess-md'
import { describe, expect, it } from 'vitest'

const rule = (cwd: string) =>
  docs(corpus({ cwd, roots: ['**/*.md'] }))
    .that()
    .resideInFolder('guides/**')
    .should()
    .haveSection('Prerequisites')
    .because('a guide states what it assumes')

describe('a page has a required section', () => {
  it('clean: every guide has the section', () => {
    const v = rule(fixture('clean')).violations()
    expect(v).toHaveLength(0)
    expect(v.examined).toBeGreaterThan(0)
  })
  it('violating: a guide without the section is reported', () => {
    expect(rule(fixture('violating')).violations()[0]?.message).toMatch(/Prerequisites/)
  })
})
```

The exact `corpus()` options, the `examined` accessor and the message are read from the code at
build time; the sketch names the shape.

**`check:examples` runs it.** `examples/tsconfig.json` adds `md/**/*.test.ts` to `include`, and
`examples/vitest.config.ts` adds it to `include`. Bug 0222's open scope question for the five unrun
templates is untouched.

**Non-vacuity, three rows.**

- `arch/examples-md-public-blocks-only` and `arch/examples-md-no-hand-built-rules`: probe files
  under `examples/md/` (named `__nonvacuity_probe_*`, so `.gitignore` and `check:integrity` already
  recognise a leftover), one per spelling. Each must red with its rule id on the probe, and a quiet
  probe using only `docs()` must stay green. The same shape as `gateArchOneTagComparison`
  (`scripts/check-nonvacuity.mjs`).
- `examples/md-violating-fixture-is-load-bearing`: for every `examples/md/<name>.test.ts`, a
  missing or empty `fixtures/<name>/clean` or `violating` folder is a finding; then, per example, the
  violating fixture is replaced by the clean one under `withProbe` and that one test file is run, and
  it must fail. An example whose violating fixture can be swapped for its clean one and stay green
  proves nothing. The row prints the number of examples it swapped, so an empty folder cannot pass it.

**What is not mechanised.** "A violating fixture per _judgement_" is not: the gate sees example files
and fixture folders, not how many judgements a test states. One example with three judgements and
one violating folder passes the gate. That stays with review, and the plan says so rather than
claiming it.

**The documentation example.** `docs/markdown.md` gains "A document's shape, built from blocks", with
the seed example inline (its fence is compiled by `check:docs-code`) and a link to `examples/md/`;
`packages/md/README.md` links that section, since npm ships neither `examples/` nor `docs/`.

**Release.** No package source changes. `packages/md/README.md` is under `packages/md/`, so
`check:release` needs a declaration: one changeset, `'@nielspeter/eess-md': none`.

## Phases

**Phase 1: the folder and the seed example.** `examples/md/`, the seed example and its two fixture
folders; the two `include` lines. `npm run check:examples` runs it, green.

**Phase 2: the two arch rules.** `arch.rules.ts` gains `project('examples/tsconfig.json')`, the
matcher and both rules. `npm run check:arch` prints its rule count up by two and stays green.

**Phase 3: non-vacuity.** The three rows in `scripts/check-nonvacuity.mjs`, with `GATE_FOR['check:arch']`
and `GATE_FOR['check:examples']` extended. Run the three rows by name, not the whole harness.

**Phase 4: docs.** The `docs/markdown.md` section, the README link, `examples/README.md`'s table, the
changeset.

## Files Changed

| file                                                    | change                                       |
| ------------------------------------------------------- | -------------------------------------------- |
| `examples/md/a-page-has-a-required-section.test.ts`     | new                                          |
| `examples/md/fixtures/a-page-has-a-required-section/**` | new: `clean/` and `violating/`               |
| `examples/tsconfig.json`, `examples/vitest.config.ts`   | include `md/**/*.test.ts`                    |
| `arch.rules.ts`                                         | the examples project, the matcher, two rules |
| `scripts/check-nonvacuity.mjs`                          | three rows; `GATE_FOR` for arch and examples |
| `docs/markdown.md`                                      | "A document's shape, built from blocks"      |
| `packages/md/README.md`                                 | a link to that section                       |
| `examples/README.md`                                    | a third kind of example, and its contract    |
| `.changeset/*.md`                                       | `'@nielspeter/eess-md': none`                |

## Test inventory

| row                                                                    | what it proves                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------------- |
| seed example, clean                                                    | no violation, examined > 0                              |
| seed example, violating                                                | the missing section is reported, message matched        |
| sabotage: an example imports `definePredicate` from `@nielspeter/eess` | `eess/examples-md-public-blocks-only` reds on the probe |
| sabotage: an example imports `@nielspeter/eess/internal`               | the same rule reds                                      |
| sabotage: an example imports `@nielspeter/eess-md/internal`            | the same rule reds (the allowlist is exact)             |
| sabotage: an object literal `{ description, test }`                    | `eess/examples-md-no-hand-built-rules` reds             |
| sabotage: an object literal with `evaluate`                            | the same rule reds                                      |
| sabotage: a class extending `RuleBuilder`                              | the same rule reds                                      |
| quiet: a probe using only `docs()` and `corpus()`                      | both rules stay quiet                                   |
| sabotage: the violating fixture replaced by the clean one              | the example's test fails                                |
| sabotage: an example with no `violating/` folder                       | the load-bearing row reports it by name                 |
| sabotage: `examples/md/` emptied                                       | both arch rules report examining nothing (ADR-010)      |

## Out of scope

- **`honestyAtClose` rebuilt from public blocks**, decision 3's closing proof. It needs blocks 1, 2
  and 5 and the ADR extending ADR-006 (017, second Review decision 1), none of which is plannable yet
  (017, "Not yet"). Deferred to proposal 017, where those blocks are held.
- **The `rules/*` presets' rebuild and the arch rule that they import only the md root** (decision
  1): that ADR's work.
- **The five unrun template examples and `custom-rules.test.ts`**: bug 0222's scope; this plan adds a
  folder beside them and changes none.
- **Each block's own example**: plans 0454, 0455, 0456 and 0457 add theirs under this contract.

## Progress ledger

- [ ] Phase 1: `examples/md/`, the seed example and its fixtures; `check:examples` runs it
- [ ] Phase 2: the two arch rules, green on the seed example
- [ ] Phase 3: the three non-vacuity rows, each red on its sabotage and quiet on its quiet probe
- [ ] Phase 4: docs section, README link, `examples/README.md`, changeset
- [ ] Cost measured: `check:arch` and `check:examples` time before and after
- [ ] `deferred→proposal 017` `honestyAtClose` rebuilt from public blocks, decision 3's closing
      proof (needs blocks 1, 2 and 5, and the ADR in the second Review's decision 1; no plan yet)

Deferred: proposal 017
