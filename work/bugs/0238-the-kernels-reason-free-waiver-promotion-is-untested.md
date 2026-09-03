# Bug 0238: the kernel's reason-free-waiver promotion is untested, and ADR-012 gates the clause on the dialect that forked it

## Status

- **State:** Draft — reproduced by sabotage and fixed; `/close` owes the move
  to `fixed/` once `validate` is green and the change is reviewed.
- **Severity:** High — **latent false green, in the suppression path.** Nothing
  is wrong today: the promotion is present and correct. What is missing is
  anything that would notice if it stopped. Delete twenty lines from
  `packages/core/src/execute-rule.ts` and the kernel suite stays green while
  four dialects silently apply reason-free waivers and exit 0. ADR-009 rule 1's
  subject, reached through rule 5: the guard has no differently-derived
  disagreement.
- **Origin:** self-found · architect review of the kernel-unification arc after
  it merged (PR #91, 2026-09-03). The arc shipped without a panel because an API
  outage killed every reviewer spawn; this is the first finding of the review
  that ran afterwards.
- **Reported:** 2026-09-03

## Symptom

[ADR-012](../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md) changed what
a **reason-free** exclusion directive does in the kernel. Before, the parser
**refused** it: the waiver did not apply, the finding still fired, and the
author saw red. `packages/core/src/exclusion-comments.ts:311` records the
change in its own comment — _"This used to `return` — refusing the waiver"_.

After, the waiver **applies**, and safety moves to a second step in a different
module: `applyFilters` promotes each `undocumented` warning into an
unsuppressable `severity: 'error'` finding
(`packages/core/src/execute-rule.ts:170`). That is a good design — the author
gets the original finding _and_ a message naming what to fix — but it converts
a one-step fail-closed into a two-step one, where step one suppresses and step
two is the only thing that keeps the build honest.

**Step two is exercised by no kernel test.** Measured:

| file                                                       | calls `applyFilters` | covers a reason-free directive |
| ---------------------------------------------------------- | -------------------- | ------------------------------ |
| `packages/core/tests/execute-rule.test.ts`                 | yes                  | no                             |
| `packages/core/tests/correspondence.test.ts`               | yes                  | no                             |
| `packages/core/tests/exclusion-reason-and-nesting.test.ts` | **no**               | yes, at the parser only        |

The third file is the one that looks like coverage. It asserts that the waiver
applies and that a warning with `kind === 'undocumented'` is produced — the
parser half, which is the **fail-open** half. It never calls `applyFilters`, so
it says nothing about whether that warning ever becomes a finding.

## Why it matters

`packages/ts` forks `applyFilters`; `eess-md`, `eess-mermaid`, `eess-gherkin`
and `eess-crossvalidate` do not — verified, they have no copy — so all four
reach the kernel's. Those four are exactly the dialects ADR-012 exists to give
this behaviour to. If the promotion regresses, a `// eess-exclude some/rule`
with no reason silently suppresses a real finding in four of the five dialects,
and every gate reports green.

**And ADR-012's Enforcement table reads as coverage it does not have.** Its row
for this clause (`adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md:139`) is
`gated` on a test under `packages/ts/tests/`. That test exercises **eess-ts's
fork**. So the clause is proven for the one dialect that does not depend on the
kernel's copy, and unproven for the four that do. This is bug 0189's shape
exactly — an ADR row green over a different path than the clause it states —
and that record is already in `fixed/` for the same mistake in ADR-008.

## Reproduction

**Measured by sabotage, 2026-09-03.** Delete the promotion loop at
`packages/core/src/execute-rule.ts:170` and run the kernel suite:

| kernel suite            | before the fix | with the promotion deleted |
| ----------------------- | -------------- | -------------------------- |
| tests                   | 206 pass       | **206 pass**               |
| after this record's fix | 209 pass       | 208 pass, **1 fails**      |

The one failure is the test this record adds. Nothing that existed before it
noticed the deletion, which is the finding stated as an experiment rather than
an inference.

Consistent by inspection, and the reason the gap was invisible: two kernel tests
call `applyFilters` (`execute-rule.test.ts`, `correspondence.test.ts`) and
neither involves a reason-free directive, while
`exclusion-reason-and-nesting.test.ts` — the file that looks like coverage, and
the one ADR-012 cites — never called `applyFilters` at all.

**A correction, because the first draft of this record blamed the wrong cause.**
It said a worktree sabotage was attempted and that "vitest would not boot there".
That was false. Vitest refused because the invocation passed `--reporter=basic`,
which vitest 4 has no such reporter for and tried to load as a module — an error
in the measurement, not in the worktree. The `node_modules` symlink observation
was real but irrelevant here: the kernel tests import by relative path
(`../src/internal.js`), so the sabotage would have been sound. Recorded rather
than edited away, because a wrong reason for an abandoned measurement is exactly
the shape this repo keeps catching.

## Root cause

Not the unification itself, which is right. The safety property moved from the
parser to the filter, and the test that pinned it stayed with the parser. Its
own comment at `packages/core/tests/exclusion-reason-and-nesting.test.ts:105`
says `execute-rule` promotes the warning — the knowledge is written down, one
line above a test that does not assert it.

## Fix

1. A kernel test driving `applyFilters` with a reason-free directive over a real
   finding, asserting the promoted violation by **rule id** and that it carries
   `bypassFilters` and `severity: 'error'` — not that a warning exists.
2. A `check:nonvacuity` row so the assertion cannot be deleted silently, keyed
   on the promoted finding's identity per the harness's assert-the-rule-id
   doctrine.

   **Correction, 2026-09-03: this originally said the natural home is
   `GATE_FOR['check:arch']`'s kernel family. That is wrong, and the fix
   deliberately went elsewhere.** `check:arch` runs `eess-ts check`, which uses
   **`eess-ts`'s own forked `applyFilters`** — so a row keyed there would
   exercise the one implementation that was already covered and prove nothing
   about the four dialects this record is about. The row is claimed by
   `check:corpus` instead, whose `corpus/broken-links` rule reaches the kernel's
   copy through `eess-md`. Recorded rather than edited away: a reader trusting
   this section over the shipped row would look in the wrong bucket, and the
   mistake is the same one the record's own Symptom describes — reasoning about
   a shared clause without asking which engine actually runs it.

3. Correct ADR-012's row at `:139`: cite the kernel test as the mechanism for
   the kernel's four dialects, and keep the `eess-ts` citation for the fork, or
   say plainly that the fork is covered separately. One clause, two engines,
   needs two citations or an honest note.

## Verification

- [x] Red first: with the promotion deleted, the kernel suite went from 209
      passing to 208 passing and **1 failing** — the test this record adds, and
      nothing else. Before the fix the same deletion left all 206 green.
- [x] The non-vacuity fixture discriminates: sabotaged **and rebuilt**, it exits
      0 reporting "Saw 0 violation(s)" — the silent green itself. The rebuild is
      the point: the first attempt sabotaged source without rebuilding, the
      fixture ran against stale `dist/` and reported OK, and that near-miss is
      why this box names the step.
- [x] A reason-free waiver in an `eess-md` rule produces the unsuppressable
      finding — asserted end to end by the fixture, not assumed from the kernel
      test.
- [x] ADR-012's row names a mechanism per engine, and carries a dated correction
      saying what it claimed before.
- [ ] `npm run validate` green from a run that reached the last step.

## Related

- [ADR-012](../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md) — the
  decision whose compensating half this record protects.
- [0189](./fixed/0189-adr-008s-preset-default-row-is-gated-over-a-changed-engine.md)
  — the same shape in ADR-008: a row `gated` over an engine other than the one
  its clause governs, green for a full release cycle while the clause was
  violated.
- [plan 0188](../plans/0188-unify-the-duplicated-engine-modules.md) — owns the
  two `applyFilters` copies. Until it lands, any clause about filter behaviour
  needs a citation per engine, which is this record's third fix item.
