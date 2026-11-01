# Proposal 015 — md: a wikilink is read, or reported as unread

**State:** Draft — filed 2026-10-12 at the maintainer's request; reviewed 2026-11-01 (architect ·
product · enforcement), Rewrite needed, still Draft (see "Review — 2026-11-01").
**Priority:** Medium — a corpus written with wikilinks gets a green link check while none of its
wikilinks is checked. No shipped rule claims to read them, so nothing over-claims today; the green
is what misleads.
**Origin:** self-found · the maintainer's question, 2026-10-12, while answering an inbound question
about checking an LLM-maintained Markdown wiki. That wiki uses standard links; no consumer has asked
for wikilinks.
**Affects:** `@nielspeter/eess-md` (the link walk, and possibly `resolveLink`).

## Problem

Obsidian and similar tools link with wikilinks — `[[Page]]`, `[[Page|label]]`, `[[Page#Heading]]`,
`[[Page#^block]]`, and embeds `![[file.png]]`. To CommonMark they are plain text. eess-md reads only
`link` nodes, so a wikilink is never selected, never resolved and never reported: a broken
`[[Missing Page]]` is green. _Corrected 2026-11-01 (review): a corpus with only wikilinks is red
today, through the zero-examined path; the false green is a corpus that mixes wikilinks with
standard links._

## Measured

Against this repository's build at `8db0605` and the published `@nielspeter/eess-md` 0.8.0, on one
page holding `[[Missing Page]]`, `[[b|the B page]]`, `![[img.png]]`, a wikilink in a code span and
one in a fence, and a standard `[real](gone.md)`:

- `links(c).that().areInternal()` selects `gone.md` only;
- `.should().resolve()` reports `gone.md` only — the three wikilinks in prose, one of them broken,
  produce no finding.

_Corrected 2026-11-01 (review): the reviewers re-ran this on eess-md 0.13.0, and the result is
unchanged._

## Existing code survey

- **The link walk reads `link` nodes and counts `linkReference` nodes**
  (`packages/md/src/model/links.ts:194-195`); text is not scanned for links. _Corrected 2026-11-01
  (review): those lines now fall in the paragraph and list-item branch; the reference-link branch is
  `packages/md/src/model/links.ts:197-215`._
