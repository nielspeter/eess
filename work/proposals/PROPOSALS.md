# Proposals — design under debate

A **proposal** is the shape of a capability, argued from measured evidence, with
its open questions still open. It is not a work order and it is not a defect
record:

- A **plan** ([`ROADMAP.md`](../plans/ROADMAP.md)) is work we chose to do.
- A **bug** ([`BUGS.md`](../bugs/BUGS.md)) is something already wrong in the code.
- A **proposal** is a question about what the product should become — reviewed
  _before_ anyone writes the plan, let alone the code.

The gate between a proposal and a plan is the `review-proposal` skill: an
existing-code survey plus architect, product, and enforcement reviews. An
accepted proposal becomes a Draft plan on the
[roadmap](../plans/ROADMAP.md); any binding decision inside it becomes an ADR
alongside [ADR-006](../../adr/006-framework-rules-architecture.md). **Reviewing
is not accepting** — a green review produces a Draft plan, not code.

## Why the survey is the whole game

Every duplication finding in this project's history came from a proposal written
without reading the code, and the pattern is unbroken:

- **002** — declined as specified; the primitive was shaped to the submitter's
  encoding, and measured 0 true positives against this repo's 130 citations.
- **003** — listed GraphQL as a future candidate. It ships: 959 LOC, a sub-path
  export, and a docs page. Surveying it also found the shipped condition is a
  text grep that cannot go red for a field named `id` (bug
  [0135](../bugs/0135-graphql-resolver-binding-is-a-text-grep.md)).
- **004** — asked for a corpus-listing primitive that is already public API in
  both dialects it named, and whose evidence section cited the wrong package's
  README.

Three proposals, three capabilities that already existed. **Survey first.**

## Origin

- **self-found** — raised by this repo's own work: a review, a gate, a spike.
- **inbound** — filed by an agent working in a _consuming_ project. Real field
  evidence and worth keeping, but it is evidence, not a finding: every
  load-bearing claim is verified against our own source before it is adopted, and
  any vocabulary from the reporting project is re-sourced to our own corpus.

## Vocabulary

**State** — a proposal's header carries a `**State:**` line. **Review does not
change it.** A proposal ruled `Rewrite needed` is still live work; what changes on
review is the `Ruling` below, the prose after the em dash, and the presence of a
`## Review` section. What closes a proposal is the ask being _dispatched_.

| State      | Meaning                                                                    | Folder      |
| ---------- | -------------------------------------------------------------------------- | ----------- |
| `Draft`    | filed. Live, whether or not it has been reviewed                           | in place    |
| `Promoted` | dispatched — a plan or bug owns it, **and the header names it**            | `promoted/` |
| `Rejected` | will not be done. The header says why, so the ask does not silently return | `rejected/` |

