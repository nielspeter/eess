# Proposal 023 — md: a footnote reference has its definition

**State:** Draft — filed 2026-10-30 at the maintainer's request; amended the same day from PR #280's reviews. Reviewed 2026-11-01, Split and sequence, both asks held (see Review).
**Priority:** Low — no shipped rule claims to check footnotes, so nothing over-claims; a broken
footnote shows as literal text on GitHub, which a reader notices and a gate does not.
**Origin:** self-found · the maintainer, 2026-10-30: "GitHub Flavored Markdown (GFM) is important".
**Affects:** `@nielspeter/eess-md`.

## Problem

Footnotes pair a reference, `[^note]`, with a definition, `[^note]: …`. They are not in the GFM
spec (Version 0.29-gfm, 2019-04-06, has no footnote section); GitHub renders them, and the parser
eess-md uses reads them (`micromark-extension-gfm`). Two drifts break the pair:

1. **A reference with no definition.** The parser does not treat it as a reference at all, and
   GitHub renders it as the literal text `[^note]`. A renamed or deleted definition turns every reference to it into
   visible brackets.
2. **A definition nothing references.** It renders nowhere on GitHub, so its text is lost from the
   page while it stays in the source.

## Measured

eess-md's own parser (`mdast-util-from-markdown` with `micromark-extension-gfm`), on
`Used[^a] and undefined[^missing].` followed by `[^a]: the a note` and `[^unused]: never
referenced`:

- `[^a]` is a `footnoteReference` with identifier `a`;
- `[^missing]` is part of a `text` node, `" and undefined[^missing]."`, since it has no definition;
- `[^unused]` is a `footnoteDefinition` that no `footnoteReference` names.

So the parse already holds both drifts, and no eess-md element or rule reads them.

## Existing code survey

- **Footnote nodes are known** to the section reader, which does not count a heading inside a
  footnote definition as a section (`packages/md/src/model/sections.ts:125`).
- **No footnote element type exists** in `packages/md/src/builders/`, and no rule reports either
  drift.
- **The nearest shapes** are `links().should().resolve()` (a reference must reach its target) and
  `mentions()` (a text pattern the caller names, so `[^…]` in text can be found today with a
  pattern; that finds the missing-definition case by its literal brackets, outside code).

## Asks

- **A — a reference has its definition.** A rule reports `[^x]` written in prose, outside code,
  whose definition the document does not hold.
- **B — a definition is referenced.** A rule reports a definition no reference names.

## Acceptance criteria

- **Break class (A):** `[^missing]` in prose with no definition is reported at its line.
- **Break class (A, false red):** `[^x]` in a code span or fenced block is not reported; nor is an
  escaped `\[^x]` (measured: the parser unescapes it into the text `Escaped [^x] here.`, so the
  scan reads the source by offset).
- **A false red A cannot avoid:** a regex class written in prose (`[^0-9]`, measured: plain text)
  has the shape of a dangling reference, and `0-9` is a valid footnote label (PR #280's
  enforcement re-check: with a `[^0-9]: …` definition it is a reference). So A reports it, and the
  finding names the remedy that clears it, a code span. A heuristic that skipped it (only a
  document that holds a footnote is read) would miss the common deletion, where a document's only
  footnote and its definition both go.
- **Break class (B):** `[^unused]: …` with no reference is reported at the definition's line.
- **Non-vacuity:** a fixture row per break class.

## Open questions