- **The parser has no wikilink extension:** `parseMarkdown` runs `fromMarkdown` with GFM and YAML
  front matter only (`packages/md/src/model/prose.ts:129-132`, since [bug 0087](../bugs/fixed/0087-frontmatter-parsed-as-setext-heading.md)'s fix). _Corrected 2026-11-01 (review): the parser setup has moved to `packages/md/src/model/prose.ts:26-29`, and the two parses are at `packages/md/src/model/prose.ts:143` and `packages/md/src/model/prose.ts:149`._ No `wikilink`, `wiki-link` or `obsidian` appears in
  `packages/*/src`.
- **Resolution is `resolveLink`** ([plan 0404](../plans/completed/0404-md-one-link-resolver-names-each-case.md)): relative paths, with `tryExtensions`, `tryIndex`,
  `rootDir` and directories. Obsidian resolves differently — a bare name matches a file by its name
  anywhere in the vault, and a heading or block reference targets part of a file.
- **The closest precedent is reporting what cannot be read.** [Plan 0405](../plans/completed/0405-md-select-the-links-a-block-declares.md)'s declaration scan reports a
  declaration made of reference-style links as one eess-md "does not read", rather than skipping it
  ([ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md) rule 7).
  _Corrected 2026-11-01 (review): that finding no longer exists; it was removed when [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md) part (a) made reference-style links read as links. The live precedents are `md/unread-mention` (`packages/md/src/builders/mentions.ts:40`, with its findings built at `packages/md/src/builders/mentions.ts:186`) and [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md) Fix 2._

## Asks

- **A — disclose.** A wikilink in a corpus is never silently skipped: a rule over links reports it
  as unread, or reports how many it did not read beside its green. A wikilink in code is not one.
- **B — resolve.** Wikilinks are links: selected by `links()` and resolved with Obsidian's rules, so
  `resolve()` reports a broken one. Expected to be held until a consumer brings a real vault, since
  the rules are a second resolver beside `resolveLink`. _Corrected 2026-11-01 (review): the maintainer has since (2026-10-30 and 2026-10-31) made full link support, wikilinks included, a goal for any corpus, so Ask B is the deliverable, not held for a vault._

## Acceptance criteria

**A — disclosure.**

- **Break class:** a corpus whose only broken link is a wikilink is not green without a word: the
  unread wikilink is a finding, or its count is reported beside the result. _Corrected 2026-11-01 (review): the count branch is ruled out. A count beside a green cannot go red, since an emptied scanner prints 0 beside a green, and it never reaches `--format json`; [ADR-009](../../adr/009-agent-first-failure-surfaces.md) rule 1, [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md) rule 1 and [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) forbid it._
- **Break class (false red):** a `[[…]]` inside a code span or fenced block is not counted.
- **Break class:** an embed, `![[…]]`, is counted like a link.
- **Non-vacuity:** a fixture row per break class.

**B — resolution.** Not specified until a consumer's vault sets the rules it must follow.

## Open questions

1. **Finding or count.** Is an unread wikilink a finding that fails the build (fail closed, but red
   for every Obsidian corpus until B ships), or a count disclosed beside a green (honest, but green)?
   _Corrected 2026-11-01 (review): a count beside a green is not an option. It cannot go red, which [ADR-009](../../adr/009-agent-first-failure-surfaces.md) rule 1, [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md) rule 1 and [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) forbid._
2. **How to find them.** A micromark wikilink extension parses them as nodes; a scan of text nodes
   finds them without a new dependency. Either must skip code.
3. **Resolution rules.** Which tool's rules — Obsidian's, or a common subset — and whether
   `resolveLink` gains a mode or a second resolver sits beside it.

## Out of scope

- Other non-CommonMark link forms (MediaWiki, Roam block references). _Corrected 2026-11-01 (review): MediaWiki shares the wikilink syntax, so it cannot be out of scope as a link form; it can be excluded only as a resolution default._

## Review — 2026-11-01

**Ruling: Rewrite needed**

Reviewed at main `bd78b962` by three lenses (architect, product, enforcement), after a survey of the
code. The defect is real. In a corpus that mixes standard links and wikilinks, a broken wikilink sits
beside a green `links().should().resolve()`. In a corpus that holds only wikilinks, the rule is red,
but the remedy its message leads with silences the wikilinks. The submission cannot be ruled on as
written, for four reasons:

1. Its central criterion offers a branch the ADRs forbid: an unread wikilink "or its count is
   reported beside the result". That is an instrument that cannot go red.
2. Its other branch, a finding that is on by default, was measured at zero true positives.
3. Its premise is stale. The maintainer has since (2026-10-30 and 2026-10-31, asking for GitHub
   Flavored Markdown link support and for a wiki corpus to be checkable as plans and bugs are) made
   full link support, wikilinks included, a goal
   for any corpus. Ask B is no longer "held until a consumer brings a real vault". It is the
   deliverable.
4. Its acceptance criteria miss break classes the reviewers measured, two of them false greens.

The architect and product lenses each wrote "Ship with changes". The enforcement lens wrote that
Ask A cannot be ruled on while Open question 1 is open, and the architect reached the same view of
Open question 1. The ruling is Rewrite needed and not Ship with changes because the changes asked
for replace Ask A's mechanism and its default, not its wording. A Ship ruling would also make
`check:corpus` owe a plan that has nothing falsifiable to build until a spike and an ADR exist.

### Corrections to the submission

These are defects the submission committed in itself. They are recorded here, not fixed above, so
the template learns from them.

- **The "count beside a green" branch.** Break class 1 and Open question 1 offer a count reported
  beside a green result. An emptied scanner prints 0 beside a green, and no `check:nonvacuity` row
  can red a count. Four binding texts rule it out: [ADR-009](../../adr/009-agent-first-failure-surfaces.md)
  rule 1; [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md) rule 1,
  which forbids an answer "a caller can mistake for 'nothing wrong here'";
  [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md)'s rejected
  alternative, "a line in the gate summary"; and
  [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md), whose receipt is an
  `ArchViolation[]`, so a count beside it never reaches `--format json`. Rule 7 of
  [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md) does not rescue
  it: there the report travels beside a "could not determine" answer, never in place of one. All
  three lenses found this.
- **The Problem overstates the false green.** A corpus with only wikilinks is red today, through the
  zero-examined path. The false green is the mixed corpus.
- **Four survey lines are stale.**
  - The link-walk pointer (lines 194-195 of `links.ts`) now falls in the paragraph and list-item
    branch. The reference-link branch is `packages/md/src/model/links.ts:197-215`.
  - The parser pointer (lines 129-132 of `prose.ts`) has moved. The parser setup is at
    `packages/md/src/model/prose.ts:26-29`, and the two parses are at
    `packages/md/src/model/prose.ts:143` and `packages/md/src/model/prose.ts:149`.
  - The "closest precedent", [plan 0405](../plans/completed/0405-md-select-the-links-a-block-declares.md)'s
    finding for a declaration made of reference-style links, no longer exists. It was removed when
    [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md) part (a) made
    reference-style links read as links. The live precedents are `md/unread-mention`
    (`packages/md/src/builders/mentions.ts:40`, with its findings built at
    `packages/md/src/builders/mentions.ts:186`) and
    [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md) Fix 2.
  - "Measured" names `8db0605` and eess-md 0.8.0. The reviewers re-ran it on eess-md 0.13.0, and the
    result is unchanged.
- **Out of scope does not hold together for MediaWiki.** It shares the syntax. It can be excluded
  only as a resolution default.

### What already exists

- **Ask A, as a composition, mostly exists.**
  `mentions(c, { pattern: /!?\[\[[^\]\n]+\]\]/g }).should().notExist()`
  (`packages/md/src/builders/mentions.ts:209`,
  [plan 0539](../plans/completed/0539-a-mention-of-a-record-is-a-link.md)) finds wikilinks in prose,
  with aliases and embeds, and fenced blocks are already clean. It false-reds a match in inline code
  or written escaped: that is [bug 0571](../bugs/0571-a-mention-cannot-be-selected-by-how-it-is-written.md).
  It is the shape [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)
  part (b) was resolved to, as the opt-in example
  `examples/md/a-reference-with-no-definition-is-reported.test.ts`, under
  [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md).
- **Ask A inside `links()` is new, and it shares a channel that is not built yet.** `links()` has no
  unread or `bypassFilters` path. [Bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)
  Fix 2 (decided 2026-11-01: raw HTML is resolved, not reported unread; see that bug) specified that channel for raw HTML links: not counted in `examined`, not
  silenced by `.expectEmpty()`, reported at the link's own line. Whichever is built first builds it
  for both. The kernel's path for a subject a rule cannot judge is `undecidedViolations`
  ([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)). The text walk to
  scan is `phrasingOf` (`packages/md/src/model/phrasing.ts:115`). The close of
  [plan 0539](../plans/completed/0539-a-mention-of-a-record-is-a-link.md) names this proposal as the
  third copy of the unread-reach helper, and the moment to extract it; when it is extracted, it
  should fold into the channel of
  [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) rather than become a
  third hand-built `bypassFilters` array (one copy is at
  `packages/md/src/builders/mentions.ts:201`).
- **Ask B is new.** `resolveLink` ([plan 0404](../plans/completed/0404-md-one-link-resolver-names-each-case.md))
  resolves by path, and covers conventions "generically instead of naming any tool"
  (`packages/md/src/model/resolve-link.ts:8-11`). A wikilink maps a name to candidates instead. The
  shape to follow is [spike 0574](../spikes/0574-what-checking-a-link-fragment-needs.md) decision 1,
  decided and not yet built: a renderer's rule is a pure function the caller passes, and eess-md
  names no tool but GitHub's default. `[[Page#Heading]]` needs the anchor sets of
  [bug 0136](../bugs/0136-link-fragments-are-never-checked.md). A `#^block` reference has no anchor
  concept anywhere in the family.

Everything lands in `@nielspeter/eess-md`. No other dialect reads Markdown links, and nothing moves
into `packages/core`.

### Decisions taken on the maintainer side

Each of these is the maintainer side's call, taken from the ADRs and the measurements, and each can
be overruled.

1. **Open question 1 is decided: the wiki reading is declared, never a default.** The basis is
   the measurement below, supported by a principle. `[[…]]` is not syntax that CommonMark or GFM
   defines. [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) calls the syntax
   Markdown and GFM define "the language, not a shape", and its root reads no shape the caller did
   not name; it does not, though, say that every other syntax is a shape, and its definition of a
   shape (a label, a state, a folder, a section, a box mark) does not cover link syntax. That gap is
   why step 3 below extends [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) rather than citing it. Wiki tools may also differ on order:
   Obsidian and MediaWiki write `[[Page|label]]`, and two lenses recalled that Gollum writes the
   reverse, which is unverified until the spike reads Gollum's docs. A default-on reading was
   measured at 29 findings, all 29 false: 14 in 6 of about 600 installed
   READMEs (POSIX classes such as `[[:digit:]]` in inline code, the ECMAScript slots `[[Prototype]]`
   and `[[Class]]` in prose, and findings on HTML blocks that cannot be suppressed), and 15 in this
   repository, 12 of them in this proposal's own text. Under
   [spike 0574](../spikes/0574-what-checking-a-link-fragment-needs.md)'s GitHub default, `[[x]]` is
   text. So a corpus declares its wiki reading. Once declared, wikilinks are links: selected by
   `links()` and resolved. A form the declared reading does not cover is reported as a finding in
   [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)'s existing class,
   never skipped. Asks A and B merge under this decision. Where the declaration lives is left to the
   rewrite: the lenses agree it is not `LinkResolveOptions`, because `.that().areInternal()` and
   `examined` are decided before any condition sees an option. The candidates are the `links()`
   entry (architect) and `corpus()` (product, so that `sections().haveLink()` and `beLinkedBack()`
   agree with `links()`).
2. **The order of work.**
   1. A documented example built from public blocks, with no new API:
      `mentions(c, { pattern: /!?\[\[[^\]\n]+\]\]/g }).should().notExist()`. It is the family's
      established pattern for text of a shape the corpus names, the same as the dangling-reference
      example in `examples/md/`. Like that example, it states its limit: a match in inline code or
      written escaped is still reported until
      [bug 0571](../bugs/0571-a-mention-cannot-be-selected-by-how-it-is-written.md) is fixed.
   2. A time-boxed spike that reads the wiki tools' own syntax and resolution docs (Obsidian and
      Gollum at least). It must fetch Gollum's docs and settle whether its order is
      `[[label|Page]]`; that claim is unverified, and nothing may record it until the spike has.
   3. An ADR extending [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) for a
      declared reading. [Spike 0574](../spikes/0574-what-checking-a-link-fragment-needs.md) already
      read [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) as "a renderer's rule is not a document's shape"; this would apply that reading a
      second time and widen it from anchors to link syntax and name lookup, which is a binding
      decision.
   4. The build, after [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)
      Fix 2 and [bug 0571](../bugs/0571-a-mention-cannot-be-selected-by-how-it-is-written.md).