`Rejected` is the bugs lane's word, deliberately: `Won't-do` (plans) / `Rejected`
(bugs) / a third synonym here would make a stranger learn three words for one
idea. It is a **State**, distinct from the `Reject` **Ruling** below — a ruling is
a verdict on the submission, a state is where the record now lives. There is no
`rejected/` directory yet; the first rejection creates it, the way `BUGS.md`
records for its own lane.

`Promoted` and `Rejected` are terminal, and `check:ledger` treats them as such
(plan 0216). The terminal token **names its successor** — that is the whole reason
promotion is safe in a lane whose checkboxes are a design checklist rather than a
deferral ledger: a proposal's open boxes travel with it into the plan it promotes to.

> **An earlier version of this section claimed "no separate linkage rule is owed",
> because `check:corpus` already verifies named plans via `**Implements:**`+`ACCEPTED_RULINGS`. That was false, and three reviewers falsified it
> independently.** The inherited rule keys on the **Ruling**, never on the
> **State**, and `ACCEPTED_RULINGS` is only `Ship as-is` / `Ship with changes`. So
> `Split and sequence`, `Rewrite needed`, `Docs-only` and `Reject` were all
> promotable while naming nothing — and `Split and sequence` is 006's, the next
> promotion. Measured: a `Promoted` proposal naming no owner passed both gates
> green. A convention with no mechanism is what ADR-009 exists to reject, so the
> rules below were built. Recorded rather than edited away.

Three checks hold the terminal state honest, all in `check:corpus`:

| rule                                 | fires when                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| `promoted-proposal-names-no-owner`   | `Promoted` and no plan **or bug** declares `**Implements:** proposal NNN`        |
| `promoted-proposal-not-dispatchable` | `Promoted` on a `Rewrite needed` / `Reject` ruling — live work, not a dispatch   |
| `promoted-proposal-has-held-asks`    | `Promoted` while a disposition row is still `Held` — a live ask leaving the lane |

The third exists because `honestyAtClose` reads GFM task boxes and a disposition
table is a **table**: closing a proposal with every ask still `Held` produced zero
findings until this rule.

Until 2026-08-23 this lane had no terminal state at all, and this section asserted
that `Draft` was "the only value a proposal's own header has ever carried" — true
when written, and exactly the kind of sentence that rots. `check:ledger` reported
the consequence in its own summary: `6 scanned · 0 done`, with 005 fully
discharged and still reading `Draft`. Anything outside the vocabulary above is
reported as `ledger/unknown-state`, not silently ignored.

The board's **Status** column below is a different, _derived_ fact — whether a
`## Review — YYYY-MM-DD` section exists in the file — not a second `State` value.
Nothing mechanizes that derivation today; it is asserted by whoever last updated
the board, the same hand-maintained trust every other board in `work/` runs on.

**Ruling** — the verdict `review-proposal` returns. It is recorded _in the
proposal_, as a `## Review — YYYY-MM-DD` section, with the submission preserved
below it rather than edited away. The Ruling itself is a fixed-shape, literal
line — `**Ruling: <verdict>**`, bold closing immediately after the verdict, one
of the six values below **verbatim, same casing** (bug 0141, fixed 2026-08-14 by
[plan 0142](../plans/completed/0142-bind-proposals-to-plans.md): a Ruling written as a
sentence — `**Ruling: rewrite needed — because …**` — is not reliably
parseable, and every proposal filed before 0142 had drifted into its own shape):

| Ruling               | Meaning                                                            |
| -------------------- | ------------------------------------------------------------------ |
| `Ship as-is`         | accepted; `/plan` it as Draft                                      |
| `Ship with changes`  | accepted once the named changes land                               |
| `Split and sequence` | more than one shippable thing; split before planning               |
| `Rewrite needed`     | the material is worth keeping; the shape or the container is wrong |
| `Docs-only`          | the capability exists — the gap is discoverability                 |
| `Reject`             | the premise did not hold                                           |

A proposal reviewed more than once carries more than one `## Review —` section,
stacked in order, never replacing an earlier one; the **most recent** — the last
`**Ruling: <verdict>**` line anywhere in the file — is the operative one,
independent of which `## Review` section it happens to sit under (`check:corpus`
does not require the heading to be well-formed to find the Ruling; a well-formed
Ruling with a malformed or missing heading still counts).

`Split and sequence` deliberately does **not** require a plan: it means "more
than one shippable thing; split before planning" — the next step is decomposing
the proposal itself, not yet a single plan to declare `**Implements:**` against.

**Implements** — the back-reference a plan built from an accepted proposal
declares in its own `## Status` header, e.g. `- **Implements:** proposal 002` or
`- **Implements:** [proposal 002](./002-comment-embedded-links.md)` — a bare
number or a markdown link, optionally bulleted (every real `## Status` header in
this repo is a bulleted list), with any trailing rationale after it ignored. A
textual mention of a proposal elsewhere in the plan is not this —
[bug 0141](../bugs/fixed/0141-no-check-binds-accepted-proposals-to-plans.md) found that
0089, 0090, and 0101 all cite a proposal in prose without implementing it (two
exclude one from scope; one cites another only as a re-check dependency). Only a
declared `**Implements:**` line counts, and it must name a real proposal number —
`check:corpus` reports both a malformed line and one naming a proposal that
doesn't exist.

**Priority** is the same scale as [`ROADMAP.md`](../plans/ROADMAP.md)'s: High
closes a gap between what eess claims and what it checks; Medium extends reach or
adoption surface; Low is speculative or demand-driven.

