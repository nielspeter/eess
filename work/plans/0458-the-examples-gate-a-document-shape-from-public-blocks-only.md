# Plan 0458: the examples gate — a document's shape, from public blocks only

## Status

- **State:** Draft — written 2026-10-17 from proposal 017's second Review, decision 3; reworked
  2026-10-18 after PR #235's five reviews (see "Review response").
- **Implements:** proposal 017
- **Priority:** Medium. It builds first. The build order, decided by the maintainer on 2026-10-18,
  is 0458 → 0456 → 0454 → 0457 → 0455 → 0459. Each block plan adds its example under this gate,
  so none of them has to create the gate during its own build.
- **Builds after:** nothing.
- **Effort:** Small to medium. It adds:
  - three arch rules over one new folder;
  - a fixture helper;
  - one seed example with two fixtures;
  - one non-vacuity row that discovers every example and swaps its fixtures both ways;
  - a docs section.

  No package source changes.

- **Created:** 2026-10-17

## Problem

Proposal 017's principle is that eess-md fixes no document's shape: a plan, a bug or a wiki page is
something a caller builds out of the blocks. Its second Review, decision 3, says how that claim is
held:

- worked examples, "built from public blocks only", in `examples/`;
- under an arch rule that "forbids constructing any predicate or condition (`defineCondition`,
  `definePredicate`, or a literal with `test` or `evaluate`) and importing
  `@nielspeter/eess/internal`";
- each example has a clean fixture and a violating fixture per judgement it states, and is
  registered in `check:nonvacuity`.

"This makes the completeness test a gate rather than a claim." Nothing like it exists. Measured
2026-10-17 and 2026-10-18:

- **What `examples/` holds and runs.**
  - 10 top-level test files, 1,468 lines (`wc -l examples/*.test.ts`).
  - `check:examples` (`package.json:17`) type-checks the top-level `*.test.ts`
    (`examples/tsconfig.json`, `"include": ["*.test.ts"]`), but executes only
    `cross-dialect.*.test.ts` and `public-surface.test.ts` (`examples/vitest.config.ts:16`).
  - It runs in `validate` and in CI (`.github/workflows/ci.yml:89`). Locally it took 1.9 s on
    2026-10-17, measured in the main checkout (the worktree has no `node_modules`).
- **No example uses eess-md's document builders.** The four cross-dialect examples drive
  eess-crossvalidate presets.
- **No arch rule reads `examples/`.** `arch.rules.ts:15` builds its workspace from the six
  packages' `tsconfig.build.json` only.
- **One example builds predicates and conditions on purpose.** `examples/custom-rules.test.ts`
  makes 2 `definePredicate` and 3 `defineCondition` calls (lines 27, 33, 64, 87, 113). It is the
  template for writing a custom rule, which is exactly what a document-shape example must not do,
  so a rule over all of `examples/` would have to exclude the one file that exists to break it.
- **Nothing proves an example's violating fixture matters.** `check:nonvacuity` registers
  `check:examples` against one row, `examples/does-not-compile`
  (`scripts/check-nonvacuity.mjs:3941`), which proves only that the type-check can fail.

## Design

### One folder, all of it under the rules

Document-shape examples live in `examples/md/`, and the rules cover that folder whole, with no
exclusions. The rest of `examples/` is untouched. Two reasons for a folder rather than "all of
`examples/` minus `custom-rules.test.ts`":

- an exclusion list is a second vocabulary to keep in step;
- the claim being gated, "built from public blocks only", is about eess-md's blocks, which is what
  the folder holds.

### The contract an example meets

Plans 0456, 0454, 0457, 0455 and 0459 follow it.

- **The file.** `examples/md/<name>.test.ts` states one judgement or a few related ones. It is built
  from `@nielspeter/eess-md`'s root and nothing else from the family (rule 1).
- **The fixtures.** `examples/md/fixtures/<name>/clean/` and `examples/md/fixtures/<name>/violating/`,
  each non-empty, read through the shared helper `examples/md/fixture.ts`:
  `fixture(name, 'clean' | 'violating')`. An example on a text corpus (plan 0455's
  `corpusFromText`) keeps its documents as files in the same two folders and reads them in through
  the helper, so every example is swapped the same way.
