# Plan 0237: eess at runtime only where a verdict is meant to be written

## Status

- **State:** Draft — the belt to plan 0235's braces. Independent of 0235 and
  independently closable; ships whether or not the emitter contract has landed.
- **Priority:** High — it is the only mechanism that reaches the two residuals
  [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)
  states it cannot: an adopter who sums receipts by hand, and one who never
  calls an emitter at all. Both are the shape an AI agent produces while
  believing it did the right thing, and the maintainer's standing instruction is
  to do all we can to prevent exactly that.
- **Effort:** Low — one rule in an existing preset, composed from two conditions
  `eess-ts` already ships, with a fixture, a dogfood run and a docs pass.
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

Nothing here is new capability. It is one rule composed from two shipped
conditions, in the preset built for this audience.

## The rule

**Id:** `preset/agent/no-verdict-outside-rules`. **Option:**
`noVerdictOutsideRules?: boolean` on `AgentGuardrailsOptions`, with a companion
`verdictFiles?: string[]` naming where eess may be used at runtime. Default
`['**/*.rules.ts', '**/*.test.ts']`.

```ts
if (options.noVerdictOutsideRules) {
  const emitters = /(^|\.)(finishPreset|reportViolations|throwIfViolations)$/
  push(
    modules(p)
      .that()
      .resideInFile(options.src)
      .and()
      .notResideInFile(...(options.verdictFiles ?? DEFAULT_VERDICT_FILES))
      .should()
      .onlyHaveTypeImportsFrom('@nielspeter/eess', '@nielspeter/eess-*')
      .andShould()
      .notContain(call(emitters)),
    {
      id: 'preset/agent/no-verdict-outside-rules',
      because:
        'a verdict assembled outside a rule file walks around the pipeline that makes a pass mean something — ' +
        'a loop that examines nothing hands the emitter an empty array and the build is green',
      suggestion:
        'write the check as a rule in a *.rules.ts file, or through a preset; if this module is a gate ' +
        'script, name it in verdictFiles',
      imperative:
        'Do NOT import eess at runtime, or call finishPreset/reportViolations, outside a rule file, a test, ' +
        'or a file listed in verdictFiles — a green built by hand certifies nothing',
    },
    'error',
  )
}
```

**The two narrowings, from Ask C's disposition row, both in.**

1. `dispatchRule` is **not** on the banned list. It is the sanctioned
   preset-authoring call, used correctly at `packages/md/src/rules/adr.ts:140-153`,
   and a preset module is exactly the kind of file this rule must not red.
2. The exemption is a **declared glob list**, not a hard-coded pair. This repo
   ships five gate scripts under `scripts/` that call the emitters legitimately,
   and every adopter with a CI gate has the same shape. `verdictFiles` names
   them. It is a list, which ADR-009 rule 3's corollary is right to be wary of —
   a marker an agent can stamp to go green is worse than none. Two things make
   this one honest: it lives in the preset's options, so stamping it is a visible
   line in the config diff, exactly like `overrides`; and a file named in it is
   still under ADR-014 the moment it calls an emitter. The list decides where a
   verdict may be written, not whether it needs evidence.

**The anchor.** `(^|\.)` on the callee, so `import * as eess` followed by
`eess.finishPreset(...)` is caught. The consuming project measured its own first
version failing exactly there. `throwIfViolations` stays on the list until plan
0235 deletes the symbol; a dead name in a regex is harmless, and an adopter on
an older kernel still has the alias.

**What it catches, and what it does not.** It catches the pattern — eess used
at runtime, or an emitter called, in a file that is not one of the declared
verdict-writing kinds. Every one of the three residual shapes lives in that
pattern. It does **not** prove any of them individually: a hand-summed receipt
inside a rule file, or a rule file that formats and exits on its own, is inside
the exemption and outside this rule, and a rule that tried to see it would be
the wiring search that produced nine holes. That is Tier 1 stated honestly, and
it is the reason this plan is the belt and 0235 is the braces.

## Implementation

### Phase 1 — red first

Fixtures under `packages/ts/tests/presets/`, each asserting the rule id:

- a `src/**` module with a runtime import of `@nielspeter/eess-md` and a call
  to `finishPreset` → one violation, naming the module;
- the same module under `import * as eess` with `eess.finishPreset(...)` → one
  violation (the anchor);
- the same code in `foo.rules.ts` → none; in `foo.test.ts` → none; in a file
  named by `verdictFiles` → none;
- a preset module calling `dispatchRule` → none (narrowing 1, asserted, not
  assumed);
- a `src/**` module with only `import type` from eess → none.

A row in `scripts/check-nonvacuity.mjs`'s `gates` table under
`check:guardrails`, per the one-row-per-check doctrine under `GATE_FOR`: a
fixture source with the offending shape must red the dogfood run naming the rule
id. Identity, not exit code.

### Phase 2 — the rule

As above, in `packages/ts/src/presets/agent-guardrails.ts`, beside the four
rules that follow the same `push(builder, metadata, severity)` shape. The rule
id joins `AgentGuardrailsRuleId` so `overrides` can turn it off, which the
changelog must name.

### Phase 3 — dogfood

`scripts/check-guardrails.mjs` enables it with `verdictFiles` covering
`**/*.rules.ts`, `**/*.test.ts`, `scripts/**`, `packages/*/src/presets/**`,
`packages/*/src/rules/**` and `packages/crossvalidate/src/**` — the modules in
this repo that write verdicts by design. Any module the run then reds is either
a real finding or a missing entry, and the entry is reviewed as a claim about
what that module is for. The denominator the script prints stays what it is.

### Phase 4 — the agent reads it before it writes the wrong thing

- `docs/agent-integration.md` recipe 3: the regenerated `AGENTS.md` block now
  carries the rule's `imperative`. One sentence there noting that this is the
  line an agent should read as "do not hand-roll a gate".
- `docs/presets.md`'s `agentGuardrails` section: the option, the default
  `verdictFiles`, and the honest scope paragraph above, so the docs do not claim
  the rule proves what it only patterns.
- Changeset: `@nielspeter/eess-ts` **minor**; names the rule id and the
  `overrides` opt-out, per Ask C's disposition row.

## Out of scope — each with its home

- **The kernel-side contract** — [plan 0235](./0235-the-emitter-takes-a-receipt.md).
  This rule does not make an evidence-free verdict unrepresentable; the emitter
  does.
- **Seeing inside a rule file** — a hand-summed receipt, or a rule file that
  never calls an emitter. Open-ended search; stays ADR-014's stated ceiling.
- **Ask D** — documenting that the dead-selector finding already ships on the
  builder path. Still `Held` on 009 for a docs owner; a `none` changeset.

## Success definition

- Each Phase 1 fixture reds or stays green as listed, by rule id.
- The `check:guardrails` non-vacuity row reds the dogfood run on a planted
  offending module and is green otherwise.
- `npm run check:guardrails` is green over this repo with the declared
  `verdictFiles`, and every entry in that list names a module that writes
  verdicts by design — reviewed as a list of claims.
- The regenerated `AGENTS.md` block carries the imperative.
- `npm run validate` green from a run that **reached the last step**.

## Progress ledger

- [ ] Phase 1 — fixtures red, keyed on the rule id; non-vacuity row registered under `check:guardrails`
- [ ] Phase 2 — the rule, in the preset, both narrowings in
- [ ] Phase 3 — dogfood green with a reviewed `verdictFiles`
- [ ] Phase 4 — docs and the changeset naming the id and the opt-out
- [ ] `/close`

Deferred: none.
