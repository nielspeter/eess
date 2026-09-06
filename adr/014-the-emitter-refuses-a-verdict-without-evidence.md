# ADR-014: The emitter refuses a verdict without evidence

## Status

**Accepted** — 2026-09-03.

Drafted the same day from the review of
[proposal 009](../work/proposals/009-core-a-verdict-cannot-be-assembled-by-hand.md),
whose Problem section every review lens accepted and whose mechanism none did,
and accepted after a consistency check against ADRs 008, 009, 010, 011 and 013
and the manifesto, which amended §1, §4, §5 and §6 before acceptance. Extends
[ADR-010](./010-a-pass-is-constructed-from-evidence.md) by one seam; amends the
implementation, not the principle, of
[ADR-008](./008-caller-owns-reporting.md), which carries the amendment. Every
Enforcement row below is `pending` and owned by
[plan 0235](../work/plans/completed/0235-the-emitter-takes-a-receipt.md): decided is not
enforced, and this document claims nothing the build has not yet made true.

## Context

ADR-010's Decision reads: _"A pass that is merely 'no violations were collected'
is unrepresentable."_ Its §2 binds that to **_"every published family's terminal
path — `.check()` / `.warn()`"_** and says nothing about the path a preset author
or a script author takes. That silence is reachable in one line:

```ts
import { finishPreset, type ArchViolation } from '@nielspeter/eess'
const violations: ArchViolation[] = []
for (const d of corpus(...).documents()) {
  if (!looksRight(d)) continue // a bug here examines nothing, and nothing can see it
}
finishPreset(violations, { report: 'throw' }) // ✓
```

`finishPreset` and `reportViolations` take a bare `ArchViolation[]`.
`reportViolations`'s second line is `if (violations.length === 0) return`. Neither
can tell an array a builder produced from an array a caller typed, and an empty
one is a silent pass either way.

**This is measured, not hypothetical.** A consuming project shipped four corpus
gates in exactly that shape — eess's types, eess's printer, eess's corpus loader,
and no `RuleBuilder` — and found three of them **inert inside one week**: a
`continue` on a malformed row, a counter that fell from 38 to 0 under
`✓ 0 violations`, a header count compared against nothing. The third defect
shipped in the commit that fixed the second. The project's own diagnosis:
_"they took the library's output format and walked around its pipeline, which is
the exact opposite of using it."_

**Who wrote them is the point.** An AI coding agent, instructed in the same
session to embrace eess. It did not misuse the library; it used three documented
public affordances in a documented way and was rewarded with green. That is an
affordance defect: the wrong construction is reachable, plausible, and — for
eess's own primary stated consumer — the natural one. `eess-ts` ships a preset for
"the mistakes AI coding agents make most often". This is one of them, and eess
currently helps make it.

**The pipeline is not at fault.** The same project measured the builder path: a
dead selector through `docs(...).should().haveSection(...)` returns one
configuration finding, with zero configuration. The same dead selector in the
hand-rolled loop returns `[]` and a tick. ADR-010 works where it applies. It does
not apply where the agent went.

**The repo already knew.**
[Bug 0190](../work/bugs/fixed/0190-the-preset-constructs-nothing-finding-cannot-fire.md)
(2026-08-21) found `presetConstructsNothingViolation` has **no call site** — the
finding written to cover "a preset that constructs nothing" cannot fire — and
named the cause as structural: `finishPreset` receives violations, never the
builder list, so _"'this preset constructed zero rules' is not a fact available
at that seam."_ `scripts/vacuity-matrix.mjs` comments that the case "must stay
detectable" while pointing at a constructor nothing constructs. 0190's fix was
"undecided, and the decision is the work". This is that decision.

## Decision

