# Plan 0405: md — select the links a block declares

## Status

- **State:** Ready — frozen 2026-10-07, at the maintainer's request (plan-ready). written 2026-10-07 from proposal 013's decision 2, after the maintainer asked
  for plans to implement the proposal. A first freeze the same day was withdrawn after review found
  the near-miss mechanism undecided (a predicate cannot emit a finding); this version decides it.
  Re-frozen
  after a second architect, enforcement and testing review settled every remaining mechanism; each
  decision the build depends on is restated here, and proposal 013 is linked as provenance only.
- **Priority:** Medium — the selector plan 0406 is built on. Selecting by physical line, the
  measured workaround, fails open on a wrapped label and on a label followed by a list.
- **Effort:** Medium — the link walk gains block ownership and a section path; two predicates; a
  near-miss scan in the builder.
- **Created:** 2026-10-07
- **Builds:** [proposal 013](../proposals/013-md-a-declared-relation-is-reciprocated.md)'s Ask A; its
  disposition row names this plan.
- **Second of three:** after [plan 0404](./0404-md-one-link-resolver-names-each-case.md), before
  [plan 0406](./0406-md-a-declared-link-is-answered.md).

## Problem

An author declares a relation in Markdown with a labelled block (`**Related to:** [a](a.md) ·
[b](b.md)`, or the label followed by a list) or a section (`## See also`). eess-md cannot select the
links such a block owns. The line-based workaround misses the second line of a wrapped label (while
`examined` stays above zero) and a label followed by a list. `collectLinks`
(`packages/md/src/model/links.ts`) walks with no block context.

## Design

- **Block ownership.** A link's block is its enclosing list item if it has one, otherwise its
  enclosing paragraph; a loose list item with two paragraphs is one block. A paragraph consisting of
  a label alone owns the list that immediately follows it, including nested sub-lists, and a
  labelled list item owns its nested sub-list; in both cases the recorded block is the **owner**
  (the label's paragraph or item), since the label is read from the owner's first line. A list
  separated from the label by another paragraph is not owned. A link with no enclosing paragraph or
  list item (a heading, a table cell) has no block.
- **The label is read from the block's first source line,** through the block's position offsets,
  so the Markdown wrapper (`**`) is still visible.
- **One label grammar, case handled by each caller.** The ledger's `LABEL`
  (`packages/md/src/rules/ledger.ts`) is lifted into `packages/md/src/model/label.ts` as a function
  of the label text. It accepts `**Label:**`, `**Label**:`, `__Label__:` and `Label:`, optionally
  after a list marker, and **requires the colon** (the ledger records why). The ledger keeps compiling
  it case-insensitively, so its behaviour is unchanged; `areLabelled` matches it **case-sensitively**.
  This corrects proposal 013's decision 2, which said the bold wrapper is required: the shared
  grammar accepts the plain `Label:` form the ledger already accepts.
- **Section path** reuses the heading stack `buildDocument` already keeps for tables
  (`packages/md/src/model/document.ts`), and matches with `haveSection()`'s `matchName`
  (`packages/md/src/model/query.ts`): a string or a `RegExp`.
- **Two predicates on `LinkRuleBuilder`:**

```ts
links(c).that().areLabelled('Related to') // links owned by a block whose label is exactly "Related to"
links(c).that().areInSection('See also') // links under a heading "See also"
```

- **The near-miss finding comes from the builder, not the predicate.** A predicate cannot emit a
  finding, and a near-miss block's links are filtered out before any condition sees them. So
  `areLabelled` and `areInSection` record their declaration on the builder (a field re-cloned by
  `LinkRuleBuilder.copy()` after `super.copy()`), and `LinkRuleBuilder` overrides
  `collectViolations()`. No `RuleBuilder` subclass in the family overrides it today, so this is the
  first; the build's review checks the bug 0155 and zero-examined paths through it. The override
  calls `super.collectViolations()`, skips the scan when no declaration was recorded, and otherwise
  scans the corpus's documents (the corpus, not the rule's selection; documented) for:
  - **a near-miss, for the wrapped label forms only** (`**Label:**`, `**Label**:`, `__Label__:`): a
    label that matches the declaration case-insensitively or with different inner spacing, but not
    exactly; or a heading that does the same for a string section declaration (a `RegExp` states
    its own tolerance). The plain `Label:` form is selected when exact and is never a near-miss,
    because prose beginning "related to:" is common;
  - **a wrapped-label block that declares nothing readable:** one holding only reference-style
    links ("declares only reference-style links, which eess-md does not read"), or no link at all
    ("declares no record"), as two findings with two messages (ADR-016 rule 7).
    Each is a finding on that block's line, naming the expected spelling or the form. The result is
    `collectResult([...base, ...findings], { examined: base.examined, sourceEmpty: base.sourceEmpty,
deadGlob: base.deadGlob })`, keeping the base evidence unchanged, **not** `mergeCollectResults`,
    whose dead-member rule would turn an empty findings part into a false red on every clean run. The
    zero-examined finding is added later by the terminal whenever `examined` is zero, so a corpus where
    every declaration is misspelt reports the near-misses and that finding.
