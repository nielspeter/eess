# Plan 0218: require a proposal to state its acceptance criteria

## Status

- **State:** Done — built and closed 2026-08-23. Two rules, both plain corpus predicates.
  `Deferred: none`.
- **Priority:** Medium — `PROPOSALS.md` requires the section and nothing checked it.
- **Effort:** Small — two rules in `scripts/check-corpus.mjs`, two fixtures, and one
  proposal gained the section it owed. No package change, no changeset, **no git**.
- **Created:** 2026-08-23 · Split out of
  [plan 0216](./0216-dogfood-the-proposals-lane.md).

## Problem

`PROPOSALS.md`'s template requires, per capability, the **break class** — the specific
corruption that must produce a violation — and how non-vacuity is kept. Proposal 006 shipped
without the section entirely, and its own review recorded that as a defect it committed.
Nothing checked it.

Separately: a `Docs-only` ruling names a remedy and creates **no owner**. Proposal 004 was
ruled `Docs-only` on 2026-08-13; ten days later none of the documentation existed, with every
gate green and the proposal's header reading as settled.

## The two rules

**1. A live proposal states its acceptance criteria.** A level-2 `## Acceptance criteria`
heading, read from `MdSection.depth` directly rather than through `haveSection`, which
matches on name alone — proposal 005 carries four `### Acceptance criteria (…)` headings
inside superseded appendices, and only the parenthetical saves a name-only rule from them.

Two exclusions, both principled:

- **terminal records** (`promoted/`, `rejected/`) are closed history, and re-litigating their
  content means rewriting the archive;
- **`Rewrite needed` / `Reject`** — the same set promotion already refuses. The review has
  already found the document deficient; demanding a section from a document the review
  rejected adds nothing, because **the ruling is the finding**. Proposal 003 is exactly this:
  its review says no entry states a break class, which _is_ this gap, and the rewrite is
  where it gets fixed.

**No exclusions, and the debt was paid rather than protected.** An earlier version of this
rule exempted terminal records and those ruled `Rewrite needed`/`Reject`, on arguments that
were reasonable in isolation: closed history should not be rewritten, and a document the
review already found deficient should not be re-audited for content it does not yet have.
Measured with the exemptions removed, they were shielding **three real records** — 003, 004
and 005 — which is grandfathering under a better name. An earlier draft of this plan then
claimed "nothing was grandfathered", which was simply false.

All six proposals now state their criteria, and what each needed is worth recording because
none of it was busywork:

- **005** had stated them **four times** — once per rewrite — always as
  `### Acceptance criteria (…)` nested inside the rewrite that owned them. The convention was
  met in substance and not in shape. The operative set is restated at level 2; the appendices
  stay as the record of what each round said.
- **004** was ruled `Docs-only`, so its one capability _is_ the documentation — and stating a
  break class for it is exactly what would have stopped the remedy evaporating, which it did
  for ten days ([bug 0219](../../bugs/fixed/0219-corpus-listing-surface-is-undocumented.md)).
  Its section also names the half that is **not** mechanised, since a `Docs-only` ruling
  invites that mistake.
- **003** is a catalog, so its capability is the bar an entry must clear before becoming a
  proposal of its own. Its review ruled `Rewrite needed` precisely because no entry stated
  one; the section sets the bar and the ruling stands.

**A guard died with the exclusions, and that is the right outcome.** The rule carried an
ADR-010 zero-guard — "0 subjects while proposals exist". With the exclusions gone
`criteriaSubjects` _is_ `liveDocs.filter(isProposalDoc)`, so that condition is unreachable by
construction. A guard that cannot fire is worth less than no guard, so it and its fixture
were deleted rather than left as decoration. The denominator carries the evidence instead:
the summary prints `6 criteria-checked`, and a zero there means a broken selector.

**2. A `Docs-only` ruling names an owner** that declares `**Implements:** proposal NNN` —
a plan **or a bug**, since 004's owner is bug 0219.

## What this deliberately is not

An earlier version of this plan gated the **diff**: only proposals a change _added_ had to
comply, so the existing six were untouched. That dragged in a base-ref module, three diff
arms, rename-versus-add semantics, throwaway-worktree fixtures and a coverage audit for the
coverage — and two review rounds found real bugs in all of it, including a fail-open on
renames, a fixture that passed with the fix deleted, and a cleanup step that deleted tracked
files.

