# Plan 0405: md — select the links a block declares

## Status

- **State:** Done — built 2026-10-09 and reviewed in four rounds; the design and counts in force are
  the second round's design as amended by the third and final rounds (see "Final review round").
  Frozen Ready 2026-10-07 from proposal 013's decision 2; the freeze history is in the proposal's
  review.
- **Priority:** Medium — the selector plan 0406 is built on. Selecting by physical line, the
  measured workaround, fails open on a wrapped label and on a label followed by a list.
- **Effort:** Medium — the link walk gains block ownership and a section path; two predicates; a
  near-miss scan in the builder.
- **Created:** 2026-10-07
- **Builds:** [proposal 013](../../proposals/013-md-a-declared-relation-is-reciprocated.md)'s Ask A; its
  disposition row names this plan.
- **Second of three:** after [plan 0404](./0404-md-one-link-resolver-names-each-case.md), before
  [plan 0406](../0406-md-a-declared-link-is-answered.md).

## Problem

An author declares a relation in Markdown with a labelled block
(`**Related to:** [a](a.md) · [b](b.md)`, or the label followed by a list) or a section
(`## See also`). eess-md cannot select the
links such a block owns. The line-based workaround misses the second line of a wrapped label (while
`examined` stays above zero) and a label followed by a list. `collectLinks`
(`packages/md/src/model/links.ts`) walks with no block context.

## Design

> **Superseded in part by the second review round.** The frozen design below decides ownership while
> walking (an owner, a labelled list item owning its sub-list), reports reference-style links only
> for a block made of nothing else, and adds only `block?`/`sectionPath?` to `MdLinkRef`. As built,
> every block owns itself, each link carries `blockPath`, the nearest label decides at selection
> time, references are reported in any declaration, and `MdLink` also gains `blockPath`. The text
> below is kept as frozen.

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
- A `RegExp` argument to `areLabelled` (`areInSection` and `terms({ label })` take one): additive
  later, not needed by plan 0406 (product review, final round).

## Success

- `areLabelled` and `areInSection` select exactly what a block declares, in both of the
  workaround's failure shapes.
- A near-miss or unreadable declaration in one record is reported.
- The ledger and the predicates share one grammar, each with its own case rule.
- `npm run validate` green.

## Progress ledger

- [x] Phase 1 — block and section on every link; the shared label grammar
- [x] Phase 2 — `areLabelled`, `areInSection`, the override and its findings, docs
- [x] Phase 3 — the non-vacuity rows
- [x] the nine sabotage rows go red
- [x] proposal 013 records the plain-`Label:` correction in a dated note (done when this plan was
      written)
- [x] `npm run validate` green

## Build notes — 2026-10-09

> **Describes the first build (acaf41c) only** — its three non-vacuity rows and nine sabotage rows.
> The review rounds below replaced the ownership walk; their counts are the current ones.

- **The label grammar is shared, byte for byte.** `labelPattern('State')` produces the same regex
  source the ledger compiled before; its 61 rule tests pass unchanged.
- **The sabotage matrix, measured** (each from a green baseline, restored after, in the plan's
  worktree): ownership by physical line reds 4 tests, not the one the plan named — the wrapped
  label, the label-then-list, the labelled item's sub-list and the loose item each depend on it;
  the label paragraph not owning the list reds 1; the optional colon 1; the near-miss scan removed 2;
  the section near-miss removed 1; the section stack not reset 1; a case-insensitive `areLabelled`
  2; the override raising `examined` 1; `mergeCollectResults` 2 (the green control and the
  every-misspelt row).
- **The non-vacuity rows are fixture tier, and are claimed under `check:corpus` with that said.**
  No production rule declares a block until plan 0406's dogfood, so the three rows prove the builder
  `check:corpus` is written in, not a rule `check:corpus` runs. Each was sabotaged on its own (its
  finding removed from `declarationFindings`): only that row went to exit 0; the other two stayed 1.
- **The three findings share the rule's id**, so each row's token is a line the fixture prints only
  when its own message is on its own file — an id match would let any one answer for the others.

## Review round — 2026-10-09

> **Superseded in part by the second round below.** This round's ownership rule ("a block that opens
> with a label owns itself") and its rationale for removing the plain-form body restriction were
> wrong: they turned the defect around rather than closing it. Its sabotage counts were measured on
> code that has since been replaced; the second round's counts are the current ones.

