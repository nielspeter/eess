# Bug 0127: two non-vacuity fixtures rebuild the rule they guard and five exercise the shipped preset, so neither proves the production gate still invokes it — 35 of 44 dogfood rules have no fixture of any kind

## Status

- **State:** Draft — measured, corrected under review, and the correction is
  recorded below rather than edited away. No red test yet.
- **Severity:** High — on the reproduction, not on the ratio. `check:arch` passes
  green over six rules that assert nothing, which is `BUGS.md`'s High row (a gate
  passes over drift it should catch). Note what is _not_ claimed: only one of the
  44 rules examines zero units today, and that one is a legitimate empty (see
  Symptom). [0112](./0112-three-crossval-presets-have-no-fixture.md) is a strict
  subset of this record's population at Medium; if that severity is right, the
  boundary is that 0112 counts absent fixtures and this counts fixtures that
  cannot see the production gate.
- **Origin:** self-found · instrumented both kernel seams while scoping the
  ts-archunit doctrine port ([0088](../plans/0088-fold-ts-archunit-into-eess.md),
  and [0103](./0103-adr-009-cited-but-does-not-exist.md), which cites the doctrine)
- **Reported:** 2026-08-12

### Correction, 2026-08-12 — what the six-persona review found wrong in this record

Kept because a record about uncounted coverage that hides its own miscount is
worth nothing.

| first draft claimed                             | measured                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| 38 rules across six gates                       | **44** across eight — `check:baseline` (4) and `check:release` (2) were dropped |
| 3 covered by a fixture                          | **9**                                                                           |
| "All 25 rules in `check:arch`" uncovered        | two are covered                                                                 |
| the harness "cannot cover production rules"     | three gates do exactly that                                                     |
| the reproduction empties 25 rules               | **6**                                                                           |
| the summary line is "byte-identical"            | identical but for elapsed time                                                  |
| fix 3 (drive the production rule file) is novel | already shipped for three gates                                                 |

The cause of the miscount is this record's own subject: coverage was enumerated
from one syntactic form (`gateNode(script, mustSay)` rows) and reported as
complete, so the three gates that assert via `firedOn(...)` were invisible. Two
reviewers found it independently; a third disproved the reproduction's
interpretation by experiment.

## Symptom

Instrumenting the two examining seams the dogfood gates use — `RuleBuilder`'s
post-predicate set and `CorrespondenceBuilder`'s sides — across the eight
rule-running gates in the `validate` chain:

| gate             | rules  | covered by a fixture |
| ---------------- | ------ | -------------------- |
| `check:arch`     | 25     | 2                    |
| `check:spec`     | 4      | 0                    |
| `check:diagram`  | 1      | 1                    |
| `check:corpus`   | 5      | 1                    |
| `check:ledger`   | 0      | —                    |
| `check:crossval` | 3      | 2                    |
| `check:baseline` | 4      | 1                    |
| `check:release`  | 2      | 2                    |
| **total**        | **44** | **9**                |

**35 rules have no fixture of any kind.** Every rule in `check:spec` — the gate
binding the README and the ADR index — is among them.

**Only one rule examines zero units**, and it is legitimate:
`release/changed-package-needs-changeset` sees 5 changeset declarations against 0
changed packages on a clean tree, which is the rule being satisfied, not failing.
Recorded because it is the concrete case a fail-closed floor must not red — see
Fix. (Caveat on the metric: a correspondence's "examined" was taken as
`min(left, right)`, a judgement, not a derivation.)

The three fixtures that do reach a production rule are the strongest in the
harness and were missed by the first draft. `gateArch`
(`scripts/check-nonvacuity.mjs:168`) plants a probe file in real source and runs
**`eess-ts check arch.rules.ts`** — the production rule file — asserting one
violation carrying both the production rule id and the probe. `gateInternalArch`
and `gateBaseline` do the same for `arch.internal.rules.ts` and the shipped
`recommended` preset.

The rest fall into two weaker tiers:

- **Rebuild the rule** — `bad-links.mjs`, `bad-pointers.mjs`. They construct
  their own rule with their own id (`nonvacuity/broken-links`), so they prove a
  **condition** fires over a broken corpus and nothing more.