1. **Element or condition.** A `footnotes()` element type (a reference or a definition, with the
   kernel's whole surface), or a `docs()` condition. eess-md's other pairs are element types.
2. **Whether A is a mention.** A is a literal-text case, which `mentions()` with a pattern already
   reaches; the review should decide whether a documented example covers it before new API does.

## Dogfooding

Whether this repository's `check:corpus` adopts the rule is for the review. Measured by parsing
every tracked Markdown file under `work/`, `adr/` and `docs/`: none holds a footnote reference or
definition, so the gate would read nothing today, and the rows are the proof.

## Out of scope

- Footnotes in other Markdown flavours (Pandoc inline footnotes).

## Review — 2026-11-01

**Ruling: Split and sequence**

Reviewed by the architect, product and enforcement lenses, after an existing-code survey. The
architect said ship with changes, product said split and sequence, and enforcement said not ready
as written, with three critical issues. All measurements were throwaway scripts against
`packages/md/dist` and the parser in `node_modules`. The longest was product's README census, about
10 s a run. No suite, gate or validate was run.

The two asks have different architectures and different evidence, so they do not move together.
A needs no new API: it is a documented example built from public blocks. B is genuinely new, and
it is not ready to plan. Both are `Held` on the conditions in the table below.

### Existing code survey, corrected

- **A already exists as a composition of public blocks.** `mentions()` with a footnote pattern,
  `.that().satisfy(not(areLinked())).should().notExist()`, is the established pattern for text of
  a named shape. It is what [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)
  part (b) shipped, in `examples/md/a-reference-with-no-definition-is-reported.test.ts`. The parser
  pairs a defined `[^a]` into a `footnoteReference`, which has no text for the mention walk to read.
  An undefined `[^x]` stays text, so only dangling references match. All three lenses measured
  this on dist. The parser's case and Unicode folding, definitions inside lists and blockquotes,
  and "a definition in a code block does not count" all work with no new code.
- **The remedy line A wants already exists.** It is `.rule({ suggestion })`
  (`packages/core/src/rule-metadata.ts:15`), printed as `Fix:`. The survey said the composition
  lacks one, and so does a verification note in
  [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md). Both are
  wrong. That note's correction belongs to that record, not to this one.
- **A's two false-red exclusions are owned by
  [bug 0571](../bugs/0571-a-mention-cannot-be-selected-by-how-it-is-written.md).** Its `inCode`
  predicate and `escaped` fact are what lines 52-54 ask for, word for word. Fenced code is already
  skipped (`packages/md/src/model/phrasing.ts:223`).
- **B is genuinely new.** Nothing in the family reports an unused definition of any kind, footnote
  or link. `definitionsOf` (`packages/md/src/model/definitions.ts:49`) builds its map only to
  resolve references. A footnote definition's label is not text, so `mentions()` cannot reach it.
  Without new API the only way in is a hand-written condition over `MdDocument.root`
  (`packages/md/src/model/document.ts:69`), and an example may not ship one
  (`arch.rules.ts:202`).

### Placement

- **A** is an `examples/md/` file plus one sentence in `docs/markdown.md`, next to the sentence
  on reference-style links. Under
  [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) a shape ships as an example.
  No package moves.
- **B**, if it returns, belongs in eess-md only, as a root element over the parser's definitions.
  The "is it referenced" fact is computed in `model/`, the way `links()` carries `.definition`, and
  a predicate plus `.notExist()` composes the rule. Under [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md)'s clause 4 the rule itself is an
  example, not a `rules/*` module.
- **Nothing moves into `packages/core`.** In particular "referenced" must not be a kernel
  `correspondence()` keyed by identifier. The architect built that join from public blocks and it
  is unsound both ways: a footnote cited twice is reported as ambiguous, a false red, and a
  duplicate definition passes, a false green.

### Why A waits for [bug 0571](../bugs/0571-a-mention-cannot-be-selected-by-how-it-is-written.md)

The review weighed two orders. In the first, A waits for
[bug 0571](../bugs/0571-a-mention-cannot-be-selected-by-how-it-is-written.md). In the second, A
ships now as an opt-in example with the residuals
[bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md) disclosed, and
lines 52-58 are rewritten as "after the fix". The architect preferred the second, enforcement the
first, and product accepted either.

The ruling takes the first. Today the composition reports `[^x]` in a code span, and it reports an
escaped `\[^a]` even when its definition exists. The proposal's own criteria say neither is
reported. Lines 55-58 name a code span as the remedy for `[^0-9]`, and a code span does not clear
it today; nor do `&#91;` or `[\^`. Shipping A first would ship false reds that its own acceptance
criteria forbid. The fix in
[bug 0571](../bugs/0571-a-mention-cannot-be-selected-by-how-it-is-written.md) must also not be
rebuilt inside a footnote rule: that is a parallel mechanism for a defect another record owns.

A's clean half needs a proof, not only a fixture row per break class. An absence rule examines
nothing when it holds, and no public block can see a defined footnote reference, so the clean
fixture cannot show it holds any. The partial proof enforcement names is required. The clean
fixture holds defined references in every container the parser reads, so a reference the parser
failed to pair becomes text and reds the clean test. The population assertion stays review-held
(`scripts/check-nonvacuity.mjs:1366`).

### Why B is held

- **"Referenced" is undefined, and the obvious build fails open.** With the to-hast renderer, the
  "same identifier appears anywhere" build stays green over four definitions that render nowhere:
  one referenced only from inside an unreferenced definition (a chain), one that references only
  itself, an a↔b cycle with no reference from the body, and the second of two duplicate `[^a]:`
  definitions. Each needs a break-class row, and the meaning needs measuring on GitHub's renderer,
  as [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md) measured
  `<a href>` through GitHub's Markdown API. Nobody had network access, so cmark-gfm is unmeasured.
  The rendering claims in this review (literal brackets, renders nowhere) are proxy measurements
  from micromark and mdast-util-to-hast.
- **B must key on the parser's `identifier`, never `label`.** `[^A]` pairs with `[^a]:`, and
  `[^STRASSE]` with `[^straße]:`.
- **Open question 1 is a real three-way disagreement.** Enforcement wants a `footnotes()` element
  over references and definitions, so A gets a public population proof. The architect wants an
  element over definitions only: a union needs kind guards on every predicate, its reference half
  has nothing to judge, and making dangling text an element is the PR #284 regression. Product
  would hold B for want of a consumer. All three agree a `docs()` condition is wrong, because it
  counts documents as `examined`. On this footnote-free corpus it would print N documents examined
  while judging no definition, the fake green
  [ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md) forbids.
- **B has no measured consumer, and its general sibling is common.** Product scanned 1,881 unique
  READMEs in `node_modules`. Four hold any footnote definition, and none is unused. Unused link
  reference definitions (`[x]: url`, mostly stale badge pairs) number 262, in 98 files. That is
  markdownlint's MD053. The general version has its own false-red class, the `[//]: # (comment)`
  idiom (11 measured), and a trap the architect measured: `links()` does not read
  `imageReference`, so an image-only definition would look unused.
- **The name has to leave room.**
  [ADR-023](../../adr/023-a-predicate-and-a-condition-that-share-a-word.md) keeps a published plain
  name's kind. If `footnotes()` ships before a general element for definitions, the dialect has two
  words for one concept. The dialect's word is already _definition_ (`MdLink.definition`,
  `docs/markdown.md:234`). A returning B is named so a later link half adds a `kind`, not a second
  builder.
