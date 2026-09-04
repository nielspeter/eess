# Bug 0250: the review roster is a gated contract with a hole — no persona owns the working-method lens

## Status

- **State:** Fixed — the lens has an owner, and its first run caught a method
  defect in this record's own sibling. Closed in the PR that fixed it.
  `Deferred: none`.
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

- a board's status cell saying `Draft` about shipped work — [0244](../0244-the-board-status-cell-is-bound-to-nothing.md)
- a bug closed in a separate post-merge PR, against the project's own rule — [0238](./0238-the-kernels-reason-free-waiver-promotion-is-untested.md)
- hand-written counts gone stale **inside the comment warning about stale counts**
- a record's code pointer staling in the commit that wrote it
- a CONTROL justified by a claim measurement refuted
- [0249](../0249-most-of-work-is-outside-every-corpus-root.md) shipping a title
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

## The option taken, and why the other two are worse

**Option 1 — a seventh persona**, `reviewer-method`, with its roster row.

**Not option 2 (fold it into `enforcement`).** That lens is the one the skill
declares mandatory and forbids omitting, and its question is about _mechanisms_:
can this go red, is the break class named, is the tier honest. Method findings ask
the same question of _records_: was that number measured, does that comment
describe a mechanism that exists, does the board agree with the record. Related,
but loading both onto one persona is how a mandatory lens gets quietly weaker —
and enforcement's brief is already the longest of the six.

**Not option 3 (declare it unowned).** The record argued an explicit non-owner
beats a silent one, and that is true — but it is a fallback, not a fix. This
repo's whole thesis is that unowned things rot, and the six findings above are
what that looks like.

The persona is adapted from one that existed on the branch whose records PR #99
landed, not written from nothing: its brief was already right. What is new is
calibration to what this session actually produced — "measured or asserted?" is
promoted to the first item because it was the highest-yield question, and "claims
that outrun their mechanism" is added as its own class, because that phrase named
findings in three separate reviews.

## Verification

- [x] `check:review-harness` stays green: **7 reviewer agents, roster matches**.
      The gate objected the moment the agent file existed without a roster row —
      that bidirectional check is what made this a safe two-file change, and it
      is now the thing holding the seventh persona honest.
- [x] The gate's own non-vacuity fixture still fires (`bad-review-harness:
detected as expected — foreign-project token`), so the roster check is not
      green by accident after the addition.
- [x] A method finding is re-run against the new owner and caught **by its brief,
      not by initiative**. Run on `work/README.md` — the corpus map
      [0249](../0249-most-of-work-is-outside-every-corpus-root.md) had already
      flagged as wrong — with no hint of what to look for. It returned nine
      findings, two critical, every one measured. Three are worth naming because
      no existing persona would have been assigned to any of them:

      - **The `State:` token table is wrong for two of three lanes.** The map
        teaches one four-token vocabulary; `check-ledger.mjs` declares three
        deliberately disjoint ones. `Fixed`, `Promoted` and `Parked` are in live
        use across dozens of records and appear in the map **zero** times — so a
        newcomer closing a bug as `Done` per the map gets a gate failure the map
        cannot explain. Neither 0108 nor 0249 covers this.
      - **The dogfood is worse than the product.** `kit/templates/work/README.md`
        — what eess *exports* as its working method — lists two lanes including
        `bugs/`; the repo's own copy lists one and calls the bugs lane
        "cargo-cult". The two files have diverged structurally, so a fix to
        either will not propagate.
      - **It found a record I missed.** [Bug 0108](../0108-work-readme-lanes-table-lists-one-lane.md)
        has covered the README lane drift since 2026-08-12. I filed 0249 with
        "fix `work/README.md`" as a remedy step and never checked whether it was
        already filed — and 0108's own fix is blocked by 0249's root gap, with
        neither record naming the other. Cross-linked now.

      That last one is the strongest evidence available: the lens's first run
      caught a method defect **in the record that argued for creating it**.

- [x] The `/review` skill names when the lens is mandatory, rather than leaving a
      seventh optional persona nobody selects: whenever the change touches
      `work/`, `adr/` or `docs/`.

## Related

- [0244](../0244-the-board-status-cell-is-bound-to-nothing.md) ·
  [0248](../0248-the-source-text-guard-covers-a-sixth-of-the-repo.md) ·
  [0249](../0249-most-of-work-is-outside-every-corpus-root.md) — three findings of
  this class in two days, which is what made the gap visible.