3. **The "count beside a green" branch is deleted**, on
   [ADR-009](../../adr/009-agent-first-failure-surfaces.md) rule 1,
   [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md) and
   [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md), as recorded under
   "Corrections to the submission".

### What the rewrite must add

- **The corpus with only wikilinks.** `links().should().resolve()` over such a corpus examines 0 and
  reds, with a message that leads with `.expectEmpty()`. Following it gives a green with 0 findings
  (enforcement, measured). The rewrite needs this as a break class, and must state the precedence:
  a wikilink finding outranks `.expectEmpty()`, is not counted in `examined`, and bypasses filters,
  as [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md) Fix 2 decided
  for HTML.
- **`[[Page]]` beside a `[Page]: ./b.md` definition.** It parses as `[`, a shortcut reference and
  `]`, and `links()` resolves it to `b.md`: a false green under a wiki reading. A scan by source
  offset would turn it into a double count. Under a declared reading the characters are one
  element: the reference on GitHub, the wikilink in a vault. Rows must red both for two elements and
  for none. The same holds for `![[Page]]` beside a definition, read today as `!` and a reference.
- **Escapes.** `\[\[x\]\]` and `[\[x]]` are decoded to `[[x]]` by the parser, a false red. The scan
  must read source offsets, which is
  [bug 0571](../bugs/0571-a-mention-cannot-be-selected-by-how-it-is-written.md)'s fact; reuse it.
