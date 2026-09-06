# Plan 0237: eess at runtime only where a verdict is meant to be written

## Status

- **State:** Done — built and closed in PR #110, on top of the freeze in #109.
  `preset/agent/no-verdict-outside-rules` ships behind `noVerdictOutsideRules`
  (default off) with `preset/agent/rule-files-matches-nothing` beside it, two
  `check:nonvacuity` rows (one per finding), 24 tests, and four stated ceilings.
  Seven review personas found five real defects in it — a `base` derivation that
  disagreed with the rule it described, a finding with no non-vacuity coverage,
  a fourth escape, a false dogfood claim, and numbers that went stale inside the
  branch that measured them. All fixed or filed; the record carries each one,
  including a docs "fix" I made on a review finding that was itself wrong.
  **Deferred: bug 0264.**
  Previously read: Ready — frozen 2026-09-06, the day plan 0235 merged. The belt to
  0235's braces: independent of it and independently closable, and now the only
  live mechanism aimed at the two residuals ADR-014 states it cannot reach.
  **The freeze found five things and fixed them rather than flipping over
  them — and MISSED A SIXTH, which is recorded here because the freeze's own
  count was one of the numbers it got wrong.** A method review found it: the
  frozen text asserted, as decided rather than as an open question, that a dead
  `ruleFiles` entry was covered by "the dead-glob diagnosis already in the
  pipeline". That was false, and reachable by reading the one function the claim
  depended on — `isDeadSite` short-circuits on negative polarity, as its own
  comment says. The freeze's bar is that a load-bearing artifact is internalised
  and checked; this one was neither, and it surfaced at build, forcing an entire
  new rule id the frozen scope did not carry.

  Worth stating beside it: plan 0263's freeze **did** catch the analogous
  mistake — a table claim inherited without measuring — before any build. The
  discipline works when it is actually applied to a mechanical claim; here it
  was applied to four citations and not to the fifth thing the plan leaned on.

  The five it did find — four citations that had staled and one item of Phase 2
  that was already done:
  1. The `dispatchRule`-in-`eess-md` fact is re-recorded **by value** (the three
     call expressions and the import member). Its line citation had staled in
     both this plan AND proposal 009's Ask C row, because 0235 rewrote the
     surrounding lines — the same class that refused 0235's own first freeze.
  2. Phase 2 asked the build to derive `check-guardrails.mjs`'s hard-coded
     `5 rules`. **It already derives it.** Left in as a recorded correction so
     an implementer is not sent to fix a fixed thing.
  3. "`throwIfViolations` stays on the list until plan 0235 deletes the symbol"
     — 0235 shipped without deleting it; that moved to plan 0263 Phase 5.
  4. The runtime-import census is re-derived and dated, with the command that
     produces it: 55/141 and 10/24 had drifted from 53 and 9. The conclusion is
     unchanged and slightly stronger.
  5. `DEFAULT_RULE_FILES` is marked as a constant this plan **introduces**, so
     nobody greps for it first and concludes the snippet is wrong.

  Everything else verified against the code at `4fa5e84`: `modules()`,
  `onlyHaveTypeImportsFrom`, `notContain`, `call()`, `resideInFile`, the
  `agentGuardrails` internals (the union, `STATIC_RULE_IDS`, `knownOverrideIds`,
  `collectRuleIds`, `optionsHint`, `push`'s parameter type, the by-hand-in-four-
  places comment) and `dependency.ts`'s `none-matched` edge disclosure all hold
  at their cited lines.

- **Priority:** High — it is the only mechanism that reaches the two residuals
  [ADR-014](../../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)
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
  // DEFAULT_RULE_FILES is NEW — this plan introduces it; it does not exist yet.
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
   preset-authoring call, used correctly in `packages/md/src/rules/adr.ts`.
   **Recorded by value at the freeze**, because the line citation had already
   staled: the three calls are `dispatchRule(declared, 'adr/enforcement-declared', …)`,
   `dispatchRule(validTiers, 'adr/valid-tiers', …)` and
   `dispatchRule(citations, 'adr/citations-resolve', …)`, and the runtime import is
   the `dispatchRule,` member of that file's first `import { … } from
