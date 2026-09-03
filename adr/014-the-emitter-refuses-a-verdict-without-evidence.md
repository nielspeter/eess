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
[plan 0235](../work/plans/0235-the-emitter-takes-a-receipt.md): decided is not
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
[Bug 0190](../work/bugs/0190-the-preset-constructs-nothing-finding-cannot-fire.md)
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
> emitter adds nothing to it. A pass that is merely "an empty array" is
> unrepresentable at this seam, as ADR-010 already makes it at the terminal.**

Six parts.

### 1. The seam is every emitter, and the fact is `examined`

ADR-010 §2 binds `.check()` / `.warn()`. This binds every exported path a
verdict can leave on. The kernel root exports three today: `finishPreset`,
`reportViolations`, and `throwIfViolations` — the last a one-line alias for
`finishPreset(v, { report: 'throw' })` that ADR-008 kept for compatibility and
that this decision **removes**, because an alias that still takes a bare array
is the hole, spelled differently. A dialect path that throws without emitting
under a run-level aggregating caller (ADR-008's amendment; `eess-ts`'s
`deliver()`) is an emitter for this purpose too, and is bound the same way.

The value every emitter accepts is the evidence shape ADR-010 already mandates
and every terminal already produces — `CollectResult`'s
`{ violations, examined }` — not a new type. A terminal's output flows through
unchanged. `dispatchRule`, the kernel's per-rule step for a preset assembled by
hand, hands that shape back rather than a bare array, so a preset built from it
has the number to pass on. A caller who assembles by hand assembles the same
shape.

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
declaration is a configuration finding, and ADR-010 §3's declared-empty grammar
(`expectEmpty`, and its expiry the day the set stops being empty) reaches the
emitter through the same options the presets already thread.

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
declare `expectEmpty` if the set is legitimately empty. The kernel never names
a preset's options at a seam that may not be a preset.

### 5. The finding leaves by every door

ADR-008 gives the caller `throw`, `return` and `warn`, and its amendment gives a
run-level aggregating caller a throw with no emission. The evidence finding is
produced before any of that is decided, so it is in the returned value under
`return`, rides the `ArchRuleError` under `throw` and under aggregation, and is
written under `warn`. ADR-008's invariant — suppress exactly what rides the
throw, and nothing else — holds because the finding is a violation like any
other by the time delivery is chosen. The value handed back is the value handed
in, plus that finding when it was produced: evidence flows through, so a caller
that owns reporting reports the receipt it was given rather than deriving a
number of its own.

### 6. ADR-008 keeps its principle and amends its implementation

"A check detects; the caller decides how — and whether — to emit" is unchanged.
The caller still owns `report: 'throw' | 'return' | 'warn'` and the format. What
the caller is **allowed to hand over** narrows, and what comes back widens.
ADR-008's sentence _"`reportViolations` … never throws or filters"_ stays
literally true: it does not throw on violations and does not filter them; an
evidence-free input is turned into a configuration finding and emitted like any
other, and only `finishPreset` under `report: 'throw'` throws — which it
already does.

Three of ADR-008's statements are superseded at these symbols, and it gains an
amendment section saying so on the day this is accepted, in the form its
2026-08-22 amendment already uses:

- _"Preset return type is `ArchViolation[]`"_ — a preset, and `finishPreset`,
  hand back the receipt. A caller that wrote `.length` on the result writes
  `.violations.length`.
- _"`throwIfViolations` is retained … for compatibility"_ — removed, per §1.
- _"Existing call sites are unaffected … the option is additive"_ — true of
  ADR-008's own change, and not of this one. Every call site changes, and the
  changeset says so.

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
  this repo, counted: the kernel's `executeCheck` / `executeWarn` and
  `dispatchRule`; `eess-ts`'s `deliver()` on both of its branches and the four
  synthetic builders that return `{ violations: () => [...] }`; six
  `eess-crossvalidate` presets and two `eess-md` presets (`adrEnforcement`,
  `honestyAtClose`) that assemble an array and finish it; five gate scripts
  under `scripts/`. Each states what its own assertion ran over — a
  crossvalidate preset the documents it iterated, the synthetic builders the
  preset's own configuration (`examined: 1`), `deliver()` the sum of its
  builders' `examinedUnits()`. The two scripts that wrap a preset pass the
  preset's receipt through and count nothing themselves. None loses a finding;
  the review that found them established that a finding's `bypassFilters` and
  remedy survive untouched.
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
  time.** JavaScript callers and `--format json` pipelines that pass a bare array
  receive the configuration finding through the emitter, which is the fail-closed
  default ADR-009 rule 1 requires.
- **The declared-empty grammar has one more carrier.** Presets that thread
  `expectEmpty` to their rules thread it to the emitter too; a script author has
  it as an option. ADR-010 §3's precedence — an empty source outranks any token —
  applies unchanged.
