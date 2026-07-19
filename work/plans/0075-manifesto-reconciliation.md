# Plan 0075: Manifesto reconciliation

## Status

- **State:** Draft — waiting on adopter feedback. The 2026-07-19 honesty pass
  labelled each architecture layer shipped/partial/vision and added the
  staleness and constraints-not-a-map stances; that bought time, not a
  resolution. A deep restructure written without a real adopter's reading is
  guesswork about which half of the document is load-bearing.
- **Priority:** P3 — the document is currently _honest_, which is the property
  that mattered most; restructuring is improvement, not repair.
- **Effort:** ~1 session.
- **Created:** 2026-07-19

## Problem

`docs/manifesto.md` is three documents wearing one cover:

1. a **defensible thesis** (specs must be executable, or they drift);
2. **shipped doctrine** — the tier model, the ADR Enforcement convention, the
   drift-fails-the-build gates, all of which exist and run in CI;
3. a **horizon** — Tiers 2–5 as described capability, where eess today only
   resolves a cited test.

A reader cannot tell which is which without knowing the codebase. The 2026-07-19
pass added labels to the architecture layers, but the document's _structure_
still interleaves the three, so the labels do work the outline should be doing.

There is a second, subtler problem: the manifesto is treated as binding — CLAUDE.md
names it the design specification alongside the ADRs — yet unlike every ADR it
carries no `## Enforcement` table and has never been ratified. A binding document
that no mechanism touches is exactly the drift eess exists to catch.

## Approach (sketch — a Draft, not a frozen floor)

**Phase 1 — separate the three voices structurally.** Thesis first and short;
shipped doctrine second, each claim citing the gate that enforces it; horizon
last and explicitly labelled as such. Labels stop carrying structural load.

**Phase 2 — bind it.** Give the manifesto the same treatment every ADR gets: an
Enforcement table over its enforceable clauses, so `check:corpus`'s ADR gate (or
a sibling) can hold it. Clauses that are genuinely unenforceable get `manual` or
`n/a` — honestly, not by omission.

**Phase 3 — ratify.** A Tier-5 act: the document becomes a decision of record
with a date, not a living essay that quietly changes meaning.

## Out of scope

- Renaming eess, or reopening the acronym. Settled 2026-07-19: the name stays,
  the expansion is retired from every live surface, the manifesto's origin note
  stays as the one place that answers "what did it stand for?".
- Rewriting the walkthrough or the docs site — this is the manifesto only.

## Success definition

A newcomer reading top-to-bottom can state, unprompted, which capabilities exist
today and which are horizon — without cross-checking the code. And a future
change to a load-bearing manifesto claim fails a gate rather than passing
silently.

## Open questions (resolve before Ready)

- [ ] Which adopter feedback actually gates this? Name the signal, or drop the
      dependency and schedule it.
- [ ] Can the existing `adrEnforcement` preset hold a non-ADR document, or does
      binding the manifesto need its own rule?
- [ ] Does ratification mean an ADR _about_ the manifesto, or a state token in
      the manifesto itself?
