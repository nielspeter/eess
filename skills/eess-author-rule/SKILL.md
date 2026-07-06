---
name: eess-author-rule
description: Translate an ADR / architecture-decision clause into an enforceable eess mechanism — usually an eess-ts architecture rule (the fluent modules/classes/functions/types DSL) plus the Enforcement-table row (Tier | Mechanism | Status). Use whenever you're making an ADR clause enforceable, filling in or adding an `## Enforcement` / `## Håndhævelse` table, writing an `arch.rules.ts` / `*.rules.ts` rule for a decision, or the user says "make this decision enforceable", "write an eess rule", "gate this ADR", "add enforcement", or asks which tier/mechanism a clause needs. Pair it with eess-validate-faithfulness to check the translation afterward.
user-invocable: true
---

# eess-author-rule

Turn a decision written in English into something the build can enforce. eess
(Executable Enforceable Specification System) works because every ADR clause
names _how_ it's enforced and the mechanism actually runs in CI. Your job is to
pick the right mechanism, write it, and record the Enforcement row honestly.

The hard part is not the DSL — it's **not lying**. A rule that looks like it
enforces the clause but quietly checks nothing (or checks the wrong thing) is
worse than no rule, because it reads as green. Optimize for a rule that fails
loudly the day the code violates the clause, and for an Enforcement row whose
status is the truth.

## Step 1 — classify the clause by tier

A tier says _what kind of fact_ the clause is. It decides the mechanism. Don't
force everything into an eess-ts rule; most business ADRs are Tier 2+.

| Tier | The clause is…                           | Mechanism to reach for                               |
| ---- | ---------------------------------------- | ---------------------------------------------------- |
| 1    | a static fact about source code          | **eess-ts rule** (`.ts`) · a lint rule (`.vue` etc.) |
| 2    | a claim about runtime behavior           | contract / property / integration test               |
| 3    | a property of the running system         | observability, policy-as-code, infra check           |
| 4    | a judgment with no deterministic checker | LLM/human review, cited evidence — flags, soft       |
| 5    | the choice/rationale itself              | governance — versioned, amended by process           |

Tier 1 is "statically decidable" — but that is **not** "eess-ts can see it."
eess-ts parses TypeScript; a rule about a `.vue` `<script>` is still Tier 1 but
its mechanism is the linter. Name the mechanism, not just the tier.

If the clause is Tier 2–5, you're done with the rule question — write the row
naming the real mechanism (a test file, a policy, `governance`) and move to Step 4.

## Step 2 — write the eess-ts rule (Tier 1, `.ts`)

Rules read like English: pick an entry point, filter with `.that()`, assert with
`.should()`, name it with `.rule()`. If the repo has the eess-ts guide (`docs/`
— `getting-started.md`, `modules.md`, `classes.md`, `body-analysis.md`), consult
it for the full surface; otherwise the common shapes:

```ts
// Layer/dependency: "domain must not import infrastructure"
modules(p)
  .that()
  .resideInFolder('src/domain/**')
  .should()
  .notDependOn('src/infrastructure/**')
  .rule({ id: 'adrNNN-domain-isolation', because: 'ADR-NNN' })

// Forbidden import: "source must never import the raw typescript package"
modules(p)
  .that()
  .resideInFolder('**/packages/*/src/**')
  .should()
  .notImportFrom('**/node_modules/typescript/**')
  .rule({ id: 'adrNNN-no-raw-ts' })

// Body/hygiene via a condition: "no `as` casts, no eval, no console in source"
modules(p)
  .that()
  .resideInFolder('src/**')
  .should()
  .satisfy(moduleNoTypeAssertions()) // or moduleNoEval(), moduleNoConsoleLog(), moduleNoNonNullAssertions()
  .rule({ id: 'adrNNN-no-casts' })

// Class-shaped: "repositories must extend BaseRepository, must not throw generic Error"
classes(p)
  .that()
  .extend('BaseRepository')
  .should()
  .notContain(newExpr('Error'))
  .rule({ id: 'adrNNN-typed-errors' })
```

Entry points: `modules` (imports/deps/body), `classes`, `functions`, `types`,
`slices` (cycles/layers), `calls`. Body matchers inside `notContain`/`contain`:
`call('x')`, `newExpr('X')`, `access('a.b')`, `expression(/regex/)`.

## Step 3 — do not write a vacuous rule

This is the failure the validator hunts for, so pre-empt it:

- **Verify the selection is non-empty** — this is where real vacuity comes from.
  A `.that().resideInFolder(GLOB)` whose glob matches no files makes the rule
  inspect an empty set and pass silently. Run the gate and read its count line —
  `check:arch` reports `✓ eess-ts — N rules across M files · 0 failing`,
  `check:corpus` reports per-check counts. If your new rule's target count is 0,
  the glob is wrong or the rule is a no-op, not a pass.
- **Know what `.excluding()` actually does.** It is a post-hoc violation
  suppressor, not a file selector: a **string** must _exactly equal_ a
  violation's element/file/message; a **regex** is `.test()`-matched against
  them. So exclude by path with a **regex** (`.excluding(/\/generated\//)`), give
  it a written reason, and keep it narrow — an over-broad regex like `/./`
  suppresses every violation and neuters the rule. A glob string
  (`.excluding('**/*.ts')`) is a dead line: it matches nothing and only warns.
- **Enforce the _whole_ clause.** If the clause says "no `as` AND no `satisfies`",
  one condition covering `as` leaves half unenforced. Either add a second
  mechanism or narrow the clause to what you actually gate.

## Step 4 — write the Enforcement row honestly

Every ADR ends with a table; add one row per clause:

```
| Clause (the decision, in prose) | Tier | Mechanism (cite the real file + rule id + `it('…')` test) | Status |
```

- **Mechanism** must cite things that exist: a file path in backticks (it must
  resolve) and, where a test proves it, `` `path/to/x.test.ts` `` · `it('exact title')`
  (the title must exist and be unique). The corpus/crossval gates check these.
- **Status** is a fixed vocabulary — and this is where honesty lives:
  - `gated` — the mechanism runs in CI and failing blocks. Only claim this if the
    rule is wired into a gate **and green today**.
  - `pending` — decided, mechanism known/written, **not green yet** because the
    code doesn't satisfy it. Ship the rule as a skipped test (`it.skip`) and mark
    `pending`. Marking it `gated` when the code still violates it is the exact lie
    eess exists to prevent. It ratchets to `gated` when the code catches up.
  - `warn` (runs, doesn't block) · `manual` (human review, no mechanism) ·
    `n/a` (rationale/context) · `deprecated`.

## Step 5 — validate the translation

You wrote English→rule; you are the worst judge of whether it's faithful. Hand
off to **eess-validate-faithfulness** (or ask for a faithfulness check) on the
clause + the rule you just wrote, before considering the row `gated`.
