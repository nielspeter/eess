<!-- Landed 2026-09-04, unchanged except where this note says otherwise. -->

> **Landing note — 2026-09-04.** This record and its README lived only on the
> unpushed local branch `spike/eess-over-ts-archunit` for four weeks. The file
> below calls itself "the spike's terminal record", and a terminal record that
> exists on one laptop is one disk failure from gone — so it is landed here, in
> the corpus, where terminal records belong.
>
> Landing it is **not** a proposal to act on it. The conclusion's own framing
> stands: the branch was never proposed for merge, and nothing here obliges
> anyone. Read the date — the blockers below were measured against ts-archunit
> 0.58.0 on 2026-08-08 and have not been re-checked since.
>
> **One edit, disclosed.** The upstream reference in "What blocks it" was written
> as `` `src/core/rule-builder.ts:50` `` — a `path:line` shape that reads as a
> pointer into THIS repo, where that path does not exist. It refers to
> ts-archunit's source, so it now names ts-archunit's file and line. Same
> information; it no longer claims to be local.
>
> That edit was made expecting `check:corpus` to reject the original. **It would
> not have**: `work/spikes/**` is not one of that gate's roots, so nothing in this
> directory has its links or pointers checked at all — verified by removing both
> files and watching the check count stay at 1630 across 165 documents. The edit
> stands because the pointer was misleading either way; the gap it exposed is
> filed as [bug 0249](../../bugs/0249-work-spikes-is-a-record-lane-no-gate-reads.md).
>
> Nothing else in either file was touched, and the branch's other contents (the
> runnable spike, two reviewer personas, plans 0084/0085 and an alternate ADR-009
> from before a renumbering) were deliberately left behind — they would collide
> with this repo's live numbering, and none is a terminal record.

# Spike 0001 — conclusion

**Question.** Can eess stop maintaining a fork of ts-archunit's engine and depend
on the published package instead?

**Answer: yes, technically — and it is the cheaper of the two ways to the same
place. But it is not free, and it cannot be built today.**

This file is the spike's terminal record. The branch it lives on
(`spike/eess-over-ts-archunit`) is **not merged and is not proposed for merge**.
Nothing here obliges anyone to act.

---

## What was measured

|                 |                                                                           |
| --------------- | ------------------------------------------------------------------------- |
| Fork point      | ts-archunit ~0.17; upstream was 0.57.0 when spiked, 0.58.0 two days later |
| Divergence      | **10,342 diff-lines** across the 118 files both trees share               |
| Missing modules | **37** upstream modules with no eess counterpart                          |
| Kernel split    | 29 modules = **22** stale copies + **7** genuinely eess's own             |
| API stability   | **zero** exports removed or renamed upstream across 0.24→0.57             |

The last row is what makes the fork expensive rather than merely old: the
divergence is not new surface to adopt, it is **correctness the fork never
received** — the assertion gate, finding identity, copy-on-write builders,
exclusion-comment correctness, unsuppressable configuration findings. Those are
the properties eess's own manifesto claims. Upstream enforces them; the fork
asserts them in prose.

## What was proven

A working foreign dialect — a mermaid `classDiagram` dialect ts-archunit has
never heard of — built on the published core, no fork, no eess kernel, no
ts-morph. Three proofs, all green:

1. **Type-level.** The subclass compiles under TS 5.9 strict against the
   published `.d.ts`. `Predicate<T>`/`Condition<T>` are genuinely generic;
   `ArchViolation` is plain data.
2. **Behavioural.** The assertion gate and the `Why:`/`Fix:`/`Docs:` agent
   surface fire for the foreign dialect with zero extra code.
3. **Copy-on-write** holds across a held selection, verified by element
   identity.

## What was disproven — the spike's most useful output

The spike proved the **terminal-pattern** path. eess's real dialects are not on
it: all eight builders (mermaid ×1, md ×6, gherkin ×1) extend a two-parameter
`RuleBuilder<T, Project>`, and upstream's takes one parameter and requires a
ts-morph `ArchProject` — surface the upstream contract ADR explicitly declines
to promise until its amendment 3(b) lands.

So the honest finding is narrower than the headline: **the joint works; the
joint the dialects actually need does not exist yet.** That gap was found by
review reading the spike's own seams list more carefully than the plan drafted
from it did.

## Status of the artifacts this produced

| Artifact                                      | State                     | Where                        |
| --------------------------------------------- | ------------------------- | ---------------------------- |
| ADR-009 — adopt ts-archunit, retire the fork  | **Proposed**, unratified  | this branch                  |
| ADR-010 — the extension surface is a contract | **Proposed**              | ts-archunit, merged (PR #35) |
| Plan 0085 — the migration                     | **Draft**, P3, blocked    | this branch                  |
| Plan 0084 — port the fork to parity           | **Superseded** by ADR-009 | this branch                  |
| Bug 0086 — NUL bytes in published dist        | **Fixed**                 | extracted to `main`          |
| Bug 0087 — gates can be silently unwired      | **Draft**                 | with 0086 on `main`          |

Ratification is deliberately two-sided: ADR-009 flips to Accepted only when
ADR-010 does, and vice versa. Neither repo can bless the arrangement alone.

## What blocks it (as of 2026-08-08)

1. **Upstream amendment 3(b)** — optional `ArchProject` on `RuleBuilder<T>`.
   Verified still outstanding at ts-archunit 0.58.0
   (ts-archunit's own `src/core/rule-builder.ts`, line 50). Amendment 3(a), the `expectNonEmpty()`
   hoist, **has** landed.
2. **Two further upstream items** the migration leans on: the jiti config-loader
   fix (without it, retiring eess-ts reintroduces bug 0074 — the only real
   adopter signal this product has had) and the HTML exclusion-comment forms
   eess-md needs.
3. **Ratification** of both ADRs — a human act, not a technical one.

## What it cost, and what it returned

The investigation cost roughly a day. It returned the measurement above, two
ADRs, two plans, and — unplanned — **two real defects on `main`**: bug 0086
(shipping binary `dist/` files to npm, found because grep silently skipped a
source file mid-audit and produced a wrong answer) and bug 0087 (three gates
were in `validate` and had never run in CI).

That is worth recording plainly: the most valuable output of a spike about
adopting an upstream engine was a pair of defects in our own shipped artifacts,
found by accident while measuring something else.

## Recommendation

**Do not act yet, and do not discard.** The direction is sound and the
measurement will not go stale in a way that changes the conclusion — a fork that
is 10,342 lines behind does not become cheaper to maintain. Revisit when
upstream amendment 3(b) lands, which is the single gate between "decided" and
"buildable".

If the answer later turns out to be no, plan 0084 records what the alternative
costs (XL, and recurring), so the rejection is priced too.

## Honest limits of this spike

- `run.ts` is a demonstration, not a test. It prints its verdicts; the branch's
  review round made its failure branches set a non-zero exit, but nothing runs
  it in CI and no gate covers this directory.
- Its dependency is a `file:` path to a sibling checkout, so it reproduces only
  on a machine that has ts-archunit beside eess. The claim "published dist" is
  true of the code that was read, not of the resolution path in the lockfile.
- It ran on Node 26.7.0; ADR-001 pins Node 24 and CI runs 24.
- The type-level proof rests on a `tsconfig.json` that nothing in CI executes.

None of these weaken the three findings above — they were each verified by hand
at the time — but a later reader should not mistake a green `prettier` on this
directory for the spike still compiling.