> **Evidence is required at every seam where a verdict leaves eess, not only at
> the terminal. The emitters — `finishPreset` and `reportViolations` — take a
> value that carries what was examined, and hand the same value back. A value
> carrying no evidence at all is a configuration finding on every path. A value
> whose evidence is zero and whose violations are empty, absent a declaration,
> is a configuration finding. Both fail, neither can be suppressed, and both
> are produced before the delivery mode is applied, so they leave by whichever
> door the verdict does. A value that already carries a finding is red, and the
> emitter adds nothing to it. Every builder's `violations()` returns that same
> value, and bundled verdicts merge through one kernel merge that a dead member
> cannot hide inside. A pass that is merely "an empty array" is unrepresentable
> at this seam, as ADR-010 already makes it at the terminal.**

Seven parts.

### 1. The seam is every emitter, and the fact is `examined`

ADR-010 §2 binds `.check()` / `.warn()`. This binds every exported path a
verdict can leave on. The kernel root exports three today: `finishPreset`,
`reportViolations`, and `throwIfViolations` — the last a one-line alias for
`finishPreset(v, { report: 'throw' })` that ADR-008 kept for compatibility and
that this decision **removes**, because an alias that still takes a bare array
is the hole, spelled differently. A dialect path that throws without emitting
under a run-level aggregating caller (ADR-008's amendment; `eess-ts`'s
`deliver()`) is an emitter for this purpose too, and is bound the same way.

The value every emitter accepts, and hands back, is the evidence shape ADR-010
already mandates and every terminal already produces — `CollectResult`, which
keeps its name and changes its shape: an `ArchViolation[]` carrying
`examined: number`, `sourceEmpty?: true` and `declaredEmpty?: true` as its own
properties. An array, not an object wrapping one, for a reason the first draft
of this section got wrong: an object turns every untyped `.length` read into
`undefined > 0`, false forever — a silent green in every JavaScript consumer and
in this repo's own gate scripts (`scripts/check-corpus.mjs:150` was measured
going permanently green under the object shape). An array keeps `.length` and
iteration correct while the field stays unomittable for a TypeScript consumer.
The kernel exports one constructor for it, which is also where the runtime guard
lives, and one merge (§7).

It is built by every terminal, **returned by every builder's `violations()`** —
not by an accessor beside it, because an accessor can be declined and the
evidence is optional again by another route — returned by `dispatchRule`, and
accepted and returned by every emitter. `RuleBuilderLike`'s one member carries
it, so an adopter's hand-rolled rule file that cannot say what it examined stops
compiling where it is compiled, and reds at the merge (§7) where it is not. A
caller who assembles by hand assembles the same shape with the same constructor.

**Where a hand-assembler counts is where ADR-010 §1 says.** Evidence is the
units the caller's own assertion ran over, counted where that happened — not
files loaded, documents found, or a selection before the loop's own `continue`.
Those are diagnosis, and the difference is the whole bug: a loop that loads
forty documents and skips every one has examined zero. A script that wraps a
preset does not count at all — the preset's receipt flows through
`report: 'return'` and the script hands it on.

### 2. The device is a required field, not a registry — because the target is the honest mistake

Proposal 009 optimized against a forger and reached for a `WeakSet` keyed on
violation objects. That collides with ADR-010 §2's cap on kernel-bound registries
(_"nothing may add a fourth"_), and it cannot answer the case 009 itself called
the important one: a `WeakSet` on elements has nothing to interrogate when the
array is empty, and the empty array is the **dominant** path — every clean preset
run in every package produces one.

The measured failure was not forgery. The agent did not know it should count.
Against that target, **unomittable** is the whole requirement, and a required
field delivers it:

- it cannot be left out — the code does not compile;
- to get it wrong, a caller must type a number they know is false — a lie that
  is written, not an oversight that is invisible;
- it adds no registry, so ADR-010's cap is untouched;
- for a TypeScript consumer it fails at edit time, before any gate runs.

This is [ADR-013](./013-the-kernel-takes-the-fact-not-the-project.md)'s shape a
third time: the kernel takes what it needs to _say_ — a number — not the thing
it would have to _understand_ to derive one. Bug 0190 diagnosed that the emitter
cannot see the builder list; the answer is not to show it the list.