- **Front matter.** A wikilink in YAML front matter, such as `related: "[[Missing]]"`, is skipped
  silently. "Never silently skipped" is false until this is a break class or is put out of scope by
  name. Whether Obsidian links properties is unverified.
- **Embeds, split against [proposal 024](./024-md-an-images-file-exists.md).** `links()` does not
  read standard images. `![[Note]]`, a transclusion, is a link. `![[img.png]]`, a file embed, belongs
  with [proposal 024](./024-md-an-images-file-exists.md). Otherwise say why the wiki form is held to
  more than a standard image.
- **A mechanism for each row.** "A fixture row per break class" names none. The example route is
  proven by `check:nonvacuity`'s example swaps (`examplesMdLoadBearing`,
  `scripts/check-nonvacuity.mjs:1063`), and its false-red rows wait on
  [bug 0571](../bugs/0571-a-mention-cannot-be-selected-by-how-it-is-written.md). The built-in route
  needs named sabotages: an emptied scan, a dropped code skip, decoded text read in place of the
  source, the reference collision counted twice, and `.expectEmpty()` silencing the finding.
  Dogfooding cannot carry any of them, because this repository writes no wikilinks.
- **Ask B's break classes that need no vault.**
  1. A name that matches no file reds; a name that matches one file is green.
  2. A name that matches two files is a cannot-judge finding under
     [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md), never an arbitrary
     pick. `resolveLink` gains an "ambiguous" case (architect).
  3. A `#Heading` or `#^block` fragment is cannot-judge until the anchor sets of
     [bug 0136](../bugs/0136-link-fragments-are-never-checked.md) exist, never a pass on the file
     part.
  4. Order, case and space rules belong to the declared reading.
