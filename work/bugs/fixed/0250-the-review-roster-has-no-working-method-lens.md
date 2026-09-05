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

## The option taken, and why the other two are worse

**Option 1 — a seventh persona**, `reviewer-method`, with its roster row.

**Not option 2 (fold it into `enforcement`).** That lens is the one the skill
declares mandatory and forbids omitting, and its question is about _mechanisms_:
can this go red, is the break class named, is the tier honest.

**The reason given here first was weak, and architecture review said so.** It
argued from brief length — "enforcement's brief is already the longest" — which is
an argument about a file, not a lens. It also dismissed option 2 in a form it need
not take: not "load method onto enforcement" but "add four lines extending _is the
claim honest_ from mechanisms to the records describing them", which is what a
bullet is for.

The reason that survives is about **investigation, not taxonomy**. Enforcement
reads code and asks whether it can go red. Method reads prose and _re-runs its
measurements_ — its highest-value instruction is literally "run the command, read
the gate's real output, and say what it printed", aimed at documents. Different
tool sequences over different subjects. Folding them puts two investigations on
one agent's budget, and the mandatory one loses.

**And the evidence half of this record's original argument does not survive at
all.** It listed six findings of this class and called them caught "by luck of who
was looking". Six for six is not luck — it is the panel working. If enforcement
and architecture reliably step outside their briefs to catch method defects, the
honest reading is that briefs are emphasis rather than fences, and a seventh does
not make the other six stop. The cost of a persona is certain; the marginal catch
was inferred. What justifies the seventh is the different investigation above —
and, as it turned out, its first two runs finding a hole in its own mandate, an
unmeasurable claim in its own brief, and a record neither existing bug had named.

**Not option 3 (declare it unowned).** The record argued an explicit non-owner
beats a silent one, and that is true — but it is a fallback, not a fix. This
repo's whole thesis is that unowned things rot, and the six findings above are
what that looks like.

The persona is adapted from one that existed on the branch whose records PR #99
landed, not written from nothing: its brief was already right. Calibrated to what
this session produced — "measured or asserted?" promoted to the first item as the
highest-yield question, "claims that outrun their mechanism" added as its own
class because that phrase named findings in three separate reviews, "corrections
kept, not tidied away" added, and a scope note saying records are its subject even
when the diff is mostly code.

**One line was DROPPED, and it is the most interesting edit in the file.** The old
brief told the reviewer to check "State tokens used correctly (Draft/Ready/Done)"
— which is the union defect [0108](./0108-work-readme-lanes-table-lists-one-lane.md)
documents, sitting inside the persona meant to catch it. Removing it was right;
not noticing it was worth noticing, and the persona's own first review of this
change is what surfaced it.

## Verification

- [x] `check:review-harness` stays green: **7 reviewer agents, roster matches**.
      The gate objected the moment the agent file existed without a roster row —
      that bidirectional check is what made this a safe two-file change, and it
      is now the thing holding the seventh persona honest.