Stated as the honest ceiling: this closes **correctness**, not **forgery**. A
supplied `examined: 500` over a loop that skipped everything is still a green
lie. So is the honest version, and it is the one to expect from the consumer
this ADR is for: a count taken at the wrong place — `documents.length` before
the loop's own `continue` — is not a lie, it is the same mistake one line
earlier, and the required field cannot tell it from the right number. §1 says
where to count; only a fixture that breaks the loop and expects red proves the
count means anything, which is what this repo's non-vacuity harness is for its
own gates and what an adopter owes theirs. That is a strictly better position
than today's — where `[]` is indistinguishable by construction, with nobody
lying — and it is the position ADR-010 already occupies at the terminal, where
`examined` is a number a family computes and a family could compute wrongly.

### 3. Hand-assembly stays legal; an evidence-free verdict does not

Nothing here bans building an `ArchViolation` by hand. This repo's own
`spec.rules.ts` does it inside a `Condition`, correctly; `eess-crossvalidate`
does it for a parse failure it wants to report against the document rather than
throw. What changes is what such a caller may hand to an emitter: the violations
_and_ the count of what was examined to find them. Zero examined without a
declaration is a configuration finding.

ADR-010 §3's declared-empty grammar reaches the emitter **on the receipt**, as
`declaredEmpty`, not through delivery options. One boolean over a sum cannot
carry per-rule declarations, and the terminal already holds the fact at the
moment it decides not to fire (`packages/core/src/terminal-builder.ts:258-277`)
and today discards it. A cardinality-exempt rule sets the same flag: `.notExist()`
over zero subjects is a declaration by construction. The grammar's expiry comes
with it: a receipt declared empty that arrives with `examined > 0` is the
expired-declaration finding at the emitter, the mirror of what the terminal
produces for its own rules.

**A declaration is one a caller made over a live instrument — never one eess
infers from a configuration.** `expectEmpty` is an assertion whose author can be
wrong and which reddens the day a unit is examined. `overrides: { id: 'off' }` is
an instruction, and it is byte-identical whether the author meant "I have scoped
this out" or "I turned this off to stop a finding." eess is not positioned to
tell those apart, so by ADR-013's rule it must not decide: the party that knows
hands the fact over, or there is no fact.

**A preset that constructed zero rules is therefore a configuration finding, not
a declaration** — and this is the terminal's own precedence one level up, not a
new ruling. `sourceEmpty` already governs the identical shape: nothing was loaded
before any predicate ran, so there is no selection to widen and no assertion that
can expire, and §3's own grammar cannot rescue it. Measured against the shipped
kernel: `.expectEmpty()` over a `sourceEmpty` instrument yields the
configuration finding, while `.expectEmpty()` over a loaded project whose
selection narrowed to zero is green. Zero rules constructed is `sourceEmpty` at
the preset seam — no instrument was ever built — so it takes the same answer.
All-off remains a legitimate thing to intend; what it is not is a thing eess may
certify on the author's behalf. The reachable remedies are the ones ADR-010 §3
already names: declare the rules empty while leaving them on, so the declaration
expires, or remove a call that enforces nothing.

### 4. The finding is about a pass, and it names its cause

A terminal that examined nothing has already said so: its own configuration
finding arrives at the emitter as `{ violations: [that finding], examined: 0 }`,
because a family counts its units before the floor converts zero into a
finding. The emitter does not stack a second cause on top — a value that
already carries a finding is red, and "you constructed nothing" would be a
false remedy beside "your glob is dead". The emitter's own finding fires on a
**pass** without evidence: zero examined, zero violations, no declaration. A
value with no evidence field at all is the exception — that is a shape defect,
and its remedy (pass the receipt) is real on every path.

