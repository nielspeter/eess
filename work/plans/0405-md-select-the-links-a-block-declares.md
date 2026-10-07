# Plan 0405: md — select the links a block declares

## Status

- **State:** Ready — frozen 2026-10-07. Written the same day from proposal 013's decision 2, at the
  maintainer's instruction to plan the proposal's implementation, and frozen at the maintainer's
  request. Every decision the build depends on is restated in this plan; the proposal is linked
  as provenance only.
- **Priority:** Medium — the selector proposal 013's B is built on. Selecting by physical line, the
  measured workaround, fails open on a wrapped label and on a label followed by a list.
- **Effort:** Medium — the link walk gains block ownership and a section path; two predicates and
  one near-miss finding.
- **Created:** 2026-10-07
- **Builds:** [proposal 013](../proposals/013-md-a-declared-relation-is-reciprocated.md)'s Ask A; its
  disposition row names this plan. No `**Implements:**` line, for the reason plan 0404 gives.
- **Second of three:** after [plan 0404](./0404-md-one-link-resolver-names-each-case.md), before
  [plan 0406](./0406-md-a-declared-link-is-answered.md).

## Problem

An author declares a relation in Markdown in one of two ways: a labelled block
(`**Related to:** [a](a.md) · [b](b.md)`, or the label followed by a list) or a section
(`## See also`). eess-md cannot select the links such a block owns. The workaround, a predicate that
tests whether a link's physical line starts with the label, misses:

- the second line of a wrapped label (its links have a later line and are not selected, while
  `examined` stays above zero because the first line's links are);
- a label followed by a bullet list.

`collectLinks` (`packages/md/src/model/links.ts`) walks the tree with no block context, so the
information the selector needs is not recorded today.

## Design (decided in proposal 013, decision 2)

- **Block ownership.** While walking, each link records the block that owns it: the nearest
  enclosing paragraph or list item. A paragraph that consists of a label alone owns the list that
  immediately follows it.
- **The label grammar is the ledger's,** lifted from `packages/md/src/rules/ledger.ts` (`LABEL`)
  into `packages/md/src/model/label.ts` and used by both. It accepts `**Label:**`, `**Label**:`,
  `__Label__:` and `Label:`, optionally after a list marker, and **requires the colon** (the ledger
  records why: without it, "Stateless rendering …" read as a declaration).
- **Section path.** Each link records the headings above it, so a section form matches by heading,
  with the same matching `haveSection()` uses (`matchName` in `packages/md/src/model/query.ts`): a
  string or a `RegExp`.
- **Two predicates on `LinkRuleBuilder`,** both reading the recorded block:

```ts
links(c).that().areLabelled('Related to') // links owned by a block whose leading label is "Related to"
links(c).that().areInSection('See also') // links under a heading "See also"
```

- **A near-miss is a finding of its own.** A block whose leading label, with its colon, matches the
  declared one except for case or inner spacing (`**Related To:**`), or a heading that does the same
  for the section form, is reported on that block's line, naming the expected spelling. A near-miss
  is defined for a string declaration only; a `RegExp` declaration states its own tolerance. Prose such
  as "Related to bug 0253, the …" has no colon after the label and is never a near-miss. The
  finding is produced by the predicate's rule, not by a second rule, so it cannot be configured
  away separately.
- **A declaration that selects nothing in the whole corpus fails** under ADR-010 §3, through the
  existing zero-examined finding. Nothing new is needed for that, and a test proves it.

## Phases

### Phase 1 — record the block and the section on every link

`MdLinkRef` gains `block: { line: number; label?: string }` and `sectionPath: readonly string[]`.
`collectLinks` tracks the enclosing paragraph or list item and the heading stack.

**Files:** `packages/md/src/model/links.ts`, `packages/md/src/model/label.ts` (new),
`packages/md/src/rules/ledger.ts` (uses the shared grammar).

### Phase 2 — the predicates and the near-miss finding

**Files:** `packages/md/src/builders/links.ts`, `packages/md/src/predicates/` (new
`declared-block.ts`), `docs/markdown.md`, `.changeset/` (eess-md minor, additive).

## Test inventory

- **Label forms:** each of the four ledger forms selects; a label without its colon does not.
- **Block ownership:** a wrapped label's second-line link is selected; a label followed by a list
  selects the list's links; a link in the next, unrelated paragraph is not selected.
- **Section form:** links under `## See also` are selected; links under the next heading are not.
- **Near-miss:** `**Related To:**` and `**Related  to:**` each produce the finding with the expected
  spelling; "Related to bug 0253, the …" produces nothing.
- **Zero selected:** a corpus where the label never appears is red with the zero-examined finding.
- **Ledger unchanged:** the ledger's existing tests pass on the shared grammar.

**Break classes and sabotage rows** (ADR-009 rule 5):

- block ownership reverted to physical lines: the wrapped-label row goes red;
- the colon made optional: the "Related to bug 0253" row goes red;
- the near-miss finding removed: its row goes red.

**Non-vacuity:** the predicates are exercised by plan 0406's production rule and its
`check:nonvacuity` rows; this plan adds no gate of its own.

## Out of scope

- Front matter: eess-md has no front-matter model (proposal 013, open question 1).
- Reference-style links.
- The answer check itself: plan 0406.

## Success

- `areLabelled` and `areInSection` select exactly the links a block declares, in both of the
  workaround's failure shapes.
- A near-miss in one record is reported.
- The ledger and the new predicates share one label grammar.
- `npm run validate` green.

## Progress ledger

- [ ] Phase 1 — block and section recorded on every link; the label grammar shared with the ledger
- [ ] Phase 2 — `areLabelled`, `areInSection`, the near-miss finding, docs
- [ ] the three sabotage rows go red
- [ ] proposal 013's disposition row for Ask A names this plan
- [ ] `npm run validate` green
