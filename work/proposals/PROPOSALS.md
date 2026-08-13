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

**State** — a proposal's header carries its own status line; a row means what the
header says.

| State      | Meaning                                                                        |
| ---------- | ------------------------------------------------------------------------------ |
| `Draft`    | filed; not yet through the three-lens review                                   |
| `Reviewed` | survey + architect/product/enforcement run; the ruling is recorded in the file |

**Ruling** — the verdict `review-proposal` returns. It is recorded _in the
proposal_, as a `## Review — YYYY-MM-DD` section, with the submission preserved
below it rather than edited away:

| Ruling               | Meaning                                                            |
| -------------------- | ------------------------------------------------------------------ |
| `Ship as-is`         | accepted; `/plan` it as Draft                                      |
| `Ship with changes`  | accepted once the named changes land                               |
| `Split and sequence` | more than one shippable thing; split before planning               |
| `Rewrite needed`     | the material is worth keeping; the shape or the container is wrong |
| `Docs-only`          | the capability exists — the gap is discoverability                 |
| `Reject`             | the premise did not hold                                           |

**Priority** is the same scale as [`ROADMAP.md`](../plans/ROADMAP.md)'s: High
closes a gap between what eess claims and what it checks; Medium extends reach or
adoption surface; Low is speculative or demand-driven.

**A proposal is not evidence of demand.** 002 measured 130 real citations and was
still declined. An unmeasured ask is a shape, not a signal.

## Corrections stay in the record

Where a review falsifies a claim, the claim is **annotated in place, not edited
away** — and where a review finds a defect the proposal committed _in itself_,
that correction is recorded rather than silently fixed. That is how the template
learns. 001 records that its first draft specified six new ways to fail a build
with no non-vacuity criteria; 004 records that a proposal about agents making
false claims about corpus state contained one.

## Board

| Item                                                                            | Priority | State       | Ruling         | Origin                      | Related plans                                                                                                                                                                                     |
| ------------------------------------------------------------------------------- | -------- | ----------- | -------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [001 — express a corpus's own conventions](./001-md-corpus-rule-coverage.md)    | High     | 🔵 Reviewed | Rewrite needed | self-found                  | builds on [0069](../plans/completed/0069-spec-corpus-reach.md) ✅; out of scope for [0089](../plans/0089-family-standalone-sufficiency.md), [0101](../plans/0101-sibling-gates-go-fail-closed.md) |
| [002 — links embedded in source-code comments](./002-comment-embedded-links.md) | Medium   | 🔵 Reviewed | Rewrite needed | inbound · reference corpus  | deferred behind [0090](../plans/0090-adopt-ts-archunit-work-corpus.md) ⇄ (cited both ways)                                                                                                        |
| [003 — future dialect candidates (catalog)](./003-future-dialect-candidates.md) | —        | 🔵 Reviewed | Rewrite needed | brainstormed w/ maintainer  | excludes [0078](../plans/0078-workflow-dialect.md); ER candidate parked by [0096](../plans/0096-dogfood-missing-crossvalidate-bindings.md)                                                        |
| [004 — corpus-content `explain` equivalent](./004-corpus-content-explain.md)    | Low      | 🔵 Reviewed | Docs-only      | inbound · consuming project | CLI question sequenced after [0089](../plans/0089-family-standalone-sufficiency.md)                                                                                                               |

**What each one asked for.** 001 — `terms()`/`vocabulary()` plus coverage over
the md corpus. 002 — resolve doc citations embedded in source-code comments.
003 — a catalog of eight candidate future dialects. 004 — a corpus-listing
primitive for md/gherkin.

**Read of the board (2026-08-13).** **No proposal here has spawned a plan.** Every
one filed so far was declined or returned as specified, and in three of four cases
the survey alone was decisive — an argument about the _template_, not about the
submitters: the survey belongs before the design, not after it. 001 is the only
one whose remaining blocker is a set of decisions reserved for the author rather
than a defect in the submission.

The relationships that do exist run the other way, and are worth reading before
picking any of these up:

- **001 rests on shipped work rather than producing it.** `terms()`/`vocabulary()`
  landed in [0069](../plans/completed/0069-spec-corpus-reach.md) Phase 4, and the
  proposal's design was rewritten _against_ that primitive after the fact. Two live
  plans then name it explicitly **out of scope** — [0089](../plans/0089-family-standalone-sufficiency.md)
  and [0101](../plans/0101-sibling-gates-go-fail-closed.md) both fence off "md
  adopting `terms()`/`vocabulary()`" so their own floors stay closable.
- **002 is the only two-way binding.** The proposal defers its widened primitive
  behind [0090](../plans/0090-adopt-ts-archunit-work-corpus.md), and 0090 cites the
  proposal back. That is the shape a live deferral should have: neither end can be
  closed while forgetting the other.
- **003 and 004 cite plans for context only** — to avoid duplicating 0078, to note
  that 0096 already parks the ER binding for want of an `erDiagram` in this repo,
  and to flag that 004's CLI question is downstream of 0089's Phase 2 wording.

## Known gaps in this lane

Recorded rather than left to be rediscovered:

- **No terminal folder.** Plans move to `completed/`/`wont-do/` and bugs to
  `fixed/`/`rejected/`. Proposals have no such convention — a declined proposal
  (002) sits in place with its ruling in its header. That works while the lane is
  small; it means the board is the only thing distinguishing live from settled.
- **`check:ledger` does not read this lane** — bug
  [0121](../bugs/0121-ledger-reads-two-of-four-lanes.md). Proposals carry a
  `State:` and nothing opens them, so a proposal cannot be held honest at close
  the way a plan or a bug is.
- **The `work/` README lanes table lists one lane** — bug
  [0108](../bugs/0108-work-readme-lanes-table-lists-one-lane.md). This board does
  not fix that; it gives the lane something to point at.

`check:corpus` does gate this file: its cross-links must resolve and any
`path:line` pointer must ground in real code.

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