- **B's proof is unit tests through the public entry point**, each red under a named sabotage: the
  walk emptied, keyed by `label`, inner definitions not walked, the duplicate dropped. A corpus with
  no footnotes is the zero-examined configuration finding. Per-document state lives behind the
  parse memo, not in builder state, so `fork()` cannot share it.

### Further findings

- **The whitespace and empty label class has no break class.** `[^a b]`, `[^a\tb]` and `[^]` are
  not footnotes. With a one-word note (`[^a b]: note`) the line becomes a link definition, and
  `links().resolve()` reports `broken link: "note"`, the wrong fix. With a sentence both lines are
  text and A's pattern misses them, a false green. The proposal states which label forms A reads
  and what each excluded form does.
- **The pattern's label class is the caller's knob.** The example states what its class gives up:
  `/\[\^\w+\]/` drops `[^0-9]` and also misses `[^my-note]`.
- **A reference in a raw HTML block or in image alt** is reported as `md/unread-mention`, measured
  correct. It is named as one of A's break classes.
- **Messages.** The composition's finding reads `docs/a.md:3 should not exist`. It does not name
  the label, so two findings on one line look the same. A renamed definition shows as two findings,
  A at the reference and B at the definition, and neither names the other, so an author may add a
  second definition. The gap is general and affects the reference example equally, so it is
  recorded on its own as
  [bug 0590](../bugs/0590-a-mention-absence-finding-does-not-name-its-match.md). B's message names
  the identifier.
- **Tier.** Tier 1 is honest for both asks, provided A claims "text of the footnote-reference shape
  the parser did not read as one", not "every footnote has its definition". Priority Low is right.
