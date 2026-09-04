# Bug 0250: the review roster is a gated contract with a hole — no persona owns the working-method lens

## Status

- **State:** Draft — measured, not fixed. The fix is a roster decision, not a
  defect to patch.
- **Severity:** Medium — **an unowned class of finding, in the mechanism that
  exists to make ownership explicit.** Findings of this class do get caught, but
  by whichever reviewer wanders outside its brief. That is luck, and this repo's
  whole method is that nothing is left to it.
- **Origin:** self-found · architecture review of PR #99 grepped the six personas
  for this lens and found nobody holding it; re-derived independently here.
- **Reported:** 2026-09-04

## Symptom

`.claude/agents/` holds six reviewer personas, and `check:review-harness` gates
the roster **bidirectionally** — a persona on disk without a row in the `/review`
skill reds the build, and vice versa. So the roster is not a convention; it is a
declared, enforced contract about which lenses a review covers.

Measured across all six, for the working-method vocabulary
(`closab|freeze discipline|ledger|disposition|honest.*claim`):

| persona     | hits | what they are                                              |
| ----------- | ---- | ---------------------------------------------------------- |
| architect   | 0    | —                                                          |
| customer    | 0    | —                                                          |
| enforcement | 0    | —                                                          |
| product     | 1    | "the honest tier model" — a tier claim, not method honesty |
| devops      | 1    | `ledger` as a gate name in a chain listing                 |
| testing     | 1    | `ledger` as a gate name in a chain listing                 |

**Zero of the three hits are the lens.** Nobody owns: plan closability, ledger
honesty and box disposition, ADR-vs-plan separation, freeze discipline, and the
question this repo asks most often — _was that number measured, or asserted?_

## The evidence is the reviews themselves

Findings from this session that belong to no persona's brief, each caught by a
reviewer reaching outside it or by the author:

- a board's status cell saying `Draft` about shipped work — [0244](./0244-the-board-status-cell-is-bound-to-nothing.md)
- a bug closed in a separate post-merge PR, against the project's own rule — [0238](./fixed/0238-the-kernels-reason-free-waiver-promotion-is-untested.md)
- hand-written counts gone stale **inside the comment warning about stale counts**
- a record's code pointer staling in the commit that wrote it
- a CONTROL justified by a claim measurement refuted
- [0249](./0249-most-of-work-is-outside-every-corpus-root.md) shipping a title
  that was wrong by half, and a root cause false in the fail-open direction

Every one is a method finding. They were caught — and that is the point: they
were caught by the enforcement and architecture reviewers stepping outside their
own briefs, and by the author re-reading. Nothing assigned anyone to look.

## Why the obvious fix is not simply "add the persona back"

A `reviewer-method` persona **existed**. It was on the deleted branch
`spike/eess-over-ts-archunit` (tip `e9fe6bbcd70abafe57f287c06de84887bdff19fd`,
reflog-reachable until roughly 2026-11-06), described as:

> Working-method reviewer — closability, ledger honesty, ADR/plan separation,
> freeze discipline, honest claims. The corpus-integrity lens no generic persona
> covers.

It was correctly left behind when that branch's records were landed: it predates
the six current personas (created later, in PR #34), and dropping a file into
`.claude/agents/` without a matching `/review` skill row reds
`check:review-harness` immediately. Its sibling `reviewer-release` is genuinely
superseded by `reviewer-devops`.

So this is not "restore a file". It is a decision about what the roster is for,
with three real options:

1. **Add the seventh persona**, with its skill row — the roster gate makes that a
   two-file change and will hold it honest.
2. **Extend an existing brief.** `enforcement` is the closest fit: its lens is
   already "can this go red, is the claim honest". Method findings are that
   question asked of records instead of code.
3. **Decide the lens belongs to the author, not a reviewer**, and say so in the
   `/review` skill — an explicit non-owner beats a silent one.

## Verification

- [ ] Whichever option is taken, `check:review-harness` stays green — the roster
      and the skill table agree.
- [ ] A method finding from the list above is re-run against the chosen owner and
      is actually caught by its brief, not by a reviewer's initiative.
- [ ] If option 3, the `/review` skill says plainly that this class is unowned, so
      the next reader does not assume the roster covers it.

## Related

- [0244](./0244-the-board-status-cell-is-bound-to-nothing.md) ·
  [0248](./0248-the-source-text-guard-covers-a-sixth-of-the-repo.md) ·
  [0249](./0249-most-of-work-is-outside-every-corpus-root.md) — three findings of
  this class in two days, which is what made the gap visible.
