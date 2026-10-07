# Plan 0406: md — a declared link is answered

## Status

- **State:** Ready — frozen 2026-10-07. Written the same day from proposal 013's decisions 1, 3, 4, 7, 9 and 10, at the
  maintainer's instruction to plan the proposal's implementation, and frozen at the maintainer's
  request. Every decision the build depends on is restated in this plan; the proposal is linked
  as provenance only.
- **Priority:** Medium — no shipped rule checks this property. A consuming project checks it with a
  hand-written condition whose skips sit outside ADR-010's evidence guarantee.
- **Effort:** Medium — one condition, its findings per cause, and a dogfood rule over this
  repository's ADRs with a production non-vacuity row.
- **Created:** 2026-10-07
- **Builds:** [proposal 013](../proposals/013-md-a-declared-relation-is-reciprocated.md)'s Ask B; its
  disposition row names this plan. No `**Implements:**` line, for the reason plan 0404 gives.
- **Depends on:** [plan 0404](./0404-md-one-link-resolver-names-each-case.md) (`resolveLink`) and
  [plan 0405](./0405-md-select-the-links-a-block-declares.md) (`areLabelled`, `areInSection`).

## Problem

When a record declares a relation to another record, by a label or a section, nothing checks that
the other record answers. A consuming project wrote that check as a custom condition. As proposal
013 measured, the obvious composition with released parts, `correspondence().beComplete()`, both
gives a false red (a target that links back twice is "ambiguous") and passes green when the label is
misspelt (bug 0400).

## Design (decided in proposal 013)

A condition on `LinkRuleBuilder`:

```ts
links(c)
  .that()
  .areLabelled('Related to')
  .should()
  .beLinkedBack()
  .rule({ id: 'corpus/related-links-back', because: '…', suggestion: '…' })
```

- **The answer is any link back** from the target to the source (decision 1). Several links back
  are one answer. The documentation names the blind spot: an incidental mention counts.
- **The check is set membership, not a join.** On first evaluate the condition builds, from every
  internal link in the corpus resolved with `resolveLink`, an index from each document to the
  documents that link to it. Each selected link is then looked up. `examined` is the selected links
  (ADR-010 §1), so a selection that is empty fails with the zero-examined finding, and bug 0400
  does not apply.
- **Not cardinality-exempt.** The condition is not marked through `marksAssertsCardinality`; a test
  pins that it stays outside `CARDINALITY_ASSERTERS`.
- **Frozen targets are left out of the selection** (decision 3). `beLinkedBack()` adds a
  selection-side filter for links whose target is a frozen document, so they are not examined, and
  an all-frozen selection examines zero and fails. "Frozen" is the adopter's `frozen` corpus option.
- **How the exemption is disclosed.** The filter's description is part of the rule's description
  ("whose target is not frozen"), so `explain` and every finding name it. **It is not counted:**
  the kernel's `CollectResult` (`packages/core/src/collect-result.ts`) has no field for links a
  selection left out, and adding one is a kernel change outside this plan. Proposal 013's decision
  3 asked for a count; that part is `deferred→` [bug 0174](../bugs/0174-eess-ts-reports-a-clean-gate-with-no-denominator.md),
  which owns how a gate reports what it examined, and a note is added there.
- **One finding per cause, on the source line, naming the target** (decisions 4 and 7):

| `resolveLink` case       | finding                                                 | remedy named in the finding                                           |
| ------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------- |
| `document`, no link back | `a.md` declares `b.md`, and `b.md` does not link back   | add a link to `a.md` in `b.md`, or remove `b.md` from the declaration |
| `outside-corpus`         | `b.md` is outside the corpus, so its links are not read | add its folder to the corpus `roots`, or correct the link             |
| `missing`                | `b.md` does not exist                                   | the same remedy `linkResolves` names, so one fix clears both          |
| `directory`              | the link names a directory                              | link the record's file                                                |
| `self`                   | the link points at this record                          | remove it; a record does not relate to itself                         |

Each remedy is verified to remediate (ADR-009 rule 2): a test applies it and shows the finding
clears.

## Phases

### Phase 1 — the condition

**Files:** `packages/md/src/conditions/linked-back.ts` (new), `packages/md/src/builders/links.ts`
(`beLinkedBack()`), `docs/markdown.md`, `.changeset/` (eess-md minor, additive).