Architect, product, enforcement, method and testing reviewed the build. Four measured, and product
read, the same **Critical**: block ownership used a looser grammar than selection. Its plain form
matched any line holding a colon, so a parent such as `Metadata:`, `- Note: x` or a URL took
ownership of a nested `**Related to:**` item. That item was then neither selected nor reported, and
the rule stayed green with `examined` above zero — the fail-open this plan exists to close. A label
after `1.`, `[ ]` or `>`, and one on a paragraph's second line, were silent the same way. Fixed in
this PR, since it is the plan's own capability:

- **One grammar.** `label.ts` builds every reader (`labelPattern`, `wrappedLabelOf`,
  `opensWithLabel`, `isLabelAlone`) from the same fragments; `labelPattern('State')` is still the
  ledger's old source, pinned by the rule tests. The walk reads a block's text from its content
  column, so list markers, task boxes and `>` never reach the grammar.
- **A block that opens with a label owns itself**; a parent never absorbs a label. With that, the
  plain form's looseness on a parent has no effect on selection, so the body restriction first
  written for it was removed rather than kept as a guard nothing can fail.
- **New findings:** a wrapped label inside a paragraph; reference-style links in any declaration,
  not only one made of nothing else; and the empty declaration now says when the label stands alone
  with no list under it, the actual cause, instead of sending the author to add an inline link
  (enforcement I2).
- **Smaller:** declarations deduped per rule; `collectResult(…, base)` passes the whole base
  evidence; the findings moved from `predicates/` to `builders/declaration-findings.ts`; links and
  tables share `inSection()`; `MdLinkBlock` is exported, since `MdLink.block` is public. The
  `copy()` override was deleted: declarations are replaced, never pushed, so it could not fail; a
  fork test pins the behaviour instead.
- **Tests added** for every measured shape, the plain-form empty label (the inventory row the build
  first missed — method I1), exact finding sets per fixture, a fork, a repeated declaration, and a
  rule with no condition (bug 0155: the missing-condition finding stays beside the declaration
  findings).

**Decisions taken, not deferred:**

- **The empty-declaration finding stays** (product I2 asked to drop it). A wrapped label with text and
  no link, `**Related to:** bug 0253`, is a declared relation that no link-based rule can check —
  the silent escape this plan is about. A template writing `**Related to:** none` gets the finding,
  and the docs say to leave the label out.
- **The names stay `areLabelled`/`areInSection`** (product I1, M5). In eess-md, "label" already names
  the `**X:**` line the ledger reads, and the docs define the term; `resideIn…` names where a
  document lives, not where a link sits under a heading.
- **`sectionPath` stays optional** (product M6): `MdLink` is also built by adopters' own tests and
  conditions, and a required field would break them.
- **Declaration findings can be sanctioned** with `.excluding()`, like any finding (enforcement M2) —
  measured, and documented.

**Sabotage, measured on the reworked code** (`declared-block.test.ts` plus the ledger's rule tests,
each mutation restored before the next): the nine new rows — a parent absorbing a label 1 red, the
task box kept 1, the content column ignored 1, the mid-paragraph scan removed 1, references only
when no inline link 1, the alone message folded 2, declarations not deduped 1, a lone label only at
top level 1, declarations pushed and shared across forks 1. The nine original rows, re-run because
the code under them moved: physical-line ownership 7, the lone label not owning its list 2, the
optional colon 7, the near-miss scan removed 6, the section near-miss removed 1, the section stack
not reset 1, case-insensitive `areLabelled` 4, the override raising `examined` 1,
`mergeCollectResults` 6.

**Non-vacuity:** six rows now, one per finding kind plus `nested-declaration`, the Critical's shape.
The three new ones were each sabotaged alone (the parent absorbing the label, the mid-paragraph scan
removed, the empty finding removed); only that row went to exit 0.

**Residual, recorded here and not fixed:**

- A reference to an undefined definition (`[a][missing]`) is plain text to mdast, so its block reads
  as naming no record — the remedy still points at the right fix.
- `declarationFindings` walks each document a second time (architect M4); a cost, not a defect.
- This is the family's first `collectViolations()` override outside the kernel. If plan 0406 or a
  second dialect needs another, a kernel hook is the shape to extract (architect M6).
- No non-vacuity row pins the selector itself against over-selection (enforcement M4), nor against
  under-selection (testing, final round): deferred→plan 0406, which now carries it as a dated
  Phase 3 item and a ledger box.

