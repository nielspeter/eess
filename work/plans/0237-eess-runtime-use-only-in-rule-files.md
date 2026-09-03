# Plan 0237: eess at runtime only where a verdict is meant to be written

## Status

- **State:** Draft — the belt to plan 0235's braces. Independent of 0235 and
  independently closable; ships whether or not the emitter contract has landed.
- **Priority:** High — it is the only mechanism that reaches the two residuals
  [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)
  states it cannot: an adopter who sums receipts by hand, and one who never
  calls an emitter at all. Both are the shape an AI agent produces while
  believing it did the right thing, and the maintainer's standing instruction is
  to do all we can to prevent exactly that. With one ceiling this plan carries
  rather than hides: it reaches them only inside the adopter's TypeScript
  project. A JavaScript gate script outside every `tsconfig` — this repo's own
  shape, five times over — is invisible to `eess-ts`, and beyond every
  mechanism in the family except the adopter's own break-the-loop fixture.
- **Effort:** Low — one rule in an existing preset, composed from two conditions
  `eess-ts` already ships plus one small exclusion predicate, a widening of the
  preset's `push` helper, three id lists kept in step, an adopter-shaped
  fixture project, and a docs pass.
- **Created:** 2026-09-03
- **Builds:** proposal 009's Ask C, **reshaped** by the two narrowings its
  disposition row required before it could leave `Held`; that row now names
  this plan. No `**Implements:**` line, for the reason plan 0235 gives: 009's
  ruling is `Split and sequence`, and this plan builds one ask of it.

## Problem

ADR-014 makes an evidence-free verdict unrepresentable at every seam eess owns.
It names, honestly, what it does not reach: a caller who never calls an emitter
— formats and exits on its own — and a caller who sums receipts by hand instead
of through the kernel's merge. Both were measured in the field, in code an AI
agent wrote after being told to embrace eess, and both are green today with
nothing to tell the agent otherwise.

A contract cannot reach code that never touches it. A lint can see the shape
that code takes: **a module that is not a rule file, not a test, not a preset
and not a declared gate, and uses eess at runtime.** That is the "walked around
the pipeline" shape in one sentence — eess's corpus loader and eess's types,
imported into ordinary source, with a verdict assembled by hand beside them.
The consuming project that measured the field failure wrote this rule itself
afterwards, in two parts, and cut a third after two review rounds produced nine
holes. Its lesson is on this record so it is not re-learned: **a binding is a
fact; a wiring is an open-ended search.** The rule asserts what a file imports
and what it calls. It does not try to prove what a file does with the result.

## Existing code survey

- `modules(p)` — `packages/ts/src/builders/module-rule-builder.ts:307` — the
  module-level builder.
- `.onlyHaveTypeImportsFrom(...globs)` — `:205` — the import-kind condition:
  every import from the named packages must be `import type`.
- `.notContain(matcher)` — `:232` — with `call(nameOrRegex)` from
  `packages/ts/src/helpers/matchers.ts:118`, the callee-anchored matcher.
- `agentGuardrails` — `packages/ts/src/presets/agent-guardrails.ts:87` — the
  preset for "the mistakes AI coding agents make most often", one boolean option
  per rule, each rule carrying `because` / `suggestion` / `imperative` so
  `explain --format agent` renders it into the adopter's `AGENTS.md` block
  (`docs/agent-integration.md`, recipe 3). **This is the delivery channel to
  the agent**: the rule's own text is what the agent reads before it writes the
  wrong thing.
- `check:guardrails` — `scripts/check-guardrails.mjs` — this repo dogfoods the
  preset over `packages/*/src`.

One piece is new, and small: there is no `notResideInFile` on the module
builder (`resideInFile` at `:90` takes one glob), so the selection's exclusion
is a predicate composed from the free `resideInFile`
(`packages/ts/src/predicates/identity.ts:76`) under `not` and `or`
(`packages/core/src/combinators.ts`), and it **declares its globs** through
`globAnyOf` so a `ruleFiles` entry that matches nothing is diagnosed as a
dead glob rather than silently excluding nothing. The two conditions are
shipped; the exclusion predicate is the one new line.

## The rule

**Id:** `preset/agent/no-verdict-outside-rules`. **Option:**
`noVerdictOutsideRules?: boolean` on `AgentGuardrailsOptions`, with a companion
`ruleFiles?: string[]` naming where else eess may be used as a value. It
**extends** the default `['**/*.rules.ts', '**/*.test.ts', '**/*.spec.ts']` —
proposal 009's own list; an earlier draft dropped `*.spec.ts` with no reason —
rather than replacing it, so an adopter naming `scripts/**` does not red every
rule file. Named `ruleFiles` because "verdict" appears in no eess doc and the
rule id already says `outside-rules`; the existing option vocabulary is `src`,
`folders`, `shared`, `layers`.

