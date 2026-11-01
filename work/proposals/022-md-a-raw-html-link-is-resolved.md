# Proposal 022 — md: a raw HTML link is resolved

**State:** Draft — filed 2026-10-30 at the maintainer's request; amended the same day from PR #280's reviews; reviewed 2026-11-01 (architect · product · enforcement), Ship with changes, owned by [plan 0580](../plans/0580-md-a-raw-html-link-is-resolved.md) — see "Review — 2026-11-01".
**Priority:** Medium — once [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)
reports a raw HTML link as unread, nothing passes over one silently; what is left is that a
corpus that writes links in HTML is red with "unread" instead of checked.
**Origin:** self-found · the maintainer, 2026-10-30: "GitHub Flavored Markdown (GFM) is important".
**Affects:** `@nielspeter/eess-md` (the link walk).

## Problem

GFM lets a document hold raw HTML, and GitHub READMEs use it for what Markdown cannot say: a
centred logo with a link, a `<details>` block holding links, a table cell with a line break.
`<a href="./target.md">` in such a block is a link to a reader. eess-md never selects it
([bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)), and once that
bug is fixed it reports it as unread. This proposal is the step after: read the `href` and resolve
it like any other link.

## Measured

On the v0.16.0 build (eess-md 0.13.0), one document holding `<a href="./gone-html.md">raw
html</a>` and one inline link to a missing file: `links(c).should().resolve()` examines 1 link and
reports the inline one only. The reproduction is
[bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s.

## Existing code survey

- **The link walk** reads `link` nodes and, since
  [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s part (a), defined `linkReference`
  nodes (`packages/md/src/model/links.ts:197`); an `html` node is not scanned.
- **Resolution is `resolveLink`**, one resolver for every case ([plan 0404](../plans/completed/0404-md-one-link-resolver-names-each-case.md)). An `href`
  is a URL like any other, so resolution needs no second resolver: the new part is finding the
  URL in HTML.
- **Unread disclosure exists**: `mentions()` reports a mention inside a raw HTML block as
  `md/unread-mention` (`packages/md/src/builders/mentions.ts:49`).
- **An inline `<a href>` recogniser exists:** `OPENS_A = /^<a\s[^>]*\bhref\s*=/i`
  (`packages/md/src/model/phrasing.ts:64`), which `mentions()` uses to report a mention in an inline
  HTML link as unread. It reads inline HTML only; a block-level `html` node is a separate cause
  (`'html-block'`). It is the reuse point for
  [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s unread finding and the
  starting point for this proposal's scan.
- **The closest precedent** is [proposal 015](./015-md-wikilinks-are-read-or-reported.md), "read, or
  reported as unread", for another link form `links()` does not read.
- **No HTML parser is a dependency** of eess-md today (its dependencies are the mdast and
  micromark packages, `picomatch` and `yaml`).

## Asks

- **A — resolve `href`.** An `href` on an `<a>` element in a raw HTML node is a link: selected by
  `links()` at its own line and resolved with `resolveLink`, so a broken one is reported like an
  inline link.

## Acceptance criteria

- **Break class:** `<a href="./gone.md">` reports a broken link at its line.
- **Break class (false red):** an `href` in a code span or fenced block is not a link; an
  `href` to an external URL is external.
- **Break class:** HTML the reader cannot parse is reported as unread, never skipped; this keeps
  [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s guarantee.
- **Break class (false red):** an `href` inside an HTML comment, an `<a name>` with no `href`, and
  an external `href` produce no broken-link finding; an entity-encoded `href` (`&amp;`) is decoded
  before it is resolved.
- **Evidence:** `examined` counts each `href` read, and a finding is reported at the line the
  `href` sits on inside a multi-line HTML block, not the block's first line.
- **Non-vacuity:** a fixture row per break class.
- **Dogfooding:** this repository holds no `<a href>` in a tracked Markdown file today (PR #280's
  method review), so `check:corpus` gains nothing to read; the rows are the proof.

## Open questions

1. **How to read HTML.** A small attribute scan over `html` nodes, which needs no dependency and
   reads a subset of HTML, or an HTML parser as a new dependency. Either must say what it does not
   read.
2. **Other attributes.** `<img src>` is an image: [proposal 024](./024-md-an-images-file-exists.md)'s
   Ask B, on this proposal's scan.

## Out of scope

- Links built by script, and HTML outside the Markdown documents.

## Review — 2026-11-01

**Ruling: Ship with changes**

Reviewed by the architect, product and enforcement lenses, each on its own survey of the code, on
`main` at `bd78b962`. The architect and product lenses said ship with changes; the enforcement lens
said the acceptance criteria must be rewritten before a plan. No lens disputes the shape of the ask.
Every critical finding is about scope, about a criterion that cannot fail, or about the decision
[bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s Fix 2 held open.
That decision is now taken (below), so the ask is ready to plan with the changes listed here. The
owner is [plan 0580](../plans/0580-md-a-raw-html-link-is-resolved.md).

The design is right. Widen `links()` inside eess-md and resolve each `href` with `resolveLink`
([plan 0404](../plans/completed/0404-md-one-link-resolver-names-each-case.md)), which already serves
every other link. Keep `MdLink` as the one element type, with no `htmlLinks()` builder; a marker for
how the link is written, like `.definition` for a reference link, is plan detail, and a predicate on
it is new only if someone asks, checked then against
[ADR-023](../../adr/023-a-predicate-and-a-condition-that-share-a-word.md). It adds no kernel change.
HTML, `href` and links are eess-md's concepts; no other dialect has a use for them, and
eess-crossvalidate imports no `links()`, so only `@nielspeter/eess-md` moves. Real READMEs use the
construct: in 607 READMEs measured by the product lens, 49% hold raw HTML and 17 (2.8%) hold an
internal `<a href>`; d3-dsv's README holds about 40 hrefs missing their `#`, broken on GitHub too.

### Decisions

Each decision below can be overruled; its basis is stated so that it can be.

1. **Resolve directly, not unread first. This settles the open decision in
   [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s Fix 2.** GFM
   passes raw HTML through, and GitHub renders `<a href>` as a link, so reading it fixes no
   document's shape ([ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md)). Unread
   first would make every `<a href>` an unsuppressable finding
   ([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) rule 5). For a logo
   sized with `width`, or a link with `target`, the only remedy would then be to delete a correct
   link, which breaks [ADR-009](../../adr/009-agent-first-failure-surfaces.md) rule 2: a remedy
   must be real. The other way out, unread findings suppressible per cause, would amend [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)
   rule 5. Resolving gives a broken `href` a real remedy: fix the target. A tag the reader cannot
   parse is still reported as unread, under named causes, with the remedy "write it in a form
   eess-md reads". Adopters take one break on this construct, not two. So [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s HTML half
   closes done-otherwise against [plan 0580](../plans/0580-md-a-raw-html-link-is-resolved.md), and
   this proposal's Priority line, which assumed unread first, is superseded (see the corrections).
2. **One owner for reading HTML attributes.** Today the only HTML recogniser is `OPENS_A`
   (`packages/md/src/model/phrasing.ts:64`). It answers yes or no and pulls out no value, and
   `mentions()` uses it (`packages/md/src/model/phrasing.ts:203`) only to report a mention in an
   inline `<a>` as unread, cause `html-link`. Three records are queued on the same reader: this
   proposal (`href`), [proposal 024](./024-md-an-images-file-exists.md) Ask B (`src`, and `srcset`
   per entry), and [spike 0574](../spikes/0574-what-checking-a-link-fragment-needs.md) decision 2
   for [bug 0136](../bugs/0136-link-fragments-are-never-checked.md), which reads `id` and `name`
   anchors "from `html` nodes with comments removed". The plan builds one model owner that reads
   `href`, `src` and `id`/`name`: given an `html` node and the source, it returns tag, attribute,
   decoded value, source span and line, with comments cut out. The architect suggests
   `packages/md/src/model/html-attributes.ts`. `links()`, a future `images()`, the anchor sets and
   `mentions()` all read from it, and an arch rule gates it, as
   [ADR-019](../../adr/019-a-code-blocks-language-tag-is-read-in-any-letter-case.md) gates its tag
   comparison (`arch.rules.ts:361`). With it, `mentions()` can judge a mention inside `<a>` as
   linked instead of reporting it unread, so the two builders agree on what an `<a href>` is.
3. **Scope: `<a>` and `<area>`, in any letter case, quoted or unquoted**, as [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s Fix 2
   scoped it. The plan pins `<area>` against GitHub's Markdown API, since only `<a>` was measured
   there. A detector wider than the reader finds any `<a` or `<area` tag start; whatever it finds
   that the reader cannot read is reported unread, each under a named cause with a remedy verified
   to clear it. The residue is named:
   - an unquoted `href` holding `/`, which micromark leaves as a `text` node (measured inline, at a
     block's start and in a table cell) while GitHub renders it as a link. It is reported, not
     re-tokenized, since a second tokenizer would go against asking the parser. The scan reads
     source offsets, so an escaped `\<a href>` stays text (`sourceOffsets`,
     `packages/md/src/model/phrasing.ts:79-115`, is the precedent);
   - Vue's `:href` and `v-bind:href`;
   - `<a title="a>b" href=…>`, where a `>` sits inside a quoted value;
   - an unterminated quote;
   - a tag split by a blank line.

   Open question 1 (a scan or an HTML parser) is not decided by this review. The lenses lean to an
   attribute scan that names its grammar (the CommonMark §6.6 open tag) and writes what it does not
   read into `docs/markdown.md:232-240`. The product lens measured that a quoted-attribute scan
   covers all 2,349 hrefs it found, and a parser would not fix the unquoted-`/` case, which is the
   Markdown parser's. An HTML parser as a runtime dependency is a decision the size of
   [ADR-002](../../adr/002-ts-morph-ast-engine.md) and engages
   [ADR-020](../../adr/020-a-package-supports-a-runtime-only-where-ci-checks-it-there.md), so that
   answer needs an ADR first; the scan needs none.

### What the plan must add

- **A misread `href` is a false green as well as a false red.** The link walk
  (`collectLinkBlocks`, `packages/md/src/model/links.ts:117`) feeds `beLinkedBack()`'s back-link
  index (`packages/md/src/conditions/linked-back.ts:14-24`) and `sections().haveLink()`
  (`packages/md/src/model/section-holds.ts:50,76`). A commented-out `<a href>` read as a link would
  count as a link back, and would give a section a link. Each needs a row that goes red when the
  comment is read. A section whose only link is an unread `href` is undecided ([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)), not "has no
  link".
- **The unread finding follows [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md):** an unread `href` is not counted in `examined`
  ([ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md)), `.expectEmpty()` does not
  silence it, and it is reported only where the verdict depends on it.
- **Break classes for attributes:** `href=` inside another attribute's value; `data-href`, `:href`
  and `xlink:href`; spaces around `=`; a tag over several lines; `<A HREF>`; single quotes;
  `<a href=docs/>`, where HTML reads the value `docs/` and micromark reads `/>` as self-closing. The
  tag is tokenized first and its values decoded after, so `&lt;a href…&gt;` is not a tag.
- **Break classes for context:** raw-text elements (`<script>`, `<style>`, `<textarea>`, `<title>`,
  CDATA) hold no links, and GFM's tagfilter changes what renders, so measure against GitHub rather
  than reason it out. The content of `<pre>` is a link. A comment inside a larger `html` node needs
  its own skipping; `ONE_COMMENT` (`packages/md/src/model/phrasing.ts:63`) skips only a node that is
  all comment. Whether an `<a>` inside a Markdown link is one element or two is stated.
- **The autofix span.** An `html` node's `value` drops `> `, list indentation and continuation
  indentation (measured), so an offset into the value is not an offset into the source, and
  `movedLinkFix` (`packages/md/src/model/resolve-link.ts:273-294`) would rewrite the wrong bytes.
  Either an `href` gets no fix, or its span is mapped to the source and checked with `writtenAt`,
  the fix is left out when the value is entity-encoded, and it is refused when the replacement
  cannot be written in that attribute's quoting. Rows: in a blockquote, on an indented continuation
  line, in an unquoted value.
- **A break statement and its impact per reader.** The changeset marks
  `**Breaking (@nielspeter/eess-md):**`, a minor on 0.x, as [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md) part (a) did; no other package
  moves. The plan lists what changes for `.resolve()`, `.beLinkedBack()` in both directions,
  `haveLink()`, `areLabelled()` and `areInSection()` (an `href` in inline HTML gets a `blockPath`,
  measured, and so becomes declared), `haveLiveTargets()`, `.select()` into `correspondence()`, and
  `examined`. It says what each `MdLinkRef` field holds for an `href`: `.text` (empty for
  `<a><img></a>`, which is 13 of the 14 block-level links measured), `line`, `block` and
  `blockPath`.
- **A fragment `href` is a link resolved as `self`**, its fragment left to
  [bug 0136](../bugs/0136-link-fragments-are-never-checked.md). `href="#…"` is 1,346 of the 2,349
  hrefs measured (57%), and [spike 0574](../spikes/0574-what-checking-a-link-fragment-needs.md) counted 1,124 more at this proposal's boundary.
- **Pin what is honest but surprising:** `href=""` resolves as `self`; `javascript:` is external by
  `EXTERNAL_RE` (`packages/md/src/model/external.ts:6`); a templated `href` (`{{ site.baseurl }}`)
  reds as missing, as its Markdown twin does; a component's `href` prop (`<VPButton href>`) is not
  an `<a>` and stays out.
- **The docs state the subset** where `links()` is described (`docs/markdown.md:232-240`,
  `docs/markdown.md:690-700`, and the `links()` docstring, `packages/md/src/builders/links.ts:149`),
  with one phrase for the construct where today there are three.
- **The scan is linear:** no nested quantifier over `[^>]*`. Security is fine: an `href` reaches only
  `resolveLink`'s index lookup, and the autofix is the only path that writes.

### Corrections to the submission

The submission above is kept as written. These are the defects the review found in it:

- **The survey names `OPENS_A` as "the starting point for this proposal's scan".** It cannot be
  one: it pulls out no value, it already matches `data-href` and `title="href=…"`, and it misses
  `<a title="a>b" href=…>`, since `[^>]*` stops at the quoted `>` (measured by two lenses). That
  misread in `mentions()`'s `html-link` cause is recorded as
  [bug 0593](../bugs/0593-the-html-link-recogniser-matches-data-href-and-misses-a-quoted-angle-bracket.md).
- **Ask A narrows [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s measured scope without saying so.** It reads "a raw HTML node" and
  `<a>` only; Fix 2 reads the source text and covers `<area>`, any letter case, quoted or unquoted.
  Decision 3 restores Fix 2's scope.
- **The Priority line assumes unread ships first.** Fix 2 held that order open, and decision 1
  decides it the other way: a raw HTML link is resolved, not left red with "unread".
- **The criterion "HTML the reader cannot parse is reported as unread" cannot fail.** A subset scan
  only matches or does not match; it has no "cannot parse" state. It is replaced by the detector and
  reader split, the named causes and their remedies (decision 3).
- **The criteria treat a misread `href` as a false red only.** It is also a false green through
  `beLinkedBack()` and `haveLink()` (above), the fail-open twin of the regression PR #284 measured
  for [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md).
- **"An `href` in a code span or fenced block is not a link" holds in Markdown and fails inside an
  HTML block**, where GitHub renders backticks and fences literally. That disagrees with the choice
  `fencesInHtml` makes (`packages/md/src/model/prose.ts:235`), and the plan states it as a decision.
- **The entity criterion cannot fail as written.** `linkTargets` never strips a query string
  (`packages/md/src/model/resolve-link.ts:136`), so `./a.md?x=1&amp;y=2` is broken decoded or not.
  The row puts the entity in the path, `./R&amp;D.md` against `R&D.md`, and says whether the
  message quotes the URL decoded or as written. The query-string defect breaks Markdown links too
  and is recorded on its own as
  [bug 0583](../bugs/0583-a-local-link-with-a-query-string-never-resolves.md), not folded in here.
- **"A fixture row per break class" is the wrong cost shape.** A case that produces nothing cannot
  go red as a nonvacuity row; it belongs in the suite, each red under its own sabotage. Nonvacuity
  takes two or three scenarios of one fixture script, as `corpus/declared-block/*` does, since
  [bug 0552](../bugs/0552-nonvacuity-shard-3-runs-near-its-timeout.md)'s shard is near its timeout:
  a readable broken `href`, an unread `href` written in a construct the reader cannot read (so an
  emptied detector reds), and the unquoted text case. The cost per row is estimated at 1 s or
  less; the timing run was denied, so it is not measured.
- **The survey misses a consumer:** [spike 0574](../spikes/0574-what-checking-a-link-fragment-needs.md)'s anchor sets for [bug 0136](../bugs/0136-link-fragments-are-never-checked.md) need the same attribute
  reader (decision 2), and open question 2 should name it.
- **The external-`href` false-red case appears twice** in the criteria; it is one row.
- **The Measured section rests only on [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s synthetic reproduction.** The real-corpus figures
  above belong beside it.

### Recorded separately, not in this scope

- [Bug 0583](../bugs/0583-a-local-link-with-a-query-string-never-resolves.md): a local link with a
  query string never resolves, for Markdown links as well.
- [Bug 0593](../bugs/0593-the-html-link-recogniser-matches-data-href-and-misses-a-quoted-angle-bracket.md):
  the HTML link recogniser matches `data-href` and misses a quoted `>`. Decision 2's owner is
  where it gets fixed, but the defect stands on its own today.

### Next step

[Plan 0580](../plans/0580-md-a-raw-html-link-is-resolved.md) declares that it implements this proposal
and carries the changes above as its acceptance criteria. This proposal stays Draft until that plan
owns the ask.