## Second review round — 2026-10-09

Architect and enforcement re-reviewed the fix and both measured a **Critical** the first round
introduced: "a block that opens with a label owns itself" was decided by the loose plain grammar, so
an annotated item under a correct declaration — `- bug 0402: [b](b.md)`,
`- [c](c.md): why it matters`, an item holding a URL — claimed itself and left the declaration. It
was neither selected nor reported, and the rule stayed green on a broken declared link. A plain
`Notes:` paragraph inside a labelled item took the list after it, and the "stands alone" message
fired on a label whose list was directly under it. In acaf41c those items joined their owner, so
this was a regression, and the attempt stopped there: the ownership design was put to both lenses on
paper before any more code. Their break attempts added two shapes — a different wrapped label
inside a declaration (`- **plan 0406:** [e](e.md)`) taking its links out silently, and a changed
bullet starting a list outside the label — plus a label in a table cell, a heading or mid-line,
never scanned.

**The design adopted.** Ownership is no longer decided while walking, by a grammar that cannot know
the declared label. Every paragraph and list item is its own block, and each link carries
`blockPath`, its enclosing blocks outermost first (mirroring `sectionPath`); a label alone on its
line encloses every list directly after it. `areLabelled(L)` decides at selection time: walking out
from the link, the first block that matches L (any form, exact case) or opens with a wrapped label
of its own settles it. A plain line that is not L settles nothing. On that:

- an annotated item, a URL, `Notes:` and `Metadata:` defer, so they neither hide nor capture a
  declaration;
- a different wrapped label inside an L declaration settles "not L" — selecting it as L would
  silently re-file `Supersedes` links as `Related to` links — and is **reported** at the inner
  label;
- an empty declaration is judged by the links L actually selects, so a label whose list is all
  annotated items is not empty, and one whose only child is `**Supersedes:**` is explained by the
  inner-label finding rather than a misleading one;
- references get a deciding block the same way, which removes the over-count the first draft of this
  design accepted;
- the "label where no block starts" scan moved to the syntax tree: any label-shaped `strong` node
  that is not the first child of its paragraph — a later line, mid-line, a table cell, a heading —
  and a label in code is not one. It replaces the line-based scan.
- `opensWithLabel` lost its last caller and was removed; the plain body stays loose, because it is
  only asked whether a line is a label alone.

**Accepted gap, decided:** a plain-form near-miss (`- Related To: [x]`) defers and is not reported;
the near-miss scan reads wrapped labels only, as decided earlier, and `docs/markdown.md` names it as
the one misspelling the rule does not catch.

**Sabotage, measured on this design** (`declared-block.test.ts` plus the ledger's rule tests, each
restored before the next; 209 green after): the innermost block always deciding 7 red; a wrapped
non-L label never deciding 1; the inner-label finding removed 1; a label enclosing one list only 1;
a lone label enclosing nothing 5; the unread-label scan removed 2; that scan flagging block-opening
labels 13; the empty finding ignoring enclosed links 1; references reported only when nothing is
selected 1; the alone message folded 2; the task box kept 1; the content column ignored 1;
declarations not deduped 1; declarations pushed and shared across forks 1; the optional colon 3;
the near-miss scan removed 6; the section near-miss removed 1; the section stack not reset 1;
case-insensitive `areLabelled` 4; the override raising `examined` 1; `mergeCollectResults` 7.

**Non-vacuity:** nine rows. `mid-paragraph` became `unread-label`; `annotated-child` (a colon-annotated
item's broken link must be reported by `resolve()` on that file — the Critical's shape, at the
gate), `inner-label` and `stands-alone` are new. Each new row was sabotaged alone and was the only one
to go to exit 0.

## Third review round — 2026-10-09

Architect and enforcement measured the built design (a9e80a3) against every shape from the two
earlier rounds and their own new probes. Each was selected or reported, except one class both found:
a bold label at a block's start that the syntax tree reads and the line grammar does not —
`**_Related to:_**`, `**Related _to_:**`, a whole line in bold (`**Related to: [a](a.md)**`) — was
skipped as "read by the grammar" and was neither selected nor reported. `***Related to:***` parsed as
emphasis around bold was reported with the wrong cause ("not at the start"). The tree had the label
in hand and dropped it, so it was fixed here: a bold label counts as at its block's start when only
`*`/`_` precede it on the block's line, and there it counts as read only when the line grammar reads
the same label; otherwise it is reported as "written with formatting eess-md does not read — write
it `**Related to:**`". Bold prose (`**Important: read this**`) is not a finding unless its label is
the declared one or a near miss.

