# Spike 0360: what the disk walk actually costs, and whether its budget is in the right place

Measured 2026-09-29 for
[bug 0359](../bugs/0359-a-disk-walk-that-gave-up-reports-nothing-and-now-decides-a-verdict.md).

## The question

`buildDiskSet` stops after **50,000** directory entries and then answers
`not-determined` for **every** glob, memoized per project. Since
[0355](../bugs/fixed/0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md)
that answer decides whether a cardinality rule reports, so above the budget a shipped
gate turns itself off for a whole repository and says nothing.

0359 asks whether a verdict may depend on a bounded walk at all. That is the right
question and it is not the first one. **The budget's own justification has never been
measured**, and it is a claim about time
(`packages/ts/src/core/disk-set.ts`):

> a _failing_ run that then hangs inside a 5s vitest timeout is a worse experience
> than the false green this whole mechanism exists to remove

So: what does the walk cost?

## Method

A synthetic monorepo — `packages/pN/src/areaM/fK.ts`, 20 files per directory, unique
paths — walked with the same shape `disk-set.ts` uses: `readdirSync` with
`withFileTypes`, the same 16-name prune list, recursive, counting dirents. Median of
five runs after a warm-up walk. Node 24, macOS, APFS, local disk.

**A first attempt is discarded and worth recording.** Its generator reused directory
names, so files overwrote each other and the "target" column bore no relation to what
was on disk — 250,000 requested, 14,376 actually walked. The timing column was still
paired with the real entry count, so the µs/entry figure survived, but the table as
labelled was false. Caught by the entries column not matching the target.

## Result

| files   | dirents    | median ms | µs/entry |
| ------- | ---------- | --------- | -------- |
| 5,000   | 5,271      | 12        | 2.31     |
| 25,000  | 26,351     | 35        | 1.34     |
| 50,000  | **52,701** | **76**    | 1.44     |
| 150,000 | 158,101    | 229       | 1.45     |
| 300,000 | 316,201    | **491**   | 1.55     |

Linear at roughly **1.5 µs per entry** above the smallest tree.

|                                            |                                        |
| ------------------------------------------ | -------------------------------------- |
| the budget, 50,000 entries                 | **76 ms**                              |
| 6× the budget, 316,000 entries             | **491 ms** — a tenth of the 5s timeout |
| entries needed to reach 5s                 | **~3.2 million**                       |
| an adopter's real monorepo, 16,770 entries | **~25 ms**                             |
| this repository, ~3,500 entries            | ~5 ms                                  |

**The budget is set about two orders of magnitude below what its own justification
requires**, and the walk is performed **once per project** (memoized on a `WeakMap`),
not once per rule — so this is a one-off cost, not a per-check one.

## What this establishes

**The time argument does not support 50,000.** Nothing measured here comes close to
hanging anything. A budget chosen to prevent a 5s hang would sit near 3 million
entries; at 50,000 it fires on trees that cost 76ms.

**It does not establish that the budget should simply be raised and forgotten.**
Raising it moves the cliff without making the failure honest: at any budget,
exhaustion still answers `not-determined` for every glob, still means green, and still
says nothing. ADR-009 is explicit that a detector which cannot fire must say so rather
than pass. So the two changes are independent and only one of them is optional.

## What this does NOT measure

- **A cold page cache.** Every timing here is warm — the tree was walked once to count
  before timing. A cold cache, a network filesystem, or a container with a slow
  overlay would all be worse, and by an unmeasured factor. This is the largest gap.
- **Windows**, where `readdirSync` on NTFS has a different cost profile.
- **`classify()` itself** — only the walk. The per-glob matching cost is separate and
  is paid per rule rather than per project.
- **A pathological shape** — one directory with 200,000 entries, rather than the
  uniform 20-per-directory tree used here.

## The decision this brings back

Two changes, and the record should be explicit that they are independent:

1. **Report exhaustion.** Required by ADR-009 regardless of where the budget sits, and
   the honest minimum: a run whose walk gave up must say so. One finding for the
   project rather than one per rule — the precedent is `emptyProjectViolation`, whose
   identity is the tsconfig rather than any glob.
2. **Move the budget to where its justification puts it.** On these numbers that is
   somewhere between 500,000 and 1,000,000 entries — 0.8s to 1.5s worst case, warm —
   which puts every realistic repository inside it. **Not** unbounded: the cold-cache
   gap above is unmeasured, and a bound nobody can reach is still a bound.

With both, 0359's original question — may a verdict depend on a bounded walk — becomes
much less pressing: the bound sits far from any real tree, and reaching it is reported
rather than silent. It is not answered, and it should stay open in 0359 rather than be
declared closed by a number.

## Related

- [0359](../bugs/0359-a-disk-walk-that-gave-up-reports-nothing-and-now-decides-a-verdict.md)
  — the defect this spike serves. Its adopter measurement (16,770 entries, 34% of
  budget) is what made the budget's placement worth measuring at all.
- [0345](./0345-what-it-costs-to-load-a-monorepo.md) — the other spike about what eess
  costs, and the one whose method this follows: measure, state what was not measured,
  bring a decision back rather than a fix.
