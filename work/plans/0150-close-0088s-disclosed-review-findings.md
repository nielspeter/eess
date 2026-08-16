# Plan 0150: Close plan 0088's disclosed-but-unfiled review findings

## Status

- **State:** Draft — created 2026-08-16, spun off from plan 0088's own Phase 4
  ledger entry ("What the review found that is NOT fixed, left open on
  purpose") while closing that plan. Those findings were real, Important-tier,
  and explicitly recorded "for a later pass — not silently absorbed" — but no
  later pass ever gave them a number. This plan is that home.
- **Priority:** Medium — none of the four items is a live, present-day defect
  with a known trigger; each is a real gap that would bite a specific future
  change (a new `CorrespondenceBuilder` check type, a caller that actually
  relies on `.expectNonEmpty()`, a silent regression in copy-on-write's
  `.because()`/`.excluding()`).
- **Effort:** Small–Medium — four independent, mostly-small items; no shared
  design work ties them together beyond their common origin.
- **Created:** 2026-08-16

## Problem

Plan 0088's Phase 4 ledger entry ("Multi-agent review (2026-08-15)") recorded
five things the review found that were **not** fixed in that pass, explicitly
distinguished from the two real regressions the same review found and fixed
immediately. Four of the five still have no home:

1. **`diagnose()`/`orphanExclusions()` — partially resolved since, not tracked
   as such.** Plan 0088's Success Definition said standalone sufficiency was
   "partially met" because ts-archunit's own `diagnose()` CLI subcommand and
   `orphanExclusions()` audit mechanism were never ported — a deliberate
   scope decision (native evidence gate over mechanical port), disclosed, but
   left "deferred → not yet filed as its own eess bug/plan." **Since then,
   unrelated plan 0147 built and shipped a `diagnose()` core function
   (`packages/ts/src/core/diagnose.ts`) and a `doctor` CLI subcommand
   (`packages/ts/src/cli/commands/doctor.ts`, wired into `cli/index.ts`) —
   confirmed by reading both directly, and I personally tested the `doctor`
   command end-to-end earlier this session.** That closes the `diagnose()`
   half of the gap, incidentally, untracked back to this finding until now.
   `orphanExclusions()` specifically was never built anywhere — confirmed by
   grep, zero hits in `packages/ts/src` or `packages/core/src`. That half is
   the genuine remainder.
2. **`CorrespondenceBuilder.assertsCardinality()` is an unconditional
   class-wide `true`**, not scoped per-check the way `RuleBuilder`'s `.every()`
   treatment is (`packages/core/src/correspondence-builder.ts` — confirmed
   location via plan 0088's own citation). Sound today, because
   `beComplete()`/`preserveRelations()` are the only check types this builder
   has and both are legitimately absence-assertions. The first non-absence
   check type added to this builder would silently inherit an exemption it
   is not entitled to — a config-finding that should fire staying silent.
3. **`.expectNonEmpty()` is a behavioral no-op.** `_expectEmpty === false` is
   set on the builder but never read anywhere distinct from `undefined` —
   confirmed by grep for `_expectEmpty` across `packages/core/src`. A caller
   who chains `.expectNonEmpty()` expecting it to assert something gets
   silent nothing, which is precisely the failure class ADR-010 exists to
   make unrepresentable, now living in ADR-010's own reference implementation.
4. **`.because()`/`.excluding()` have no direct test coverage in
   `packages/core/tests/`** — only indirect coverage via dialect-level tests.
   The 2026-08-15 testing review confirmed this by reverting each to
   mutate-in-place (the pre-fold "bug 0016" shape) and finding the full suite
   still passed. Re-verified today (2026-08-16): `packages/core/tests/` has
   no `rule-builder.test.ts`; the only `.because(`/`.excluding(` hits in that
   directory are in `correspondence.test.ts`, a different builder.

## Implementation phases

### Phase 1 — `CorrespondenceBuilder`'s cardinality exemption

Scope `assertsCardinality()` per-check, matching `RuleBuilder`'s own
`.every()`-based treatment, so a future non-absence check type on this
builder does not silently inherit an exemption meant only for
`beComplete()`/`preserveRelations()`. Red-test-first: a synthetic non-absence
check type on `CorrespondenceBuilder` over an empty selection must produce a
config-finding, not a silent pass — confirm it does not today, then fix.

### Phase 2 — `.expectNonEmpty()` — make it real or remove it

Decide and implement: either wire `_expectEmpty === false` into a real
assertion (a selection expected non-empty that is empty becomes a finding —
the mirror of `.expectEmpty()`'s own guarantee), or remove the method and its
state entirely if no honest semantics survive design review. Silent dead API
is not an acceptable third option. Red-test-first either way.

### Phase 3 — `.because()`/`.excluding()` direct kernel coverage

A `packages/core/tests/rule-builder.test.ts` (or extend an existing
kernel-level test file) exercising the base `RuleBuilder`'s copy-on-write
chain methods directly — `.that()`, `.excluding()`, `.rule()`, `.because()`,
`.expectEmpty()` — asserting independence across two branches of a held
selection, sabotage-verified against the exact "bug 0016" mutate-in-place
regression the 2026-08-15 review used to find this gap.

### Phase 4 — `orphanExclusions()`

Port or natively rebuild ts-archunit's `orphanExclusions()` audit mechanism —
survey ts-archunit's own implementation first (same discipline plan 0147 used
throughout: read the live source before deciding port-verbatim vs.
port-adapted vs. reject-as-superseded), and record the ruling here rather
than assuming a port is the right shape.

## Out of scope

- Anything else plan 0088's own review found and already fixed in that same
  pass (the two real regressions, the `bypassFilters` filter-survival fix,
  the `sourceEmpty` precedence wiring) — already closed, not reopened here.
- New capabilities beyond closing these four specific, named findings.

## Test inventory

Each phase lands with its own red-test-first regression, matching this
session's own discipline throughout plan 0147/0148. `npm run validate` stays
green after each phase.

## Success definition

- `CorrespondenceBuilder`'s cardinality exemption is scoped per-check, not
  class-wide.
- `.expectNonEmpty()` either asserts something real or does not exist.
- `packages/core/tests/` directly exercises `RuleBuilder`'s own copy-on-write
  chain methods, sabotage-verified.
- `orphanExclusions()` has a recorded ruling (port / port-adapted /
  reject-as-superseded), not a silent skip.
- `npm run validate` green throughout.

## Progress ledger

- [ ] Phase 1 — `CorrespondenceBuilder`'s cardinality exemption.
- [ ] Phase 2 — `.expectNonEmpty()` — make it real or remove it.
- [ ] Phase 3 — `.because()`/`.excluding()` direct kernel coverage.
- [ ] Phase 4 — `orphanExclusions()`.