- **Exercise the shipped preset over a fixture corpus** — `bad-adr.mjs`,
  `bad-ledger.mjs`, `bad-crossval.mjs`, `bad-md-ts.mjs`, `bad-gherkin-ts.mjs`.
  Stronger: the published code really fires. Still silent on whether the
  production gate script invokes it.

## Reproduction

Two rots, and the contrast between them is the finding.

**A — an uncovered rule.** `arch.rules.ts:24` defines `only()`, used by 6 of that
file's 7 rules:

```bash
# anchored on text, not a line number, and self-verifying.
# -F (fixed string) is load-bearing: the BRE form of this pattern silently
# fails to match and reports a false ANCHOR MOVED — measured while writing this.
grep -qF 'packages/${pkg}/src/**' arch.rules.ts || echo "ANCHOR MOVED — repro invalid"
perl -pi -e 's{packages/\$\{pkg\}/src/\*\*}{packages/\$\{pkg\}/NO_SUCH/**}' arch.rules.ts
git diff --quiet arch.rules.ts && echo "PATCH DID NOT APPLY — do not trust the result"

npm run check:arch        # exit 0 — "✓ eess-ts — 25 rules across 2 files · 0 failing"
npm run check:nonvacuity  # exit 0 — "20 gates each failed on their violating input"

git checkout -- arch.rules.ts
```

Six rules now assert nothing. `check:arch` is green and its summary is identical
but for elapsed time — the denominator counts rule objects and rule files, never
examined elements.

**B — a covered rule.** Rot `eess/adr002-no-raw-typescript`'s own selector
(`arch.rules.ts:42`) instead:

```
npm run check:arch        # exit 0 — same green, same summary
npm run check:nonvacuity  # exit 1
  nonvacuity: arch (root rules) — FAILED (did not fail on violating input)
```

**The harness is partial, not blind.** A rot that lands on a covered rule is
caught within one edit; A stays green only because the rules it empties are among
the 35. The first draft ran A, read the green as blindness, and built its prose on
that — a reproduction constructed so it could not have failed.

_(The first draft used `sed -i ''`, which is BSD-only. Under GNU sed the `''` is
consumed as the script, the file is unchanged, and the reader gets the claimed
green **for the wrong reason** — the failure this repo exists to catch, inside its
own reproduction. Hence the anchored, self-verifying form above.)_

## Root cause

Scoped to where it is true. The `gateNode` fixtures — both tiers — build their own
invocation, so nothing binds them to the production gate script. Measured, by an
enforcement reviewer: neutering the production link rule at
`scripts/check-corpus.mjs:54` (`const broken = linkRule.violations()` → `[]`) left
**`check:corpus` green and `bad-links.mjs` green**, the fixture still exiting 1 on
its own rebuilt copy. Fixture and subject are written from the same understanding
and agree even when the understanding is wrong — the shape
[0110](./fixed/0110-nonvacuity-gates-do-not-assert-which-rule-fired.md) closed one
layer down, when it made a fixture name the rule that fired. The rule it names is
still the fixture's own.

Underneath, the kernel fails open by construction at
`packages/core/src/rule-builder.ts:330` — an empty selection and a clean corpus
return the same value. `RuleBuilder` at least _knows_ `filtered.length` and could
report it; the `TerminalBuilder` seam at
`packages/core/src/terminal-builder.ts:159` returns `ArchViolation[]` with nowhere
to put evidence at all.

**The symptom ships.** `packages/ts/src/cli/commands/check.ts:65-66` computes the
summary from `builders.length` and `args.ruleFiles.length` — the invocation, never
work done — under a comment reading _"Report the denominator so a fast green is
provably non-vacuous."_ This is not a property of this repo's harness; every
adopter gets it, and `eess-ts init` scaffolds rule files against a guessed layout,
so an adopter whose sources sit outside the scaffolded glob gets a confident green
on their first run.

## Why it matters