ADR-010 §4 applies at this seam as it does at the terminal: the finding names
its cause's remedy, and the emitter can fire for more than one. An empty source
(`sourceEmpty`) outranks any declaration and names the source. A preset that
constructed zero rules has a preset's remedy — enable an option, or remove the
call — and only the preset plumbing knows it is a preset, so it names that
remedy itself before handing over, the way `ownsDiscoveryDiagnosis()` already
lets a builder own its own diagnosis. What reaches the kernel emitter without
either is a hand-assembled receipt, and the kernel names the hand-assembler's
remedy: the loop reached its assertion zero times — fix the selection, or
declare it empty if the set legitimately is. The kernel never names a preset's
options at a seam that may not be a preset.

### 5. The finding leaves by every door

ADR-008 gives the caller `throw`, `return` and `warn`, and its amendment gives a
run-level aggregating caller a throw with no emission. The evidence finding is
produced before any of that is decided, so it is in the returned value under
`return`, where the caller owns it, and rides the `ArchRuleError` under `throw`
and under aggregation. Under `warn`, and under a bare `reportViolations`,
nothing is handed back that a caller must act on — so there the finding
**throws**, exactly as the terminal's warn path already escalates an
unsuppressable finding (`packages/core/src/execute-rule.ts:255-257`), and as the
finding's own text promises: not by `.warn()`. A printed unsuppressable finding
above a zero exit is the lie by another name. ADR-008's invariant — suppress
exactly what rides the throw, and nothing else — holds because the finding is a
violation like any other by the time delivery is chosen. The value handed back is the value handed
in, plus that finding when it was produced: evidence flows through, so a caller
that owns reporting reports the receipt it was given rather than deriving a
number of its own.

### 6. ADR-008 keeps its principle and amends its implementation

"A check detects; the caller decides how — and whether — to emit" is unchanged.
The caller still owns `report: 'throw' | 'return' | 'warn'` and the format. What
the caller is **allowed to hand over** narrows, and what comes back widens.
ADR-008's sentence _"`reportViolations` … never throws or filters"_ narrows by
one clause: it never throws **on violations** and never filters them; it throws
on a configuration finding it produced itself, because that finding is
unsuppressable and a door that hands nothing back has no other way to be red
(§5).

Four of ADR-008's statements are superseded at these symbols, and its amendment
section of the same date says so, in the form its 2026-08-22 amendment uses:

- _"Preset return type is `ArchViolation[]`"_ — a preset, and `finishPreset`,
  hand back the receipt. It is still an array, so a caller that wrote `.length`
  on the result keeps writing `.length`; what changes is that the array now
  carries its evidence, and an untyped consumer's exit line stays correct
  instead of reading `undefined`.
- _"never throws or filters"_ — never throws on violations; throws on its own
  configuration finding.
- _"`throwIfViolations` is retained … for compatibility"_ — removed, per §1.
- _"Existing call sites are unaffected … the option is additive"_ — true of
  ADR-008's own change, and not of this one. Every call site changes, and the
  changeset says so.

### 7. Bundled verdicts merge fail-closed

ADR-010 §1 counts evidence at the examining seam, and a script that runs nine
checks has nine seams. A single receipt whose `examined` is their sum is honest
about the whole and blind to any one member — the measured failure shape, three
gates going inert one at a time. So every hand-assembled check produces its own
receipt, and bundling happens only through the kernel's one merge, which is
fail-closed: a member with zero examined and no declaration contributes the
configuration finding to the merged result; a member with no integer `examined`
at all contributes the no-evidence finding; the merged receipt is declared empty
only if every zero-contributing member was, and `sourceEmpty` if any member is;
a merge over zero members is zero examined, undeclared. `checkAll` and the
`eess-ts` CLI aggregate through this merge, which is what makes a rule file that
exports `{ violations: () => [] }` red rather than green: it arrives as a bare
member. An adopter who sums by hand instead of calling the merge has rebuilt the
summed receipt, and that is a stated ceiling below.

### Amendment 2026-09-03 — after plan 0235's review

