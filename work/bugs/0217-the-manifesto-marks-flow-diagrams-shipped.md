# Bug 0217: the manifesto marks a Mermaid capability `shipped` that no grammar parses

## Status

- **State:** Draft — measured, and the finding nearly evaporated: it was established by
  proposal 006's review and then omitted from all six records that review produced.
- **Deferred:** none
- **Found:** 2026-08-22, review of proposal 006. Filed only after three reviewers each
  named its absence — which is the reason it is worth saying out loud that a finding whose
  fix raises the finder's own workload is the one that goes unfiled.

## Symptom

`docs/manifesto.md:168-170` defines the status vocabulary:

> **shipped** (exists, runs in CI today) · **partial** (a real subset exists) · **vision**
> (decided direction, nothing built)

`docs/manifesto.md:223` reads `## Mermaid Semantic Schemas — shipped`, and its only worked
example is a flow diagram:

```
graph TD
    Route --> Service
    Service --> Repository
```

followed by three claimed enforcements — "Route may only connect to Service", "Repository
owns persistence access", "Domain cannot depend on infrastructure".

**eess models neither the kind nor the assertions.** There are two grammars,
`packages/mermaid/src/parser/grammar/class-diagram.langium` and `er-diagram.langium`.
`graph` is denylisted by name in `FOREIGN_HEADER` (`packages/crossvalidate/src/md-mermaid.ts:34`),
and the three claimed rules exist for no Mermaid kind eess parses.

The neighbouring section is scrupulous about exactly this distinction — `## Schema Layer —
partial` enumerates "the Mermaid class/er grammars" as what exists — which is what makes
the un-hedged `shipped` on this one stand out rather than read as boilerplate.

## Why it matters more here than elsewhere

CLAUDE.md names `docs/manifesto.md` as the design specification. This repo's whole thesis
is that a green which examined nothing is a lie; a spec that marks a capability `shipped`
when nothing runs is the same defect one level up, in the document that defines the
vocabulary it violates.

It also has a measurable consequence already: proposal 006 set its Priority to Medium on
the reasoning that "nothing here is currently over-claimed". That rationale is false, and
it propagated into plan 0212's priority before review caught it.

## Fix

One of two, and the choice is the author's:

1. **Correct the status marker.** `partial` or `vision` for that section, and either drop
   the `graph TD` example or mark it as illustrative of the direction rather than of a
   shipped capability.
2. **Ship what it claims** — which is [proposal 006](../proposals/006-mermaid-beyond-classdiagram.md)'s
   Ask B for `flowchart`/`graph`, currently **Held** pending a measurement and an open
   question. If that is the route, the manifesto is accurate-in-advance rather than wrong,
   and it should say so with `vision`.

Option 1 is a sentence. Option 2 is a programme. They are not equally available, and the
record should not pretend otherwise.

## Verification

- [ ] Every `shipped` section in `docs/manifesto.md` names a mechanism that runs in CI, or
      is re-marked. This bug is one instance; the sweep is what closes it honestly.
- [ ] Proposal 006's Priority rationale is annotated in place (`PROPOSALS.md`'s
      "Corrections stay in the record"), and plan 0212's derived rationale re-stated.
- [ ] Consider whether the manifesto's status tokens are checkable at all. A `shipped`
      section whose worked example is a mermaid fence must name a kind the parser models —
      that narrow case _is_ Tier-1 checkable, and would have caught this one.

## Out of scope

- **A general "does this section's claim run in CI" gate**, and the manifesto-wide sweep of
  every `shipped` marker. That is Tier 4 for most sections, not worth faking, and the sweep
  is [plan 0075](../plans/0075-manifesto-reconciliation.md)'s job — an earlier draft of this
  record claimed it as a verification box, which would have made this bug unclosable. This
  record owns **one marker** and the question of whether any mechanism is possible.
- Ask B itself — [proposal 006](../proposals/006-mermaid-beyond-classdiagram.md).
