# Plan 0458: the examples gate — a document's shape, from public blocks only

## Status

- **State:** Draft — written 2026-10-17 from proposal 017's second Review, decision 3; reworked
  twice on 2026-10-18 after PR #235's two review rounds (see "Review response").
- **Implements:** proposal 017
- **Priority:** Medium. It builds first. The build order, decided by the maintainer on 2026-10-18,
  is 0458 → 0456 → 0454 → 0457 → 0455 → 0459. Each block plan adds its example under this gate,
  so none of them has to create the gate during its own build.
- **Builds after:** nothing.
- **Effort:** Medium. It adds:
  - four arch rules over one new folder (rule 1 in two halves, rules 2 and 3);
  - a fixture helper;
  - one seed example with a clean fixture and one violating fixture;
  - four non-vacuity rows: three over the arch rules, and one that discovers every example and
    swaps each of its fixtures both ways;
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
  from `@nielspeter/eess-md`'s root and the fixture helper, and nothing else (rule 1).
- **The fixtures: one folder per judgement.** `examples/md/fixtures/<name>/clean/`, plus one
  `examples/md/fixtures/<name>/violating-<judgement>/` per judgement the example states (for example
  `violating-unclaimed/` and `violating-double/` for plan 0456's two block-6 judgements). Each folder
  is non-empty. `<judgement>` is kebab-case. Every folder is read through the shared helper
  `examples/md/fixture.ts`:
  - `fixture(name, kind)` returns the folder's path;
  - `fixtureFiles(name, kind)` returns its files as `{ relPath: text }`, for an example on a text
    corpus (plan 0455's `corpusFromText`).

  `kind` is `'clean'` or `` `violating-${string}` ``. So an example on a text corpus keeps its
  documents as files in the same folders, and every example is swapped the same way.

- **The tests.** Each file has at least one test of each kind.
  - Each `clean: …` test asserts zero violations, and proves its fixture holds a population:
    - **For a positive rule** (one that must find something on every selected element), it asserts
      `examined > 0`.
    - **For a cardinality rule** (`notExist()`), `examined` is the selection's size
      (`packages/core/src/rule-builder.ts:379-381`). A clean fixture selects nothing, so `examined`
      is 0 by construction. The clean test instead proves the population through the same corpus
      selected one step wider: the same builder without the rule's narrowing predicate (or scope),
      read through `.select({ label, identify })` (`core/src/rule-builder.ts:195`), is non-empty. That shows
      the clean fixture holds the elements the narrowing must exclude, so the green is not an empty
      fixture's. For example, plan 0454's clean fixture holds closed records whose boxes are all
      done, and `taskItems(c).select(…)` is non-empty.
  - Each `violating-<judgement>: …` test reads `fixture(name, 'violating-<judgement>')`. It asserts
    the finding's identity: its `file` is the violating document, its message is exact, and it is
    not a configuration finding (`bypassFilters` unset).
  - The swap row matches tests to folders by these title prefixes. A `violating-<judgement>/` folder
    with no test of that prefix, or a test with no folder, is a finding.
- **No per-example row.** Registration in `check:nonvacuity` is this plan's one discovering row, so a
  block plan adds an example and its fixture folders and nothing to the harness. That is this plan's
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

The examples import only from `@nielspeter/eess-md`, `vitest` and each other. Only the fixture
helper may also import Node's own modules, which it needs to resolve and read folders. It is one rule
id over two selections, so an example cannot make its judgement with `node:fs` and a regex and then
`expect` the result without using any block.

```ts
const ex = project('examples/tsconfig.json')
const because =
  'a document-shape example proves the blocks are enough (proposal 017, decision 3); ' +
  'a kernel, dialect-internal, subpath or package-source import is a block eess-md does not offer'

modules(ex)
  .that()
  .resideInFolder('**/examples/md/**')
  .and()
  .not()
  .resideInFile('**/examples/md/fixture.ts')
  .should()
  .onlyImportFrom('@nielspeter/eess-md', 'vitest', '**/examples/md/fixture.ts')
  .rule({ id: 'eess/examples-md-public-blocks-only', because })

modules(ex)
  .that()
  .resideInFile('**/examples/md/fixture.ts')
  .should()
  .onlyImportFrom('node:**')
  .rule({ id: 'eess/examples-md-public-blocks-only', because })
```

The exact negation spelling on eess-ts's `modules()` is read from the code at build time; the sketch
names the two selections.

It is an allowlist, not a denylist. It shuts out:

- `@nielspeter/eess/internal` and `@nielspeter/eess-md/internal`;
- the `rules/*` subpaths;
- the kernel root;
- a relative import into `packages/*/src`;
- `node:*` from any example file.

The helper's `node:**`, rather than `node:*`, is there because picomatch's `*` stops at `/`, so
`node:*` would red `node:fs/promises`. That is picomatch's documented `*` semantics. A quiet row
pins it at build time on main's build, and this plan does not claim to have measured it.

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

  The name node is chosen by kind, never by position. A `get`/`set` keyword, an `async` modifier
  and a generator's `*` all come before the name, so a positional `getChildren()[0]` would read
  them instead. Quotes, backticks and brackets are stripped before the name is compared. So all of
  these are caught:
  - `{ 'test': f }`;
  - `{ ["evaluate"]: f }`;
  - `{ get test() {…} }`;
  - `{ async test() {…} }`;
  - `{ *evaluate() {…} }`.

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
const NAME_NODE_KINDS = new Set([
  'Identifier',
  'StringLiteral',
  'NoSubstitutionTemplateLiteral',
  'ComputedPropertyName',
])
const RULE_MEMBER = /^(test|evaluate)$/

/**
 * A member's name as written, quotes, backticks and computed brackets stripped.
 * The name child is found by KIND: `get`, `set`, `async` and `*` precede it.
 */
function memberName(member: Node): string {
  const nameNode = member.getChildren().find((c) => NAME_NODE_KINDS.has(c.getKindName()))
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

Any of these identifiers anywhere in `examples/md/` is reported, whatever its import. This is
decision 3's ban by name.

- `definePredicate`, `defineCondition`: the rule constructors.
- `createRequire`: it would load a module rule 1 cannot see.
- `collectResult`, `mergeCollectResults`, `finishPreset`, `dispatchRule`: the verdict-assembly
  seams. md's root re-exports them (`packages/md/src/index.ts:25-35`, `:57`, read 2026-10-18), and
  with them an example could build a verdict by hand with no `test`/`evaluate` member at all.

The ban holds even if eess-md's root one day re-exports the two constructors, and it holds after
rule 1 widens.

### What the rules do not catch

Tier 1 catches the common spellings; completeness is held by review, and the gate says so rather
than claiming it. The known evasions are:

- a predicate assembled through `Object.fromEntries`, `Object.assign`, `Object.defineProperty`,
  `Reflect.set`, or a key built by string concatenation;
- a banned name reached under an alias. `import * as md` and then `md['collect' + 'Result']`, for
  instance, never spells the identifier;
- a single `violating-<judgement>:` test that asserts two judgements on one folder. The gate pairs a
  folder with a test, not a test with how many judgements it states.

### No rule can be green on an empty folder

All three rules select modules under `examples/md/`. With no module there, they examine nothing,
which is ADR-010's finding; none of them is cardinality-shaped. `examples/md/fixture.ts` is itself
a module in the folder, so with every example removed the rules still examine one module and stay
green. The empty-folder sabotage row therefore expects the load-bearing row's zero check to red,
not the arch rules. This plan ships one example, which also gives the later plans a template to
copy.

### The seed example

`examples/md/a-page-has-a-required-section.test.ts`: "every page under `guides/` has a
`Prerequisites` section", one rule in the caller's words. It uses only `docs()` builder methods that
exist on the md root today (`resideInFolder`, `haveSection`, `packages/md/src/builders/docs.ts:30`,
`:45`), so it does not depend on any later plan. It is a positive rule, so its clean test asserts
`examined > 0`. It states one judgement, so it has one `violating-missing-section/` folder.

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
  it('violating-missing-section: a guide without the section is reported', () => {
    const v = rule(
      fixture('a-page-has-a-required-section', 'violating-missing-section'),
    ).violations()
    expect(
      v.map((x) => [x.file.endsWith('guides/install.md'), x.message, x.bypassFilters]),
    ).toEqual([[true, 'missing section "Prerequisites"', undefined]])
  })
})
```

The message is `structure.ts:18`'s (`missing section "${name}"`). The `corpus()` options are
`cwd` and the required `roots` (`packages/md/src/corpus.ts:12-37`). The `examined` accessor is read
from the code at build time.

### The fixture helper and the swap

`examples/md/fixture.ts` resolves `fixtures/<name>/<kind>`. It honours one test-only environment
variable, `EESS_EXAMPLE_SWAP=<from>=<to>`, where each side is `clean` or a `violating-<judgement>`
folder:

- `violating-<j>=clean` makes a request for that judgement's fixture return the clean one;
- `clean=violating-<j>` makes a request for the clean fixture return that judgement's fixture.

No file is written, moved or deleted, so a killed run leaves nothing behind. That is the hazard
`withProbe`'s `rmSync` (`scripts/check-nonvacuity.mjs:537`) and `withRewrittenFile` (`:613`) would
otherwise carry for a tracked fixture. The helper is the one module rule 1 lets import `node:**`.

The hook serves this repository's harness. `examples/README.md` says so in one line: outside this
repository, pass the fixture's path yourself, and a copied example needs no helper.

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
  1. Discover every `examples/md/<name>.test.ts`, the probes excepted, and its `violating-*/`
     folders.
  2. Fail if there are no examples.
  3. Each of these is a finding naming the example:
     - a missing or empty `clean/`;
     - no `violating-*/` folder;
     - an empty `violating-*/` folder;
     - a `violating-<j>/` folder with no `violating-<j>:` test;
     - a `violating-<j>:` test with no folder;
     - a file with no `clean:` test.
  4. For each example, run that one file with `vitest run --reporter=json`, `1 + 2N` times for N
     judgements:
     - **unswapped:** every test passes;
     - **for each judgement `j`, `EESS_EXAMPLE_SWAP=violating-<j>=clean`:** every `violating-<j>:`
       test fails, and every other test passes;
     - **for each judgement `j`, `EESS_EXAMPLE_SWAP=clean=violating-<j>`:** at least one `clean:`
       test fails, and every `violating-*:` test passes.

       The cardinality form's population assertion passes under this swap, because the violating
       fixture holds elements too. The zero-violations assertion is what fails.

  5. Read the outcome per test title from the JSON report, never from the exit code (bug 0109). A
     syntax error, a thrown corpus load or a missing path fails the row with what happened, not as
     a pass. vitest strips types and does not type-check, so a type error is caught by
     `check:examples`' `tsc` step, not by this row.
  6. The row requires `swapped === discovered > 0`, where `swapped` counts judgements across all
     examples. It prints that denominator and its own time, which grows with every judgement.

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
- the seed example, with `clean/` and `violating-missing-section/`;
- the `include` lines.

`npm run check:examples` runs the seed example green.

**Phase 2: the arch rules.** `arch.rules.ts` gains:

- `project('examples/tsconfig.json')`;
- the matcher;
- rule 1's two halves;
- rules 2 and 3.

`npm run check:arch` prints its rule count up by four and stays green.

**Phase 3: non-vacuity.** The four rows in `scripts/check-nonvacuity.mjs`, with
`GATE_FOR['check:arch']` and `GATE_FOR['check:examples']` extended. Run the four rows by name, not
the whole harness.

**Phase 4: docs.** This phase adds:

- the `docs/markdown.md` section;
- the README link;
- `examples/README.md`'s table and the contract above;
- the changeset.

## Files Changed

| file                                                    | change                                                                |
| ------------------------------------------------------- | --------------------------------------------------------------------- |
| `examples/md/fixture.ts`                                | new: `fixture` and `fixtureFiles`, honour `EESS_EXAMPLE_SWAP`         |
| `examples/md/a-page-has-a-required-section.test.ts`     | new                                                                   |
| `examples/md/fixtures/a-page-has-a-required-section/**` | new: `clean/` and `violating-missing-section/`                        |
| `examples/tsconfig.json`, `examples/vitest.config.ts`   | include `md/**`                                                       |
| `arch.rules.ts`                                         | the examples project, the matcher, rule 1 (two halves), rules 2 and 3 |
| `scripts/check-nonvacuity.mjs`                          | four rows; `GATE_FOR` for arch and examples                           |
| `docs/markdown.md`                                      | "A document's shape, built from blocks"                               |
| `packages/md/README.md`                                 | a link to that section                                                |
| `examples/README.md`                                    | a third kind of example, and its contract                             |
| `.changeset/*.md`                                       | `'@nielspeter/eess-md': none`                                         |

## Test inventory

| row                                                                                         | what it proves                                                                                                |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| seed example, `clean:`                                                                      | no violation, examined > 0 (a positive rule)                                                                  |
| seed example, `violating-missing-section:`                                                  | exactly one finding: the violating guide, exact message, not a config finding                                 |
| sabotage: an example imports `definePredicate` from `@nielspeter/eess`                      | rule 1 reds on the probe (and rule 3, by name)                                                                |
| sabotage: an example imports `@nielspeter/eess/internal`                                    | rule 1 reds                                                                                                   |
| sabotage: an example imports `@nielspeter/eess-md/internal`                                 | rule 1 reds (the allowlist is exact)                                                                          |
| sabotage: an example imports `@nielspeter/eess-md/rules/ledger`                             | rule 1 reds (presets are not blocks)                                                                          |
| sabotage: relative import of `packages/md/src/model/task-items.js`                          | rule 1 reds                                                                                                   |
| sabotage: an example imports `node:fs`                                                      | rule 1 reds (only the helper may import Node)                                                                 |
| quiet: the helper imports `node:fs/promises`                                                | rule 1's helper half stays quiet (`node:**`)                                                                  |
| sabotage: `{ description, test }`                                                           | rule 2 reds                                                                                                   |
| sabotage: `{ 'test': f }` (quoted key)                                                      | rule 2 reds                                                                                                   |
| sabotage: `{ ['evaluate']: f }` (computed key)                                              | rule 2 reds                                                                                                   |
| sabotage: `{ get test() { … } }`                                                            | rule 2 reds                                                                                                   |
| sabotage: `{ async test() { … } }`                                                          | rule 2 reds (the name child is chosen by kind)                                                                |
| sabotage: `{ *evaluate() { … } }`                                                           | rule 2 reds                                                                                                   |
| sabotage: `p.evaluate = …` after construction                                               | rule 2 reds                                                                                                   |
| sabotage: a class extending `RuleBuilder`                                                   | rule 2 reds                                                                                                   |
| sabotage: `await import('@nielspeter/eess/internal')`                                       | rule 2 reds (dynamic import)                                                                                  |
| sabotage: `definePredicate` referenced with no import of it (a global stand-in)             | rule 3 reds, independent of the import graph                                                                  |
| sabotage: `createRequire`                                                                   | rule 3 reds                                                                                                   |
| sabotage: an example assembles a verdict with `collectResult`                               | rule 3 reds (verdict-assembly seams)                                                                          |
| quiet: a probe using only `docs()` and `corpus()`                                           | all three rules quiet                                                                                         |
| sabotage: `EESS_EXAMPLE_SWAP=violating-missing-section=clean`                               | the seed's `violating-missing-section:` test fails, by title; `clean:` passes                                 |
| sabotage: `EESS_EXAMPLE_SWAP=clean=violating-missing-section`                               | the seed's `clean:` test fails, by title; the violating test passes                                           |
| sabotage: the seed's violating assertion weakened to `toBeGreaterThanOrEqual(0)`            | the `violating-missing-section:` test still passes under the forward swap, so the row reds naming the example |
| sabotage: a probe example with two judgements, one of whose tests reads the other's folder  | that judgement's forward swap leaves its test passing; the row reds naming the judgement                      |
| sabotage: a `notExist()` probe example whose clean fixture holds documents with no elements | its population assertion (the wider `.select()`) fails unswapped; the row reds naming the example             |
| sabotage: a `violating-<j>/` folder with no matching test, and a test with no folder        | the row reports each by name                                                                                  |
| sabotage: an example with no `violating-*/` folder, and one with no `clean:` test           | the row reports each by name                                                                                  |
| sabotage: an example with a syntax error                                                    | the row reds with the error, not as a pass (a type error is `check:examples`' `tsc`)                          |
| sabotage: `examples/md/` holds no example (`fixture.ts` remains)                            | the load-bearing row fails on zero; the arch rules stay green examining `fixture.ts`                          |

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

### Round two

From PR #235's second-round reviews (`review-235-*-r2.md`) and the coordinator's brief 2.

- **Architect I-2, Enforcement I5, Method C1, Testing C1** (a `notExist()` example's clean test
  cannot assert `examined > 0`). The contract has a cardinality form: the clean test proves its
  population through the same corpus selected without the rule's narrowing, which must be non-empty
  (brief 2, decision 5). A sabotage row empties a `notExist()` clean fixture's elements and must red.
- **Enforcement I6, Method I1, Testing C2** (the mechanism knew one violating folder; 0456 has two
  judgements). There is one `violating-<judgement>/` folder per judgement. The helper, the swap
  variable and the discovering row handle N of them, and each file has at least one `clean:` and
  one `violating-*:` test. This also closes the gap the plan previously listed as not mechanised
  (one violating folder for several judgements). What remains is narrower, and is listed.
- **Architect m12, Enforcement m12** (the empty-folder row expected the wrong result). `fixture.ts`
  keeps the rules examining one module; the row now expects the load-bearing row's zero check.
- **Architect m13** (`node:**` and the verdict-assembly seams escape "public blocks"). `node:**` is
  limited to `fixture.ts` (rule 1 in two halves). `collectResult`, `mergeCollectResults`,
  `finishPreset` and `dispatchRule` join rule 3's names. Sabotage rows are added for both.
- **Enforcement m11** (`memberName` read the `get`/`async`/`*` child). The name child is chosen by
  kind, and rows are added for `async test()` and `*evaluate()`.
- **Enforcement m13** ("does not compile"). It is now "a syntax error"; type errors belong to
  `check:examples`' `tsc`.
- **Architect m14, Method m6** (`structure.ts:17`). Now `:18`.
- **Method m1** (numbers disagreed inside the plan). Effort now says four rows and four rule calls,
  and the heading says "No rule". The ROADMAP row's "two arch rules" is the coordinator's board.
- **Product minor 1** (a copied example copies the hook). `examples/README.md` gains the line.
- **Testing M7** (row wording). Reworded.
- **Brief 2, decision 7.** The seed already uses `corpus({ cwd, roots })`. This plan calls no
  predicate's `test` directly, so `matchingElements` does not apply here.
- **Measurement note.** The `node:*` / `node:**` claim is picomatch's documented `*` semantics, not
  measured on main's build in this rework. The quiet row pins it at build time.

## Progress ledger

- [ ] Phase 1: `examples/md/`, `fixture.ts`, the seed example and its fixtures; `check:examples` runs it
- [ ] Phase 2: rule 1 (two halves), rules 2 and 3, green on the seed example
- [ ] Phase 3: the four non-vacuity rows, each red on its sabotage and quiet on its quiet probe
- [ ] Phase 4: docs section, README link, `examples/README.md`, changeset
- [ ] Cost measured: `check:arch`, `check:examples` and the load-bearing row, before and after
- [ ] `deferred→proposal 017` `honestyAtClose` rebuilt from public blocks, decision 3's closing
      proof (needs blocks 1, 2 and 5, and the ADR in the second Review's decision 1; no plan yet)
- [ ] `deferred→proposal 017` the outward-binding example and rule 1's widening to sibling dialect
      roots (block 10; no plan yet)

Deferred: proposal 017