Accepted in the morning with an object-shaped receipt, a declaration carried on
delivery options, a printed finding under `warn`, and no statement about bundled
verdicts. Plan 0235's six-lens review the same afternoon measured each against
the source and found a silent green behind each: the object shape turned this
repo's own ADR gate permanently green at `scripts/check-corpus.mjs:150`; an
options-carried declaration could not distinguish a declared-empty rule from a
vacuous one inside a preset; the warn door printed an unsuppressable finding
above a zero exit; and a summed receipt was blind to one dead check among nine.
§1, §3, §5 and §6 are rewritten above and §7 added, each with its reason. The
decision's principle is unchanged; four places where it could still lie green
are closed. Recorded here rather than edited away, per this repo's own rule
about corrections.

### Amendment 2026-09-05 — the all-off preset, after plan 0235's Phase 0 stopped on it

Accepted on 2026-09-03 with the sentence "a preset every rule of which was
disabled is declared, not red — the standing ruling that all-off is a permanent,
legitimate decision holds in every dialect", and with `dispatchRule` named as the
mint. Building plan 0235's Phase 0 measured three things against the source that
the sentence does not survive.

**The mint named does not reach the presets it was named for.** No `eess-ts`
preset calls `dispatchRule` — measured, zero call sites; only `eess-md`'s
`adrEnforcement` does. `recommended` handles `'off'` itself with a `continue`.
The clause's other half — the preset plumbing is handed the fact — was therefore
carrying the whole ruling alone.

**The declaration it would mint is one the codebase forbids a user to write.**
`declaredEmptyFindings` reports an `expectEmpty` id naming a rule set to `'off'`,
and says why: "`'off'` deleted the rule, so the declaration about it is dead." An
author may not declare an off rule empty. Minting that same declaration for them,
for every rule at once, is the inverse of a rule the gate already enforces.

**And the shipped terminal already rules on the shape.** `.expectEmpty()` over a
`sourceEmpty` instrument returns the configuration finding; over a loaded project
with an empty selection it returns nothing. Zero rules constructed is the first
of those, one level up. The ruling was available in the code and this ADR
contradicted it.

§3 is rewritten above: a declaration is one a caller made over a live instrument,
and a preset that constructed zero rules is a configuration finding. The
principle is unchanged — all-off stays a legitimate intent — and what closes is
eess certifying that intent on the author's behalf from a config file it read.
Bug 0261 is the measured instance: `recommended()` with every rule `'off'`
returns `[]` today, carrying neither a finding nor a declaration.

Recorded here rather than edited away, per this repo's own rule about
corrections.

## Alternatives rejected

- **A registry of minted violations** (proposal 009, Ask A as written). Cannot
  see `[]`; adds a fourth kernel registry against ADR-010 §2; and its named mint
  site — the kernel's `applyFilters` — is never reached by `eess-ts`, which
  forked that function and calls its own, so a mint there would register nothing
  the flagship dialect produces and turn every one of its presets red.
