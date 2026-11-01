# Plan 0580: a raw HTML link is resolved

## Status

- **State:** Draft — freeze written 2026-11-01, under the re-check of the lenses that raised its
  items; flips to Ready when they accept it
- **Implements:** [proposal 022](../proposals/022-md-a-raw-html-link-is-resolved.md)
- **Priority:** High, [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s
  severity: this plan closes that bug's HTML half, a false green
  (`links().should().resolve()` passes over a broken `<a href>` today).
- **Effort:** Medium. One owner for reading HTML attributes, and `links()` widened onto it.
- **Created:** 2026-11-01
- **Decided by:** [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) (syntax that
  Markdown or GFM defines is not a shape, so GFM's rendering is what is read),
  [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) (what the reader
  cannot read is reported, never dropped), [ADR-009](../../adr/009-agent-first-failure-surfaces.md)
  rule 2 (every unsuppressable finding carries a remedy that clears it),
  [ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md) (`examined` counts what was read).
- **Decided on the review (2026-11-01), each overrulable:**
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

Real READMEs use the construct. In 607 READMEs the review's product lens measured, 49% hold raw
HTML and 17 (2.8%) hold an internal `<a href>`; of the 2,349 hrefs found, 1,346 (57%) are fragments,
and a quoted-attribute scan covers all 2,349.

## Measured

Both tables were measured 2026-11-01 and are recorded here by value. The build reads them from
this plan, not from the source.

**How micromark parses each case** (eess-md's parser, with GFM, on `main` at 7daac794):

| Input                                      | Node micromark makes                                  |
| ------------------------------------------ | ----------------------------------------------------- |
| `see <a href=./x.md>x</a> here`            | `text` `see <a href=./x.md>x`, then `html` `</a>`     |
| `see <a href=x.md>x</a> here`              | `html` `<a href=x.md>`                                |
| `see <a title="a>b" href="./x.md">x</a>`   | `html` `<a title="a>b" href="./x.md">`                |
| `see <a :href="foo">x</a>`                 | `html` `<a :href="foo">`                              |
| `see <a href="./x.md>x</a>` (no close)     | `text` `see <a href="./x.md>x`                        |
| `see \<a href="./x.md">x</a>` (escaped)    | `text` `see <a href="./x.md">x`, the same as unquoted |
| `<a href=docs/>x</a>`                      | `html` `<a href=docs/>`                               |
| `<a href="./R&amp;D.md">x</a>`             | `html` holding `&amp;` as written                     |
| a `<div>` block inside `> `                | one `html` node, its value without the `> ` prefixes  |
| `<details>` holding a fence, no blank line | one `html` node holding the fence lines               |
| `<script>` holding `'<a href="./x.md">'`   | one `html` node holding the string                    |

**How GitHub renders each case** (`gh api -X POST /markdown`, `mode=gfm`, synthetic input only):

| Input                                                              | GitHub's output                                                            |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `<a href>` inside `<script>`, `<style>`, `<textarea>` or `<title>` | the tag escaped as text (GFM's tagfilter), the inner `<a href>` **a link** |
| `<map><area href="./x.md"></map>`                                  | nothing: the elements are removed                                          |
| a fence inside `<details>`, no blank line                          | the backticks as text, the `<a href>` **a link**                           |
| a code span inside `<div>`                                         | the backticks as text, the `<a href>` **a link**                           |
| `see <a href=./x.md>U</a>`                                         | **a link**, `href="./x.md"`                                                |
| `see <a :href="foo">V</a>`                                         | `see V`: the attribute removed, no link                                    |
| `<pre>` holding `<a href>`                                         | **a link**                                                                 |
| `<a href=docs/>`                                                   | **a link**, `href="docs/"`                                                 |
| a comment holding `<a href>` beside a real one                     | the comment dropped, the real one a link                                   |

## Design

### The attribute owner

One model module, `packages/md/src/model/html-attributes.ts`. Given an `html` node and the
document's source, it returns each element it reads: the tag name (lower-cased), each attribute's
name (lower-cased), its decoded value, the value's source span and its line. An arch rule makes it
the one owner of reading HTML attributes in eess-md, as `arch.rules.ts:361` does for
[ADR-019](../../adr/019-a-code-blocks-language-tag-is-read-in-any-letter-case.md)'s tag comparison.

- **D1. The grammar is CommonMark's open tag (§6.6), named in its docstring:** a tag name, then
  attributes, each a name (`[A-Za-z_:][A-Za-z0-9_.:-]*`) with an optional value, unquoted
  (no whitespace, `"`, `'`, `=`, `<`, `>` or backtick), single-quoted or double-quoted. This is the
  grammar micromark used to make the `html` node, so the reader agrees with the parser. No HTML
  parser is added: that would be a decision the size of
  [ADR-002](../../adr/002-ts-morph-ast-engine.md), it would engage
  [ADR-020](../../adr/020-a-package-supports-a-runtime-only-where-ci-checks-it-there.md), and it
  would not fix the unquoted case, which is the Markdown parser's (open question 1, answered).
- **D2. Tokenize first, decode after.** The tag is found in the source text and its value decoded
  once, so `&lt;a href…&gt;` is never a tag and `./R&amp;D.md` resolves to `R&D.md`. The finding
  quotes the decoded URL, as a Markdown link's finding quotes mdast's decoded `url` today.
- **D3. An unquoted value follows the HTML tokenizer:** it runs to whitespace or `>`, so
  `<a href=docs/>` reads `docs/` (GitHub agrees, measured).
- **D4. Comments are cut out** of the node before it is read, wherever they sit in it; `ONE_COMMENT`
  (`packages/md/src/model/phrasing.ts:63`) skips only a node that is all comment, and that is not
  enough here.
- **D5. Inside an `html` node, everything is HTML.** A fence or a code span inside an HTML block is
  rendered with its backticks as text and its `<a href>` as a link (measured on GitHub), so the
  reader reads it. This differs from `fencesInHtml` (`packages/md/src/model/prose.ts:235`), which
  sets such a fence aside for prose. That choice is about what an author means as an example. This
  one is about what renders as a link. A red here has a real remedy: a blank line after the opening
  tag, which makes the fence render as code on GitHub too.
- **D6. Raw-text elements hold links under GFM.** GFM's tagfilter shows `<script>`, `<style>`,
  `<textarea>`, `<title>` (and `<xmp>`, `<iframe>`, `<noembed>`, `<noframes>`, `<plaintext>`) as
  text, so an `<a href>` inside them renders as a link (measured for the first four), and the reader
  reads it. A renderer that runs the script instead, such as VitePress's `<script setup>`, sees
  code there. A broken target found there still has a real remedy: fix the target.
- **D7. `<pre>` holds links** (measured). An `<a>` written inside a Markdown link's text,
  `[<a href="x">y</a>](z)`, is two links: each URL is written and each is resolved.
- **D8. The scan is linear:** no nested quantifier over `[^>]*`. An `href` reaches only
  `resolveLink`'s index lookup. The autofix (below) is the only path that writes.

### What `links()` reads, and what it reports unread

- **R1. Read:** each `href` on an `<a>` or `<area>` element the owner reads, in any letter case and
  any quoting. It becomes an `MdLink` at the line the `href` sits on, resolved by `resolveLink` with
  no second resolver. `<area>` is read although GitHub removes it (measured): HTML defines it as a
  link, eess-md serves any Markdown corpus, and a broken one has a real remedy.
- **R2. Not a link, and not reported:** `data-href`, `xlink:href`, and `:href` / `v-bind:href`.
  These are other attributes, not `href`. The last two are a framework's binding of an expression,
  and GitHub removes the attribute (measured). A component's `href` prop (`<VPButton href>`) is not
  an `<a>`. An `<a name>` or `<a id>` with no `href` is an anchor, left to
  [bug 0136](../bugs/0136-link-fragments-are-never-checked.md). _This overrules the review's
  decision 3 for `:href` and `v-bind:href`, which listed them as reported unread. An unsuppressable
  finding on a correct Vue binding would have no remedy but deleting it, the case decision 1
  rejected under [ADR-009](../../adr/009-agent-first-failure-surfaces.md) rule 2._
- **R3. The detector.** It finds every tag start that the source does not escape: `<a` or `<area`,
  any case, followed by whitespace, `/` or `>`. It looks in `html` nodes and in `text` nodes,
  reading source offsets so that an escaped `\<a` stays text; `sourceOffsets`
  (`packages/md/src/model/phrasing.ts:79`) is the precedent. A tag start the reader did not read
  is reported under one of these named causes, each with a remedy verified to clear it:

  | Cause              | Where                                                                                                                                | Remedy, verified to clear it     |
  | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
  | `unquoted-in-text` | a `text` node holding a tag start with `href`: micromark did not take it as HTML (`href=./x.md`; GitHub renders it a link, measured) | quote the attribute's value      |
  | `unterminated`     | a tag start whose quote never closes before the node ends                                                                            | close the quote                  |
  | `split-tag`        | a tag start in an `html` node whose `>` is cut off by the node's end (a blank line ends an HTML block)                               | keep the tag on contiguous lines |

  A tag start in a `text` node with no `href` before the line ends is not reported: it is prose
  that reads like a tag, and no renderer makes it a link.

- **R4. The unread finding follows `md/unread-mention`** (`packages/md/src/builders/mentions.ts:46`):
  rule id `md/unread-link`, one finding per unread site at its line, a WHERE and a REMEDY per cause,
  carrying `bypassFilters` ([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)
  rule 5). An unread site is not counted in `examined`
  ([ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md)), and `.expectEmpty()` does not
  silence it. It is reported where the verdict depends on it
  ([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) rule 4): always for
  `.resolve()`; for `haveLink()`, only on a section with no read link; for `beLinkedBack()`, only
  where the back-link is otherwise missing. A section whose only link is unread is undecided, not
  "has no link".

### The autofix

- **F1.** An `href` gets `movedLinkFix`'s rewrite on the same terms as a Markdown link
  (`packages/md/src/model/resolve-link.ts:283`): only when the value's source span is known. The
  owner sets `urlStart`/`urlEnd` only when `writtenAt` (`packages/md/src/model/destination.ts:28`)
  confirms that the source bytes at that span are the decoded value. So an entity-encoded value gets
  no fix, and a value whose `html` node dropped a `> ` or an indent is mapped to the source or gets
  none.
- **F2.** No fix is offered when the replacement cannot be written in that value's quoting: an
  unquoted value, or a replacement holding the value's own quote character.

### What changes for each reader of `links()`

The changeset marks `**Breaking (@nielspeter/eess-md):**`, a minor on 0.x, as
[bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md) part (a) did. No
other package moves: eess-crossvalidate imports no `links()`. The changeset and `docs/markdown.md`
state each change:

- `.resolve()`: a broken `href` is red at its line, and an unread site is red as `md/unread-link`.
- `.beLinkedBack()`, both directions: an `href` counts as a link to its target and as a link back;
  a commented-out one counts as neither.
- `sections().haveLink()`: an `href` gives its section a link.
- `areLabelled()` and `areInSection()`: an `href` in inline HTML gets a `blockPath` (measured by the
  review), so it becomes declared like an inline link in the same block.
- `haveLiveTargets()`: reads an `href` into a frozen record as that record, like any link.
- `.select()` into `correspondence()`: the selected set grows by every `href` read.
- `examined`: counts each `href` read, and no unread site.
- `MdLinkRef` fields for an `href`: `url` is the decoded value; `line` is the `href`'s own line
  inside a multi-line block; `block` and `blockPath` as for an inline link at that line; `.text` is
  the element's text, which is empty for `<a><img></a>` (13 of the 14 block-level links the review
  measured).
- Pinned because honest but surprising: `href=""` resolves as `self`; `href="#…"` resolves as `self`,
  its fragment left to [bug 0136](../bugs/0136-link-fragments-are-never-checked.md); `javascript:`
  is external by `EXTERNAL_RE` (`packages/md/src/model/external.ts:6`); a templated `href`
  (`{{ site.baseurl }}`) is red as missing, as its Markdown twin is.

The docs state the subset where `links()` is described (`docs/markdown.md:232`, and the `links()`
docstring, `packages/md/src/builders/links.ts:149`), with one phrase for the construct where today
there are three.

## Phase 0: the review's changes (dispositions, 2026-11-01)

The proposal's Review ends: "[plan 0580] … carries the changes above as its acceptance criteria".
So the changes land here, in the Design above. The proposal's submission is kept, and its false
claims are annotated in place (PROPOSALS.md, "Corrections stay in the record"). This plan's first
draft said the changes would land in the proposal; that was this plan's mistake, and the
dispositions below correct it.

- [x] Record the corrections to the proposal's own text: `OPENS_A` is not a starting point for the
      scan; Ask A narrowed [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s
      measured scope without saying so; the entity example sat in a query string, where it cannot
      show decoding.
- [ ] Rewrite the Priority line for "resolve directly" — done-otherwise: annotated in place in the
      proposal (its Priority line carries the correction), and this plan's Priority states it.
- [ ] Scope — done-otherwise: R1 to R3, with `<area>` and the unquoted case measured on GitHub (the
      Measured section).
- [ ] The detector/reader split, named causes, remedies, [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) precedence — done-otherwise: R3
      and R4.
- [ ] The false-green rows for `haveLink()` and `beLinkedBack()` — done-otherwise: the Test
      inventory, Phase 2.
- [ ] The attribute and context break classes, and the decision on a code span or fence inside an
      HTML block — done-otherwise: D1 to D7, and the Test inventory.
- [ ] The autofix rule — done-otherwise: F1 and F2.
- [ ] The entity row in the path — done-otherwise: D2, and the Test inventory.
- [ ] The break statement and the impact on each reader — done-otherwise: "What changes for each
      reader of `links()`".
- [ ] Suite rows and two or three nonvacuity scenarios — done-otherwise: the Test inventory.
- [ ] [Bug 0136](../bugs/0136-link-fragments-are-never-checked.md) named as a consumer of the
      owner — done-otherwise: the Status block's second decision.
- [ ] Open question 1 — done-otherwise: D1, an attribute scan on CommonMark's named grammar, with no
      ADR.

## Phases

1. **The attribute owner.** `html-attributes.ts` as designed (D1 to D8), with its arch rule.
   `mentions()` recognises an `<a href>` through it, and `OPENS_A` is removed. That closes
   [bug 0593](../bugs/0593-the-html-link-recogniser-matches-data-href-and-misses-a-quoted-angle-bracket.md)
   (`OPENS_A` matches `data-href` and misses `title="a>b"`), which moves to `fixed/` with this plan.
2. **`links()` reads `href`.** `collectLinkBlocks` (`packages/md/src/model/links.ts:117`) yields an
   `MdLink` per `href` the owner reads (R1), the detector reports the residue (R3, R4), and the
   autofix follows F1 and F2. The docs and the changeset state each reader's change.
   [Bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md) is closed
   done-otherwise against this plan.

## Files changed

- Phase 1: `packages/md/src/model/html-attributes.ts` (new), `packages/md/src/model/phrasing.ts`,
  `arch.rules.ts`, `work/bugs/0593-the-html-link-recogniser-matches-data-href-and-misses-a-quoted-angle-bracket.md`
  (to `fixed/`).
- Phase 2: `packages/md/src/model/links.ts`, `packages/md/src/builders/links.ts`,
  `packages/md/src/model/resolve-link.ts` (if F1 needs it), `docs/markdown.md`,
  `scripts/check-nonvacuity.mjs` and `scripts/nonvacuity/`, `.changeset/` (one changeset, marked
  Breaking, `@nielspeter/eess-md` minor),
  `work/bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md` (its disposition).

## Test inventory

Each suite row goes red under its own sabotage; a case that produces nothing is a suite row, never
a nonvacuity row.

- **Phase 1, the owner:**
  - attributes: `href=` inside another attribute's value is not `href`; `data-href`, `:href` and
    `xlink:href` are not `href`; spaces around `=`; a tag over several lines; `<A HREF>`; single
    quotes; `<a href=docs/>` reads `docs/`; `<a title="a>b" href="./x.md">` reads `./x.md`;
  - decoding: `&lt;a href…&gt;` is not a tag; `./R&amp;D.md` decodes to `./R&D.md`;
  - context: a comment inside a larger node is cut out; a fence and a code span inside an HTML block
    are read (D5); `<script>` and `<textarea>` content is read (D6); `<pre>` content is read;
  - `mentions()`'s existing `'html-link'` tests green, plus a `data-href` row that no longer
    matches and a `title="a>b"` row that now does
    ([bug 0593](../bugs/0593-the-html-link-recogniser-matches-data-href-and-misses-a-quoted-angle-bracket.md)).
- **Phase 2, `links()`:**
  - a readable broken `href` red at its own line inside a multi-line block, and inside a blockquote;
  - `./R&amp;D.md` resolves against `R&D.md`, and the finding quotes the decoded URL;
  - each cause in R3 reported once at its line, and its remedy clearing it; an escaped `\<a` and a
    prose `<a` with no `href` reported by none;
  - a commented-out `<a href>` is not a link back and does not satisfy `haveLink()`; a section
    whose only link is unread is reported as undecided, not as having no link;
  - an external `href`, `href=""`, `href="#x"`, an `<a name>` and a `:href` produce no broken-link
    finding;
  - `examined` counts each `href` read and no unread site; `.expectEmpty()` does not silence an
    unread one;
  - the autofix: rewritten in a quoted value; none for an entity-encoded value, an unquoted value,
    or a value in a blockquote whose span does not map.
- **Nonvacuity:** one fixture script, three scenarios, each asserting its message: a readable
  broken `href`; an `unquoted-in-text` site, so an emptied detector reds; an `unterminated` site.
  [Bug 0552](../bugs/0552-nonvacuity-shard-3-runs-near-its-timeout.md)'s shard is near its timeout,
  so the build measures the three rows' cost and says which shard takes them.

## Out of scope

- Links built by script, and HTML outside the Markdown documents.
- `<img src>`: [proposal 024](../proposals/024-md-an-images-file-exists.md) Ask B, on Phase 1's owner.
- A fragment in an `href`: resolved as `self` here, checked by
  [bug 0136](../bugs/0136-link-fragments-are-never-checked.md).
- `mentions()` still reporting an `<a>`'s text as unread while `links()` resolves its `href`: said
  in the docs and recorded as a follow-up, as
  [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md) part (a) did.
- A local link with a query string never resolving: fixed by
  [bug 0583](../bugs/fixed/0583-a-local-link-with-a-query-string-never-resolves.md).

## Progress ledger

- [x] Reviewed, as [proposal 022](../proposals/022-md-a-raw-html-link-is-resolved.md)'s Review
      (architect · product · enforcement), 2026-11-01
- [x] Freeze written: the review's changes, the measurements, the open question answered (2026-11-01)
- [ ] Freeze re-checked by the lenses that raised its items
- [ ] Ready
- [ ] Phase 1 — the attribute owner
- [ ] Phase 2 — `links()` reads `href`
- [ ] Sabotage matrix, all red

Deferred: none