- **The tests.**
  - The clean test is titled `clean: …`. It asserts zero violations and `examined > 0`.
  - The violating test is titled `violating: …`. It asserts the finding's identity: its `file` is
    the violating document, its message is exact, and it is not a configuration finding
    (`bypassFilters` unset).
  - The swap row identifies the two tests by those title prefixes.
- **No per-example row.** Registration in `check:nonvacuity` is this plan's one discovering row, so a
  block plan adds an example and its fixture pair and nothing to the harness. That is this plan's
  reading of decision 3's "registered in `check:nonvacuity`", stated here as a reading.
- **Exports.** A block plan exports any predicate, combinator or condition its own example needs, in
  that same plan. Nothing an example needs may arrive in a later plan.
- **Missing blocks.** An example that cannot be written from public blocks records a missing block
  (proposal 017's completeness rule). Widening the gate is not the answer.
- **Presets are not blocks.** The `rules/*` presets (`@nielspeter/eess-md/rules/ledger`,
  `/rules/adr`) are not blocks, and rule 1 refuses them on purpose. Decision 3's closing proof is
  `honestyAtClose` rebuilt from the root, so an example built on the preset would prove nothing
  about the blocks.

### Rule 1, `eess/examples-md-public-blocks-only` (in `arch.rules.ts`)

The modules under `examples/md/` import only from `@nielspeter/eess-md`, `vitest`, `node:**` and
each other.

```ts
const ex = project('examples/tsconfig.json')

modules(ex)
  .that()
  .resideInFolder('**/examples/md/**')
  .should()
  .onlyImportFrom('@nielspeter/eess-md', 'vitest', 'node:**', '**/examples/md/**')
  .rule({
    id: 'eess/examples-md-public-blocks-only',
    because:
      'a document-shape example proves the blocks are enough (proposal 017, decision 3); ' +
      'a kernel, dialect-internal, subpath or package-source import is a block eess-md does not offer',
  })
```

It is an allowlist, not a denylist. It shuts out:

- `@nielspeter/eess/internal` and `@nielspeter/eess-md/internal`;
- the `rules/*` subpaths;
- the kernel root;
- a relative import into `packages/*/src`.

`node:**` rather than `node:*`, because picomatch's `*` stops at `/` and would red
`node:fs/promises`.

`onlyImportFrom` matches a bare specifier as well as the resolved path (`candidatesFor`,
`packages/ts/src/core/import-candidates.ts:60-81`). So `@nielspeter/eess-md` names the root
exactly, and `@nielspeter/eess-md/internal` does not match it. A sabotage row proves that reading
rather than assuming it.

Two things a later plan would change:

- **eess-md re-exporting `define*`.** The allowlist stops being the reason `define*` is out of reach
  the day eess-md's root re-exports either one, which `check:family` would force once any md source
  imports it. Rule 3 bans them by name, so the ban does not depend on md's import graph.
- **The outward-binding example.** 017's completeness criterion includes an example that binds
  documents outward (a value naming code joined to eess-ts). Rule 1 refuses it today. When that
  example is planned, rule 1 widens to the sibling dialect roots, and rule 3 already holds the
  `define*` ban that eess-ts's root (`packages/ts/src/index.ts:48`) would otherwise let through.
  Recorded under Out of scope with its home.

### Rule 2, `eess/examples-md-no-hand-built-rules`

Structural typing means a `Predicate` or `Condition` (`packages/core/src/predicate.ts:7`,
`packages/core/src/condition.ts:77`) can be built as a plain object without any import. The rule
reports any of the following in `examples/md/`:

- **An object member named `test` or `evaluate`, read from its name node, not its source text.** The
  member is any of:
  - a `PropertyAssignment`;
  - a `ShorthandPropertyAssignment`;
  - a `MethodDeclaration`;
  - a `GetAccessor`;
  - a `SetAccessor`.

  Its name may be:
  - an `Identifier`;
  - a `StringLiteral`;
  - a `NoSubstitutionTemplateLiteral`;
  - a `ComputedPropertyName` around one of those.

  Quotes, backticks and brackets are stripped before the name is compared. So `{ 'test': f }`,
  `{ ["evaluate"]: f }` and `{ get test() {…} }` are all caught.

- **An assignment to a member named `test` or `evaluate`**: `p.test = …` and `p['evaluate'] = …`.
- **Any class declaration or class expression.** That also covers extending the re-exported
  `RuleBuilder`. An example composes blocks, and a class adds nothing a block call cannot express.
  This is decided here, and review may narrow it to classes with those members.
- **Any dynamic `import()`.** No example needs one, and whether `onlyImportFrom` reads dynamic edges
  is not pinned (`packages/ts/src/conditions/dependency.ts:47` excludes `dynamic` from another
  condition). Banning it outright removes the question.

The matcher reads nodes by kind name, as `langTagComparison` does (`arch.rules.ts:41`), because the
repository root does not depend on ts-morph.

```ts
const NAME_KINDS = new Set([
  'PropertyAssignment',
  'ShorthandPropertyAssignment',
  'MethodDeclaration',
  'GetAccessor',
  'SetAccessor',
])
const RULE_MEMBER = /^(test|evaluate)$/

/** A member's name as written, quotes, backticks and computed brackets stripped. */
function memberName(member: Node): string {
  const nameNode = member.getChildren()[0]
  const raw =
    nameNode?.getKindName() === 'ComputedPropertyName'
      ? (nameNode.getChildren()[1]?.getText() ?? '')
      : (nameNode?.getText() ?? '')
  return raw.replace(/^['"`]|['"`]$/g, '')
}