```ts
if (options.noVerdictOutsideRules) {
  const emitters = /(^|\.)(finishPreset|reportViolations|throwIfViolations)$/
  // Every specifier shape, not only the bare package: `@nielspeter/eess-ts/presets`
  // is how this repo's own guardrails script imports, and `@nielspeter/eess/internal`
  // is the kernel's second entry point. Measured with picomatch: the bare globs
  // match neither.
  const eess = [
    '@nielspeter/eess',
    '@nielspeter/eess/**',
    '@nielspeter/eess-*',
    '@nielspeter/eess-*/**',
  ]
  // Extends the default; an adopter naming `scripts/**` must not lose `*.rules.ts`.
  const ruleFiles = [...DEFAULT_RULE_FILES, ...(options.ruleFiles ?? [])]
  push(
    modules(p)
      .that()
      .resideInFile(options.src)
      .and()
      .satisfy(not(or(...ruleFiles.map((g) => resideInFile(g))))) // declares its globs
      .should()
      .onlyHaveTypeImportsFrom(...eess)
      .andShould()
      .notContain(call(emitters)),
    {
      id: 'preset/agent/no-verdict-outside-rules',
      because:
        'outside a rule file nothing counts what was examined, so a pass there is a claim with no evidence — ' +
        'a loop that skips every item looks identical to one that checked them all',
      suggestion:
        'express the check as a Condition and reach the verdict through a builder (.check(), or a preset), ' +
        'so the evidence floor sees it; moving the same loop into a *.rules.ts file hides it, it does not fix it. ' +
        'If this module is a gate script that finishes through an emitter, name it in ruleFiles',
      imperative:
        'Do NOT import eess as a value (only `import type`), or call finishPreset/reportViolations, outside a ' +
        'rule file, a test, or a file listed in ruleFiles — and inside one, reach the verdict through a ' +
        'builder, never a hand-written loop: a green built by hand certifies nothing',
    },
    'error',
  )
}
```

**The remedy must not name the bypass.** An earlier draft's `suggestion` led
with "write the check as a rule in a `*.rules.ts` file". The same hand-written
loop moved into a rules file is inside the exemption and green — an agent
following that Fix line would un-detect the problem, not remediate it, which is
ADR-009 rule 2's prohibition. The suggestion leads with the construction that
actually reaches the evidence floor, and names the file move only as where a
legitimate emitter call belongs.

**The two narrowings, from Ask C's disposition row, both in.**

1. `dispatchRule` is **not** on the banned list. It is the sanctioned
   preset-authoring call, used correctly at `packages/md/src/rules/adr.ts:140-153`.
   Stated honestly, though, the regex is not what spares a preset module: that
   module imports `dispatchRule` at runtime (`adr.ts:3-10`), so the
   type-import leg reds it whatever the call regex says. **A preset module is a
   verdict file by definition** and belongs in `ruleFiles`; the Phase 1
   fixture asserts that a declared preset module is green, which is the
   exemption working, not the regex. Keeping the call off the regex still
   matters for a verdict file that is checked for calls only — none today —
   and costs nothing, so the narrowing stays, described as what it is.
2. The exemption is a **declared glob list**, not a hard-coded pair. This repo
   ships five gate scripts under `scripts/` that call the emitters legitimately,
   and every adopter with a CI gate has the same shape. `ruleFiles` names
   them. It is a list, which ADR-009 rule 3's corollary is right to be wary of —
   a marker an agent can stamp to go green is worse than none. Two things make
   this one honest, and one thing keeps it from rotting. It lives in the
   preset's options, so stamping it is a visible line in the config diff,
   exactly like `overrides` — a Tier 5 defence, review-enforced, and named as
   such rather than dressed as a mechanism. A file named in it is still under
   ADR-014 the moment it calls an emitter; the list decides where a verdict may
   be written, not whether it needs evidence. And an entry that matches **zero
   files** is a configuration finding, not a silence: the exclusion predicate
   declares its globs, so the dead-glob diagnosis already in the pipeline covers
   it, the way `overrideFindings` (`packages/ts/src/presets/agent-guardrails.ts:98`)
   already reports an unknown override key. A list that can go stale silently
   is proposal 009's own requirement (its lines 239-241), and the first draft of
   this plan had dropped it.

**The anchor.** `(^|\.)` on the callee, so `import * as eess` followed by
`eess.finishPreset(...)` is caught. The consuming project measured its own first
version failing exactly there. A renamed import — `finishPreset as done` —
escapes the call leg and is caught by the import leg, so the two conditions
cover each other's blind spot once the subpath globs are right.
`throwIfViolations` stays on the list until plan 0235 deletes the symbol; a
dead name in a regex is harmless, and an adopter on an older kernel still has
the alias.

**What it catches, and what it does not.** It catches the pattern — eess used
at runtime, or an emitter called, in a file that is not one of the declared
verdict-writing kinds. Every one of the three residual shapes lives in that
pattern. It does **not** prove any of them individually: a hand-summed receipt
inside a rule file, or a rule file that formats and exits on its own, is inside
the exemption and outside this rule, and a rule that tried to see it would be
the wiring search that produced nine holes. That is Tier 1 stated honestly, and
it is the reason this plan is the belt and 0235 is the braces.

**Two more ceilings, stated because an unstated one reads as coverage.** The
rule lives in `eess-ts`, because only the TypeScript dialect has an AST engine
to see imports and calls; an adopter of `eess-md` or `eess-gherkin` alone has no
static-analysis surface in the family, and for them the kernel-side contract in
ADR-014 is the whole protection. And the rule sees only modules inside the
adopter's TypeScript project: a `.mjs` gate outside every `tsconfig` — the
exact shape this repo ships five of — is examined by nothing here, and an
adopter whose hand-rolled gate lives there gets an honest green from this rule
while the field shape is unreached. `docs/presets.md` says both.

**And in this repository it cannot fire at all, which Phase 3 says plainly.**
The dialects' own source _is_ eess: measured, 53 of 141 `eess-ts` source files,
9 of 24 in `eess-md`, 8 of 29 in `eess-mermaid`, 7 of 9 in `eess-crossvalidate`
import the kernel at runtime, by design, and `packages/core/src` never imports
its own package name. A `ruleFiles` wide enough to make `check:guardrails`
green over `packages/*/src` would exempt every module that could fire, and the
green would be a tautology presented as dogfood. The only honest evidence in
this repo is a fixture project shaped like an adopter's, driven both ways.

## Implementation

### Phase 1 — red first

Fixtures under `packages/ts/tests/presets/`, each asserting the rule id:

Each condition is isolated by a fixture that only it can red, so sabotaging
either one leaves a fixture the wrong colour — ADR-009 rule 5, not a pair of
fixtures that both conditions trip:

- a `src/**` module with a **runtime** import of `@nielspeter/eess-md` and **no**
  emitter call → red (the import condition alone);
- a `src/**` module with only `import type` from eess, calling `finishPreset`
  through a local wrapper re-export → red (the call condition and its anchor
  alone);
- the same module under `import * as eess` with `eess.finishPreset(...)` → red;
- one fixture per specifier shape: `@nielspeter/eess/internal`,
  `@nielspeter/eess-ts/presets`, `@nielspeter/eess-md/rules/adr` → red each,
  because the bare globs an earlier draft used match none of them;
- the same code in `foo.rules.ts` → green; in `foo.test.ts` → green; in a file
  named by `ruleFiles` → green;
- a preset module calling `dispatchRule` → green (narrowing 1, asserted, not
  assumed);
- a `ruleFiles` entry matching zero files → the dead-glob configuration
  finding, by its rule id.

Every red assertion is by **rule id**, never by a count of one: each condition
emits its own violation, so a module that trips both reports two.

A row in `scripts/check-nonvacuity.mjs`'s `gates` table under
`check:guardrails`, per the one-row-per-check doctrine under `GATE_FOR`: a
fixture source with the offending shape must red the dogfood run naming the rule
id. Identity, not exit code.

### Phase 2 — the rule

As above, in `packages/ts/src/presets/agent-guardrails.ts`, beside the four
rules that follow the same `push(builder, metadata, severity)` shape — after
widening `push`, whose parameter is typed
`FunctionRuleBuilder | DuplicateBodiesBuilder` (`:108-112`) and will not accept
a `ModuleRuleBuilder` as it stands.

The preset keeps its rule bookkeeping **by hand in four places**, and its own
comment at `:280-284` says nothing enforces their sync. All four change: the
`AgentGuardrailsRuleId` union (`:30`), so the option type-checks;
`STATIC_RULE_IDS` (`:245`, which `knownOverrideIds` at `:270` derives from), or
`overrides: { 'preset/agent/no-verdict-outside-rules': 'off' }` is rejected as
"matches no rule in this preset" and the opt-out the changelog promises does not
exist; `collectRuleIds` (`:286`), or a preset enabling only this flag fires
`constructs-nothing` on itself; and the `optionsHint` string at `:216`, which
is the constructs-nothing remedy's list of flags to set and would omit the new
one. A test enables only the new rule and asserts both: the override is
accepted, and no constructs-nothing finding fires.

Two more things the build must not leave as they are. The type-import leg
records `none-matched` edge coverage on every healthy run
(`packages/ts/src/conditions/dependency.ts:566-571`), and that disclosure reads
as "the glob may be a typo" — for this rule zero matching imports is the goal,
so under ADR-009 rule 2 the stated cause is wrong; give it a reason variant, or
say it in the docs. And `scripts/check-guardrails.mjs:110` hard-codes
`5 rules` in its summary line, true only because this rule is not enabled
there; derive the number so it cannot lie when someone does.

### Phase 3 — dogfood, honestly

Not over `packages/*/src`. That source is eess and imports itself at runtime
everywhere, so the rule examines every module there and can fire on none; a
green from that run would certify nothing, and `check:guardrails` must not
enable this rule over it. Instead: a fixture project under `scripts/nonvacuity/`
shaped like an adopter's — a `src/` with ordinary modules, one `*.rules.ts`,
one gate script named in `ruleFiles` — driven through the rule both ways.
Clean, it is green; with one module planted in the "walked around the
pipeline" shape, it reds naming the rule id. That row is registered under
`check:guardrails` in `GATE_FOR`, beside `guardrails/generic-error`, and it is
the only in-repo evidence this rule discriminates. The plan says so rather than
letting a `check:guardrails` tick imply it.

### Phase 4 — the agent reads it before it writes the wrong thing

- `docs/agent-integration.md` recipe 3: the regenerated `AGENTS.md` block now
  carries the rule's `imperative`. One sentence there noting that this is the
  line an agent should read as "do not hand-roll a gate".
- `docs/presets.md` has **no** `agentGuardrails` section today — the preset is
  one line at `packages/ts/README.md:176` — so Phase 4 creates it: the option,
  the default `ruleFiles` and that the list extends it, the expected first reds
  (any local preset module under `src/` until it is named), and the honest
  scope above — including that the rule sees only modules inside the
  TypeScript project, and that an adopter without `eess-ts` has no equivalent —
  so the docs do not claim the rule proves what it only patterns, or reaches
  what it cannot see.
- Changeset: `@nielspeter/eess-ts` **minor**; names the rule id and the
  `overrides` opt-out, per Ask C's disposition row. The flag defaults **off**,
  so the upgrade is silent for every adopter; the "reds adopters on upgrade"
  framing inherited from 009's review does not apply here, and the changelog
  says so — and says that a dogfooder with every flag on must add this one.

## Out of scope — each with its home

- **The kernel-side contract** — [plan 0235](./0235-the-emitter-takes-a-receipt.md).
  This rule does not make an evidence-free verdict unrepresentable; the emitter
  does.
- **Seeing inside a rule file** — a hand-summed receipt, or a rule file that
  never calls an emitter. Open-ended search; stays ADR-014's stated ceiling.
- **Ask D** — documenting that the dead-selector finding already ships on the
  builder path. Still `Held` on 009 for a docs owner; a `none` changeset.
- **An equivalent for adopters without `eess-ts`.** There is no AST engine to
  build it on; the family's answer for them is ADR-014's kernel contract.
- **A `.mjs` gate outside every `tsconfig`.** Invisible to this dialect by
  construction; only the adopter's own fixture sees it.

## Success definition

- Each Phase 1 fixture reds or stays green as listed, by rule id — including
  the two isolating fixtures, so deleting either condition turns one red
  fixture green.
- Every subpath specifier shape reds; the bare-package globs an earlier draft
  used are measured to miss all of them.
- The adopter-shaped fixture project reds on the planted module and is green
  clean, registered under `check:guardrails`; no `check:guardrails` run over
  `packages/*/src` enables this rule.
- A `ruleFiles` entry matching zero files reds by the dead-glob rule id.
- A preset enabling only this rule accepts its `overrides` opt-out and fires no
  `constructs-nothing` finding on itself.
- The regenerated `AGENTS.md` block carries the imperative, and the imperative
  names the construction that reaches the evidence floor, not the file move.
- `npm run validate` green from a run that **reached the last step**.

## Progress ledger

- [ ] Phase 1 — fixtures red, keyed on the rule id; non-vacuity row registered under `check:guardrails`
- [ ] Phase 2 — the rule, in the preset, both narrowings in
- [ ] Phase 3 — the adopter-shaped fixture project, red planted and green clean, under `check:guardrails`
- [ ] Phase 4 — docs and the changeset naming the id and the opt-out
- [ ] `/close`

Deferred: none.