- **What it does not do.** It does not detect a wrong `examined`, lied or
  honestly miscounted (§2). It does not reach a caller who never calls an emitter — one who formats and exits on its
  own; ADR-010 §2 names the same weakness for a verdict factory nothing forces a
  terminal to call, and here it is the ceiling. Only the guardrail rule (Ask C)
  sees that caller, which is why this ADR does not replace it: it catches both
  patterns earlier and cheaper for adopters who enable it, and this ADR's
  dogfood row below turns it into a requirement for this repo's own scripts. It
  does not touch ADR-003's grammar, ADR-011's root/internal split, or the
  terminal seam.

## Enforcement

| Clause                                                                      | Tier | Mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                   | Status    |
| --------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| The emitters' input type carries `examined`; a bare array does not compile  | 1    | The signature itself, plus a test in `packages/core/tests/report.test.ts` that hands each emitter an evidence-free value and asserts the configuration finding is what comes out — the file exists and covers the emitters today; the rows are owed — owned by [plan 0235](../work/plans/0235-the-emitter-takes-a-receipt.md)                                                                                                               | `pending` |
| `throwIfViolations` is not exported, and `dispatchRule` returns the receipt | 1    | The same test file asserts the kernel root has no such export and that `dispatchRule`'s result carries `examined`; `check:family` sees the removal in every dialect that re-exported it — owned by [plan 0235](../work/plans/0235-the-emitter-takes-a-receipt.md)                                                                                                                                                                           | `pending` |
| Zero examined at the emitter is a configuration finding, unsuppressable     | 2    | A row in `scripts/check-nonvacuity.mjs`: a fixture script that calls `finishPreset` with `examined: 0` and no declaration must exit red naming the finding's rule id — asserting identity, not exit code, per the harness's own doctrine — owned by [plan 0235](../work/plans/0235-the-emitter-takes-a-receipt.md)                                                                                                                          | `pending` |
| A terminal's own finding arrives once                                       | 2    | `packages/core/tests/report.test.ts`: a value carrying one `bypassFilters` finding and `examined: 0` comes out carrying exactly that one, never a second cause — owned by [plan 0235](../work/plans/0235-the-emitter-takes-a-receipt.md)                                                                                                                                                                                                    | `pending` |
| The finding leaves by every door                                            | 2    | `packages/core/tests/report.test.ts` for `return` and `warn`; a test under `packages/ts/tests/presets/` that the finding rides the `ArchRuleError` a run-level aggregating caller receives, per ADR-008's suppress-exactly-what-rides-the-throw invariant — owned by [plan 0235](../work/plans/0235-the-emitter-takes-a-receipt.md)                                                                                                         | `pending` |
| The finding names its cause, and the remedy remediates                      | 2    | Three fixtures — no evidence field, `sourceEmpty`, zero examined with empty violations — each cleared by applying the remedy its message states, per ADR-009 rule 2's behavioural corollary; and the kernel's message never names a preset's options — owned by [plan 0235](../work/plans/0235-the-emitter-takes-a-receipt.md)                                                                                                              | `pending` |
| A terminal's verdict flows through unchanged                                | 2    | The existing terminal tests in `packages/core/tests/` and `packages/ts/tests/core/` run unmodified — the retype is additive on the producing side — owned by [plan 0235](../work/plans/0235-the-emitter-takes-a-receipt.md)                                                                                                                                                                                                                 | `pending` |
| No new kernel registry is added                                             | 1    | `packages/core/src/cardinality.ts` remains the sole home of the kernel-bound `WeakSet` registries ADR-010 §2 caps; a rule in `arch.internal.rules.ts` asserting no other module under `packages/core/src` constructs one — owned by [plan 0235](../work/plans/0235-the-emitter-takes-a-receipt.md)                                                                                                                                          | `pending` |
| Every emitter call in this repo supplies evidence                           | 1    | An `eess-ts` rule over `scripts/**` and `packages/*/src/**` asserting each `finishPreset` / `reportViolations` call site passes the evidence shape — the dogfood form of 009's Ask C. Anchored on the callee (start of text or a preceding dot) so a namespace import cannot walk around it, which the consuming project measured its first version failing to do — owned by [plan 0235](../work/plans/0235-the-emitter-takes-a-receipt.md) | `pending` |
| `presetConstructsNothingViolation` is producible or gone                    | 2    | Bug 0190's own red test — a preset constructing zero rules produces the finding through `.check()`; owned by that record, unblocked by this decision — owned by [plan 0235](../work/plans/0235-the-emitter-takes-a-receipt.md)                                                                                                                                                                                                              | `pending` |
| A wrong `examined` is not detected                                          | 5    | Stated ceiling, not a clause. Review-enforced residue — Tier 5 because only a human reading the loop can judge the number — named so it is not mistaken for coverage                                                                                                                                                                                                                                                                        | `n/a`     |
