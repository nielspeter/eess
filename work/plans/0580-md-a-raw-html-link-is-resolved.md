# Plan 0580: a raw HTML link is resolved

## Status

- **State:** Draft — awaiting the review's changes (see the proposal's Review, 2026-11-01); not ready to build
- **Implements:** [proposal 022](../proposals/022-md-a-raw-html-link-is-resolved.md)
- **Priority:** High, [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s
  severity: under "resolve directly" this plan closes that bug's HTML half, a false green
  (`links().should().resolve()` passes over a broken `<a href>` today). The proposal's own
  Priority line is rewritten to match in Phase 0.
- **Effort:** Medium. One owner for reading HTML attributes, and `links()` widened onto it.
- **Created:** 2026-11-01
- **Decided (2026-11-01, the maintainer, on the review):**
  - **Resolve directly, not unread first.** The `href` is read and resolved in one build; what the
    reader cannot read is reported as unread in the same build. This settles the open decision in
    [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s Fix 2, so
    no [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) amendment for
    suppressible unread findings is needed.
  - **One owner for reading HTML attributes** (`href`, `src`, `id`, `name`) in eess-md. `links()`
    reads it, and so do a future `images()` ([proposal 024](../proposals/024-md-an-images-file-exists.md)'s
    Ask B), [spike 0574](../spikes/0574-what-checking-a-link-fragment-needs.md)'s anchor sets
    ([bug 0136](../bugs/0136-link-fragments-are-never-checked.md)) and `mentions()`, whose use of
    `OPENS_A` (`packages/md/src/model/phrasing.ts:64`) it replaces.
  - **Scope:** `<a>` and `<area>`, in any letter case, quoted or unquoted. A detector wider than the
    reader finds every `<a` or `<area` tag start; what it finds and the reader cannot extract is
    unread, under a named cause.
  - **One change marked Breaking** (`**Breaking (@nielspeter/eess-md):**`, a minor on 0.x). No other
    package moves.
  - [Bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s HTML half
    closes done-otherwise against this plan, in the same PR.

## Problem

`links()` reads `link` nodes and defined `linkReference` nodes
(`packages/md/src/model/links.ts:197`); an `html` node is never scanned, so a broken
`<a href="./gone.md">` is not examined and the rule is green
([bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)). The only
recogniser, `OPENS_A`, answers yes or no, pulls out no value, over-matches `data-href` and misses
`<a title="a>b" href=…>` (the review's survey, measured). The review also found that a misread
`href` is a false green as well as a false red: the link walk feeds `beLinkedBack()`'s index
(`packages/md/src/conditions/linked-back.ts:14`) and `sections().haveLink()`
(`packages/md/src/model/section-holds.ts:50`), so a commented-out `<a href>` would count as a link.

## Phase 0: the proposal's changes, before this plan can be promoted

The review's recommended next step, step 2, lists what must land in the proposal, with its
submission kept and the correction added below it.

- [ ] Record the corrections to the proposal's own text: `OPENS_A` is not a starting point for the
      scan; Ask A narrowed [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s
      measured scope without saying so; the entity example sat in a query string, where it cannot
      show decoding.
- [ ] Rewrite the Priority line for "resolve directly".
- [ ] Scope: what is resolved and what is reported unread, including the unquoted `href` that
      micromark leaves as a `text` node (Critical 2): resolved, or reported unread under a cause of
      its own, read by source offset either way. `<area>` with the GitHub measurement the review
      asked for.
- [ ] Replace the "cannot parse" criterion with the detector/reader split, its named causes
      (`title="a>b"`, `:href` or `v-bind:href`, an unterminated quote, a tag split by a blank line),
      a remedy per cause verified to clear it, and the
      [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) precedence
      (Critical 3).
- [ ] Add the false-green rows for `haveLink()` and `beLinkedBack()` (Critical 4).
- [ ] Add the attribute and context break classes (Important 2 and 3), including the decision on a
      code span or fence inside an html block, which disagrees with `fencesInHtml`'s choice
      (`packages/md/src/model/prose.ts:235`).
- [ ] Settle the autofix rule for an `href` (Important 4).
- [ ] Move the entity row into the path, `./R&amp;D.md` against `R&D.md` (Important 5).
- [ ] Add the break statement and the impact on each reader of `links()` (Important 6).
- [ ] Split the rows into suite rows and two or three nonvacuity scenarios of one fixture script
      (Important 7).
- [ ] Name [bug 0136](../bugs/0136-link-fragments-are-never-checked.md) as a consumer of the
      attribute owner, beside [proposal 024](../proposals/024-md-an-images-file-exists.md) Ask B
      (Important 1).
- [ ] Open question 1 is answered: a named-grammar attribute scan (CommonMark's open tag), which
      needs no ADR, or an HTML parser dependency, which is an ADR first (Important 9). The reviewers
      lean to the scan.

## Phases

1. **The attribute owner.** One model module that, given an `html` node and the source, returns the
   tag, the attribute, its decoded value, its source span and its line, with comments cut out. An
   arch rule makes it the one owner, as `arch.rules.ts:361` does for
   [ADR-019](../../adr/019-a-code-blocks-language-tag-is-read-in-any-letter-case.md)'s tag
   comparison. `mentions()` recognises an `<a href>` through it, and `OPENS_A` is removed.
2. **`links()` reads `href`.** `collectLinkBlocks` (`packages/md/src/model/links.ts:117`) yields an
   `MdLink` per `href` the owner reads, at its own line, resolved by `resolveLink` with no second
   resolver. The detector reports the residue as unread: not counted in `examined`, not silenced by
   `.expectEmpty()`. `docs/markdown.md` and the `links()` docstring state the subset read.
   [Bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md) is closed
   done-otherwise against this plan.

## Files changed

- Phase 1: a new module under `packages/md/src/model/`, `packages/md/src/model/phrasing.ts`,
  `arch.rules.ts`.
- Phase 2: `packages/md/src/model/links.ts`, `packages/md/src/builders/links.ts`,
  `docs/markdown.md`, `scripts/nonvacuity/`,
  `.changeset/` (one changeset, marked Breaking, `@nielspeter/eess-md` minor),
  `work/bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md` (its disposition).

## Test inventory

- Phase 1: the owner's own rows for each attribute and context break class Phase 0 adds;
  `mentions()`'s existing `'html-link'` tests green, plus a `data-href` row that no longer matches.
- Phase 2:
  - a readable broken `href` red at its line inside a multi-line block;
  - each named unread cause reported, and its remedy clearing it;
  - a commented-out `<a href>` is not a link back and does not satisfy `haveLink()`;
  - an external `href` and an `<a name>` produce nothing;
  - nonvacuity: two or three scenarios of one fixture script asserting the message (a readable
    broken `href`, an unread one built from a construct the reader cannot extract, and the
    unquoted `text` case if Phase 0 puts it in scope), mindful of
    [bug 0552](../bugs/0552-nonvacuity-shard-3-runs-near-its-timeout.md)'s shard.

## Out of scope

- Links built by script, and HTML outside the Markdown documents.
- `<img src>`: [proposal 024](../proposals/024-md-an-images-file-exists.md) Ask B, on Phase 1's owner.
- A fragment in an `href`: resolved as `self` here, checked by
  [bug 0136](../bugs/0136-link-fragments-are-never-checked.md).
- `mentions()` still reporting an `<a>`'s text as unread while `links()` resolves its `href`: said
  in the docs and recorded as a follow-up, as
  [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md) part (a) did.
- A local link with a query string never resolving (`packages/md/src/model/resolve-link.ts:136`),
  for Markdown links too: recorded as [bug 0583](../bugs/0583-a-local-link-with-a-query-string-never-resolves.md).
