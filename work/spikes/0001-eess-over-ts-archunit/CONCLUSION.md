<!-- Landed 2026-09-04. The record below is verbatim; see the note for the one exception. -->

> **Landing note — 2026-09-04.** This record and its README lived only on the
> unpushed local branch `spike/eess-over-ts-archunit` for 27 days. The file below
> calls itself "the spike's terminal record", and a terminal record that exists on
> one laptop is one disk failure from gone — so it is landed here, in the corpus,
> where terminal records belong.
>
> Landing it is **not** a proposal to act on it. The conclusion's own framing
> stands: the branch was never proposed for merge, and nothing here obliges
> anyone. Read the date — the blockers below were measured against ts-archunit
> 0.58.0 on 2026-08-08 and have not been re-checked since.
>
> **The numbers below are from before a renumbering and do NOT mean what they say
> here.** Each is a live artifact in this repo about something else entirely:
>
> | this record says                              | this repo's live artifact                                     |
> | --------------------------------------------- | ------------------------------------------------------------- |
> | ADR-009, "adopt ts-archunit, retire the fork" | `adr/009-agent-first-failure-surfaces.md`                     |
> | plan 0084, plan 0085                          | no such plans; 0084 and 0085 are **bugs**                     |
> | bug 0086, "NUL bytes in published dist"       | `work/bugs/fixed/0086-links-to-directories-do-not-resolve.md` |
> | bug 0087, "gates can be silently unwired"     | `work/bugs/0087-frontmatter-parsed-as-setext-heading.md`      |
>
> The collision that will actually catch someone: **this repo's bug 0086 is the
> corpus-link-routing bug** cited throughout `scripts/check-corpus.mjs` — the file
> [bug 0249](../../bugs/0249-most-of-work-is-outside-every-corpus-root.md) is
> about. A reader following that thread meets two different bug 0086s. The
> NUL-bytes work this record calls "0086" landed here as
> [0099](../../bugs/fixed/0099-nul-bytes-make-md-gherkin-unsearchable.md) and
> [0144](../../bugs/fixed/0144-md-gherkin-nul-bytes-break-grep.md).
>
> **Do not spot-check this.** The record's bug 0074 citation IS correct here — it
> is the jiti config-loader bug, same number, same subject. So one sample can
> return a true positive and buy false confidence in the rest. Architecture review
> found that, and it is why the table above is exhaustive rather than illustrative:
> 0074 is the only citation verified to survive the renumbering.
>
> **Where the artifacts this record cites now live.** "This branch" is deleted.
> Its tip was `e9fe6bbcd70abafe57f287c06de84887bdff19fd`, reachable from one
> machine's reflog until roughly 2026-11-06 and nowhere else. The runnable spike,
> two reviewer personas, those plans and that ADR were all left behind
> deliberately — they collide with live numbering and none is a terminal record —
> but the citations to them below are, from today, dangling. Naming the SHA is the
> most this landing can do about that.
>
> **One edit, disclosed.** The reference in "What blocks it" pointed at
> ts-archunit's own source and was written in this repo's `path:line` pointer
> shape. It now names ts-archunit's file and line in prose instead.
>
> The first version of this note gave the wrong reason — it said the path "does
> not exist" here. It effectively does: this repo's corpus gate resolves a pointer
> by path **suffix**, so that reference matches `packages/ts/src/core/rule-builder.ts`
> and would be reported as grounded. That is worse than not existing, because a
> gate would bless a claim about the wrong file. Enforcement review measured it,
> and it is why the shape is broken here rather than merely relocated.

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