const handBuiltRule: ExpressionMatcher = {
  description:
    'a hand-built predicate, condition or builder (a `test`/`evaluate` member, a class, or a dynamic import)',
  matches(node) {
    const kind = node.getKindName()
    if (kind === 'ClassDeclaration' || kind === 'ClassExpression') return true
    if (kind === 'CallExpression') return node.getChildren()[0]?.getKindName() === 'ImportKeyword'
    if (NAME_KINDS.has(kind)) return RULE_MEMBER.test(memberName(node))
    if (kind === 'BinaryExpression') {
      const [left, op] = node.getChildren()
      return (
        op?.getText() === '=' &&
        /(\.(test|evaluate)|\[['"`](test|evaluate)['"`]\])$/.test(left?.getText() ?? '')
      )
    }
    return false
  },
}
```

The exact child positions are read from the AST at build time; the sketch names the shape. A
`MethodDeclaration` inside a class is already reported as a class.

The boundary, stated so review can move it: a callback that a public block takes (for example
`haveTableRowsSatisfying(fn)`) is the caller's logic inside a block, and is allowed. An object that
is itself a predicate or condition is not.

### Rule 3, `eess/examples-md-no-rule-constructors`

Any identifier `definePredicate`, `defineCondition` or `createRequire` in `examples/md/` is reported,
whatever its import. This is decision 3's ban by name. It holds even if eess-md's root one day
re-exports the two constructors, and it holds after rule 1 widens. `createRequire` is on the list
because it would load a module rule 1 cannot see.

### What the rules do not catch

Tier 1 catches the common spellings; completeness is held by review, and the gate says so rather
than claiming it. The known evasions are:

- a predicate assembled through `Object.fromEntries`, `Object.assign`, `Object.defineProperty`,
  `Reflect.set`, or a key built by string concatenation;
- a "violating fixture per judgement". The gate sees example files and fixture folders, not how many
  judgements a test states, so one example with three judgements and one violating folder passes it.

### Neither rule can be green on an empty folder

All three rules select modules under `examples/md/`. With no module there they examine nothing,
which is ADR-010's finding; none of them is cardinality-shaped. So this plan ships one example,
which also gives the later plans a template to copy.

### The seed example

`examples/md/a-page-has-a-required-section.test.ts`: "every page under `guides/` has a
`Prerequisites` section", one rule in the caller's words. It uses only `docs()` builder methods that
exist on the md root today (`resideInFolder`, `haveSection`, `packages/md/src/builders/docs.ts:30`,
`:45`), so it does not depend on any later plan.

```ts
import { corpus, docs } from '@nielspeter/eess-md'
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture.js'

const rule = (cwd: string) =>
  docs(corpus({ cwd, roots: ['**/*.md'] }))
    .that()
    .resideInFolder('guides/**')
    .should()
    .haveSection('Prerequisites')
    .because('a guide states what it assumes')

describe('a page has a required section', () => {
  it('clean: every guide has the section', () => {
    const v = rule(fixture('a-page-has-a-required-section', 'clean')).violations()
    expect(v).toHaveLength(0)
    expect(v.examined).toBeGreaterThan(0)
  })
  it('violating: a guide without the section is reported', () => {
    const v = rule(fixture('a-page-has-a-required-section', 'violating')).violations()
    expect(
      v.map((x) => [x.file.endsWith('guides/install.md'), x.message, x.bypassFilters]),
    ).toEqual([[true, 'missing section "Prerequisites"', undefined]])
  })
})
```

The message is `structure.ts:17`'s (`missing section "${name}"`). The exact `corpus()` options and
the `examined` accessor are read from the code at build time.

### The fixture helper and the swap

`examples/md/fixture.ts` resolves `fixtures/<name>/<kind>`. It honours one test-only environment
variable, `EESS_EXAMPLE_SWAP`:

- `violating=clean` makes a request for the violating fixture return the clean one;
- `clean=violating` does the reverse.

No file is written, moved or deleted, so a killed run leaves nothing behind. That is the hazard
`withProbe`'s `rmSync` (`scripts/check-nonvacuity.mjs:537`) and `withRewrittenFile` (`:613`) would
otherwise carry for a tracked fixture. Rule 1 allows the helper, since it imports only `node:**`.

### `check:examples` runs the folder

`examples/tsconfig.json` adds `md/**/*.test.ts` and `md/**/*.ts` to `include`, and
`examples/vitest.config.ts` adds `md/**/*.test.ts`. Bug 0222's open scope question for the five
unrun templates is untouched.

### Non-vacuity: four rows

- **`arch/examples-md-public-blocks-only`.** Probe files `examples/md/__nonvacuity_probe_*.test.ts`
  (inside the new include, so the project sees them, and a name `.gitignore:27` and
  `check:integrity` already recognise as a leftover). There is one probe per spelling. Each must red
  with this rule's id on the probe's own file, never with a zero-examined finding. This is the same
  discipline as `gateArchOneTagComparison` (`scripts/check-nonvacuity.mjs:744`).
- **`arch/examples-md-no-hand-built-rules`** and **`arch/examples-md-no-rule-constructors`.** The
  same mechanism, one probe per spelling in the inventory. A quiet probe that uses only `docs()` and
  `corpus()` must stay green under all three rules.
- **`examples/md-fixtures-are-load-bearing`.** It runs in this order:
  1. Discover every `examples/md/<name>.test.ts`, the probes excepted.
  2. Fail if there are none.
  3. A missing or empty `clean/` or `violating/` folder is a finding naming the example.
  4. For each example, run that one file with `vitest run --reporter=json`, three times:
     - **unswapped:** both tests pass;
     - **`EESS_EXAMPLE_SWAP=violating=clean`:** the `violating:` test fails and the `clean:` test
       passes;
     - **`EESS_EXAMPLE_SWAP=clean=violating`:** the `clean:` test fails and the `violating:` test
       passes.
  5. Read the outcome per test title from the JSON report, never from the exit code (bug 0109). A
     compile error, a thrown corpus load or a missing path fails the row with what happened, not as
     a pass.
  6. The row requires `swapped === discovered > 0`, prints that denominator, and prints its own
     time, which grows with every example.

### The documentation example

`docs/markdown.md` gains "A document's shape, built from blocks". It shows the seed example inline,
so its fence is compiled by `check:docs-code`, and links to `examples/md/`. `packages/md/README.md`
links that section, since npm ships neither `examples/` nor `docs/`.

### Release

No package source changes. `packages/md/README.md` is under `packages/md/`, so `check:release` needs
a declaration: one changeset, `'@nielspeter/eess-md': none`.

## Phases

**Phase 1: the folder, the helper and the seed example.** This phase adds:

- `examples/md/`;
- `fixture.ts`;
- the seed example and its two fixture folders;
- the `include` lines.

`npm run check:examples` runs the seed example green.

**Phase 2: the three arch rules.** `arch.rules.ts` gains `project('examples/tsconfig.json')`, the
matcher and the three rules. `npm run check:arch` prints its rule count up by three and stays green.

**Phase 3: non-vacuity.** The four rows in `scripts/check-nonvacuity.mjs`, with
`GATE_FOR['check:arch']` and `GATE_FOR['check:examples']` extended. Run the four rows by name, not
the whole harness.

**Phase 4: docs.** This phase adds:

- the `docs/markdown.md` section;
- the README link;
- `examples/README.md`'s table and the contract above;
- the changeset.

## Files Changed

| file                                                    | change                                                  |
| ------------------------------------------------------- | ------------------------------------------------------- |
| `examples/md/fixture.ts`                                | new: `fixture(name, kind)`, honours `EESS_EXAMPLE_SWAP` |
| `examples/md/a-page-has-a-required-section.test.ts`     | new                                                     |
| `examples/md/fixtures/a-page-has-a-required-section/**` | new: `clean/` and `violating/`                          |
| `examples/tsconfig.json`, `examples/vitest.config.ts`   | include `md/**`                                         |
| `arch.rules.ts`                                         | the examples project, the matcher, three rules          |
| `scripts/check-nonvacuity.mjs`                          | four rows; `GATE_FOR` for arch and examples             |
| `docs/markdown.md`                                      | "A document's shape, built from blocks"                 |
| `packages/md/README.md`                                 | a link to that section                                  |
| `examples/README.md`                                    | a third kind of example, and its contract               |
| `.changeset/*.md`                                       | `'@nielspeter/eess-md': none`                           |

## Test inventory

| row                                                                              | what it proves                                                                              |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| seed example, `clean:`                                                           | no violation, examined > 0                                                                  |
| seed example, `violating:`                                                       | exactly one finding: the violating guide, exact message, not a config finding               |
| sabotage: import `definePredicate` from `@nielspeter/eess`                       | rule 1 reds on the probe (and rule 3, by name)                                              |
| sabotage: import `@nielspeter/eess/internal`                                     | rule 1 reds                                                                                 |
| sabotage: import `@nielspeter/eess-md/internal`                                  | rule 1 reds (the allowlist is exact)                                                        |
| sabotage: import `@nielspeter/eess-md/rules/ledger`                              | rule 1 reds (presets are not blocks)                                                        |
| sabotage: relative import of `packages/md/src/model/task-items.js`               | rule 1 reds                                                                                 |
| quiet: import from `node:fs/promises`                                            | rule 1 stays quiet (`node:**`)                                                              |
| sabotage: `{ description, test }`                                                | rule 2 reds                                                                                 |
| sabotage: `{ 'test': f }` (quoted key)                                           | rule 2 reds                                                                                 |
| sabotage: `{ ['evaluate']: f }` (computed key)                                   | rule 2 reds                                                                                 |
| sabotage: `{ get test() { … } }`                                                 | rule 2 reds                                                                                 |
| sabotage: `p.evaluate = …` after construction                                    | rule 2 reds                                                                                 |
| sabotage: a class extending `RuleBuilder`                                        | rule 2 reds                                                                                 |
| sabotage: `await import('@nielspeter/eess/internal')`                            | rule 2 reds (dynamic import)                                                                |
| sabotage: `definePredicate` referenced with no import of it (a global stand-in)  | rule 3 reds, independent of the import graph                                                |
| sabotage: `createRequire`                                                        | rule 3 reds                                                                                 |
| quiet: a probe using only `docs()` and `corpus()`                                | all three rules quiet                                                                       |
| sabotage: `EESS_EXAMPLE_SWAP=violating=clean`                                    | the seed's `violating:` test fails, by title, `clean:` passes                               |
| sabotage: `EESS_EXAMPLE_SWAP=clean=violating`                                    | the seed's `clean:` test fails, by title, `violating:` passes                               |
| sabotage: the seed's violating assertion weakened to `toBeGreaterThanOrEqual(0)` | the forward swap stays green, and the row reds naming the example                           |
| sabotage: an example with no `violating/` folder                                 | the load-bearing row reports it by name                                                     |
| sabotage: an example that does not compile                                       | the load-bearing row reds with the compile error, not as a pass                             |
| sabotage: `examples/md/` holds no example                                        | the three arch rules report examining nothing (ADR-010); the load-bearing row fails on zero |

## Out of scope

- **`honestyAtClose` rebuilt from public blocks**, decision 3's closing proof. It needs blocks 1, 2
  and 5 and the ADR extending ADR-006 (017, second Review decision 1), none of which is plannable
  yet (017, "Not yet"). Deferred to proposal 017, where those blocks are held. Because the proof is
  split off, 017's row for the gate is `Accepted, reshaped`.
- **The outward-binding example** of 017's completeness criterion (a value naming code joined to
  eess-ts). It widens rule 1 to sibling dialect roots when it is planned; rule 3 already makes that
  safe. Deferred to proposal 017, block 10.
- **The `rules/*` presets' rebuild, and the arch rule that they import only the md root**
  (decision 1): that ADR's work.
- **The five unrun template examples and `custom-rules.test.ts`**: bug 0222's scope. This plan adds
  a folder beside them and changes none.
- **Each block's own example**: plans 0456, 0454, 0457, 0455 and 0459 add theirs under this
  contract.

## Review response — 2026-10-18

Each Critical and Important finding from PR #235's reviews, and what changed.

- **Architect I1, Method X1 and X3, Testing (X1), Enforcement I15** (the contract cannot be met in
  the order; who grows the vocabulary; non-vacuity disagreement). The contract now says:
  - each block plan exports what its example needs, in the same plan;
  - an unbuildable example records a missing block;
  - there is one discovering row and no per-example row.

  The maintainer's 2026-10-18 order is stated.

- **Product I1** (the outward-binding example is blocked). Rule 1's widening is stated, rule 3
  makes it safe, and it is deferred to proposal 017, block 10.
- **Product I2** (`rules/*` excluded). This is now a stated decision, with its reason.
- **Enforcement I12, Testing I3, Architect M2, Product M** (the matcher is defeated by quoted or
  computed keys and getters). Names are read from the name node; accessors, assignment after
  construction and dynamic `import()` are added; sabotage rows for each; remaining evasions are
  listed as not mechanised.
- **Enforcement I13** (`define*` held only by md's import graph). Rule 3 bans them by name, with
  their own sabotage row.
- **Enforcement I14, Testing I2** (any failure counts; printing a count is not failing). The row now:
  - reads per-test outcomes from vitest's JSON report;
  - requires `swapped === discovered > 0`;
  - adds the reverse swap.
- **Testing I1, Architect M3** (the swap would delete or mutate a tracked fixture). The fixture
  helper swaps by environment variable, and no file is touched.
- **Testing I4** (relative import into package source). A sabotage row is added.
- **Method C1, P1** (an `Accepted` row whose closing proof is deferred). The row becomes
  `Accepted, reshaped`, recorded in proposal 017 by the coordinator.
- **Minors, grouped:**
  - `node:**` replaces `node:*` (Testing M1);
  - the seed asserts the finding's identity (Testing M2);
  - the swap row's cost is printed (Testing M3);
  - probes are `__nonvacuity_probe_*.test.ts` inside the include and must red with their own rule
    id (Enforcement M15);
  - dynamic import is decided by banning it (Enforcement M14);
  - the project-relative glob is kept pinned by the red rows and the empty-folder row
    (Enforcement M16);
  - corrected: 1,468 lines (not 1,486), `arch.rules.ts:41` (not `:34`), and `candidatesFor` at
    `import-candidates.ts:60-81` (not `:137`) (Method minors).

## Progress ledger

- [ ] Phase 1: `examples/md/`, `fixture.ts`, the seed example and its fixtures; `check:examples` runs it
- [ ] Phase 2: the three arch rules, green on the seed example
- [ ] Phase 3: the four non-vacuity rows, each red on its sabotage and quiet on its quiet probe
- [ ] Phase 4: docs section, README link, `examples/README.md`, changeset
- [ ] Cost measured: `check:arch`, `check:examples` and the load-bearing row, before and after
- [ ] `deferred→proposal 017` `honestyAtClose` rebuilt from public blocks, decision 3's closing
      proof (needs blocks 1, 2 and 5, and the ADR in the second Review's decision 1; no plan yet)
- [ ] `deferred→proposal 017` the outward-binding example and rule 1's widening to sibling dialect
      roots (block 10; no plan yet)

Deferred: proposal 017