- [x] The gate's own non-vacuity fixture still fires (`bad-review-harness:
detected as expected — foreign-project token`). **It proves less than an
      earlier draft of this box claimed.** That fixture asserts one sentinel, for
      the foreign-token check — one of seven — so it says nothing about the roster
      check being non-vacuous. Enforcement review measured the consequence: three
      of the four original checks could be deleted with both the gate and the
      fixture green. Fixed at the gate instead (below); this box now says what
      the fixture actually shows.
- [x] A method finding is re-run against the new owner and caught **by its brief,
      not by initiative**. Run on `work/README.md` — the corpus map
      [0249](./0249-most-of-work-is-outside-every-corpus-root.md) had already
      flagged as wrong — with no hint of what to look for. Three of its findings
      are named below because no existing persona would have been assigned to
      any of them; the rest are drift in the same document, now carried by
      [0108](./0108-work-readme-lanes-table-lists-one-lane.md), which owns that
      map. (An earlier draft reported "nine findings, two critical" and named
      three — a count with no artifact behind six of them, in a record closed
      `Deferred: none`. Its own reviewer called that out.)

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
      - **It found a record I missed.** [Bug 0108](./0108-work-readme-lanes-table-lists-one-lane.md)
        has covered the README lane drift since 2026-08-12. I filed 0249 with
        "fix `work/README.md`" as a remedy step and never checked whether it was
        already filed — and 0108's own fix is blocked by 0249's root gap, with
        neither record naming the other. Cross-linked now.

      That last one is the strongest evidence available: the lens's first run
      caught a method defect **in the record that argued for creating it**.

- [x] The `/review` skill names when the lens is mandatory, rather than leaving a
      seventh optional persona nobody selects: whenever the change touches
      `work/`, `adr/` or `docs/`.

## Its own first review, applied to this record

The persona was pointed at this change — the change that created it — and told
so plainly, so the test was fair rather than a surprise. It returned no
criticals, re-derived every measurable claim here verbatim, and found four
things that are fixed above:

1. **The mandate leaned on a gate that did not make it.** The skill called two
   personas non-optional; only `reviewer-enforcement` was hard-required by name.
   Deleting the method agent **and** its roster row together left
   `check:review-harness` green at six — the roster check is a correspondence,
   so a coordinated deletion satisfies it. A clause now requires
   `reviewer-method` by name, mirroring the enforcement one, and the skill says
   plainly what remains ungated: nothing can check that a review actually RAN
   either persona.
2. **A count with no artifact behind it** — "nine findings", six of them unfiled,
   in a record closed `Deferred: none`.
3. **The "what is new" list read exhaustive and was not**, and omitted the one
   edit worth reporting: the old brief's own wrong State-token line, dropped.
4. **It flagged an unevidenced claim in its own brief** — "this repo has paid for
   the same finding being re-derived twice more than once" — which it could
   evidence once and not twice. Replaced with the measured instance (bugs 0099
   and 0144).

A lens whose first act is to find the hole in its own mandate and an
unmeasurable claim in its own text is the strongest evidence available that it is
the right lens.

## The enforcement review, and the gate it left behind

Its verdict was _do not ship as-is_, and it was right: **the fix for "the roster
has no working-method lens" added no check that the roster has one.** Deleting
the agent file and its roster row together left `check:review-harness` green at
six — 0250's exact pre-fix state, reported as OK. A mandatory lens whose absence
is green is a claim, not a mechanism.

Asked what the change actually bought, it measured the answer: a persona file
**truncated to zero bytes passed**, reporting "7 reviewer agents, roster
matches". The guarantee was a filename.

Seven holes, each reproduced here before fixing, each closed:

| hole                                                 | now                                                                                                                                                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| agent + roster row deleted together                  | red — `reviewer-method` required by name, mirroring the enforcement clause                                                                                                                                         |
| only the dispatch-table row deleted                  | red — the roster is read from the TABLE, not any backticked prose mention. The old pattern scanned the whole file, and this change had **doubled** the problem by adding prose mentions of both mandatory personas |
| frontmatter `name:` typo'd                           | red — the dispatcher binds `name:`, this gate bound the filename, and they were never compared. One character made a persona unreachable while everything read consistent                                          |
| brief emptied to 0 bytes                             | red — a length floor                                                                                                                                                                                               |
| brief replaced by a generic "review the code" prompt | red — each persona must still contain its own lens vocabulary. That is the drift this gate's header says it exists to prevent, and it was undetectable                                                             |
| any of the four loop checks deleted                  | red — each tallies **inside its own loop**, so its number goes to zero, and a zero beside `OK` is itself a finding (ADR-010)                                                                                       |
| either single-assertion check deleted                | red — they record that they ran                                                                                                                                                                                    |

**The summary line was making the same over-claim the gate exists to catch.** It
printed "roster matches, no foreign-project drift, enforcement present, --plan →
work/plans/" from a single `findings.length === 0`; enforcement review deleted
three of those four checks and watched all four claims print verbatim. It carries
a real denominator per check now — and the first version of that fix was wrong in
the identical way, computing the counts from the same inputs at the end, so
deleting a whole check left its number at 7. They are tallied where the work
happens.

**What still is not gated, said plainly because this record previously implied
otherwise:** nothing can check that a review actually RAN a persona. The gate
holds the roster and the briefs; honouring the mandate is the coordinator's. And
a lens vocabulary is a Tier-1 static check standing in for a Tier-4 semantic
property — it cannot be otherwise, because a prompt cannot be unit-tested.

## Related

- [0244](../0244-the-board-status-cell-is-bound-to-nothing.md) ·
  [0248](../0248-the-source-text-guard-covers-a-sixth-of-the-repo.md) ·
  [0249](./0249-most-of-work-is-outside-every-corpus-root.md) — three findings of
  this class in two days, which is what made the gap visible.