ts-archunit's ADR-008: _"A check that cannot fail is worth less than no check,
because it is counted as coverage."_ `check:nonvacuity` prints `20 gates each
failed on their violating input — none is silently green`, which reads as the
gates being proven. It proves 20 fixtures and 9 rules.

## Fix

**Scoped to what closes in one PR.** The first draft's fix ladder was a programme,
and its lead item could not go red on its own reproduction (below).

1. **Convert `bad-links.mjs` and `bad-pointers.mjs` to the `gateArch` pattern** —
   plant the broken link/pointer in the real corpus, run the **production**
   `scripts/check-corpus.mjs`, assert one violation carrying the production rule
   id and the planted file. This is generalising a working in-repo pattern, not
   new machinery, and it is falsifiable by the sabotage above: with it in place,
   neutering `check-corpus.mjs:54` must red the gate.
2. **Correct `check:nonvacuity`'s summary sentence** to state what it measured —
   fixtures that fired, not gates proven — so the harness stops over-claiming
   while the coverage gap is open.

Both land together; (1) without (2) leaves the misleading sentence, and (2)
without (1) is a docs change.

**Explicitly not in this record**, with reasons:

- **A rule-level coverage denominator.** The first draft closed on this. It
  cannot: a count of which rules a fixture _names_ does not move when a rule
  examines nothing, so it stays green on both reproductions above — this record's
  own reviewer question answered "pass". It also cannot be derived today (8 of the
  44 rules are constructed inline inside `.mjs` scripts and exported nowhere), so
  the total would arrive hand-typed. If it is built, it must be a **set** measured
  against a dated committed baseline, not a scalar that a rule leaving and another
  joining leaves unmoved. → [0088](../plans/0088-fold-ts-archunit-into-eess.md)
  Phase 4a, which already specifies a shrink-only list with an expiry.
- **Evidence at the seam** (`{ violations, examined }`). The only fix that reddens
  reproduction A. Three costs the first draft understated: there are **eight**
  `collectViolations` implementations across the family, not one root, so
  ts-archunit's "~8 lines" is its cost and not ours; retyping the kernel's abstract
  member is a break across all six packages; and it needs a declared-empty grammar
  **first**, or `release/changed-package-needs-changeset` reds on every PR that
  touches no package, and stage 2 of `docs/eess-walkthrough-calculator.md:120` —
  which teaches writing rules before the code exists — goes red for every new
  adopter. → 0088 Phase 3/4.

**A measured constraint on the seam fix, which should not be rediscovered later:**
it reaches 44 of the family's checks and **not** `check:ledger`'s. `honestyAtClose`
constructs no builder — it imports `finishPreset` and iterates directly
(`packages/md/src/rules/ledger.ts:297`) — so it emitted zero evidence records. A
floor is necessary and not sufficient.

**Method scope, stated so it is not read as more than it is:** two of the family's
eight seams were instrumented, chosen because the dogfood gates use only those. The
six unmeasured seams (slice, cross-layer, tsconfig, smell, and the two graphql
builders) are outside this measurement, and the next dialect that ships a builder
is outside it by construction.

## Verification

- [ ] Red test written first: with (1) in place, neutering
      `scripts/check-corpus.mjs:54` must make `check:nonvacuity` exit 1 naming
      `corpus/broken-links`. Green today — measured.
- [ ] The converted fixtures assert the production rule id **and** the planted
      file in one violation, per `firedOn`'s existing contract.
- [ ] The probe surface moves out of `packages/*/src` first, or concurrent runs
      hand each other spurious violations (`scripts/check-nonvacuity.mjs:89`).
- [ ] `check:nonvacuity`'s summary states fixtures fired, not gates proven.
- [ ] `npm run validate` green.

Deferred, each re-homed:

- **The coverage denominator** → [0088](../plans/0088-fold-ts-archunit-into-eess.md)
  Phase 4a. Its four-verdict classification (`fail-open` · `config-finding` ·
  `other-throw` · `no-checks`) is a correction to that phase's stated three, and
  the `no-checks` cell is the preset-constructs-nothing hole 4a claims to expose.
- **Evidence at the seam, and the declared-empty grammar it requires** → 0088
  Phase 3/4.
- **The shipped CLI summary** (`packages/ts/src/cli/commands/check.ts:65`) — the
  adopter-facing half of this defect, fixable independently of the seam. Needs its
  own record.
