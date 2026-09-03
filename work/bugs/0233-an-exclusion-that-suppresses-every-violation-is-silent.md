# Bug 0233: an exclusion that suppresses every violation a rule produced is silent, and the rule reports green with a full denominator

## Status

- **State:** Draft — reproduced structurally against the shipped source; no red test yet.
- **Severity:** High — **false green.** A rule with a catch-all exclusion cannot
  fail, and nothing says so: no violation, no configuration finding, and an
  `examined` count that still reports a full denominator. ADR-009 rule 1 is "a
  check that cannot fail is worth less than no check"; this is a check turned off
  in a way the evidence seam is blind to by construction.
- **Origin:** self-found · surfaced while reviewing
  [proposal 007](../proposals/007-ts-expose-terminalbuilder-declared-state.md),
  which carries a consuming project's measurement of this loophole firing in
  production. Three review lenses (architect, product, enforcement) reached it
  independently. **This is not proposal 007's ask** — 007 asks for a read
  accessor; this is the defect its evidence exposed, and it needs no
  `**Implements:**` line.
- **Reported:** 2026-09-03

## Symptom

```ts
tsconfig(p).requires({ strict: true }).excluding(/.*/).check()
```

Against a project whose `tsconfig.json` has `strict: false`, that is green. No
violation, no stderr line, no configuration finding — and if the run prints a
denominator it is the full one, because `examined` counts the requirements the
rule declared, not what survived filtering.

The same shape silences any family. `.excluding(/.*/)` on a `classes()` rule with
real violations produces the same silence.

## Root cause

**Exclusions are applied after the evidence gate, and no floor reads post-filter
cardinality.** Verified structurally, not assumed:

| step                                                    | where                                                                                                          |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `examined` is computed from the predicate-filtered set  | `packages/ts/src/core/rule-builder.ts:380` — `const examined = filtered.length`                                |
| `evidenceFloor(...)` runs on the **raw** collect result | `packages/ts/src/core/terminal-execution.ts:66-70`                                                             |
| `.excluding()` is applied afterwards                    | `violations()` → `applyFilters(raw, this.filterContext())`, `packages/ts/src/core/terminal-builder.ts:788-792` |

So `{ violations, examined }` — the seam [ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md)
exists to make a pass constructible from — never sees the suppression. `examined`
does not decrease. The rule looks like one that examined everything and found
nothing.

## The asymmetry, which is the finding

eess already discloses the **opposite** case, and says so as a principle:

- `packages/core/src/silent-exclusion.ts:22` — _"By default, `.excluding()` warns
  when a pattern matches zero violations (stale-exclusion detection)."_
- `packages/core/src/comment-suppression.ts:4` states it as the pipeline's rule —
  _"Every other filter in the pipeline discloses itself."_
- `orphanExclusions()` (`packages/ts/src/core/orphan-exclusions.ts:136`) makes "an
  exclusion comment naming no live rule" a first-class finding.

All three are the "an exclusion that does **nothing**" direction — which is
fail-**closed**: the finding still fires, CI is still red. Nobody has built the
"an exclusion that does **everything**" direction, which is fail-**open**.

**The library predicted this exact moment.** `packages/ts/src/core/execute-rule.ts:215-223`,
verbatim:

> "Unused exclusion" above it warns about a pattern that silences NOTHING
> (fail-closed — the finding still fires, CI is still red), while this warns about
> a pattern that silences MULTIPLE real findings and every future one on the same
> edges (fail-open — a green `check()`, one stderr line). ADR-008 states the
> primary consumer does not read warnings. Kept advisory here, matching plan
> 0104's own review resolution — **but the asymmetry is real and worth
> re-litigating if this loophole is measured firing in practice, not settled by
> the precedent alone.**

Proposal 007 is that measurement arriving. It carries a consuming project's
tracker entry for this loophole firing in production, and proposes to hand the
consumer private state so they can build the detector — which is why this record
exists instead.

**And the existing advisory is narrower than that comment implies.** It only
accumulates for cycle-edge identities — `packages/ts/src/core/execute-rule.ts:184`,
`if (v.identity?.startsWith('cycle-edge::') === true)`. So for a `TsconfigBuilder`
rule with a catch-all exclusion and a drifted config: `matchIndex >= 0`, so no
unused-exclusion warning; no cycle-edge identities, so no advisory. **Zero output.**