**The machinery existed only to avoid redding the build on records that already existed.**
Applied honestly, the rule reds on exactly one — 006 — and 006 owed the section. The simple
version is ~40 lines with no git at all, and it is what shipped. Recorded because the wrong
turn was reasonable at every individual step and only obvious in aggregate.

## One classification, not three subsets

The first version of these rules hand-listed `['Rewrite needed', 'Reject']` and
`['Docs-only']` inline — beside an `ACCEPTED_RULINGS` in `scripts/lib/proposal-ruling.mjs`
whose own comment says _"it is the one place the policy is decided"_, and an
`UNPROMOTABLE_RULINGS` elsewhere in the same file. **Three hand-written subsets of one
closed six-value vocabulary, in two files, none bound to it.** A seventh verdict would have
fallen through all three and acquired no obligation at all, silently.

Replaced by `RULING_OBLIGATION`: one exhaustive map from each ruling to what it obliges
(`needs-a-plan` · `needs-an-owner` · `unfinished` · `none`), asserted in both directions at
load. Every subset is now derived from it. Verified: adding a seventh ruling without an
obligation throws before any gate runs.

Two smaller ones went the same way. The lane's terminal folders were typed out in both
`check-ledger.mjs`'s lane config and this gate's "is this closed history" test; they now come
from `PROPOSAL_DONE_FOLDERS`. And `DOCS_ONLY_RULINGS` was a `Set` with one member —
generality it did not have.

**The rules no longer know the test harness exists.** They used to filter
`!isProbeArtifact(d)`, which is scaffolding leaking into production selection. The probes
that plant proposals now carry an `## Acceptance criteria` section — they are supposed to
model honest proposals — so the filter was deleted rather than tidied.

## The one thing kept from the reverted design

`check:nonvacuity` now derives its own rule-id coverage instead of asserting it. Emitted
ids are read from `check-corpus.mjs`'s **source**; asserted ids from the **run**, via
`firedOn`. Different places on purpose — an audit whose two halves come from one place
proves nothing.

This exists because the claim it replaces was wrong twice. "N of N rule ids fixtured" was
checked by hand with a regex that missed a whole call form, then with one that missed
`[a-z0-9-]` — so `corpus/unfixtured-0218` was invisible to it, in a repo that names things 0218. The extractor therefore carries its own denominator: it counts literal `ruleId:`
assignments independently and refuses to pass when it parsed fewer than it found.

`gateCoverage()` asserts per-_script_; this asserts per-_rule_. The gap between them is how
three rule ids once shipped behind one fixture. Verified by planting an unfixtured
digit-bearing id: it reds.

## Files Changed

- `scripts/check-corpus.mjs` — two rules and a zero-guard on the first rule's subjects
- `scripts/check-nonvacuity.mjs` — a fixture per rule id
- `work/proposals/006-mermaid-beyond-classdiagram.md` — the section it owed
- `work/proposals/PROPOSALS.md` — the two closed gaps, and what the gates now check

## Verification

- [x] Rule 1 red first: **006 was the only violation** on first run, which is the record its
      own review names. Writing the section clears it; no other proposal moved.
- [x] Rule 2 reds: stripping bug 0219's `**Implements:** proposal 004` leaves 004's
      `Docs-only` ruling ownerless and fires `docs-only-ruling-names-no-owner`.
- [x] Both exclusions verified against the corpus rather than reasoned about: 003 is exempt
      by ruling, 004 and 005 by folder, and the summary prints how many were checked.
- [x] Zero-examined is a finding, not a pass — the exclusions are broad enough to reach an
      empty subject set, so `corpus/proposal-criteria-examined-nothing` guards it.
- [x] A fixture per rule id; `npm run validate` exit 0.

## Out of Scope

- **`Split and sequence` creates no obligation either**, by the same argument that motivates
  rule 2. It is prose today (`split before planning`), and a rule keying on prose is the
  false-positive machine bug 0110 warns about. Left open deliberately, and named in
  `PROPOSALS.md`'s _Known gaps_ rather than folded in here.
- **Whether the section's _contents_ hold up.** Rule 1 proves a heading exists; an empty
  section satisfies it, and its `because` says so outright. Reading what is under the heading
  is Tier 4 and belongs to review.