Sabotage, measured: the format check removed reds its test (1 of 32) and the new `formatted-label`
non-vacuity row; the `*`/`_` prefix not counted as the block start reds its test (1 of 32). They
replace the second round's "that scan flags block-opening labels" row, whose `i === 0` test no longer
exists. Non-vacuity: ten rows.

## Final review round — 2026-10-09

Product, method and testing, who had seen only the first build, reviewed the whole PR. No Critical.

- **Product:** the declaration findings shared one element, so `.excluding()` could not sanction
  only "this label is intentionally empty" — the docs' claim was coarser than true. Each finding now
  ends its element with its kind (`(near miss)`, `(inside "…")`, `(not at a block start)`,
  `(formatting)`, `(reference links)`, `(empty)`), and the docs show
  `.excluding(/→ label "Supersedes" \(empty\)$/)`, measured to sanction `**Supersedes:** none` while
  a reference-link finding on the same label stays. Each remedy moved from the message into the
  suggestion, so the findings print a `Fix:` line like every other. The docs explain `block` and
  `blockPath`; a `RegExp` `areLabelled` is listed out of scope.
- **Testing:** six mutants survived the suite. Pinned now: the `**Label**:` form (colon outside the
  bold) mid-paragraph, which failed open; the inner-label finding's "inside a declaration" guard,
  whose loss would red every other wrapped label (the green control now holds an outside
  `**Supersedes:**`); a later line repeating the first (`block.line === line`); a nested near miss
  reported once, not also as "inside". The `endsWith` conjunct was dead and was removed. The
  misspelt-corpus test is an exact set. A heading inside a list item, which misdescribes the cause
  as "stands alone", is recorded as residual.
- **Method:** the Design, Build notes and State line now carry their supersession; the
  over-/under-selection residual has a real home in plan 0406; stale comments were fixed.

**Sabotage, the whole matrix re-run on this final tree** (`declared-block.test.ts` plus the ledger's
rule tests, 94 tests; each row restored before the next; 211 green after). 28 rows, every one red:
the twenty rows carried from the second and third rounds (the innermost block always deciding 7; a
wrapped non-L label never deciding 1; the inner-label finding removed 1; one list only 1; a lone
label enclosing nothing 5; the unread scan removed 2; the empty finding ignoring enclosed links 1;
references only when nothing is selected 1; the alone message folded 2; the task box kept 1; the
content column ignored 4; not deduped 1; pushed across forks 1; the optional colon 3; the near-miss
scan removed 7; the section near miss removed 1; the section stack not reset 1; case-insensitive 5;
`examined` raised 1; `mergeCollectResults` 7), the third round's two (the format check removed 1; the
`*`/`_` prefix not the block start 1), and six new (the colon-outside-bold form 1; the "inside"
guard 1; a later line as the block start 1; a nested near miss also "inside" 1; no suggestion 12;
one shared element 2). Counted: 21 − 1 + 2 + 6 = 28 (the second round's 21, less the scan row
the third replaced, plus its two, plus six).

**Residual added:** a heading inside a list item (`- **Related to:**` / `  ## [g](g.md)`) is reported
as "stands alone" rather than for its real cause; not silent, exotic, left.

**Validate.** Full runs, in order: red at `check:arch` on two unused type exports (unexported);
green in 8m33s (the build); red at `check:arch` on `matchName`, exported for a caller that had moved
(made private again); green in 8m17s (the first round's fix); green in 8m33s (the second round's
design). Since the second red, `check:fast` runs before every full run. The ledger's validate box
was ticked before the first run, because `check:ledger` inside validate reads it. On the third
round's tree: red at `check:nonvacuity`, where a scripted edit had put a stray row name into the
`stands-alone` row of `scripts/check-nonvacuity.mjs` (the harness's self-check caught it); after the
one-line fix, `check:integrity` plus every step from `check:nonvacuity` to the end of the chain green
in 7m35s, and CI green on the PR in 15m35s. On the final round's tree: red at `typecheck` on an unguarded index in a new test line
(`noUncheckedIndexedAccess`), guarded; then one complete `npm run validate`, green in 8m42s.