## The clause to decide

> An exclusion that suppressed every violation a rule produced is a configuration
> finding, not a silence.

- **Tier 1** — statically decidable from the filter's own bookkeeping.
- **The measurement already exists.** At the reporting loop
  (`packages/ts/src/core/execute-rule.ts:196-239`) the filter already holds the
  pre-filter count, the post-filter count, `matchedPatterns`
  (`:140` — which indices matched anything), `refusedPatterns` (which hit a
  `bypassFilters` finding) and `silentIndices`. The predicate is a subtraction
  over numbers already in scope: _a rule that produced ≥1 non-`bypassFilters`
  violation and retained 0 after exclusion filtering._ The only reason it is not
  reported today is the ADR-008-precedent decision recorded at `:213-223`, not a
  missing measurement.
- **Unsuppressable**, like every other ADR-010 configuration finding — a finding
  about the rule's own instrument, not about what it examined.

## Break class

A fix must fail when:

1. A rule that produces at least one real violation retains zero after its own
   exclusions, and the run is green. (`.excluding(/.*/)` over a genuinely
   violating fixture.)
2. And it must **not** fire when an exclusion legitimately suppresses _some_ of a
   rule's violations, which is what `.excluding()` is for; nor when the rule
   produced none to begin with, which is the stale-exclusion case already
   covered; nor on a `bypassFilters` configuration finding, which exclusions
   already refuse (`packages/core/src/execute-rule.ts:50`).

(2) is what makes this narrow rather than a ban on `.excluding()`.

## Notes for whoever fixes this

- `silent()` is the sharp edge. `recordExclusions`
  (`packages/core/src/silent-exclusion.ts:56-69`) unwraps `silent(pattern)` into
  the same `_exclusions` array, recording only the index in `_silentIndices`. A
  `silent(/.*/)` catch-all is **strictly more dangerous** than a bare one, because
  it also suppresses the one warning eess does emit. Decide explicitly whether
  `silent()` should be able to silence this finding too — the honest answer is
  probably no, since `silent()` exists to quiet the zero-match warning, not to
  license a catch-all.
- The same state exists on both `TerminalBuilder`s
  (`packages/core/src/terminal-builder.ts:68`, `packages/ts/src/core/terminal-builder.ts:127`)
  and both are public root exports. Fix it once, in the kernel, or
  `eess-md`/`-mermaid`/`-gherkin`/`-crossvalidate` keep the hole. Note ADR-013 and
  [plan 0188](../plans/0188-unify-the-duplicated-engine-modules.md) are already
  unifying these two copies — land it where that plan is heading, not beside it.

## Verification

- [ ] Red test: a rule with a real violation plus `.excluding(/.*/)` reds, and the
      finding is unsuppressable.
- [ ] Red test that must stay green: an exclusion suppressing _some_ violations
      does not fire it; a rule with zero violations does not fire it.
- [ ] A non-vacuity row in `scripts/check-nonvacuity.mjs` (the `gates` table at
      `:1255+`), with a fixture in `scripts/nonvacuity/`'s `bad-adr.mjs` family:
      a `.rules.ts` declaring one rule that genuinely violates over a committed
      fixture source, `.excluding(/.*/)` appended. Assert the violation's
      **identity** — the new rule id — not merely that it threw; that is
      `bad-adr.mjs`'s own discipline against bug 0109's class, and it matters more
      here because the rule under test is one that turns other findings off.
- [ ] Sabotage: delete the subtraction and the fixture goes green while every
      functional test stays green — the "changes silence, not behaviour" shape
      `packages/ts/src/core/orphan-exclusions.ts:59-67` documents.
- [ ] Decide `silent()`'s interaction explicitly, and record the decision.

## Related

- [proposal 007](../proposals/007-ts-expose-terminalbuilder-declared-state.md) —
  ruled `Rewrite needed`; its review names this bug as the shippable thing and the
  accessor as the secondary question.
- [0231](./fixed/0231-a-killed-nonvacuity-run-leaves-an-invisible-probe-that-reds-other-gates.md)
  — the same lens: a gate that reports something other than what is true sends the
  reader to the wrong fix.
