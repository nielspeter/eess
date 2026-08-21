# Plan 0193: Measure the margin

## Status

- **State:** Draft — the feasibility question is answered by a spike (below);
  what is not settled is the baseline ratchet and the mutation model.
- **Priority:** High — this is the number that would have caught most of what
  PR #72's two review rounds found, before a human had to.
- **Effort:** Medium. The measurement works today; the gate around it is the work.
- **Created:** 2026-08-21

## Problem

**Margin** is how many tests fail when a primitive is gutted so it can never
report. Margin 0 means the primitive cannot be falsified — a check that cannot
fail, ADR-009's object. Margin 1 means one deletion away from that.

Nothing computes it. The distribution below was produced by hand, once, over
about two hours, and exists nowhere in the repo:

| margin                    | primitives                                                                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0 — unfalsifiable**     | **6** (all fixed: bugs [0186](../bugs/fixed/0186-two-security-rules-cannot-fail.md), [0187](../bugs/fixed/0187-four-visibility-and-async-predicates-cannot-fail.md)) |
| **1 — one deletion away** | **42**                                                                                                                                                               |
| 2–3                       | 35                                                                                                                                                                   |
| 4–10                      | 62                                                                                                                                                                   |
| 11–30                     | 21                                                                                                                                                                   |
| 31+                       | 15                                                                                                                                                                   |

183 primitives across `src/rules/`, `src/conditions/`, `src/predicates/` and
`src/presets/`. Nearly a quarter sit at margin 1, and nothing would notice if any
of them reached 0 tomorrow.

**Every gate the repo has answers a different question.** `check:nonvacuity`
proves a _gate_ fails on a violating fixture. `check:vacuity` proves a published
_constructor_ is not fail-open. Neither asks how much would have to be deleted
before a primitive stopped being checked at all — and both of those gates went
blind at some point during the fold (see PR #72), which is itself the argument
for a number that is computed rather than asserted.

## The spike — measured 2026-08-21

The blocker was always cost: the hand sweep was ~33s per primitive × 183 ≈ 2
hours. Not a gate. Two findings change that.

**1. Narrowing by the import graph is sound and halves the cost.** A test that
cannot transitively reach a module cannot observe a change to it. Gutting
`noConsole` in `src/rules/security.ts`:

| run                                | files  | tests    | margin | time    |
| ---------------------------------- | ------ | -------- | ------ | ------- |
| full suite                         | 264    | 3540     | 4      | 33s     |
| import-reachable only              | 51     | 921      | 4      | 12s     |
| **+ text-readers + dist-touchers** | **76** | **1177** | **4**  | **16s** |

Same margin all three ways. The barrel (`src/index.ts`) is why the reduction is
2× rather than 10× — nearly everything is reachable from everything.

**Two edges the import graph cannot see**, both statically detectable and both
included unconditionally in the third row:

- **32 test files read `src/` as TEXT** (`readFileSync` over source) rather than
  importing it — source censuses, scanners, the `scan-enforceable-primitives`
  population walk.
- **4 test files touch `dist/`**, which is built from `src` and so observes
  changes without an import edge.

Omitting either makes the narrowing unsound. That is the difference between the
12s row and the 16s row, and the 4 seconds buys correctness.

**2. Diff-awareness is what makes it a gate.** Primitive-bearing files touched
per commit, measured over this branch's last eight:

```
dfd91cb 1   0062cf1 0   f624a4e 0   11b2d70 0
697c97e 0   253a69d 1   75871e3 1   b219429 1
```

**0–1 per commit.** A PR-time margin gate costs **~16 seconds**, not two hours.
It does not need to answer "what is every margin" — only "did this PR lower the
margin of anything it touched, and is anything it touched at zero."

The full sweep stays a periodic job. The gate becomes routine.

## Implementation phases

### Phase 1 — the measurement, as a committed script

`scripts/margin.mjs`: given a primitive, compute its covering test set (import
reachability ∪ text-readers ∪ dist-touchers), gut it, run only that set, return
the count. Must **refuse to report a number it cannot trust** — a run with no
parseable summary, or one containing a test timeout, returns `unmeasurable`, not
zero. The first sweep's harness defaulted to `0` on an unparseable run, which is
indistinguishable from _unfalsifiable_; that hole is not to be rebuilt.

Verify against the hand-measured values: `noConsole` 4, `noJsonParse` 2,
`arePublic` 3, `areNotAsync` 2.

### Phase 2 — the diff-aware gate

`check:margin`, PR-time. For each primitive whose source file changed against the
base ref: measure, and fail on **margin 0**. Reads the same base ref
`check:release` does, and hard-errors rather than passing when none resolves.

Fail on zero only, at first. A ratchet on the _number_ is Phase 3 and needs the
decision below.

### Phase 3 — the ratchet, or a reasoned refusal

Failing only on 0 catches the cliff, not the slide: 42 primitives at margin 1 can
each lose their last test one at a time and the gate stays green until the moment
it is already too late.

A stored per-primitive margin fixes that and introduces the exact hazard this
whole audit is about — a checked-in file of accepted numbers that gets edited to
green. `KNOWN_FAIL_OPEN` was emptied and three of its branches became unreachable;
the preset probes were "corrected" until they stopped asking. **A ratchet file
here needs its own non-vacuity guard before it is worth having**, and if that
cannot be built, the honest outcome is to keep Phase 2's zero-only gate and record
why — not to ship a ratchet nobody can trust.

## Out of scope

- **Plan 0188 Phase 3** — the anti-re-fork gate. Adjacent and genuinely
  different: that one detects a dialect growing its own copy of a kernel module
  (structural duplication); this one measures whether a primitive can be
  falsified at all. Neither subsumes the other, and bundling them would put a
  measurement behind two unwritten ADRs. Same reasoning as
  [bug 0192](../bugs/0192-nothing-detects-a-dialect-shadowing-a-kernel-name.md),
  which is a third distinct gate and is filed separately for the same reason.
- **A real mutation score.** `evaluate: () => []` is one total gut. Proper
  mutation testing uses many small mutants, and margin-against-one-gut is a
  weaker signal. It answers "can this fail at all", which is the question ADR-009
  asks, and it should not be described as more than that.
- **The other four dialects.** The spike measured `eess-ts`. Nothing here
  generalises without re-measuring; `packages/md`'s corpus shape is different
  enough that its covering sets may not narrow at all.

## Success definition

- `check:margin` reports a number for a changed primitive, or `unmeasurable` —
  never a zero it did not measure.
- It **fails on margin 0**, sabotage-proven: gut a primitive's only test, the gate
  reds and names the primitive.
- Its own break class is registered in `scripts/check-nonvacuity.mjs`.
- Runs in the PR path in under a minute for a typical commit.
- The measured values match the hand-measured four, or the difference is
  explained rather than absorbed.

## Progress ledger

- [ ] Phase 1 — `scripts/margin.mjs`, verified against the four known values
- [ ] Phase 2 — `check:margin`, diff-aware, fails on zero, registered in nonvacuity
- [ ] Phase 3 — the ratchet with its own guard, or a recorded refusal

Deferred: none.
