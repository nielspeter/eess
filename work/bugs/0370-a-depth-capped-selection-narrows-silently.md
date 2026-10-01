# Bug 0370: a depth-capped selection narrows silently, so a function nested too deep is never checked

## Status

- **State:** Draft — found by the survey for
  [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md),
  which needed to know whether any other bounded instrument breaks the clause it states.
- **Severity:** Medium — **a silent narrowing of SELECTION, which is the shape of a false
  green.** A function nested deeper than the cap is not selected, so a rule over it examines
  fewer subjects and can pass while the code violates it, and nothing says the cap was hit.
- **Origin:** self-found. ADR-016 clause 1 says an instrument that stops short must report
  it; validation of that ADR asked which other instruments stop short, and this one does.
- **Reported:** 2026-09-30

## Symptom

`MAX_OBJECT_LITERAL_DEPTH = 3` in `packages/ts/src/core/object-literal-functions.ts` caps how
far the shared traversal descends into nested object literals while collecting
function-valued properties. It is the single traversal behind `functions()` object-literal
collection and the callback extractor, so both inherit the cap.

A function at depth 4 is **not collected**. It is therefore not a subject, so:

- a rule asserting something about it examines a smaller population and passes;
- `examined` counts the subjects that WERE found, so the ADR-010 floor sees a non-zero
  count and does not fire;
- nothing reports that the traversal stopped.

That is the same composition as
[bug 0359](./fixed/0359-a-disk-walk-that-gave-up-reports-nothing-and-now-decides-a-verdict.md):
a bound that limits knowledge, silently, in a place a verdict depends on. 0359's was the
filesystem; this one is the AST.

## Not yet measured

**This record is a reasoned finding, not a measured one, and that distinction is the whole
lesson of the round that produced it.** What is confirmed is the constant, its comment
("Default recursion depth into nested object literals"), and that the traversal is shared.
What is NOT yet measured:

- whether a real rule shape can be made to go green over a depth-4 function — the red test
  this bug needs;
- whether any shipped preset or this repo's own rules reach depth 4 in practice;
- whether the cap is reachable at all for the `within()` / callback path, which may bottom
  out earlier for other reasons.

Do the measurement before the fix. A bug record that asserts a mechanism is the error this
bug's own origin story is about.

## Fix

Not decided, and it should follow ADR-016 clause 1 rather than invent its own answer: if the
traversal stops short, say so. The open question is whether a depth cap is even the right
instrument here — clause 6 prefers a bound that comes from the question over one that comes
from a budget, and "how deep do object literals nest in real code" may have an exact answer
that needs no cap.

## Related

- [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md) — the
  clause this violates, and which lists this bug as the reason its general clause is
  `pending` rather than `gated`.
- [0359](./fixed/0359-a-disk-walk-that-gave-up-reports-nothing-and-now-decides-a-verdict.md)
  — the same composition in the filesystem walk.

## Verification

- [ ] measured first: a red test where a depth-4 function is unselected and a rule over it
      goes green. If it cannot be constructed, this record closes as `won't-do` with the
      evidence, not as a fix.
- [ ] whether this repo's own rules or any shipped preset reach the cap.
- [ ] the fix, following ADR-016 clause 1 — and clause 6 considered before a deeper cap is
      chosen over no cap.