**A proposal is not evidence of demand.** 002 measured 130 real citations and was
still declined. An unmeasured ask is a shape, not a signal.

## Disposition — per ask, inside a Ruling

A `Split and sequence` ruling disposes each **ask** separately; the values below are that
column's vocabulary. Introduced by proposal 006's review and documented here rather than
deferred, because a word coined in a review and defined nowhere is the drift this lane
exists to catch.

| Disposition          | Meaning                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `Accepted`           | a plan owns it; the row names that plan                                                     |
| `Accepted, reshaped` | accepted, but not as asked — the row says what changed and why                              |
| `Held`               | not rejected and not ready. **The row must state what would unhold it**, or it is a soft no |
| `Rejected`           | will not be done. The row states the reason, so the ask does not return                     |

A `Held` row with no stated condition, or an `Accepted` row whose owner does not resolve, is
a defect in the disposition — not a state.

## Corrections stay in the record

Where a review falsifies a claim, the claim is **annotated in place, not edited
away** — and where a review finds a defect the proposal committed _in itself_,
that correction is recorded rather than silently fixed. That is how the template
learns. 001 records that its first draft specified six new ways to fail a build
with no non-vacuity criteria; 004 records that a proposal about agents making
false claims about corpus state contained one.

## Board

| Item                                                                                                  | Priority | Status      | Ruling             | Origin                      | Related plans                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------- | -------- | ----------- | ------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [001 — express a corpus's own conventions](./001-md-corpus-rule-coverage.md)                          | High     | 🔵 Reviewed | Rewrite needed     | self-found                  | builds on [0069](../plans/completed/0069-spec-corpus-reach.md) ✅; out of scope for [0089](../plans/completed/0089-family-standalone-sufficiency.md), [0101](../plans/completed/0101-sibling-gates-go-fail-closed.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [002 — links embedded in source-code comments](./002-comment-embedded-links.md)                       | Medium   | 🔵 Reviewed | Rewrite needed     | inbound · reference corpus  | deferred behind [0090](../plans/0090-adopt-ts-archunit-work-corpus.md), which now **declares** `**Implements:** proposal 002` rather than only citing it in prose (2026-08-23) — the mechanism bug 0141 built, unused on its one live case until then. Stays `Draft`: the ruling is `Rewrite needed`, and `corpus/promoted-proposal-not-dispatchable` refuses promotion on it, correctly                                                                                                                                                                                                                                                                                                                                                                                                  |
| [003 — future dialect candidates (catalog)](./003-future-dialect-candidates.md)                       | —        | 🔵 Reviewed | Rewrite needed     | brainstormed w/ maintainer  | excludes [0078](../plans/0078-workflow-dialect.md); ER candidate parked by [0096](../plans/completed/0096-dogfood-missing-crossvalidate-bindings.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [004 — corpus-content `explain` equivalent](./promoted/004-corpus-content-explain.md)                 | Low      | 🔵 Reviewed | Docs-only          | inbound · consuming project | ✅ **Promoted** → [bug 0219](../bugs/fixed/0219-corpus-listing-surface-is-undocumented.md), which declares `**Implements:** proposal 004` and owns the docs this ruling called for. The remedy was unowned for ten days: measured 2026-08-23, the listing surface appeared in 0 files under `docs/` and 0 package READMEs. CLI question sequenced after [0089](../plans/completed/0089-family-standalone-sufficiency.md)                                                                                                                                                                                                                                                                                                                                                                  |
| [005 — crossvalidate: detect a stale `@wip` tag](./promoted/005-crossvalidate-stale-wip-detection.md) | Medium   | 🔵 Reviewed | Ship as-is         | inbound · consuming project | implemented by [0145](../plans/completed/0145-crossvalidate-stale-wip-detection.md) ✅; folds in one row of [bug 0112](../bugs/0112-three-crossval-presets-have-no-fixture.md); cites [bug 0127](../bugs/fixed/0127-nonvacuity-proves-a-condition-not-a-wired-rule.md) for the fixture tier avoided; accepted after a third review round found [bug 0144](../bugs/fixed/0144-md-gherkin-nul-bytes-break-grep.md)                                                                                                                                                                                                                                                                                                                                                                          |
| [006 — mermaid beyond `classDiagram`, and diagrams in Markdown](./006-mermaid-beyond-classdiagram.md) | Medium   | 🔵 Reviewed | Split and sequence | inbound · consuming project | survey found Ask A already ships via `packages/crossvalidate/src/md-mermaid.ts:186`; three lenses agreed the ask is 4–6 shippable things. Accepted parts owned by [0212](../plans/0212-eess-mermaid-fence-discoverability.md) · [0213](../plans/0213-diagram-provenance-for-fence-callers.md) · [0214](../plans/0214-extract-the-diagram-kind-predicate.md). Spawned [bug 0211](../bugs/0211-diagram-sniffs-its-input-and-reads-arbitrary-files.md) (`diagram()` sniffs its input — arbitrary file read from fence content) and [bug 0217](../bugs/0217-the-manifesto-marks-flow-diagrams-shipped.md), inherits [bug 0210](../bugs/0210-er-fence-selector-is-an-allowlist.md). Its own pointers went stale twice and it shipped with no acceptance criteria — both recorded in the Review |

**What each one asked for.** 001 — `terms()`/`vocabulary()` plus coverage over
the md corpus. 002 — resolve doc citations embedded in source-code comments.
003 — a catalog of eight candidate future dialects. 004 — a corpus-listing
primitive for md/gherkin. 005 — detect a Gherkin scenario still tagged `@wip`
after a real test already cites it. 006 — mermaid beyond
`classDiagram`, and diagrams embedded in Markdown.

**Read of the board (2026-08-14).** **005 has spawned a plan, built and
merged** —
[0145](../plans/completed/0145-crossvalidate-stale-wip-detection.md), the
first time any proposal here has, and the first real exercise of the
proposal→plan linkage gate
([bug 0141](../bugs/fixed/0141-no-check-binds-accepted-proposals-to-plans.md)/[plan
0142](../plans/completed/0142-bind-proposals-to-plans.md)) against real
content rather than a synthetic probe. It took three review rounds, not one: 005's survey
found nothing wrong (the capability really is new), but its evidence and
acceptance criteria needed two full rewrites before they held up — round 2
found the first rewrite's own placement argument was factually wrong, and
round 3 (the one that decided actual acceptance) found the rewrite that
followed still couldn't be built as specified, in ways closable by name, not
by another spike. The other three filed so far were declined or returned as
specified; in each of those cases the survey alone was decisive, an argument
about the _template_, not about the submitters. 001 remains the only one
whose blocker is a set of decisions reserved for the author rather than a
defect in the submission.

The relationships that do exist run the other way, and are worth reading before
picking any of these up:

- **001 rests on shipped work rather than producing it.** `terms()`/`vocabulary()`
  landed in [0069](../plans/completed/0069-spec-corpus-reach.md) Phase 4, and the
  proposal's design was rewritten _against_ that primitive after the fact. Two live
  plans then name it explicitly **out of scope** — [0089](../plans/completed/0089-family-standalone-sufficiency.md)
  and [0101](../plans/completed/0101-sibling-gates-go-fail-closed.md) both fence off "md
  adopting `terms()`/`vocabulary()`" so their own floors stay closable.
- **002 is the only two-way binding.** The proposal defers its widened primitive
  behind [0090](../plans/0090-adopt-ts-archunit-work-corpus.md), and 0090 cites the
  proposal back. That is the shape a live deferral should have: neither end can be
  closed while forgetting the other.
- **003 and 004 cite plans for context only** — to avoid duplicating 0078, to note
  that 0096 already parks the ER binding for want of an `erDiagram` in this repo,
  and to flag that 004's CLI question is downstream of 0089's Phase 2 wording.
- **005 is now the two-way binding, alongside 002.**
  [Plan 0145](../plans/completed/0145-crossvalidate-stale-wip-detection.md) declares
  `**Implements:** proposal 005` in its own header, and this row names the
  plan back. 005 also still cites bugs, both directions run forward: it
  folds one row of [bug 0112](../bugs/0112-three-crossval-presets-have-no-fixture.md)
  into 0145's own scope rather than waiting on it, names
  [bug 0127](../bugs/fixed/0127-nonvacuity-proves-a-condition-not-a-wired-rule.md)
  as the fixture tier its own second review round caught it repeating, and
  its third review round found and fixed
  [bug 0144](../bugs/fixed/0144-md-gherkin-nul-bytes-break-grep.md) along the
  way. None of the three bugs cite 005 back — there is nothing for a bug
  record to point at in the other direction.

## Known gaps in this lane

Recorded rather than left to be rediscovered:

- **~~No terminal folder.~~** Closed 2026-08-23 by
  [plan 0216](../plans/completed/0216-dogfood-the-proposals-lane.md): `promoted/` and
  `declined/`, mirroring `completed/`/`wont-do/` on plans and `fixed/`/`rejected/`
  on bugs. 005 is the first to move.
- **~~`check:ledger` reads this lane but can't hold it honest at close~~** — bug
  [0121](../bugs/fixed/0121-ledger-reads-two-of-four-lanes.md) made the lane
  scanned and its `State:` readable; 0216 gave it the terminal states that make
  the box-disposition check reachable. It now reports a real done count.
- **Acceptance criteria are required by the template below and checked by
  nothing** — [plan 0218](../plans/0218-gate-proposal-acceptance-criteria.md).
  Measured: no proposal has ever carried the section in the shape the template
  prescribes.
- **A ruling that names a remedy creates no owner** —
  [plan 0218](../plans/0218-gate-proposal-acceptance-criteria.md) carries the rule.
  004's `Docs-only` ruling named documentation as the whole fix and nothing tracked it;
  ten days later none of it existed, while the proposal's header read as settled. The
  mirror case is a remainder "deferred behind plan NNNN" in prose, which is what 002 had
  until 0090 declared it.
- **The `work/` README lanes table lists one lane** — bug
  [0108](../bugs/0108-work-readme-lanes-table-lists-one-lane.md). This board does
  not fix that; it gives the lane something to point at.

`check:corpus` does gate this file: its cross-links must resolve, any `path:line`
pointer must ground in real code, and — since plan 0216 — the board and the
proposal files must **correspond**. The file is the source of truth; the board is a
copy, and a copy nothing compares is a copy that drifts.

It is a two-sided join, not a per-row spot check, so all of these red: a row whose
`Ruling` disagrees with its file, a proposal with **no row at all**, a row naming a
proposal that does not exist, a row that does not open with a number, and two files
claiming one number. Rows are matched by the proposal number that opens the `Item`
cell, so reordering the board is not a violation and a proposal moving into
`promoted/` keeps matching.

> A previous version of this paragraph, and of plan 0216, motivated the rule with
> _"006's row read `—` while its file read `Split and sequence`."_ **No commit
> carries that drift.** At `95ebf15` the row read `—` and the file had no `Ruling`
> line at all — they agreed; at `4d7ad72` both read `Split and sequence`. It was a
> transient working-tree state while PR #83 was authored, written up as a defect
> found in the corpus. The rule is still worth having — the other direction, a
> re-review changing the file while the board keeps the old verdict, is real and
> reds — but an unmeasured example does not belong in a lane spec. Corrected here
> rather than quietly.

## Proposal template

```markdown
# Proposal NNN — <package>: <Title>

**State:** Draft — <what has and has not been done: surveyed? measured? spiked?>
**Priority:** High | Medium | Low — <why, in the ROADMAP's terms>
**Origin:** self-found | **inbound** — <who filed it and against what>
**Affects:** <packages, builders, conditions — or "nothing yet">

## Problem

## Evidence

<Measured, dated, falsifiable. A shape with no measurement is a shape.>

## Proposed API

## Alternatives considered

## Acceptance criteria

<Per capability: the break class — the specific corruption that must produce a
violation — and how non-vacuity is kept. A capability with no break class is
unfalsifiable.>

## Open questions

<Decisions reserved for the library author. A review surfaces and argues these;
it does not settle them.>

## Scope
```
