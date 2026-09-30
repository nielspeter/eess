# Spike 0367: must the disk question walk the whole repository?

Measured 2026-09-30 for
[bug 0359](../bugs/0359-a-disk-walk-that-gave-up-reports-nothing-and-now-decides-a-verdict.md).

## The question

0359's `## Fix` enumerates four options and then says the real one is open:

> **The open question is whether a verdict may depend on a bounded walk at all.** If the
> answer is no, 0355's discriminator needs a different source of truth and this is a
> redesign rather than a report.

[Spike 0360](./0360-what-the-disk-walk-actually-costs.md) measured what the walk costs and
deliberately did not answer that. This spike asks the one thing that would **dissolve** the
question instead of answering it: `classify(glob)` only ever asks _"does any path matching
this glob hold TypeScript?"_ — so does it need a whole-repository walk at all? If each glob
could be answered by a walk bounded **by the glob's own text**, there would be no budget, no
exhaustion, and nothing for a verdict to depend on.

## Method

Synthetic monorepos — `packages/pN/src/areaM/fK.ts`, 20 files per directory, plus an
`apps/legacy/src/old.ts` that exists and holds TypeScript (the thing a ratchet asks about).
Same 16-name prune list as `disk-set.ts`. Warm-up walk first, then timed.

Two implementations:

- **A — the current design.** Eager whole-repo walk building the path sets, then match.
- **B — per-glob.** Walk lazily, **prune** any directory whose path can no longer match the
  glob's leading segments, and **short-circuit** on the first matching TypeScript file.

Four globs, chosen to separate the two shapes that matter: a glob with a literal prefix, and
a glob led by `**/`. Each measured both matching and not matching, because **a holding
ratchet is the not-matching case** and that is the common one.

## Result

| tree                  | entries | A: full walk | B: `**/apps/legacy/**` | B: `**/apps/deleted/**` | B: `apps/legacy/**` | B: `packages/p3/src/**` |
| --------------------- | ------- | ------------ | ---------------------- | ----------------------- | ------------------- | ----------------------- |
| small (this repo)     | 773     | 1.8ms        | 8.4ms / 773e           | ·4.4ms / 773e           | **0.4ms / 5e**      | **0.4ms / 35e**         |
| adopter (15 packages) | 6,335   | 14.9ms       | 32.1ms / 6,335e        | ·28.3ms / 6,335e        | **0.2ms / 5e**      | **0.3ms / 58e**         |
| large                 | 50,525  | 105.5ms      | 213.8ms / 50,525e      | ·203.2ms / 50,525e      | **0.1ms / 5e**      | **0.6ms / 123e**        |

`·` = no match, so no short-circuit was possible. `e` = directory entries read.

**Pruning is a 250–1000× win — for globs with a literal prefix.** `apps/legacy/**` reads 5
entries instead of 50,525.

**It is a 2× LOSS for a glob led by `**/`.\*\* Nothing can be pruned, so B does A's walk _plus_
a per-file glob match, and pays it per glob rather than once per project.

**And the holding ratchet can never short-circuit.** A rule asserting a path is gone matches
nothing by definition, so it must exhaust the searchable space. The worst case is not an edge
case — it is the case the feature exists for.

## The census that settles it

Per-glob pruning only helps anchored globs, so: how many real globs are anchored? Every glob
in this repository's own rule files (`arch.rules.ts`, `arch.internal.rules.ts`,
`spec.rules.ts`, `family.rules.ts`, `mermaid.rules.ts`):

| shape        | count |
| ------------ | ----- |
| led by `**/` | **9** |
| anchored     | **0** |

Nine of nine. Zero. And that is not an accident of style — it is the house convention the
corpus teaches, and [0348](../bugs/fixed/0348-a-glob-naming-segments-above-the-tsconfig-root-still-dies-under-a-dot-directory.md)
made it load-bearing: the repo-relative identity-root view applies to `'**/'`-led globs only.
The globs in the bug reports that produced this whole family — 0348, 0349, 0355, 0362 — are
`'**/'`-led too.

## Ruling — the bound is inherent, so 0359 is a report, not a redesign

**The question does not dissolve.** For the globs people actually write, a whole-repository
walk is not an implementation choice — it is what the question requires, and the common case
cannot short-circuit out of it. So there is no glob-bounded source of truth to swap in, and
0355's discriminator does not need replacing.

That settles 0359 in favour of the two options its record already leaned toward, now measured
rather than argued:

1. **Report exhaustion, once per project.** The precedent is `emptyProjectViolation` — the
   fault's identity is the walk, not any glob, so one finding rather than one per rule
   (ADR-009 rule 4). This is the half that fixes the defect, because the defect is silence.
2. **Raise the budget.** Secondary, and honestly lesser: it moves the cliff out of reach
   without removing it.

**What NOT to do, measured:** replace the eager walk with per-glob pruning. It is 2× slower
for 100% of the real glob population. Recorded because it is the obvious idea — it was this
spike's own hypothesis — and it is wrong.

A **hybrid** (anchored globs walk their own subtree, `**/`-led globs share the memoized walk)
is sound and buys nothing today at 0 of 9. Worth knowing if the convention ever changes; not
worth building now.

## A second number, and it is the sharper one

The full walk reads 50,525 entries in **105.5ms** — **2.09 µs/entry**. Spike 0360, measuring
differently, got 1.55 µs/entry; the same order, independently derived, which is what makes
either trustworthy.

So **the 50,000-entry budget fires after about 105 ms of work**, while the comment that
justifies it is about a 5-second vitest timeout:

> a _failing_ run that then hangs inside a 5s vitest timeout is a worse experience than the
> false green this whole mechanism exists to remove

At this rate 5 seconds is ~2.4 million entries. The budget is set roughly **48× below its own
stated justification** — consistent with 0360's 64×, and the gap between the two figures is
machine and method, not arithmetic. Either way the conclusion is the same: the cutoff protects
against nothing anyone would notice, and it silences a gate to do it.

## Method note

The harness lives in the session scratchpad, not the repo: it builds up to 50,000 throwaway
files and its value is the numbers above, not a fixture worth maintaining. What is reproducible
is the shape — A and B are both twenty lines against `readdirSync` with the production prune
list, and the census is one `grep` over the five rule files.

**What stays unmeasured, and why it is not hidden:** the cold-cache cost. Every figure here is
warm. 0360 declined to recommend an unbounded walk for exactly that reason and this spike does
not improve on it — purging the page cache needs privileges this run did not have, so the
honest statement is that the bound's removal is still uncosted, and only its **raising** is
supported by measurement.