- **Behaviour, not a tool name.** "Obsidian's rules" puts a tool's name in the API. The reading
  should describe behaviour: target and label order, a function from name to file, and whether
  embeds are links.
- **Granularity and id.** [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)
  rule 5 and [spike 0574](../spikes/0574-what-checking-a-link-fragment-needs.md) decision 4 give one
  finding per cause per rule, naming the links it covers. `md/unread-mention` reports one per
  occurrence, and a vault with thousands of wikilinks must not get one finding per link. Share one id
  with [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md) Fix 2;
  product suggests `md/unread-link`, with a cause per form.
- **Cache scope.** A scan whose result depends on a declared reading caches per rule and options, as
  [spike 0574](../spikes/0574-what-checking-a-link-fragment-needs.md) decision 3 does, never per
  module.
- **Line attribution.** Report at the line of the `[[`, from segment offsets.
- **Small cases, one line each:** an Obsidian comment `%% [[Hidden]] %%` is a false red; a wikilink
  inside link text, `[see [[Inner]]](./a.md)`, is reported, though a nested link is a link in
  neither renderer; an unescaped `[[Page|label]]` in a GFM table cell is split by the cell delimiter
  and missed, which may be right since Obsidian requires `\|` there, but say so; `[[Two` and
  `Lines]]` across a line break do not match, which agrees with the wiki tools.
- **Naming.** "wikilink": one word, lower case, everywhere.
- **Origin and Priority** restated against the maintainer's goal.

### Left to the plan, not the ruling

- **How to find them (Open question 2).** The architect and enforcement lenses argue for a scan over
  `phrasingOf` runs with source offsets, not a micromark extension. An extension changes the tree
  under every rule (`mentions()`, `textOf`, `sections()`, the heading text of
  [spike 0574](../spikes/0574-what-checking-a-link-fragment-needs.md), and the front-matter guard's
  comparison of two parses at `packages/md/src/model/prose.ts:114-116`), breaks the text-keyed parse
  memo, and adds a dependency that bakes in one tool's syntax. Product's constraint: with no reading
  declared, behaviour is byte-identical.
- **Suppression, decided for raw HTML.**
  [Bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md) Fix 2's
  sub-decision (may an unread finding with no Markdown remedy be suppressed per cause?) is settled
  for raw HTML by resolving the `href` instead (recorded in that bug, 2026-11-01). For wikilinks the
  question does not arise the same way: under a declared reading a wikilink is resolved, and only a
  form the reading does not cover is unread, whose remedy (write it in a covered form) is real.

### Recorded separately

The kernel's zero-examined message offers `.expectEmpty()` and does not name "links written in a
form this rule does not read" as a cause. That is a defect outside this proposal's scope, filed as
[bug 0589](../bugs/0589-a-zero-examined-rule-names-expect-empty-but-not-an-unread-link-form.md).

### Next step

The proposal is rewritten in place and stays `Draft`. No plan follows from this ruling. The first
step of decision 2, the documented example, adds no API. The build is ready to plan only after the
spike and the ADR exist and the rewrite's break classes are written.

**Releases, when built:** an eess-md minor, additive under a declared reading. The kernel, eess-ts,
eess-mermaid and eess-gherkin do not move.

**Cost of this review.** The lenses ran their probes against `packages/md/dist`: about 6 s for the
architect, about 4 s for product, and about 26 s across eight runs for enforcement. The survey's
probes took under 0.2 s each. No tracked file but this one was edited.
