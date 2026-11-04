# Plan 0580: a raw HTML link is resolved

## Status

- **State:** Done — all three phases built (PRs #296, #297, #300) → completed/. Frozen 2026-11-01 after two re-checks (architect · enforcement), the second
  Ready with changes and its changes applied (Review below)
- **Implements:** [proposal 022](../../proposals/promoted/022-md-a-raw-html-link-is-resolved.md)
- **Priority:** High, [bug 0558](../../bugs/fixed/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s
  severity: this plan closes that bug's HTML half, a false green
  (`links().should().resolve()` passes over a broken `<a href>` today).
- **Effort:** Medium. One owner for reading HTML attributes, and `links()` widened onto it.
- **Created:** 2026-11-01
- **Decided by:** [ADR-022](../../../adr/022-eess-mds-root-fixes-no-documents-shape.md) (syntax that
  Markdown or GFM defines is not a shape, so GFM's rendering is what is read),
  [ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) (what the reader
  cannot read is reported, never dropped), [ADR-009](../../../adr/009-agent-first-failure-surfaces.md)
  rule 2 (every unsuppressable finding carries a remedy that clears it),
  [ADR-010](../../../adr/010-a-pass-is-constructed-from-evidence.md) (`examined` counts what was read).
- **Decided on the review (2026-11-01), each overrulable:**
  - **Resolve directly, not unread first.** The `href` is read and resolved in one build; what the
    reader cannot read is reported as unread in the same build. This settles the open decision in
    [bug 0558](../../bugs/fixed/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s Fix 2, so
    no [ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) amendment for
    suppressible unread findings is needed.
  - **One owner for reading HTML attributes** (`href`, `src`, `id`, `name`) in eess-md. `links()`
    reads it, and so do a future `images()` ([proposal 024](../../proposals/024-md-an-images-file-exists.md)'s
    Ask B), [spike 0574](../../spikes/0574-what-checking-a-link-fragment-needs.md)'s anchor sets
    ([bug 0136](../../bugs/fixed/0136-link-fragments-are-never-checked.md)) and `mentions()`, whose use of
    `OPENS_A` (`packages/md/src/model/phrasing.ts:64` on `6bcd35e6`) it replaces.
  - **Scope:** `<a>` and `<area>`, in any letter case, quoted or unquoted. A detector wider than the
    reader finds every `<a` or `<area` tag start; what it finds and the reader cannot extract is
    unread, under a named cause.
  - **One change marked Breaking** (`**Breaking (@nielspeter/eess-md):**`, a minor on 0.x). No other
    package moves. _Corrected 2026-11-03 (Phase 3's close review): three changesets ship, one per
    phase, each marked Breaking (`.changeset/one-html-reader.md`, `.changeset/links-read-an-html-href.md`,
    `.changeset/an-unread-link-is-undecided-evidence.md`), since each phase changed verdicts on its
    own; released together they are still one minor of eess-md, with three entries in its changelog._
  - [Bug 0558](../../bugs/fixed/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s HTML half
    closes done-otherwise against this plan, in the same PR.

## Problem

`links()` reads `link` nodes and defined `linkReference` nodes
(`packages/md/src/model/links.ts:197`); an `html` node is never scanned, so a broken
`<a href="./gone.md">` is not examined and the rule is green
([bug 0558](../../bugs/fixed/0558-a-reference-style-or-raw-html-link-is-never-examined.md)). The only
recogniser, `OPENS_A`, answers yes or no, pulls out no value, over-matches `data-href` and misses
`<a title="a>b" href=…>` (the review's survey, measured). The review also found that a misread
`href` is a false green as well as a false red: the link walk feeds `beLinkedBack()`'s index
(`packages/md/src/conditions/linked-back.ts:14`) and `sections().haveLink()`
(`packages/md/src/model/section-holds.ts:50`), so a commented-out `<a href>` would count as a link.

Real READMEs use the construct. In 607 READMEs the review's product lens measured, 49% hold raw
HTML and 17 (2.8%) hold an internal `<a href>`; of the 2,349 hrefs found, 1,346 (57%) are fragments,
and a quoted-attribute scan covers all 2,349.

## Measured

Measured 2026-11-01 and recorded here by value. The build reads these tables from this plan, not
from the source. Two instruments: micromark, eess-md's parser with GFM, on `main` at 7daac794; and
GitHub's renderer (`gh api -X POST /markdown`, `mode=gfm`), given synthetic input only. The P
numbers are the freeze re-check's probes.

**Where micromark puts a tag.** micromark tokenizes inline raw HTML with CommonMark's open-tag
grammar (§6.6), with one divergence: an unquoted attribute value ends at `/` and must then be
followed by `>` (line 573 of micromark-core-commonmark's lib/html-text.js). So any unquoted value
holding a `/` that is not followed by `>` turns the whole tag into text, whichever attribute it sits
on. Inside an HTML block (§4.6, types 1 to 6: `<div>`, `<details>`, `<p>`, `<table>`, `<pre>`,
`<script>` …), micromark checks only the block's start condition. The `<a …>` tags inside it are
never tokenized.

| Input                                                                   | micromark                                            | GitHub                                        |
| ----------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------- |
| `see <a href=x.md>x</a>`                                                | `html` `<a href=x.md>`                               | link                                          |
| `see <a title="a>b" href="./x.md">x</a>`                                | `html`                                               | link                                          |
| `see <a href=./x.md>x</a>` (unquoted `/`)                               | `text`                                               | link, `href="./x.md"`                         |
| `see <a href=x.md title=a/b>x</a>` (P1)                                 | `text`                                               | link, `href="x.md"`                           |
| `see <a` + newline + `href=./x.md>x</a>` (P3)                           | `text`, one node across the soft break               | link                                          |
| table cell `<a href=./x.md>x</a>` (P5)                                  | `text`                                               | (not measured; same tag as row 3)             |
| `see <a href="./x.md"title="y">x</a>` (P7)                              | `text`                                               | text, no link                                 |
| `see <a @click="go" href="./x.md">x</a>` (P8)                           | `text`                                               | text, no link                                 |
| `see <a href="./x.md" foo=bar=baz>x</a>`                                | `text`                                               | text, no link                                 |
| `see <a href="./x.md>x</a>` (unclosed quote)                            | `text`                                               | text, no link                                 |
| `see \<a href="./x.md">x</a>` (escaped)                                 | `text`, the same value as the unquoted case          | (text by CommonMark)                          |
| `see &lt;a href=./x.md>x` (P14)                                         | `text` whose decoded value starts `<a`               | (text by CommonMark)                          |
| `the <a href>element</a>` (P13)                                         | `html` `<a href>`                                    | link, `href=""`                               |
| `<a href="./first.md" href="./second.md">`                              | `html`                                               | link to `./first.md`                          |
| `<a href=docs/>x</a>`                                                   | `html` `<a href=docs/>`                              | link, `href="docs/"`                          |
| `see <a :href="foo">x</a>`                                              | `html`                                               | `see V`: attribute removed, no link           |
| `<div>` + `<a href="./x.md"title="y">` + `</div>` (P9)                  | one `html` node                                      | link, `href="./x.md"`                         |
| `<div align=center>` + `<a @click="go" href="./x.md">` (P10)            | one `html` node                                      | link, `href="./x.md"`                         |
| a `<div>` block inside `> `                                             | one `html` node, its value without the `> ` prefixes | (link)                                        |
| `<details>` holding a fence, no blank line                              | one `html` node holding the fence lines              | backticks as text, the `<a>` a link           |
| the same with a blank line after `<details>`                            | `html`, then a `code` node                           | the fence as code, no link                    |
| `<div>` holding a code span                                             | one `html` node                                      | backticks as text, the `<a>` a link           |
| `<script>`, `<style>`, `<textarea>`, `<title>` holding `<a href>`       | one `html` node                                      | the tag escaped (tagfilter), the `<a>` a link |
| `<pre>` holding `<a href>`                                              | one `html` node                                      | link                                          |
| `<map><area href="./x.md"></map>`                                       | one `html` node                                      | nothing: removed                              |
| `<![CDATA[` + `<a href="./x.md">D</a>` + `]]>`                          | one `html` node                                      | `D ]]>`: no link                              |
| `see <img alt="<a href='./g.md'>"> here`                                | `html` `<img …>`                                     | no link from the inner `<a`                   |
| a comment holding `<a href>` beside a real one                          | one `html` node                                      | the comment dropped, the real one a link      |
| `<a href="./R&amp;D.md">`                                               | `html` holding `&amp;` as written                    | (link to `./R&D.md`)                          |
| `see <a href=./a*b*.md>x</a>` (Q1)                                      | `text`, `emphasis`, `text`: the tag split            | (link, as Q2)                                 |
| `see <a href=./x.md title=*t*>x</a>` (Q2)                               | `text`, `emphasis`, `text`: the tag split            | link, `title="*t*"`                           |
| `see <a href=./x.md title=~~t~~>x</a>` (Q3)                             | `text`, `delete`, `text`: the tag split              | (link, as Q2)                                 |
| `see \\<a href=./x.md>x</a>` (Q4: an escaped `\`, then a tag)           | `text` `see \<a href=./x.md>x`                       | `\` and a link                                |
| `see R&amp;D <a href=./x.md>x</a>` (Q5)                                 | `text` `see R&D <a href=./x.md>x`                    | link                                          |
| ``see <a title="`" href=./x.md>x`</a>`` (Q6)                            | `text`, then `inlineCode`                            | link, `title="`"`                             |
| `see <a name=a/b>x</a>` (Q7)                                            | `text`                                               | (an anchor, no `href`)                        |
| `see <a href=https://e.com/x>x</a>` (Q8)                                | `text`, then a GFM autolink-literal `link`           | (external)                                    |
| `see <a href="./x.md" data-x=a/_b_>x</a>` (Q10)                         | `text`, `emphasis`, `text`: the tag split            | (link, as Q2)                                 |
| `> <div>` + `> <a` + `href="./gone.md">x</a>` (B1; B2 in a list)        | `html` `<div>\n<a`, ended by its container           | (no link)                                     |
| `<div>` + `<a href="./gone.md>x</a>` + `</div>` + a later `"`, `>` (B3) | one `html` node ending inside a quoted value         | `<div></div>`: no link                        |
| `![logo <a href=./x.md>](y.png)` (A1; A2 quoted)                        | `image`, the tag only in `alt`                       | (alt text, no link)                           |
| `[x](y.md "<a href=./z.md>")` (A3)                                      | `link`, the tag only in its `title`                  | (a title, no link)                            |
| `[x](<a href=./z.md>)` (A4)                                             | `link`, `url` `a href=./z.md`                        | (a destination, no link)                      |

A row in parentheses was not rendered; it follows from CommonMark or from a measured row. Q2, Q4,
Q5, Q6 and B3 were rendered at the freeze's second re-check, the same day. In this
repository, the 1,431 tracked Markdown files hold no `<a` or `<area` tag start outside a code span
(the re-check's scan, 4.8 s), so the repository's own gates exercise nothing this plan adds; only the
suite and the three nonvacuity scenarios prove it live.

## Design

### The principle

A literal `href` on an HTML link element (`<a>`, `<area>`) is a link, read where a renderer reads it.
An expression binding (`:href`, `v-bind:href`), a component's prop (`<VPButton href>`) and other
attributes (`data-href`, `xlink:href`) are not links: they have no value to resolve, and a finding on
them could only be cleared by deleting correct code
([ADR-009](../../../adr/009-agent-first-failure-surfaces.md) rule 2). What eess-md cannot read where a
renderer would make a link is reported, never dropped
([ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)).

### The attribute owner

One model module, `packages/md/src/model/html-attributes.ts`, internal to eess-md: not on the root
([ADR-022](../../../adr/022-eess-mds-root-fixes-no-documents-shape.md) clause 1) and not on
`/internal` until a second package needs it.

- **D1. Inside an `html` node, it is an HTML tokenizer for tags**, following the WHATWG tokenizer's
  data, tag-open, tag-name, attribute and comment states (HTML §13.2.5), because micromark never
  tokenized those tags (Measured) and a browser reads them this way (P9, P10). It returns each start
  tag it reads: the tag name and attribute names lower-cased, each value decoded, the value's source
  span and its line. What the tokenizer does, the reader does: an attribute name is any run up to
  whitespace, `/`, `>` or `=` (so `@click` is a name, and `href` after it is read); a missing space
  between attributes is accepted; an unquoted value runs to whitespace or `>` (`<a href=docs/>` reads
  `docs/`); the first of two `href`s wins; a valueless `href` is `""`; a `<` inside a quoted value is
  text (`<img alt="<a …>">` holds no `<a>`).
- **D2. Comments and bogus comments are cut out**, as the tokenizer does: `<!-- … -->`, and `<!`
  (CDATA included) or `<?` up to the next `>` (the CDATA row). The owner's `isOnlyComment(value)`
  replaces both `ONE_COMMENT` (`packages/md/src/model/phrasing.ts:63` on `6bcd35e6`) and `HTML_COMMENT`
  (`packages/md/src/model/section-holds.ts:29` on `6bcd35e6`), which test the same thing.
- **D3. Tokenize first, decode after.** `&lt;a href…&gt;` is never a tag, and `./R&amp;D.md`
  resolves to `R&D.md`. The finding quotes the decoded URL, as a Markdown link's finding quotes mdast's
  decoded `url` today.
- **D4. Inside an `html` node, everything is HTML.** A fence or a code span inside an HTML block is
  rendered with its backticks as text and its `<a href>` as a link (measured), so it is read. This
  differs from `fencesInHtml` (`packages/md/src/model/prose.ts:235`), which sets such a fence aside
  for prose. That choice is about what an author means as an example; this one is about what
  renders as a link. A red here has a real remedy, measured: a blank line after the opening tag,
  which makes the fence render as code. Phase 1 adds a line to `fencesInHtml`'s docstring naming
  this difference, so neither is "fixed" to match the other.
- **D5. GFM's tagfilter elements do not change the tokenizer's state.** GFM shows `<script>`,
  `<style>`, `<textarea>`, `<title>`, `<xmp>`, `<iframe>`, `<noembed>`, `<noframes>` and
  `<plaintext>` as text, so an `<a href>` inside them renders as a link (measured for the first four)
  and is read. Their content is often a program, not a page (VitePress's `<script setup>`), so a tag
  start inside them that the tokenizer cannot finish is not reported (R3): its only remedy would be
  to delete code. "Inside" runs from the element's start tag to its matching end tag (the same name,
  any case). An element with no matching end tag in the node has no inside, so causes 1 and 2 apply
  after it.
- **D6. `<pre>` holds links** (measured). `[<a href="x">y</a>](z)` is two links, each URL written and
  each resolved.
- **D7. Outside `html` nodes, the owner scans each inline container's source:** a paragraph, a
  heading or a table cell (which ends where GFM splits the cell). A tag start is a literal `<a` or
  `<area` in the source, any case, followed by whitespace, `/` or `>`, that is preceded by an even
  number of `\` (so `\<a` is not one and `\\<a` is, Q4), and whose `<` lies inside a `text` node's
  source span. So a `<a` in an `html` or `inlineCode` node, in an image's alt text, in a link's title
  or in its destination is not a start (A1 to A4: GitHub renders none of them as a link); Q6's `<a` is
  in a `text` node, before its code span. An entity is source text, so `&lt;a`
  is not a tag start and a decoded `&amp;` before a real one does not hide it (Q5). From each start,
  §6.6 is applied over the container's source, with line endings as whitespace and container prefixes
  (`> `, list indentation) stepped over, up to the tag's `>` or the container's end, never stopping
  at an mdast node's end: micromark re-parses a refused tag's inside as Markdown, so emphasis,
  strikethrough or a code span splits it across nodes (Q1 to Q3, Q6, Q10). This is the grammar
  GitHub uses for inline HTML (P7, P8 and the unclosed quote render as text; P1, P3, Q2, Q4, Q5 and Q6
  render as links). A §6.6 tag with an `href` there is a tag micromark refused and a renderer links
  (R3).
- **D8. One prefix stepper.** The container-prefix stepping in `sourceOffsets`
  (`packages/md/src/model/phrasing.ts:76`) moves into the owner's module and is exported to
  `phrasing.ts`, so D7 and `mentions()` step prefixes one way and no second stepper is written.
- **D9. The scan is linear:** no nested quantifier over `[^>]*`. An `href` reaches only
  `resolveLink`'s index lookup, and nothing writes: an `href` gets no autofix (the review's first
  option). `movedLinkFix` depends on `writtenAt`, which accepts no closing quote
  (`packages/md/src/model/destination.ts:28`), and a fix for an attribute value is new work that no
  one has asked for.
- **D10. The owner's arch rule**, `md/one-html-attribute-reader`, in `arch.rules.ts` beside
  [ADR-019](../../../adr/019-a-code-blocks-language-tag-is-read-in-any-letter-case.md)'s
  (`arch.rules.ts:361`). Outside `html-attributes.ts`, no file under `packages/md/src` holds a regular
  expression literal whose source text contains `href`, `src`, `<a` or `<\/a`. `OPENS_A` and
  `CLOSES_A` (`packages/md/src/model/phrasing.ts:64-65` on `6bcd35e6`) move into the owner. What the rule cannot
  see is stated in its `because` ([ADR-016](../../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md)
  rule 7): a pattern built from a string (`new RegExp('href')`), `includes('href')`, and a pattern
  that spells the word another way (`h\x72ef`). Like its precedent, it has a nonvacuity row (the
  Test inventory): once `OPENS_A` and `CLOSES_A` move, the rule matches nothing, and only a fixture
  shows that it can still fail.

### What `links()` reads, and what it reports unread

- **R1. Read:** each `href` on an `<a>` or `<area>` start tag that the owner reads in an `html` node,
  in any letter case and any quoting. It becomes an `MdLink` at the line the `href` sits on, resolved
  by `resolveLink`, with no second resolver. `<area>` is read although GitHub removes it (measured):
  HTML defines it as a link, eess-md serves any Markdown corpus, and the docs say GitHub drops it.
  `<a title="a>b" href=…>` is read; the review listed it as unread, and the owner reads it because
  the tokenizer does.
- **R2. Not read, and not reported:** `:href`, `v-bind:href`, `data-href`, `xlink:href`, a component's
  `href` prop, and an `<a name>` or `<a id>` with no `href`, which is an anchor left to
  [bug 0136](../../bugs/fixed/0136-link-fragments-are-never-checked.md). The docs list each by name. _This
  overrules the review's decision 3 for `:href` and `v-bind:href`, which listed them as reported
  unread (the principle above)._
- **R3. Unread, with a cause.** The detector is the owner. Every `<a` or `<area` start the owner
  enters ends in exactly one of these, by construction:
  - **read** (R1);
  - **a cause** below;
  - **a named silence**, of which there are three: a start in an inline container that is not a §6.6
    tag (GitHub renders it as text, measured); a §6.6 tag in an inline container with no `href`
    (`<a name=a/b>`, Q7, an anchor left to
    [bug 0136](../../bugs/fixed/0136-link-fragments-are-never-checked.md), which this owner does not read for
    it); and an unfinished start inside a tagfilter element (D5).

  A suite row pins the invariant over every Measured row and every P, Q and B probe. The causes,
  decided in this order:

  | Order | Cause            | Where                                                                                                                                                   | Remedy (each verified to clear it in the suite)                                                                                |
  | ----- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
  | 1     | `split-tag`      | an `html` node ended by a blank line while the tokenizer is inside a tag and either outside a quoted value or inside one that holds no `>` so far (P15) | keep the tag inside one HTML block, with no blank line in it                                                                   |
  | 2     | `unterminated`   | every other `html` node that ends inside a tag: a quote that never closes (B3), or a block its container ended (B1, B2)                                 | close the tag inside the same HTML block: its quote or its `>`                                                                 |
  | 3     | `unquoted-slash` | an inline container holds a §6.6 tag with an `href` (D7) and an unquoted value holding `/`, which micromark refuses (Measured)                          | quote each named attribute's value; the finding names every attribute that holds a `/` ("quote `href`'s and `title`'s values") |
  | 4     | `refused-tag`    | an inline container holds a §6.6 tag with an `href` and no unquoted `/` value: a refusal no Measured row explains                                       | write the link in Markdown, `[text](url)`                                                                                      |

  Cause 4 exists so that a refusal nobody has measured is reported, never dropped; it is not
  expected while micromark's only divergence is the `/`. Its row drives the classifier with a
  synthetic refused tag, since no input reaches it today. The message says where the site is and its
  cause, and the remedy names the attributes.

- **R4. Subject side: an unread site is undecided in every `links()` rule.** It is asked of the rule's
  predicates as far as it is known (document, line, `sectionPath`, `block`, `blockPath`); `url`,
  `external`, the target, `text`, `definition`, `urlStart` and `urlEnd` are unknowable, so
  `areInternal()`, `areExternal()`, `haveLiveTargets()` and a `satisfy()` predicate that reads `.text`
  cannot decide it out. If no predicate decides it false, it is reported, whatever
  the conditions are (`resolve()`, `beLinkedBack()`, `satisfy()`, `notExist()`), as
  [ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) rule 4 says. Rule id
  `md/unread-link`, one finding per site per rule, at its line, carrying `bypassFilters` (rule 5).
  It is not counted in `examined` ([ADR-010](../../../adr/010-a-pass-is-constructed-from-evidence.md)).
  When every reached site is unread and nothing is read, the rule reports the unread findings and no
  zero-examined finding beside them (rule 7).
- **R5. One shared helper.** `reachedUnread` and `unreadFindings`
  (then in `mentions.ts`; built as `packages/md/src/builders/unread.ts:32`) become one helper, generic over the element and
  its "as seen" view, called by `mentions()` and `links()`. No copy is made. It counts each reached
  unread finding in the receipt's `undecided`, so the terminal withholds the generic zero-examined
  finding and `declaredEmpty` beside them (`packages/core/src/terminal-builder.ts:290`).
  `mentions()` does not do this today, and that is
  [bug 0602](../../bugs/fixed/0602-an-unread-mention-stands-beside-a-zero-examined-finding.md), which this
  plan closes: the same root cause on the same code path.
- **R6. Evidence side: an unread site in another subject's evidence.** The cause names the site,
  not the section or the target, so the kernel's deduplication (`undecidedViolations`,
  `packages/core/src/undecided.ts:65`) gives one finding per site per rule in predicate position, and
  the condition side emits one per site per rule too, however many nested sections or links reach
  it. A site the subject side (R4) already reported in this rule gets nothing more from this side.
  - `sections().haveLink()`: a section with no read link and an unread site is undecided, following
    `haveField`'s pattern (`packages/md/src/builders/have-field.ts:67`). In predicate position,
    `sectionsHolding({ kind: 'link' })` declares `undecided` (rule 1), so `.select()` and
    `matchingElements` refuse (rule 6) and `not(haveLink())` stays unknown (rule 2). In condition
    position, the unread finding replaces "has no link"; it does not sit beside it. A section with a
    read link and an unread site gets no unread finding.
  - `beLinkedBack()`: a target document with no read link back and an unread site is undecided for
    that pair. The unread finding replaces "does not link back", once per site per rule however many
    links point at that document ([ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)
    rule 5), at the site's line. A target with a read link back gets no unread finding.
- **R7. `links().select()` refuses** when its predicates reach an unread site
  ([ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) rule 6,
  [ADR-014](../../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)): a side of
  `correspondence()` built from it would otherwise drop the link without a word. `mentions().select()`
  has the same gap today, recorded as
  [bug 0600](../../bugs/fixed/0600-select-drops-an-unread-mention-without-a-word.md).
- **R8. `block` and `blockPath` for an `href`:** an HTML node is not an `MdLinkBlock`
  (`packages/md/src/model/links.ts:73`). An `href` takes the paragraph or list item that holds an
  inline `html` node, and only its enclosing list item when it sits in an HTML block (`blockPath`
  holds paragraphs and list items only, `packages/md/src/model/links.ts:193`).
  So `**Links:**` followed by a `<ul><li><a href>` HTML block is not declared.
- **R9. No new `MdLink` field.** How a link is written (`inline`, `reference`, `html`) is not
  exposed: no consumer needs it, and a field is added when one does, as `.definition` was for a
  reference-style link.

### What changes for each reader of `links()`

The changeset marks `**Breaking (@nielspeter/eess-md):**`, a minor on 0.x, as
[bug 0558](../../bugs/fixed/0558-a-reference-style-or-raw-html-link-is-never-examined.md) part (a) did. No
other package moves: eess-crossvalidate never calls `links()`. The changeset and `docs/markdown.md`
state each change, and each has a suite row:

- `.resolve()`: a broken `href` is red at its line; an unread site is `md/unread-link`.
- `.beLinkedBack()`, both directions: an `href` counts as a link to its target and as a link back; a
  commented-out one counts as neither; R6's replacement.
- `sections().haveLink()`: an `href` gives its section a link; R6.
- `areLabelled()` and `areInSection()`: per R8.
- `haveLiveTargets()`: reads an `href` into a frozen record as that record, like any link.
- `.select()`: the selected set grows by every `href` read; R7.
- `examined`: counts each `href` read, and no unread site.
- `MdLinkRef` for an `href`: `url` is the decoded value; `line` is the `href`'s own line inside a
  multi-line block; `block`/`blockPath` per R8; `.text` is the element's text, empty for
  `<a><img></a>` (13 of the 14 block-level links the review measured).
- Pinned because honest but surprising: `href=""` and a valueless `href` resolve as `self`;
  `href="#…"` resolves as `self`, its fragment left to
  [bug 0136](../../bugs/fixed/0136-link-fragments-are-never-checked.md); `javascript:` is external by
  `EXTERNAL_RE` (`packages/md/src/model/external.ts:6`); a templated `href` (`{{ site.baseurl }}`)
  is red as missing, as its Markdown twin is; JavaScript inside a `<script>` that builds a tag the
  tokenizer can finish (`"<a href=\"./x.md\">"`) is read and resolved (D5), and a broken one is an
  ordinary, suppressible finding; an unquoted `href` holding a full URL in a paragraph
  (`<a href=https://e.com/x>`) is reported as `unquoted-slash`, and GFM's autolink also reads the URL
  as an external Markdown link (Q8).

The docs state the subset where `links()` is described (`docs/markdown.md:232`), where `mentions()`
describes its `<a href>` cause (`docs/markdown.md:701`), and in the `links()` docstring
(`packages/md/src/builders/links.ts:149`), with one phrase for the construct where today there are
three. They name R2's attributes and that GitHub removes `<area>`.

## Phase 0: the review's changes (dispositions, 2026-11-01)

The proposal's Review ends: "[plan 0580] … carries the changes above as its acceptance criteria".
So the changes land here, in the Design above. The proposal's submission is kept, and its false
claims are annotated in place (PROPOSALS.md, "Corrections stay in the record"). This plan's first
draft said the changes would land in the proposal; that was this plan's mistake, and the
dispositions below correct it.

- [x] Record the corrections to the proposal's own text: `OPENS_A` is not a starting point for the
      scan; Ask A narrowed [bug 0558](../../bugs/fixed/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s
      measured scope without saying so; the entity example sat in a query string, where it cannot
      show decoding.
- [ ] Rewrite the Priority line for "resolve directly" — done-otherwise: annotated in place in the
      proposal (its Priority line carries the correction), and this plan's Priority states it.
- [ ] Scope — done-otherwise: R1 to R3, with `<area>` and the unquoted case measured on GitHub (the
      Measured section).
- [ ] The detector/reader split, named causes, remedies, [ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) precedence — done-otherwise: R3
      and R4.
- [ ] The false-green rows for `haveLink()` and `beLinkedBack()` — done-otherwise: the Test
      inventory, Phase 2.
- [ ] The attribute and context break classes, and the decision on a code span or fence inside an
      HTML block — done-otherwise: D1 to D7 (D4 for the fence), and the Test inventory.
- [ ] The autofix rule — done-otherwise: D9, no autofix for an `href` (the review's first option).
- [ ] The entity row in the path — done-otherwise: D3, and the Test inventory.
- [ ] The break statement and the impact on each reader — done-otherwise: "What changes for each
      reader of `links()`".
- [ ] Suite rows and two or three nonvacuity scenarios — done-otherwise: the Test inventory.
- [ ] [Bug 0136](../../bugs/fixed/0136-link-fragments-are-never-checked.md) named as a consumer of the
      owner — done-otherwise: the Status block's second decision.
- [ ] Open question 1 — done-otherwise: D1 and D7, a tag tokenizer of the owner's own (HTML's in an
      `html` node, CommonMark's in a `text` node), with no parser dependency and no ADR.

## Phases

1. **The attribute owner.** `html-attributes.ts` as designed (D1 to D10), with its arch rule.
   `mentions()` recognises an `<a href>` through it, and `OPENS_A`, `CLOSES_A`, `ONE_COMMENT` and
   `HTML_COMMENT` are replaced. That closes
   [bug 0593](../../bugs/fixed/0593-the-html-link-recogniser-matches-data-href-and-misses-a-quoted-angle-bracket.md)
   (`OPENS_A` matches `data-href` and misses `title="a>b"`), which moves to `fixed/` with this plan.
   The unread helper is shared (R5).
2. **`links()` reads `href`.** `collectLinkBlocks` (`packages/md/src/model/links.ts:117`) yields an
   `MdLink` per `href` the owner reads (R1), the owner's causes become `md/unread-link` findings on the
   subject side (R3, R4), `.select()` refuses (R7), and `block`/`blockPath` follow R8. The docs and the
   changeset state each reader's change.
   [Bug 0558](../../bugs/fixed/0558-a-reference-style-or-raw-html-link-is-never-examined.md) is closed
   done-otherwise against this plan.
3. **The evidence side (R6).** `sections().haveLink()` and `.beLinkedBack()` read an unread site as
   undecided, not as no link; and so does the declaration scan, which today says a label "stands
   alone with no list directly under it" when its list holds only an unread link (found by Phase 2's
   testing review; the same root, an unread site read as absent). _Split from Phase 2 on the build
   (2026-11-02), so each is one reviewable PR. Between the two, Phase 2 adds no false green: a
   section or a target whose only link is unread is read as having none, as before this plan: red
   with the wrong words in condition position, and, in predicate position (`.that().haveLink()`),
   left out without a word, as every `<a href>` was._

## Files changed

- Phase 1: `packages/md/src/model/html-attributes.ts` (new), `packages/md/src/model/phrasing.ts`,
  `packages/md/src/model/section-holds.ts` (its comment test), `packages/md/src/model/prose.ts` (one
  docstring line, D4), `packages/md/src/builders/mentions.ts` (the shared helper), `arch.rules.ts`,
  `scripts/check-nonvacuity.mjs` (D10's fixture),
  `work/bugs/0593-the-html-link-recogniser-matches-data-href-and-misses-a-quoted-angle-bracket.md`
  and `work/bugs/0602-an-unread-mention-stands-beside-a-zero-examined-finding.md` (to `fixed/`), and
  a changeset naming `@nielspeter/eess-md` for `mentions()`'s changes (R5, D2).
- Phase 2: `packages/md/src/model/links.ts`, `packages/md/src/builders/links.ts`,
  `packages/md/src/model/section-holds.ts`, `packages/md/src/predicates/section.ts`,
  `packages/md/src/builders/sections.ts`, `packages/md/src/conditions/linked-back.ts`,
  `docs/markdown.md`, `scripts/check-nonvacuity.mjs` and `scripts/nonvacuity/`, `.changeset/` (one
  changeset, marked Breaking, `@nielspeter/eess-md` minor),
  `work/bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md` (its disposition).
- Phase 3: `packages/md/src/model/unread-link.ts` and `packages/md/src/model/unread-finding.ts` (new),
  `packages/md/src/model/section-holds.ts`, `packages/md/src/conditions/section.ts`,
  `packages/md/src/predicates/section.ts`, `packages/md/src/conditions/linked-back.ts`,
  `packages/md/src/builders/links.ts`, `packages/md/src/builders/unread.ts`,
  `packages/md/src/builders/declaration-findings.ts`, `packages/md/tests/links-html-evidence.test.ts`
  (new), `docs/markdown.md`, `.changeset/an-unread-link-is-undecided-evidence.md`, and the close: this
  plan to `completed/`, [proposal 022](../../proposals/promoted/022-md-a-raw-html-link-is-resolved.md) to `promoted/`, the boards.

## Test inventory

Each suite row goes red under its own sabotage; a case that produces nothing is a suite row, never
a nonvacuity row. Every Measured row with a micromark result is a suite row, so a micromark upgrade
that changes one reds it (line 573's divergence included).

- **Phase 1, the owner:**
  - attributes: `href=` inside another attribute's value is not `href`; `data-href`, `:href` and
    `xlink:href` are not `href`; spaces around `=`; a tag over several lines; `<A HREF>`; single
    quotes; `<a href=docs/>` reads `docs/`; `title="a>b"`; no space between attributes (P9);
    `@click` before `href` (P10); the first of two `href`s; a valueless `href` is `""`;
  - decoding: `&lt;a href…&gt;` is not a tag; `./R&amp;D.md` decodes to `./R&D.md`;
  - context: a comment and a CDATA section inside a larger node are cut out; a tag start inside
    another tag's quoted value is not a tag; a fence and a code span inside an HTML block are read
    (D4); `<script>` and `<textarea>` content is read and an unfinished tag start there is not
    reported (D5); `<pre>` content is read; an unclosed `<textarea>` followed by P15's split is
    `split-tag` (D5);
  - inline containers (D7): P1, P3, P5, Q1 to Q3, Q5, Q6, Q10 and the unquoted-`/` row are §6.6
    tags with an `href`, each found whole although micromark split it; P7, P8, `foo=bar=baz` and the
    unclosed quote are not; `\<a` and `&lt;a` are not tag starts, and Q4's `\\<a` is; Q7 is a tag
    with no `href`; A1 (a tag in an image's alt) and A3 (in a link's title) are not starts and give
    no finding;
  - the invariant: every `<a`/`<area` start the owner enters is read, given a cause, or in one of
    the three named silences, over a fixture holding every Measured row and every P, Q and B probe;
  - `isOnlyComment` (D2): `mentions()` and `sections()` treat a node that is only a bogus comment
    (`<!DOCTYPE html>`, `<?x?>`) as they treat a comment, one row each, and the changeset says so;
  - `mentions()`'s existing `'html-link'` tests green, plus a `data-href` row that no longer matches
    and a `title="a>b"` row that now does
    ([bug 0593](../../bugs/fixed/0593-the-html-link-recogniser-matches-data-href-and-misses-a-quoted-angle-bracket.md));
    `mentions()`'s unread findings unchanged through the shared helper (R5), except that a rule over
    only unread mentions no longer adds the zero-examined finding or `declaredEmpty`
    ([bug 0602](../../bugs/fixed/0602-an-unread-mention-stands-beside-a-zero-examined-finding.md)'s rows).
- **Phase 2, `links()`:**
  - read: a broken `href` red at its own line inside a multi-line block, inside a blockquote, and
    inside a `<details>` fence; `./R&amp;D.md` resolves against `R&D.md`, and the finding quotes the
    decoded URL; an `<area>` read;
  - each cause in R3 at its line with its remedy's text, and each remedy clearing it: `split-tag`
    (P15); `unterminated` on B1 and on B3 with its later paragraph in place; `unquoted-slash` on P1
    (naming `title`), on `href=./x.md title=a/b` (naming both), on P3 and on Q2; `refused-tag` through
    the classifier with a synthetic refused tag; P7, P8, Q7 and an escaped `\<a` give no finding of
    any rule id;
  - the subject side (R4): `resolve()`, `beLinkedBack()`, `satisfy()` and `notExist()` each report an
    unread site their predicates reach; `resideInFile` deciding a site out reports nothing for it;
    `areExternal()` cannot decide one out;
  - unsuppressable (R4): `.excluding(/.*/)` does not hide `md/unread-link` and the finding carries
    `bypassFilters`, the twin of
    `packages/md/tests/builders/mentions.test.ts` · `it('an unread mention is unsuppressable: .excluding() does not hide it')`;
    `.warn()` and a baseline do not hide it either;
  - the evidence side (R6): a section whose only link is unread is undecided under `.that().haveLink()`
    and `.select()` throws; under `.should().haveLink()` it is `md/unread-link`, not "has no link"; a
    section with a read link and an unread site gets no unread finding; a target whose only link back
    is unread gets `md/unread-link` once, not "does not link back"; one with a read link back gets
    none;
  - a commented-out `<a href>` is not a link back and does not satisfy `haveLink()`;
  - `.select()` refuses when it reaches an unread site (R7);
  - R8: an `href` in a top-level HTML block has no `block`; `**Links:**` above a `<ul>` HTML block is
    not declared;
  - an external `href`, `href=""`, a valueless `href`, `href="#x"`, an `<a name>` and a `:href`
    produce no broken-link finding;
  - `examined` counts each `href` read and no unread site; a rule whose only reached sites are unread
    reports them and no zero-examined finding (rule 7); `links().should().notExist()` over only
    unread sites has no `declaredEmpty`;
  - the reader-impact list: one row each for `areLabelled()`, `areInSection()`, `haveLiveTargets()`,
    `.select()` and `.text` on `<a><img></a>`.
- **Nonvacuity:** one fixture script, three scenarios, each asserting its message and cause: a readable
  broken `href` in a `<div>` block (an emptied reader reds it); an `unquoted-slash` site in a paragraph
  (an emptied text-node detector reds it); an `unterminated` site in a `<div>` block (an emptied
  `html`-node detector reds it). Plus D10's gate row, as `arch/one-code-block-tag-comparison` has
  one (`scripts/check-nonvacuity.mjs:859`): a fixture writes `/href/` into a file under
  `packages/md/src` outside the owner and expects `md/one-html-attribute-reader`.
  [Bug 0552](../../bugs/0552-nonvacuity-shard-3-runs-near-its-timeout.md)'s shard is near its timeout,
  so the build measures the four rows' cost and says which shard takes them.

## Out of scope

- Links built by script, and HTML outside the Markdown documents.
- An autofix for an `href` (D9).
- `<img src>`: [proposal 024](../../proposals/024-md-an-images-file-exists.md) Ask B, on Phase 1's owner.
- A fragment in an `href`: resolved as `self` here, checked by
  [bug 0136](../../bugs/fixed/0136-link-fragments-are-never-checked.md).
- `mentions()` still reporting an `<a>`'s text as unread while `links()` resolves its `href`: recorded
  as [bug 0601](../../bugs/fixed/0601-a-mention-inside-an-html-link-is-reported-unread-though-the-link-is-read.md).
- `mentions().select()` dropping an unread mention: [bug 0600](../../bugs/fixed/0600-select-drops-an-unread-mention-without-a-word.md).
- A local link with a query string never resolving: fixed by
  [bug 0583](../../bugs/fixed/0583-a-local-link-with-a-query-string-never-resolves.md).

## Review — 2026-11-01 (the freeze re-check)

Architect and enforcement, on the freeze at af342dec. Both said Not ready. What changed:

- **Two silent false greens (enforcement C1, C2).** Inside an HTML block the §6.6 reader rejected
  tags a browser links (P9, P10), and no cause caught them; a tag start followed by a newline was
  exempted (P3). Now the owner is an HTML tokenizer inside an `html` node (D1), §6.6 applies only in a
  `text` node up to the tag's `>` (D7), and every start the owner enters ends read, with a cause, or
  in one of two named silences (R3). The GitHub renders behind it were measured (Measured: P1, P3,
  P7 to P10, CDATA, the alt value, the duplicate and valueless `href`, D4's remedy).
- **Subject and evidence (architect C1, I1).** Reporting depended on the condition; now a site is
  decided by the rule's predicates on the subject side (R4), and the evidence side follows
  `haveField` (R6).
- **Causes (enforcement I1, I2; architect I4).** Ordered from the source, three causes, a remedy that
  names the attribute; prose that reads like a tag and is not a §6.6 tag is silent, as GitHub
  renders it as text.
- **Cut, as the review allowed:** no autofix for an `href` (D9; `writtenAt` takes no closing quote,
  architect I3, enforcement I6).
- **`.select()` (architect I2):** refuses (R7); `mentions()`'s same gap is
  [bug 0600](../../bugs/fixed/0600-select-drops-an-unread-mention-without-a-word.md).
- **Raw text (architect I5):** read what parses; an unfinished tag start there is not reported (D5).
- **Reuse (architect I6, I7, I8):** one unread helper (R5), one offset walk (D8), one comment test
  (D2), the arch rule's matcher and blind spots (D10), `blockPath` for an HTML block (R8).
- **Rows (enforcement I3, I4, I5, M7):** `bypassFilters`, the subject side under four conditions, the
  evidence side both ways, nonvacuity scenario 3 in a block, one row per reader change.
- **Minor:** `title="a>b"` marked as a change (R1); `docs/markdown.md:701` restored; no `MdLink`
  marker (R9); the principle stated once; the follow-up given a home
  ([bug 0601](../../bugs/fixed/0601-a-mention-inside-an-html-link-is-reported-unread-though-the-link-is-read.md));
  rule 7 stated; the owner kept internal; dogfooding stated (Measured).

### Second re-check — 2026-11-01

Architect and enforcement, on the revision at 45ae72b8. Both said Ready with changes, no Critical,
no further design round. What changed:

- **D7's bound (architect I-new-1, enforcement I1).** A refused tag is re-parsed as Markdown and split
  across nodes, so stopping at the text node's end was a silent false green (Q1 to Q6, Q10; Q2, Q4,
  Q5 and Q6 rendered as links on GitHub). D7 now scans the inline container's source, counts
  backslashes, and skips `html` and `inlineCode` spans.
- **The causes (enforcement I2, I4, M3).** `unterminated` is the else-branch; `split-tag` is exact
  (B3 is `unterminated`, as GitHub shows no link); cause 4 reports a refusal nobody has measured;
  `unquoted-slash` names every attribute holding a `/`.
- **Rule 7 (architect I-new-2).** The shared helper counts unread findings in `undecided`, which
  fixes `mentions()` too:
  [bug 0602](../../bugs/fixed/0602-an-unread-mention-stands-beside-a-zero-examined-finding.md) (measured,
  same code path), closed by this plan.
- **D10 (enforcement I3, M5).** A nonvacuity row, and a matcher on the words with its blind spots.
- **Minor:** one finding per site per rule on both sides, and none twice (architect M1, M2); D5's
  span and the finishable tag in a script (M3, M4); R8 without blockquote (M4); R4's unknowable
  fields (M5); Q7 a named silence (enforcement M1); `isOnlyComment`'s consumers (M2); Q8 in the docs
  (M6).

A verification pass the same day (architect: applied, with
[bug 0602](../../bugs/fixed/0602-an-unread-mention-stands-beside-a-zero-examined-finding.md)'s root cause
corrected; enforcement: D5's "inside" misapplied, and D7's start set too wide, A1 to A4) gave one
clause and one row each: an unclosed tagfilter element has no inside, and a start's `<` lies in a
`text` node.

## Build notes

### Phase 1 — 2026-11-02, PR #296

Built as frozen, except where noted. Each difference is a decision on the build, overrulable:

- **The owner** (`packages/md/src/model/html-attributes.ts`): `tokenizeHtml`/`readHtmlNode` (D1,
  D2, D5), `openTagAt`/`inlineTagStarts`/`inlineTagStartsOf` (D7), `isLinkStart`, `isOnlyComment`,
  `decodeReferences`. Its 43 rows are `packages/md/tests/html-attributes.test.ts`, one per Measured
  row or probe the owner decides.
- **The decoder.** No entity decoder was a dependency of eess-md. `decode-named-character-reference`,
  which micromark already installs to decode a Markdown link's URL, is now a direct dependency: it
  adds no package to an install. A reference is decoded only with its `;`, as CommonMark decodes one.
- **No source span (D1 differs).** The owner returns each attribute's line, not its source span: D9
  cut the autofix, which was the span's only consumer.
- **D8 differs.** `sourceOffsets` is not moved. Its prefix stepper is steered by the decoded
  character it is looking for, and D7 has none, so D7 steps `> ` by the container's blockquote depth
  instead. One stepper each, in their own modules.
- **R5, in part.** The shared helper (`packages/md/src/builders/unread.ts`) holds `reachedUnread`
  and the receipt (`withUnread`, which counts unread findings as undecided:
  [bug 0602](../../bugs/fixed/0602-an-unread-mention-stands-beside-a-zero-examined-finding.md)). Each
  builder keeps its own finding text, since a mention's message and a link's differ.
- **D10** is `md/one-html-attribute-reader`, as frozen. Its nonvacuity row,
  `arch/md-one-html-attribute-reader`, is one run of one probe, every alternative on its own line, the rule
  required on exactly lines 1 to 4 (3 s); with `src` dropped from the matcher it fails, naming line 2.
- **Measured on the build:** a `<script>` holding `"<a href=\"" + u` finishes its tag at
  `</script>`'s `>`, as the HTML tokenizer does, so it is read, not silenced; a quote that never
  closes (`'<a href="' + u`) is what D5 silences. A `<textarea>` opens a type-1 HTML block, which a
  blank line does not end, so P15's split after an unclosed one needs a `<div>` around it.
- **Sabotage, each red then green:** the old `OPENS_A` back (2 rows of
  [bug 0593](../../bugs/fixed/0593-the-html-link-recogniser-matches-data-href-and-misses-a-quoted-angle-bracket.md)),
  the unread count removed (2 rows of
  [bug 0602](../../bugs/fixed/0602-an-unread-mention-stands-beside-a-zero-examined-finding.md)'s), the old one-comment pattern back (1 row), `src`
  dropped from D10's matcher (its nonvacuity row).
- **Code review (architect · enforcement, 2026-11-02), both Approve with changes; applied:**
  `mentions()` opened an HTML link on a void `<area>`, swallowing the rest of the paragraph (now `<a>`
  only); the four comment closers `<!-->`, `<!--->`, `-->`, `--!>` and `</` before a non-letter (a
  bogus comment) are read as the tokenizer reads them, in both the tokenizer and `isOnlyComment`;
  "ended by a blank line" no longer counts the end of the document, and steps a quote's `>`; only a
  start tag is reported unfinished; an end tag closes its element only by its own name
  (`</scripts>` closes no `<script>`); §6.6's whitespace has no form feed; D7 skips a start inside a
  tag it already found (`title="<a href=…>"`); `inlineKind` is the seam the `refused-tag` row drives.
  Each with its row, and each row red under its own sabotage (the end-of-document blank, `<!-->`
  unread, `<area>` opening, the consumed span, the dedupe). Not done here: a shared constructor for
  an unread finding's `bypassFilters` (Phase 2, when `links()` adds the second), and deleting the
  three `eess-exclude` comments on `tokenizeHtml`, `attributeOf` and `inlineTagStartsOf` once Phase 2
  imports them (stale then, and reported). Phase 2 also reads an `html` node that micromark made
  inside a refused tag's quoted value as that value, not as a link.
- **For Phase 2, from the review's verification pass and PR #296's testing review (no Phase 1
  caller reads `unfinished`, verified by the testing review, so none changes a verdict today):**
  `split-tag` is decided from the text before the cut, but its remedy depends on the text after it.
  Four inputs get `split-tag` where removing the blank line leaves the tag `unterminated`: a blank
  line that ends a blockquote, a blank line and then the end of the document, a list item whose next
  line is not indented, and an unclosed quote cut before a paragraph with no `>` (this last follows
  R3 as frozen, so R3's `split-tag` definition is a Phase 2 review question). Phase 2 decides
  `split-tag` by its remedy (does the tag finish inside the same block once the blank line is gone?),
  with a row for each of the four; and `readHtmlNode`'s `depth` becomes required, so a caller cannot
  leave it at 0 and bring E3 back.
- **Deferred to Phase 2: the R3 invariant row** ("every start ends read, with a cause, or in a named
  silence"). Each Measured row and probe has its own row here; the invariant across both scans
  guards what `links()` will report, so it is built with its first consumer.
- **PR #296's testing review (a fresh lens, 2026-11-02), Approve with changes; applied:** a row that
  only `</a>` closes an HTML link in `mentions()` (red when any end tag closes it); the
  `haveContent()` rows assert the finding, not a count; the HTML-link cause joins
  `corpus/record-mention/unread`'s probe in the same run (red with `isLinkStart` emptied); a note that
  D10's owner exclusion is not exercised; the changeset names four more verdict changes. Recorded, not
  fixed here: [bug 0603](../../bugs/0603-an-unread-box-stands-beside-a-zero-examined-finding.md),
  `taskItems()` with
  [bug 0602](../../bugs/fixed/0602-an-unread-mention-stands-beside-a-zero-examined-finding.md)'s shape.
- **Pointers.** Code pointers into `mentions.ts`, `phrasing.ts` and `section-holds.ts` that moved
  were renumbered; those naming code this phase removed (`OPENS_A`, `ONE_COMMENT`, `HTML_COMMENT`)
  are pinned "on `6bcd35e6`", the house form for code as it was.

### Phase 2 — 2026-11-02, PR #297

Built as frozen, except where noted:

- **Split (above):** R6 is Phase 3.
- **`split-tag` decided by its remedy** (the Phase 1 note): the owner parses the document again with
  the blank line removed, and keeps `split-tag` only when the tag then finishes in its block
  (`finishesOnceJoined`); the parser decides whether the block runs on, not a second reading of quotes
  and list items. Rows: the four inputs that are now `unterminated`, and P15 and E3 still `split-tag`.
  `readHtmlNode` takes its context as a required argument (`{ source, depth }` or `'no-source'`).
- **The link walk** (`model/links.ts`) reads each `html` node through the owner and each paragraph,
  heading and table cell through `inlineTagStarts`, with the blockquote depth passed down; an `<a>`'s
  `.text` is `elementText` in a block, or the inline nodes up to its `</a>`. `unreadLinksOf` gives the
  unread sites with their `sectionPath`.
- **The builder** (`builders/links.ts`): `md/unread-link` (exported as `UNREAD_LINK`), one finding per
  site per rule, through the shared `unreadFinding`, which now owns `bypassFilters` for `mentions()`
  too (the review's M5); `select()` refuses through the kernel's `refuseUndecided`.
- **`check:corpus` counts its links from the rule's receipt** (`examined`), not `.select()`: with R7,
  a selection refuses at an unread link, which there is a finding to report, not a crash. Its count is
  unchanged (8,127 internal links today).
- **Nonvacuity:** one row, `corpus/links/html`, one probe through the production gate, three sites
  each asserted by its message (a readable broken `href` in a block, an unquoted-`/` site, an
  unterminated tag), one pair of `check:corpus` runs (16 s); red, naming the read site, with the HTML
  reader emptied.
- **The invariant row** (deferred from Phase 1) is built at the `links()` level, over every Measured
  row and P, Q and B probe: each input ends read, with a cause, or silent, as listed.
- **Sabotage, each red then green:** the HTML reader emptied, the inline scan emptied, the unread
  findings dropped, `select()` not refusing, `split-tag` always kept, `bypassFilters` false, the
  blockquote depth not counted (by the E3 row, added at the `links()` level for it).
- **Review (architect · enforcement · a fresh testing lens, 2026-11-02), each Approve with changes;
  applied:** `split-tag` matched by the tag's offset in its block, not its line, which an earlier
  tag can share; the whole run of blank lines removed for the check; an inline `<a>`'s `.text` cuts
  tags (`Read <b>this</b>` is `Read this`, an `<img>` alone is empty); the inline kinds in an
  exhaustive `switch`, so a new kind does not compile until it is handled; `inlineTagStartsOf`
  deleted (its rows walk containers in the test); the link walk memoized per tree (`check:corpus`
  8.04 s before, 7.62 s after, one run each); `check:corpus` counts unread links apart from broken
  ones; rows for each sabotage that stayed green: a heading, a quoted paragraph and a quoted table
  (the inline scan's depth), an unfinished `<area>`, `areInSection()` and `areLabelled()` reaching an
  unread site and deciding out one elsewhere, a `.text`-reading predicate, the positive
  `beLinkedBack()`/`haveLink()` through an `href`, the zero-examined sentence; the invariant table
  asserts each site's line and cause. Eleven sabotages, each red, the last a compile error.
- **The reviews' confirmation pass** (all three: applied) found three minors, fixed with rows:
  `split-tag`'s remedy says "the blank lines", since the check joins the whole run; an inline `<a>`'s
  `.text` collapses whitespace as the block path does; the memoized walk's arrays are typed read-only,
  so the compiler holds every caller to not writing them.
- **Shards:** `corpus/links/html` runs in shard 4 and `arch/md-one-html-attribute-reader` in shard 2
  (position mod 4, read from a full run's order), not
  [bug 0552](../../bugs/0552-nonvacuity-shard-3-runs-near-its-timeout.md)'s shard 3.
- **The baseline row** of the inventory is the `bypassFilters` assertion: a baseline keys on that
  field, and the kernel's own tests pin it, as for `mentions()`.
- **`.warn()`** on a rule with an unread link throws, as a terminal escalates an unsuppressable
  finding; the row asserts the thrown violations. A baseline keys on `bypassFilters`, which the row
  asserts; the kernel's own tests pin a baseline's handling of it.

### Phase 3 — 2026-11-03, PR #300

Built as frozen (R6), with the declaration scan the Phase 2 review added to it:

- **One home for the unread-link finding.** The conditions need it and may not import a builder, so
  `UNREAD_LINK`, the cause texts, the remedies and `unreadFinding` (the one owner of
  `bypassFilters`) moved to `model/unread-link.ts`; `builders/links.ts` and `builders/unread.ts`
  import it.
- **`sections().haveLink()`:** `undecidingLinks` (`model/section-holds.ts`) gives a section's
  unread links when it holds no read one. After `.should()` each is `md/unread-link`, once per site
  per rule however many nested sections hold it, in place of "holds no link"; after `.that()` the
  predicate declares `undecided` and its `test` refuses, as `predicateHaveField` does, so the
  kernel reports the site and `.select()` refuses.
- **`beLinkedBack()`:** a live target with no read link back and an unread link is reported at that
  link, once per site per rule, in place of "does not link back"; a frozen target keeps its own
  finding. The subject side skips a site the condition already reported in the same rule.
- **The declaration scan** counts an unread link's blocks as enclosed, so its label is not "empty".
- **Rows:** `packages/md/tests/links-html-evidence.test.ts`, eleven, each position both ways.
  `not(haveLink())` is the kernel's strong Kleene over `undecided` and has no row here, since
  `sectionsHolding` is not on the root.
- **Sabotage, each red then green:** the condition saying "holds no link", the predicate without
  `undecided`, `beLinkedBack()` ignoring the unread link, the subject side duplicating a site, the
  declaration scan ignoring unread links, and each of the two site dedups removed.

- **Phase 3's review (architect: Approve; enforcement and method: with changes), applied:** a site is
  keyed by its document, line and remedy (`unreadSiteKey`), so two causes on one line are two findings
  ([ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) rule 5) in all three dedups; after `.that().haveLink()` the kernel's undecided finding
  carries the site's remedy in its message, and `unread-link.ts` no longer claims the site reads the
  same there; `unreadFinding` is in `model/unread-finding.ts`, not a module named for links; rows for
  two sites on one line (both readers), the remedy in predicate position, a section with a read and an
  unread link selected, and a frozen target keeping its own finding, each red under its sabotage.
  The close: the three Breaking changesets annotated on the decision, Files changed for Phase 3,
  [bug 0605](../../bugs/0605-promoted-means-a-plan-owns-the-ask-but-the-lane-promotes-when-it-ships.md)
  narrowed now that 022 left its scope, and [proposal 022](../../proposals/promoted/022-md-a-raw-html-link-is-resolved.md) naming
  [bug 0601](../../bugs/fixed/0601-a-mention-inside-an-html-link-is-reported-unread-though-the-link-is-read.md)
  for the part of its decision 2 this plan did not build.

- **Two loose ends, closed in writing.** Of the three test-only `eess-exclude` comments Phase 1
  named, `attributeOf`'s went when Phase 2 imported it and `inlineTagStartsOf` was deleted;
  `tokenizeHtml`'s stays, correctly, since nothing under `src` imports it (`readHtmlNode` wraps it),
  so its exclusion is true and not stale. And two sites on one line with the same remedy (two
  `<a href=./x/y.md>`) share a key and give one finding until the first is fixed: the docstring says
  the split is by cause and attributes, the remedy clears both, and nothing goes green. This departs from R4/R6's "one finding per site per rule" wording (the key
  is the document, line and remedy, not the site itself); overrulable.

- **The fresh testing review of PR #300 (Approve with changes), applied:** the subject-side dedup this
  phase added could leave `withUnread` with no findings and drop the rule's own predicate causes
  ([ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) rule 5); it now returns early only when both are empty, with a row driving a custom
  predicate's cause through `beLinkedBack()`. Rows also for: the nested-section row asserting the
  whole list (a "holds no link" beside the site reds it); every other holding ignoring an unread
  link, in both positions; `test()` refusing an undecided section for a caller that skips
  `undecided()`; one undecided finding per site across nested sections, and two for two causes on one
  line, in predicate position; and the subject side keeping another document's site. `sectionsHolding`
  declares `undecided` for `link` only, so the other holdings keep the kernel's two-valued fast path,
  and `beLinkedBack()` reads a target's unread links once per target. The changeset and docs say that
  after `.that().haveLink()` the finding is the rule's own undecided one, with the remedy in its
  message, and name the same-remedy collapse; the `haveLink()` docstring names HTML links.
- **No nonvacuity row for Phase 3, on purpose.** The one dogfood gate it reaches is `check:corpus`'s
  `areLabelled('Extends').should().beLinkedBack()`; an emptied evidence side falls back to "does not
  link back", still red, which the existing production rows keep asserting. The predicate-position
  red is reached by no gate, and the suite imports `../src`, so it sees a source mutant with no rebuild.
- **How the sabotage matrices ran:** each mutant was a one-string replacement in the source, asserted to
  apply exactly once, run against the phase's test files from a green baseline, and the file restored
  from a copy and compared byte for byte; the rows import `../src`, so no `dist` was involved. One
  mutant in this round (dropping a site in any file the condition had reported) stayed green because it
  was not the defect the row guards; the review's mutant (dropping every site once any is reported)
  reds it.

## Progress ledger

- [x] Reviewed, as [proposal 022](../../proposals/promoted/022-md-a-raw-html-link-is-resolved.md)'s Review
      (architect · product · enforcement), 2026-11-01
- [x] Freeze written: the review's changes, the measurements, the open question answered (2026-11-01)
- [x] Freeze re-checked (architect · enforcement), 2026-11-01: Not ready; revised (Review above)
- [x] The revision re-checked by the same lenses, 2026-11-01: Ready with changes; changes applied
      (Second re-check above)
- [x] Ready (2026-11-01)
- [x] Phase 1 — the attribute owner (PR #296; Build notes below)
- [x] Phase 2 — `links()` reads `href` (PR #297; Build notes below)
- [x] Phase 3 — the evidence side (R6) (PR #300; Build notes below)
- [x] Sabotage matrix, all red (each phase's Build notes)

Deferred: none