- **An ADR candidate, outside this scope.** "Text shaped like syntax the parser did not build is a
  mention found with the caller's pattern, never an element" has now been decided twice: in
  [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md) part (b) and in
  this proposal's A. It will decide
  [proposal 015](./015-md-wikilinks-are-read-or-reported.md) and the HTML half of
  [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md) too. The
  architect suggests an ADR, or an amendment extending
  [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md). Not filed by this review.
- **Pre-existing and out of scope.** The empty-corpus finding names "an unreadable tsconfig" to a
  Markdown user. Recorded as
  [bug 0591](../bugs/0591-the-empty-corpus-message-names-a-tsconfig-to-a-markdown-user.md).

### The fixture point the reviewers did not reconcile

The reference example's `not(areLinked())` predicate cuts both ways for footnotes. Enforcement
measured `[see[^gone]](./y.md)`: GitHub shows the brackets inside the link text, the predicate
drops the match (examined 0), and without it the match is reported. So enforcement says A's
example drops the predicate and pins the case with a `violating-in-link-text` fixture. The
architect measured `[^gone][lbl]` with `[lbl]:` defined: it parses as a link reference whose text
is `^gone`, the predicate correctly leaves it out, and so the two examples never double-report.
Both measurements are right for their inputs. The plan for A carries a fixture for each input and
decides from them whether the predicate stays.

### Corrections to the submission

- **Line 41** says `mentions()` finds the case "outside code". It reads inline code too; only fenced
  code is skipped. This is the false red the ruling waits on.
- **Line 54** says "the scan reads the source by offset". That describes a separate scanner, which
  contradicts open question 2's mention design. The proposal states two designs for A.
- **The Dogfooding section is wrong for A.** Enforcement ran the composition over `check:corpus`'s
  roots (about 6 s). It reports 32 findings, all in inline code, and 20 of them are in this
  proposal. After the fix in
  [bug 0571](../bugs/0571-a-mention-cannot-be-selected-by-how-it-is-written.md) the count would be
  zero. B over this corpus examines nothing. All three lenses recommend no `check:corpus` adoption:
  the proof is fixture-tier, as for the reference half of
  [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md), and it avoids a
  gate cost that nonvacuity multiplies per row.
- **The pointer `packages/md/src/model/sections.ts:125`** is the doc comment. The code is at
  `packages/md/src/model/sections.ts:119`.
- **The heuristic argument at lines 58-60 describes no drift.** If a document's only footnote and
  its definition both go, nothing dangles. The real case is that the only _definition_ is deleted,
  so the document holds no footnote node. Product's census backs the argument: the one real
  dangling footnote in 1,881 READMEs is in a file with no definition.

### Disposition

| Ask                                | Disposition | What would unhold it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — a reference has its definition | `Held`      | [Bug 0571](../bugs/0571-a-mention-cannot-be-selected-by-how-it-is-written.md) is fixed. Then A ships as a documented example from public blocks: `mentions()` with the footnote pattern, `not(areLinked())` (kept or dropped as the link-text fixtures decide), `.notExist()` and `.rule({ suggestion })`. No new API, and no package moves. The basis is the established pattern for text of a named shape, the dangling-reference example in `examples/md/`. Shipping it earlier leaves false reds on footnote marks in inline code, which the proposal's own criteria forbid |
| B — a definition is referenced     | `Held`      | "Referenced" is measured against GitHub's renderer (chains, self-reference, cycles, duplicates), and the ask is widened to "a definition is referenced", covering link definitions (262 unused link definitions in 98 READMEs, 0 unused footnotes). The name leaves room for that under [ADR-023](../../adr/023-a-predicate-and-a-condition-that-share-a-word.md). Then a re-review of B alone                                                                                                                                                                                  |

**Recommended next step:** when the fix in
[bug 0571](../bugs/0571-a-mention-cannot-be-selected-by-how-it-is-written.md) lands, A goes to
`/plan`, or is carried as a box on that bug: a separate `examples/md/` file, one sentence in
`docs/markdown.md`, and fixtures for a clean corpus with defined references in every container, a
deleted definition, a renamed definition, a `` `{x}`[^1] `` table cell, and both link-text inputs
above. Lines 52-58 are rewritten to match. B is refiled as "a definition is referenced" once its
meaning is measured. No plan for B until it is unheld.
