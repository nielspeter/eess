# Spike 0395: what an accepted entry without a file does under per-file grouping

Opened 2026-10-07 for [plan 0346](../plans/0346-a-finding-is-identified-by-the-code-it-matched.md)'s
Phase 2, after enforcement review of
[spike 0394](./0394-the-phase-2-design-for-a-file-aware-baseline.md)'s decision found that two of
its decisions contradict each other. Not yet run. Time box: half a working day. It ends in a design
for a decision, not in code, and the Phase 2 build plan is not written until it has.

## The question

Spike 0394 chose per-file grouping (EP2) and kept the deferred-warning collision guard
(`hasIdentityCollision`, census C13) blind to files, because an `accepted` entry carries no file: a
guard keyed per file let a copy in a new file arrive already accepted (spike 0394, Review). Its first
decision 4 then made entries with no file stop matching, which removes that premise. Enforcement
review found three consequences, reasoned from the code and not measured:

- **The guard's pin cannot fail.** `deferred-warning.test.ts` ·
  `it('the swap, reproduced with a colliding subject: a genuinely new finding is escalated, not silently absorbed')`
  builds its list from file-less subjects. If none of them match, every finding is `error` with the
  guard deleted.
- **A file-blind guard gives a false cause.** Under EP2, `a::X` and `b::X` are no longer suffixed,
  but the guard still treats them as one collision, and its advice says the repair assigns a
  positional suffix, which it no longer does (ADR-009 rule 2).
- **The advice for a file-less entry is unsafe.** A "file-qualified replacement" built from where the
  subject matches now accepts `b` without review on the bug 0388 shape.

## What to measure

Under EP2, with the guard keyed blind to files and keyed per file:

1. EP's Critical shapes ("`a` stays, `b` copies"; the swap; "two accepted, then `c`"), with lists
   that are file-qualified, file-less, and mixed.
2. The same with file-less entries matching, and with them not matching (the first decision 4).
3. Which collisions a file-qualified list cannot tell apart, and so which keying the guard needs.
4. What advice a file-less entry can give that does not accept an unreviewed finding.
5. One spelling for a file-qualified entry, aligned with bug 0389's `<root:NAME>/path` portable form.

Each answer is compared against `main` the way spike 0394's review did: no shape may be green where
`main` is red, and every escalation must state its true cause.

## Out of scope

Everything spike 0394 decided: per-file grouping, the no-root rule, the integration branch.