- **The `.select()` path carries no near-miss findings,** because a `Selection` holds elements, not
  findings, and the builder methods are the only way in: the predicate factories in
  `predicates/declared-block.ts` stay off the package root (as `areInternal` and `areLive` are), so
  they cannot be composed through `satisfy()`/`not()`/`or()` without the declaration. The
  documentation says the `.select()` path has no near-miss check.
- **`MdLinkRef` gains optional fields only** (`block?`, `sectionPath?`), and `resolveLink` takes
  plan 0404's narrower `LinkToResolve`, so the change stays additive.

## Phases

### Phase 1 — record block and section on every link; share the label grammar

**Files:** `packages/md/src/model/links.ts`, `packages/md/src/model/label.ts` (new),
`packages/md/src/model/document.ts` (expose the heading stack to the link walk),
`packages/md/src/rules/ledger.ts` (uses the shared grammar, case-insensitive).

### Phase 2 — the predicates, the declaration field, the `collectViolations()` override

**Files:** `packages/md/src/builders/links.ts`, `packages/md/src/predicates/declared-block.ts` (new),
`docs/markdown.md`, `.changeset/` (eess-md minor, additive).

### Phase 3 — non-vacuity rows for this plan's own findings

**Files:** `scripts/check-nonvacuity.mjs`, `scripts/nonvacuity/bad-declared-block/` and
`scripts/nonvacuity/bad-declared-block.mjs` (new, following the `bad-<name>` convention).

## Test inventory

Tests import from the package root, in `packages/md/tests/builders/declared-block.test.ts`, over
`packages/md/tests/fixtures/declared-block/`. Selected sets are compared by identity
(`relPath:line url`), never by count.

Every finding row runs through `links(c)…rule().check()`, never `.select()`.

- **A green control:** a corpus with correctly declared blocks and no near-miss reports nothing.
- **Label forms:** each of the four forms is selected; `**Related To:**` and `**Related  to:**` are
  not selected and are near-misses; plain `related to: [x](x.md)` is neither selected nor a
  near-miss, and plain `Related to: [x](x.md)` is selected; a paragraph
  `Related to bug 0253, see [x](x.md)` (no colon) is neither selected nor a near-miss.
- **Block ownership:** a wrapped label's second-line link is selected; a label followed by a list
  selects the list and its nested sub-list; a labelled list item selects its nested sub-list; a list
  after an intervening paragraph is not selected; `**Related to:** [a](a.md)` followed by a list
  selects `a` and not the list; a loose list item with two paragraphs is one block.
- **Section form:** links under `## See also` and its `### sub` heading are selected; a following
  `##` heading, or a shallower `#` heading, ends it; a `RegExp` declaration selects and produces no
  near-miss; `## See Also` and `## See  also` are near-misses for the string declaration.
- **Unreadable declaration:** a wrapped-label block holding only `[a][ref]`, and one holding no link,
  are two findings with their two messages; a plain-form `Related to:` paragraph with no link is
  nothing.
- **Every declaration misspelt:** the near-miss findings and the zero-examined finding are both
  reported.
- **Ledger unchanged:** the ledger's existing tests pass on the shared grammar.

**Sabotage rows** (ADR-009 rule 5), run in an isolated `git worktree` with its own `node_modules`,
from a green baseline, each verdict read from the exit code:

- ownership by physical line: the wrapped-label row goes red;
- the label paragraph no longer owning the following list: the list row goes red;
- the colon made optional: the "Related to bug 0253" selection row goes red;
- the near-miss scan removed from the override: the `**Related To:**` row goes red;
- the section near-miss removed: the `## See Also` row goes red;
- the section stack not reset at a following heading: the "a following `##` heading ends it" row
  goes red;
- `areLabelled` compiled case-insensitively (the ledger's flag): the `**Related To:**` selection row
  goes red;
- the override setting `examined` to its own count: the every-misspelt row goes red (the
  zero-examined finding disappears);
- the override merging through `mergeCollectResults`: the green control goes red.

**Non-vacuity** (`check:nonvacuity`, one tier weaker than a production gate): one row per finding
kind (label near-miss, section near-miss, unreadable declaration), each asserting the finding on
the fixture's file and its message, not only the rule id.

## Out of scope

- Front matter: eess-md has no front-matter model (proposal 013, open question 1).
- Reference-style links as selectable links; this plan only reports a declaration made of them.
- The answer check: plan 0406.

## Success

- `areLabelled` and `areInSection` select exactly what a block declares, in both of the
  workaround's failure shapes.
- A near-miss or unreadable declaration in one record is reported.
- The ledger and the predicates share one grammar, each with its own case rule.
- `npm run validate` green.

## Progress ledger

- [ ] Phase 1 — block and section on every link; the shared label grammar
- [ ] Phase 2 — `areLabelled`, `areInSection`, the override and its findings, docs
- [ ] Phase 3 — the non-vacuity rows
- [ ] the nine sabotage rows go red
- [x] proposal 013 records the plain-`Label:` correction in a dated note (done when this plan was
      written)
- [ ] `npm run validate` green