### Phase 2 — dogfood it on this repository's ADRs (decision 9)

- ADR-014 and ADR-016 gain an `**Extends:**` line of their own, holding only the ADRs they extend
  (ADR-014 → ADR-010; ADR-016 → ADR-009, ADR-010). Their Status prose already states these
  relations; the line restates them and changes no decision. ADR-018 stays out until it is ruled.
- ADR-009 and ADR-010 gain, at the end of the file, links back to the ADRs that extend them, so no
  live `path:line` pointer into them shifts.
- `scripts/check-corpus.mjs` runs `links(c).that().areLabelled('Extends').should().beLinkedBack()`
  over `adr/`, with no `.expectEmpty()`, so removing every label is red under ADR-010 §3.

**Files:** `adr/009-agent-first-failure-surfaces.md`, `adr/010-a-pass-is-constructed-from-evidence.md`,
`adr/014-the-emitter-refuses-a-verdict-without-evidence.md`,
`adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md`, `scripts/check-corpus.mjs`.

### Phase 3 — non-vacuity at both tiers (decision 10)

- **Production row:** `check:nonvacuity` plants a probe ADR under `adr/` that declares
  `**Extends:**` an ADR which does not link back, runs the production `scripts/check-corpus.mjs`, and
  requires the rule id to fire. The plan names the other gates that see the probe: `adrEnforcement`
  and `check:spec`'s ADR index, so the probe carries a valid Enforcement table and is excluded from
  the index check, and `scripts/check-workspace-integrity.mjs` learns the probe path (bug 0231).
- **Fixture rows,** over `scripts/nonvacuity/linked-back/`: one per cause in the table above, an
  all-frozen selection, a misspelt label (near-miss, from plan 0405), and a control that stays
  green, including a target that links back twice.

**Files:** `scripts/check-nonvacuity.mjs`, `scripts/nonvacuity/linked-back/**` (new),
`scripts/check-workspace-integrity.mjs`.

## Test inventory

- each row of the finding table, with its remedy applied and the finding cleared;
- several links back, one with a fragment: green;
- a back-link only inside a code fence or an HTML comment: red;
- an all-frozen selection: red with the zero-examined finding;
- a selection with frozen and live targets: the frozen ones left out, the live ones checked, and the
  rule's description naming the exemption;
- `beLinkedBack()` not in `CARDINALITY_ASSERTERS`;
- an empty selection: red, not green.

**Sabotage rows** (ADR-009 rule 5; published API, so rule 6's deepest level, with adversarial
review before merge):

- the membership lookup always true: the one-way row goes red;
- the frozen filter moved into the condition (counted as examined): the all-frozen row goes red;
- the condition marked cardinality-exempt: the empty-selection row goes red;
- each finding's cause swapped with another's: its row goes red;
- the production rule given `.expectEmpty()`: the production non-vacuity row goes red when every
  label is removed.

**Vacuity matrix:** it probes constructors over empty input and so reaches `links()`, not this
condition. Covering eess-md there is bug 0403's fix, and this plan does not wait for it.

## Out of scope

- A stricter answer (a link back under the same label, or a counterpart such as "Superseded by"):
  added as a separately named predicate when someone needs it (proposal 013, decision 1; ADR-017
  rule 7 by analogy).
- ADR-018's relation, until ADR-018 is ruled.
- Counting the frozen exemption: `deferred→` bug 0174 (see Design).
- A kernel "at least one counterpart" option for `correspondence()` (proposal 013, decision 6).

## Success

- A one-way declared relation fails the build with a finding that names its cause and a remedy that
  clears it.
- This repository's `check:corpus` runs the rule over the ADRs' Extends relation, and
  `check:nonvacuity` proves the production run fires it.
- `npm run validate` green.

## Progress ledger

- [ ] Phase 1 — `beLinkedBack()`, its findings per cause, docs
- [ ] Phase 2 — ADR `**Extends:**` lines and links back; the rule in `check:corpus`
- [ ] Phase 3 — the production non-vacuity row and the fixture rows
- [ ] each remedy verified to remediate
- [ ] the five sabotage rows go red; adversarial review before merge
- [ ] proposal 013's disposition row for Ask B names this plan; 013 is closed once its three asks
      have shipped
- [ ] `npm run validate` green
