# Plan 0079: Tier 2/3 mechanization (the frontier)

## Status

- **State:** Draft — blocked on a **mechanism**, which does not exist yet. This
  is the one open item where the obstacle is not scheduling or data but that
  nobody, inside this project or outside it, has a design worth copying. Kept as
  a Draft so the gap is on the board rather than folklore.
- **Priority:** P3 — the largest opportunity and the least tractable.
- **Effort:** unknown. Any estimate today would be fiction.
- **Created:** 2026-07-19

## Problem

The manifesto describes five enforcement tiers. eess mechanizes **Tier 1**
(eess-ts, eess-mermaid, the md corpus) and the crossvalidate binding between
dialects. For Tier 2 it does exactly one thing: it resolves a **citation** — an
ADR row naming `` `path/to/x.test.ts` `` · `it('exact title')` is checked to
mean that the file and title exist and are unique.

That is real, and it is much less than it sounds. eess verifies that a test with
that name **exists**; it does not verify that the test **tests the clause**. The
gap between "a test named X exists" and "clause C is behaviourally enforced" is
the entire tier.

Tier 3 (operational — the property holds in the running system) has no mechanism
at all.

## Why this is still open

Arriving from [plan 0067](./completed/0067-harness-informed-roadmap.md) Phase 5,
which named it the honest frontier and explicitly declined to attempt it.

The [external-signals research](../research-external-signals-2026-07.md) then
swept 83 usable talks of 186 and produced **no mechanism that closes it**:

- Its nearest candidate (§5 #4, glob-scoped single-question binary LLM
  verifiers) is **Tier 4** — judgment with no deterministic checker. A different
  gap, and one eess deliberately keeps advisory.
- The closest field evidence is §2's Bun Zig→Rust port, which drove adversarial
  review from machine-readable spec files (`porting.mmd`, `lifetimes.tsv`). That
  is the eess-mermaid premise shipped in anger — an existence proof that
  machine-readable specs govern real behavioural work, not a mechanism for
  binding a clause to a behaviour.
- Practitioners who _do_ verify Tier 2/3 (OpenAI, Stripe) do it with a bootable
  app, perf SLOs and observability — infrastructure, not a checkable
  correspondence.

The research's own §3c caution applies here too: **defense-in-depth beats any
single oracle.** It is possible the right answer is not one Tier-2 mechanism but
several weak ones that overlap.

## Directions worth exploring (none validated)

1. **Property-binding.** A clause names an invariant; the mechanism checks that a
   property-based test exercises _that_ invariant, not merely that a file exists.
   Requires a machine-readable statement of the invariant — which is the hard
   part, and possibly the whole problem restated.
2. **Coverage-of-clause.** Bind a clause to the code paths it constrains, and
   require that a behavioural test executes those paths. Weaker than "tests the
   clause", stronger than "a test exists", and mechanizable today.
3. **Tier 3 via policy-as-code.** Operational properties (a deploy config, a
   resource limit, an SLO) are static documents; a dialect over them is ordinary
   eess work. This may be the tractable half — Tier 3 might land before Tier 2.

Direction 2 is the most likely first slice: it is a genuine strengthening of
citation-resolution, and it needs no new theory.

## Out of scope

- Claiming a tier is mechanized when only a citation is resolved. The current
  behaviour is honest and documented; whatever replaces it must be too.
- Running the system under test. eess is a validation framework, not a harness
  runner (the boundary plan 0067 drew, and it holds).

## Success definition

A clause whose behavioural test is **deleted or gutted** fails a gate. Today it
does not, as long as a test with the cited name still exists.

## Open questions (resolve before Ready)

- [ ] Is direction 2 (coverage-of-clause) actually mechanizable with the current
      engine, or does it need runtime coverage data eess has no access to?
- [ ] Should Tier 3 be split into its own plan and shipped first, given it looks
      more tractable than Tier 2?
- [ ] What is the minimum honest claim? If only "the cited test executes the
      cited code path" is achievable, is that worth the tier's name?