'@nielspeter/eess'`. This plan cited `:140-153` and proposal 009's Ask C row
   cites `:131-141`; plan 0235 rewrote the surrounding lines and both are now off.
   Grep the symbol, not the line.
   Stated honestly, though, the regex is not what spares a preset module: that
   module imports `dispatchRule` at runtime, so the
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
   files** is a configuration finding, not a silence — the way `overrideFindings`
   (`packages/ts/src/presets/agent-guardrails.ts:98`) already reports an unknown
   override key.

   **BUILD FINDING, 2026-09-06 — the mechanism named here does not exist, and
   the family refuses to build it.** This plan said "the exclusion predicate
   declares its globs, so the dead-glob diagnosis already in the pipeline covers
   it". It does not, for two independent and deliberate reasons:
   - `isDeadSite` opens with `if ((site.polarity ?? 'positive') === 'negative')
return false`, and `not(...)` flips polarity. `terminal-builder.ts` states
     the reasoning: _"`not(dead)` over-selects rather than under-selecting, so it
     cannot be dead."_
   - Exclusion sites are never faults at all: _"a condition glob matching nothing
     is indistinguishable from an armed tripwire that has not fired, and plan
     0072 got that wrong twice before it stayed written down."_

   Both are correct, and neither should be weakened for this rule. **Decided:
   an explicit check instead**, `preset/agent/rule-files-matches-nothing`, which
   asks `isDeadSite` about each `ruleFiles` glob **on its own, at positive
   polarity** — the same computation, the honest question. Reusing `isDeadSite`
   rather than hand-rolling picomatch inherits `syntacticFault`'s anchoring and
   project-relative handling, so the pre-flight and this check cannot disagree.

   The UX is why it is worth a mechanism rather than a note. Without it a typo'd
   `ruleFiles: ['script/**']` surfaces as _"your gate script violates
   no-verdict-outside-rules"_, whose `Fix:` line says "name it in `ruleFiles`" —
   which the adopter did, with a typo. A loop the finding itself sends them
   around. The dead entry is at least **fail-closed** (an exemption that exempts
   nothing reds the files it names rather than going quiet), so this is a
   legibility fix, not a hole — and that distinction is stated here so the row
   does not over-claim. A list that can go stale silently
   is proposal 009's own requirement (its lines 239-241), and the first draft of
   this plan had dropped it.

**The anchor.** `(^|\.)` on the callee, so `import * as eess` followed by
`eess.finishPreset(...)` is caught. The consuming project measured its own first
version failing exactly there. A renamed import — `finishPreset as done` —
escapes the call leg and is caught by the import leg, so the two conditions
cover each other's blind spot once the subpath globs are right.
`throwIfViolations` stays on the list. **Corrected at the freeze:** this read
"until plan 0235 deletes the symbol", and 0235 shipped on 2026-09-06 without
deleting it — it is still exported from `packages/core/src/index.ts` and
`packages/ts/src/index.ts`, and removing it is now
[plan 0263](../0263-adr-014s-residual-enforcement-rows.md) Phase 5. The name is
live, not pending-dead. Either way a dead name in a regex is harmless, and an
adopter on an older kernel still has the alias.

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
The dialects' own source _is_ eess. **Re-derived at the freeze, 2026-09-06,
after plan 0235 changed 97 files** — the first two numbers had already drifted,
which is why the derivation is recorded here and not only its result:

```
find packages/<pkg>/src -name '*.ts'                       # the denominator
… | xargs grep -lE "^import [^t].*from '@nielspeter/eess"  # runtime importers
```

| package              | runtime-importing                               | of total |
| -------------------- | ----------------------------------------------- | -------- |
| `eess-ts`            | **56** at build (55 at freeze, 53 when drafted) | 141      |
| `eess-md`            | 10 (was 9)                                      | 24       |
| `eess-mermaid`       | 8                                               | 29       |
| `eess-crossvalidate` | 7                                               | 9        |
| `eess` (kernel)      | 0                                               | 58       |

**`eess-ts` moved from 55 to 56 inside this branch, and the cause is this
plan's own build.** Phase 2 added `import { collectResult } from '@nielspeter/eess'`
to `packages/ts/src/presets/agent-guardrails.ts` — a genuine runtime import, in
the very file this rule ships from. So the file that implements "do not import
eess at runtime outside a rule file" joined the population it had just counted.
Caught by a method review, not by me. It changes nothing about the argument (the
conclusion is "more, not fewer"), and it is the sharpest possible illustration of
why the derivation is recorded beside the number.

The conclusion is unchanged and slightly stronger: MORE of this repo's dialect
source imports the kernel at runtime than when the plan was drafted, so a
`ruleFiles` wide enough to green `check:guardrails` over `packages/*/src` would
exempt even more of what could fire. The kernel never imports its own package
name, so it is outside the rule's reach entirely. A `ruleFiles` wide enough to make `check:guardrails`
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
- a `ruleFiles` entry matching zero files → `preset/agent/rule-files-matches-nothing`,
  by its own rule id (see the build finding above — NOT the dead-glob pipeline,
  which deliberately does not cover negated or exclusion sites);
- a `ruleFiles` entry that DOES match → no such finding. The control, without
  which the check above is satisfied by a finding that always fires.

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
say it in the docs. **One item this phase used to carry is already done, found at the freeze.** The
plan asked the build to derive `scripts/check-guardrails.mjs`'s hard-coded
`5 rules` summary. It already is:
`const ruleCount = agentGuardrails(p, { ...OPTIONS, report: 'builders' }).length`
— asked of the preset rather than written beside it, with the old hard-code
recorded in the comment above it as the defect it was. Nothing is owed here, and
the number will move on its own when this rule is enabled there, which is the
point of deriving it.

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
- A `ruleFiles` entry matching zero files reds by
  `preset/agent/rule-files-matches-nothing`, and one that matches does not —
  corrected from "the dead-glob rule id" at build, which could not fire.
- A preset enabling only this rule accepts its `overrides` opt-out and fires no
  `constructs-nothing` finding on itself.
- The regenerated `AGENTS.md` block carries the imperative, and the imperative
  names the construction that reaches the evidence floor, not the file move.
- `npm run validate` green from a run that **reached the last step**.

## Progress ledger

- [x] Phase 1 — **24 tests**, every assertion keyed on the file a violation
      names rather than a count (a module tripping both conditions reports
      twice). Red first: 11 failed before Phase 2 existed. **The discrimination
      is measured, not claimed** — each mechanism sabotaged in turn, and the
      column that matters is WHICH tests fail, not how many:

      | sabotage | what fails |
      | --- | --- |
      | import leg → a no-op glob | `runtime-import` + the 3 specifier fixtures + the double-trip and static-rename fixtures — and NOT `wrapper-call`/`namespace-call`, which the call leg alone catches |
      | call leg → a no-op regex | `wrapper-call`, `namespace-call`, double-trip — and NOT `runtime-import`, which the import leg alone catches |
      | drop the `(^\|\.)` anchor | only the namespaced call and the double-trip that uses one |
      | exemption stops exempting | the gate script and the preset module (plus the dead-entry agreement test, which reads the same list) |
      | `base` hard-coded in the dead-entry check | **only** the agreement test — the regression guard for the architect review's critical |

      **The failure COUNTS this table used to carry were stale within the same
      branch, and a method review caught it.** It read 4 / 2 / 1 / 2, measured
      against a 19-test suite; the suite is now 24, because every review finding
      was pinned as a test, so the counts are 6 / 3 / 2 / 3 / 1 today and will
      move again the moment anyone adds a case. A count is a fact about the
      suite's size; the discrimination claim is about WHICH fixture survives,
      and only the latter is stable. Same lesson CLAUDE.md records for its own
      gate-summary table, re-learned here.

      **And one of those counts was never real.** Re-deriving the matrix, the
      anchor row first measured "0 failed" — which was a sabotage that never
      applied (shell quoting ate the regex), not a guard that had stopped
      working. Applied properly it fails 2. A sabotage that silently does
      nothing reports exactly like a mechanism that catches nothing; both times
      this session it was caught by checking that the edit landed, never by the
      number.

      Two things the build had to change that the plan did not foresee, both
      recorded rather than done quietly: `vitest.config.ts` now excludes
      `tests/fixtures/**` (the fixture proving the `**/*.test.ts` exemption must
      literally be named `.test.ts`, and vitest was collecting it as a suite),
      and `tsconfig.json` excludes this fixture directory (its files import
      `@nielspeter/eess-ts` **by name** — the whole point — which makes the
      project root ambiguous, TS2209, the same class as the two fixtures already
      excluded there).

- [x] Phase 2 — the rule, in the preset, both narrowings in. All four by-hand
      lists updated (`AgentGuardrailsRuleId`, `STATIC_RULE_IDS`,
      `collectRuleIds`, `optionsHint`) with a test pinning each: the override key
      is accepted, no `constructs-nothing` fires on a preset enabling only this
      rule, and the remedy lists the new flag. `push` widened to take a
      `ModuleRuleBuilder`. **`preset/agent/rule-files-matches-nothing` added**
      per the build finding above — `isDeadSite` asked about each caller glob on
      its own at positive polarity, so this check and `doctor`'s pre-flight
      cannot disagree.
- [x] Phase 3 — `scripts/nonvacuity/bad-verdict-outside-rules.mjs` builds an
      adopter-shaped project in a temp dir and drives it **both ways**: clean is
      green (and a red there exits 2 — the fixture's premise broke, not the gate
      proven), planted reds naming the rule id. Registered under
      `check:guardrails` in both the fixture list and `GATE_FOR`; the harness now
      reports **82 fixtures**. It does NOT plant under `packages/*/src`, and the
      row carries the reason: this repo's dialect source is eess, so the rule can
      fire on none of it and a green there would be a tautology.
- [x] **REVIEW FINDING, 2026-09-06 — the `ruleFiles` check shipped disagreeing
      with the rule it describes, and an architect review measured it.**
      `ruleFilesFindings` hard-coded `base: 'absolute'` when asking `isDeadSite`,
      while the exclusion it describes is built from `resideInFile`, which
      derives `base: relative ? 'normalized' : 'absolute'` — as does every other
      site in the dialect that stamps a `GlobSite` (`identity.ts:83`, `:114`,
      `:157`). Measured on the fixture project with `ruleFiles: ['gates/**']`:
      the rule **exempted** `gates/check-corpus.ts` (the unanchored glob matches
      via the tsconfig-root-relative fallback, plan 0067 C) while the finding
      said that same string "matches no file in this project, so it exempts
      nothing". Two derivations disagreeing about one glob — the failure this
      project spends most of its guards on — under a comment claiming they
      "cannot disagree".

      Three things were wrong and all three are fixed: the derivation now comes
      from `isProjectRelative`, the remedy no longer tells adopters to **widen**
      a correctly-scoped exemption to silence a false finding, and the test that
      encoded `gates/**` as "the typo case" is corrected — it had pinned the bug
      as expected behaviour. An **agreement test** is added and proven: with the
      hard-coded `base` reintroduced, exactly one test fails.

      **The docs correction that preceded this was itself wrong**, and is
      recorded because the sequence is the lesson. An adopter review reported
      the shipped example `ruleFiles: ['scripts/**']` as broken, having measured
      raw `picomatch('scripts/**')` against an absolute path. That measurement is
      real but the premise is not: the rule does not use raw picomatch, it uses
      `resideInFile`. The example was correct; it was changed to
      `'**/scripts/**'` on the strength of a plausible finding that had not been
      checked against the actual code path, and changed back. A finding measured
      against the wrong mechanism is still a wrong finding.

- [x] **REVIEW ROUND, 2026-09-06 — four more findings, three of them real gaps
      in what shipped.** A seven-persona panel; enforcement, testing and devops
      re-ran the sabotage table independently and it reproduced.

      1. **`rule-files-matches-nothing` had NO non-vacuity coverage** (testing,
         Critical). Verified by emptying `ruleFilesFindings` to `return []`:
         the fixture still exited 1, because its one scenario only exercised the
         rule id. This is bug 0240's lesson — one row standing for several
         findings — recurring in the change that cites it. Fixed with a **second
         scenario and a second `GATE_FOR` row**, one per finding; the emptied
         producer now correctly reports vacuous. 83 fixtures, was 82.
      2. **A fourth escape, unstated** (enforcement, Important):
         `const { finishPreset: done } = await import('@nielspeter/eess')` is
         caught by neither leg — the import leg because `TYPE_IMPORT_KINDS` sets
         `dynamic: false` by design, the call leg because the callee text is
         `done`. Both blind on one line, so "the two conditions cover each
         other's blind spot" was false for this shape. Measured, pinned by a
         **KNOWN-GAP test** so closing it turns the test red, stated in the
         source comment, `docs/presets.md` and the changeset, and filed as
         [bug 0264](../../bugs/0264-a-dynamic-import-escapes-the-verdict-rule.md).
         The static renamed import IS caught — also now asserted rather than
         claimed in a comment.
      3. **`check-guardrails.mjs` said it runs "the preset"** and runs four of
         its five rules (enforcement, Important). An unstated exemption, in the
         script whose own header records it being created to end exactly that.
         Header corrected to say four of five, and why the fifth is absent.
      4. **The "reports twice" argument was never exercised** (testing, Minor).
         The suite keys assertions on basenames rather than counts because a
         module can trip both legs; no fixture did. `double-trip.ts` added.

      Devops abstained from criticals after checking the changeset, both config
      exclusions, gate ordering and the `dist` failure modes — all sound.

- [x] Phase 4 — `docs/presets.md` gains the `agentGuardrails` section it never
      had, including the three ceilings stated plainly; `docs/agent-integration.md`
      recipe 3 names the imperative as the "do not hand-roll a gate" line and why
      the remedy does not lead with the file move; changeset names the rule id,
      the `overrides` opt-out, the default-off upgrade path and the expected
      first red on preset modules.
- [x] `/close` — authored in PR #110, before merge. **Deferred: one, and it has
      a home**: the dynamic-import escape is `deferred→`
      [bug 0264](../../bugs/0264-a-dynamic-import-escapes-the-verdict-rule.md),
      created when the enforcement review found it, on `BUGS.md`, and pinned by
      a KNOWN-GAP test so closing it turns that test red. Nothing else from this
      plan is owed: every Out-of-scope item was declared up front with its own
      home and none was discovered mid-build.

      **The last Success criterion was verified at close rather than assumed.**
      "The regenerated `AGENTS.md` block carries the imperative" had never been
      run. It does — `npx eess-ts explain <rules> --format agent` emits it
      verbatim, and the line leads with the construction that reaches the
      evidence floor rather than the file move, which was the half that mattered.
      Getting there took two wrong invocations of my own (`dist/cli/index.js`
      instead of the real bin `dist/cli/bin.js`, and a probe outside the repo
      where the package could not resolve), each of which returned **exit 0 with
      empty output** — indistinguishable from bug 0134's real defect. A third
      instance this session of a measurement apparatus failing silently and
      reading as a finding.

Deferred: [bug 0264](../../bugs/0264-a-dynamic-import-escapes-the-verdict-rule.md) — the
dynamic-import escape, found by review, filed with a home and pinned by a test
that reds when it is closed.