- **A guardrail rule banning emitter calls outside rule files** (009's Ask C; the
  consuming project's own rules). Real, worth shipping as a preset rule, and
  measured in the field down to the `(^|\.)` anchoring that a star import
  otherwise defeats. But it is opt-in per adopter and changes nothing about what
  eess **permits**. An adopter who never enables it is exactly where the
  consuming project was. A lint is not a contract.
- **Moving the emitters to `/internal`** (009's Ask B). The symbols are
  documented public API and re-exported by `eess-md` and `eess-ts`; hiding them
  breaks `family/re-export-complete`'s standalone-sufficiency invariant for three
  packages, and a hidden seam is not an honest one.
- **The vacuity matrix as sufficient.** It audits eess's own five presets in
  eess's own CI. 0190 states the limit in its own words: _"it says nothing about
  an adopter's preset, and produces no finding in an adopter's build."_ The
  adopter's build is what was measured failing.
- **Keeping `throwIfViolations` as a bare-array alias.** Its whole body is a
  call to `finishPreset`; ADR-008 defines it as that. Retyped, it is a second
  name for the same seam; left alone, it is the seam with the lock removed. A
  breaking release is when a compatibility alias earns its deletion, and every
  adopter who used it is changing that line anyway.
- **A count of what was loaded as the hand-assembler's evidence.** Cheaper —
  every gate in this repo already prints one — and exactly what ADR-010 §1
  excludes: files loaded is diagnosis. The measured bug is a loop that loaded
  everything and examined nothing; a denominator counted before the loop cannot
  see it.

## Consequences

- **Breaking, on 0.x, across six packages.** `@nielspeter/eess` moves minor-as-break
  and the changeset must **name** `-ts`, `-md`, `-mermaid`, `-gherkin` and
  `-crossvalidate`, per bug 0185's class; a dependent shipping this under
  "Updated dependencies" is the failure that record exists for.
- **Every emitter call site supplies evidence, and each becomes more honest.** In
  this repo, counted: the kernel's `executeCheck` and `dispatchRule`;
  `eess-ts`'s `deliver()` on both of its branches and the four synthetic
  builders that return `{ violations: () => [...] }`; six `eess-crossvalidate`
  presets and two `eess-md` presets (`adrEnforcement`, `honestyAtClose`) that
  assemble an array and finish it; five gate scripts under `scripts/`, each
  check in them its own receipt. Each states what its own assertion ran over — a
  crossvalidate preset the documents it iterated, the synthetic builders the
  preset's own configuration (`examined: 1`), `deliver()` the merge of its
  builders' receipts. The two scripts that wrap a preset pass the preset's
  receipt through and count nothing themselves. None loses a finding; the
  review that found them established that a finding's `bypassFilters` and
  remedy survive untouched.
- **Every builder's `violations()` changes type, and the flagship's own verdict
  paths carry evidence.** `checkAll` and the `eess-ts` CLI aggregate through the
  merge, so a hand-rolled builder in a rule file — the one place adopters put
  builders, loaded without a type-check — cannot pass them green.
- **`throwIfViolations` is gone, and `dispatchRule` returns the receipt.** Both
  are documented root exports; `docs/api-reference.md`'s rows change with them,
  and the changeset names the removal.
- **ADR-008 gains an amendment section** naming the three statements §6
  supersedes, so its text does not contradict the kernel it describes.
- **Bug 0190 closes by construction.** The fact it says is unavailable at the
  seam — zero rules constructed, zero units examined — is now the seam's input.
  `presetConstructsNothingViolation` either becomes producible from it or is
  deleted, per 0190's own closure condition; it does not stay exported and
  unreachable.
- **TypeScript consumers get the finding at edit time; everyone else at run
  time, and loudly.** JavaScript callers and `--format json` pipelines that pass
  a bare array receive the configuration finding through the emitter, which is
  the fail-closed default ADR-009 rule 1 requires. Because the receipt is an
  array, an untyped consumer's `.length` read on what comes back stays correct;
  it does not silently become `undefined`.
- **The declared-empty grammar rides the receipt.** A terminal that declined to
  fire because a rule declared itself empty, or asserted cardinality, hands the
  fact upward as `declaredEmpty`; `dispatchRule` mints it for a rule turned off;
  the emitter reads it and never has to infer it. ADR-010 §3's precedence — an
  empty source outranks any token — applies unchanged, and so does its expiry.
- **What it does not do.** It does not detect a wrong `examined`, lied or
  honestly miscounted (§2). It does not reach an adopter who sums receipts by
  hand instead of calling the merge (§7). It does not reach a caller who never
  calls an emitter — one who formats and exits on its own; ADR-010 §2 names the
  same weakness for a verdict factory nothing forces a terminal to call, and
  here it is the ceiling. Only the guardrail rule (Ask C)
  sees that caller, which is why this ADR does not replace it: it catches both
  patterns earlier and cheaper for adopters who enable it, and this ADR's
  dogfood row below turns it into a requirement for this repo's own scripts. It
  does not touch ADR-003's grammar, ADR-011's root/internal split, or the
  terminal seam.

## Enforcement

| Clause                                                                         | Tier | Mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Status    |
| ------------------------------------------------------------------------------ | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| The emitters' input type carries `examined`; a bare array does not compile     | 1    | The signature itself (`CollectResult`, not `ArchViolation[]`) — a bare array is a type error, and `npm run typecheck` gates it. `packages/core/tests/emitter-refuses-without-evidence.test.ts` ("a bare array reaching finishPreset is the no-receipt finding") pins the runtime half for untyped JS callers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `gated`   |
| `violations()` returns the receipt on every builder                            | 1    | The signature on the kernel's `TerminalBuilder` and on `eess-ts`'s, plus `RuleBuilderLike`'s single member; `npm run typecheck` across all six packages                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `gated`   |
| `dispatchRule` returns the receipt                                             | 1    | Its signature, and its `'off'` branch returns a measured zero marked `notRun` rather than a declaration — `packages/core/tests/preset-dispatch.test.ts` exercises the dispatch paths, and `npm run typecheck` gates the return type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `gated`   |
| `throwIfViolations` is not exported                                            | 1    | **Not done.** It is still exported from `packages/core/src/index.ts` and `packages/ts/src/index.ts`. Split out of the row above rather than left bundled with a clause that IS satisfied, because a half-true row reads as gated — owned by [plan 0263](../work/plans/0263-adr-014s-residual-enforcement-rows.md) Phase 5, where it is a breaking change in two packages                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `pending` |
| Zero examined at the emitter is a configuration finding, unsuppressable        | 2    | Three probes in `scripts/vacuity-matrix.mjs` (`EMITTER_PROBES`) hand the emitters a bare array and a zero-examined receipt; `npm run check:vacuity`. `packages/core/tests/emitter-refuses-without-evidence.test.ts` ("zero examined, zero violations, no declaration is the vacuous-pass finding")                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `gated`   |
| Bundled verdicts merge fail-closed: one dead member reds                       | 2    | `packages/core/tests/emitter-refuses-without-evidence.test.ts` ("declared only if EVERY zero-contributing member declared") and ("a bare member is the no-receipt finding, not a silent zero"). End to end on the production script: `check:nonvacuity`'s `emitter/one-dead-check` plants a `continue` in ONE of `scripts/check-corpus.mjs`'s checks and asserts the finding fires while the others still examined                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `gated`   |
| A rule file exporting an evidence-free builder reds the CLI and `checkAll`     | 2    | A non-vacuity fixture: a rule file exporting a builder whose `violations()` is a bare empty array must red `eess-ts check`; a test that `checkAll` over the same throws — owned by [plan 0263](../work/plans/0263-adr-014s-residual-enforcement-rows.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `pending` |
| A terminal's own finding arrives once                                          | 2    | `packages/core/tests/emitter-refuses-without-evidence.test.ts` ("does NOT stack on a receipt that already carries a finding") and ("carries THAT finding through, asserted by identity not by length")                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `gated`   |
| The finding leaves by every door                                               | 2    | `packages/core/tests/emitter-refuses-without-evidence.test.ts` ("rides the throw under the default throw mode"), ("THROWS under a bare reportViolations, which hands nothing back to act on") and ("is returned, not thrown, under report: return — the caller owns it")                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `gated`   |
| The finding names its cause, and the remedy remediates                         | 2    | Fixtures for each cause — no evidence field, `sourceEmpty`, zero examined with empty violations, an expired declaration — each cleared by applying the remedy its message states, per ADR-009 rule 2's behavioural corollary; and the kernel's message never names a preset's options — owned by [plan 0263](../work/plans/0263-adr-014s-residual-enforcement-rows.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `pending` |
| A declared-empty or cardinality-exempt preset stays green                      | 2    | `packages/core/tests/emitter-refuses-without-evidence.test.ts` ("CONTROL — zero examined WITH a declaration stays green"); and in the flagship dialect `packages/ts/tests/core/dead-selector-fails.test.ts` · `it('exempts a condition that declares emptiness as its passing state')`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `gated`   |
| Every flag that can quiet a zero can be contradicted                           | 2    | `notRun` shipped as the one exception — the flag that exempts a member from `mergeCollectResults`'s dead filter, with no falsifier, while `declaredEmpty` had the expiry. Found by an enforcement review of the change that established the rule. `emitter/contradictory-evidence` fires when a receipt marked never-run carries a non-zero `examined` OR a violation, checked at the gate (`packages/core/src/report.ts`) AND in the merge (`packages/core/src/collect-result.ts`), because the merged receipt carries no `notRun` and the merge is the only door that can see a lying member. `packages/core/tests/emitter-refuses-without-evidence.test.ts` — six tests including both controls, five of which red when the mechanism is removed (measured); a fifth `EMITTER_PROBES` entry under `npm run check:vacuity`                                                                                                                                                 | `gated`   |
| A terminal's verdict flows through unchanged, except where this ADR changes it | 2    | The existing terminal tests in `packages/core/tests/` and `packages/ts/tests/core/` still pass, and `npm run test` gates them. **Measured at close, because the first version of this row claimed they ran "unmodified" and that was false:** 46 assertion lines removed and 88 added across both directories — **41 of the 46 are `toEqual([])` → `toHaveLength(0)`**, forced because the receipt is an array carrying own properties, and no assertion about violation _content_ changed. The other five lines, in four places, are deliberate reversals of behaviour this ADR changes — the two "emits nothing for an empty set" assertions in `packages/core/tests/report.test.ts`, each replaced by an in-place `// REMOVED — plan 0235 Phase 1` note naming the seam, and two hand-rolled doubles in `packages/core/tests/execute-rule.test.ts` and `packages/ts/tests/core/evidence-at-every-seam.test.ts` that must now mint a receipt                               | `gated`   |
| No new kernel registry is added                                                | 1    | **Corrected 2026-09-06 at plan 0263's freeze — this row said `packages/core/src/cardinality.ts` is "the sole home", and it is not.** Measured: TWO kernel-bound `WeakSet` registries exist, `CARDINALITY_ASSERTERS` in `packages/core/src/cardinality.ts` and `OWNERS` in `packages/core/src/owns-empty-discovery.ts`, and `packages/core/src/owns-empty-discovery.ts`'s own comment says "the two markers share it". A rule written from the old text would have reddened on legitimate existing code on first run, and been weakened or exempted — the trap this correction removes. The mechanism is a rule in `arch.internal.rules.ts` asserting that no module under `packages/core/src` OTHER than those two constructs a `WeakSet`. Scoped to `WeakSet`: `packages/core/src/selection-memo.ts`'s two `WeakMap`s are a memo cache, not a suppression registry, and must not be caught — owned by [plan 0263](../work/plans/0263-adr-014s-residual-enforcement-rows.md) | `pending` |
| Every hand-assembled check in this repo supplies evidence                      | 2    | Not a rule over `scripts/**` — those files sit in no TypeScript project, so such a rule would select nothing, and over `packages/*/src` the compiler already enforces the field. One break-the-loop fixture per hand-assembled check under `check:corpus`, `check:ledger` and `check:release`, run on the default path — owned by [plan 0263](../work/plans/0263-adr-014s-residual-enforcement-rows.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `pending` |
| `presetConstructsNothingViolation` is producible or gone                       | 2    | **Gone.** Deleted from `packages/core/src/preset-dispatch.ts` and from `@nielspeter/eess/internal` (plan 0235 Phase 0) — measured first: its only occurrence in the workspace was its own definition. Re-adding it would have to pass `check:surface` (an undocumented root export) and `packages/ts/tests/matrix/vacuity-classification.ts`, which enumerates every published export in both directions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `gated`   |
| A wrong `examined` is not detected                                             | 5    | Stated ceiling, not a clause — nor an adopter who sums by hand, nor one who never calls an emitter. Review-enforced residue: Tier 5 because only a human reading the loop can judge the number; named so it is not mistaken for coverage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `n/a`     |
