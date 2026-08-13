# Proposal 002 — eess-md: Resolve Markdown Links Embedded in Source-Code Comments

**State:** Draft — reviewed 2026-08-12 (product · plus survey and spike). Problem
**accepted**; primitive **rejected as specified**; the widened primitive is
**deferred behind plan [0090](../plans/0090-adopt-ts-archunit-work-corpus.md)**.
See _Review_ below — it is the operative section, and the design below it is
preserved as submitted, not as agreed.
**Priority:** Medium
**Origin:** **inbound** — authored by an agent working in the reference corpus
(the external project measured in _Evidence_), not by this repo. Recorded here so
a later reader cannot mistake it for our own design. Its measured claims about
that corpus are reproduced as an external data point; every claim about _this_
repo is our own measurement.
**Affects:** new `commentLinks()` builder + `model/comment-links.ts` (new
files); `linkResolves()`, `mdViolation()`, `Corpus.fileIndex` (reused
unchanged, no signature changes)

## Problem

`eess-md`'s link and pointer checks only see one direction of the doc↔code
relationship. A markdown file can cite a code location (`pointers()`,
`path.ext:line`) and another markdown file (`links()`, `[text](url)`), and
both are checked — `corpus()` indexes the whole repo tree for resolution
targets. But a **source file citing a doc back** is invisible: `corpus()`
only ever _parses_ `.md` files into the `MdDocument`s that `links()` walks
(`corpus.ts:91`, `.filter((rel) => rel.endsWith('.md') ...)`). A `.ts`/`.vue`
file's comments are never read at all.

In practice, engineers write exactly this citation — a `//` or `/** */`
comment pointing at the bug/plan/ADR that explains a piece of code — because
it is the single most useful place to put it: right where the reader is. That
citation uses real markdown link syntax in every project observed so far. It
gets zero benefit from a dialect whose whole thesis is "cross-links resolve,
code pointers point at real lines" (`docs/markdown.md:5`), because it sits on
the wrong side of a file-extension filter.

This is a distinct reference shape from proposal 001's rule 6 (`fileRefs()`)
— that one is about a **markdown document** citing a path as _inline code_
(`` `support/mails/….eml` ``), a bare-path shape with no link syntax, checked
against corpus-internal evidence files. This proposal is about a **source
file** citing a doc as a _real markdown link_, the reverse direction and a
different syntax. The two close adjacent but non-overlapping gaps in the same
graph.

## Evidence

> **Re-sourced 2026-08-12.** As submitted, this section quoted verbatim source
> comments from the external corpus, including its own language and two of its
> real bug slugs. That material is client-identifiable and cannot live in this
> repo under our name, so it is replaced below by our own measurement — which
> proves the same lifecycle argument, and proves it harder. The external
> numbers are kept as an unnamed data point, the way
> [001](./001-md-corpus-rule-coverage.md) already keeps its corpus unnamed.

### This repo — measured 2026-08-12, spike over 218 source files

Source comments in this repo cite the corpus **130 times**. **51 of those
citations (39%) resolve to nothing**, across 24 distinct targets.

The drift is real and already realised. Three examples, all in the kernel's own
public documentation:

- `packages/core/src/condition.ts:27` — "See proposal 011 / plan 0057."
  Neither exists here.
- `packages/core/src/report.ts:9` — "(plan 0070, ADR-008)". Plan 0070 lives
  only in `work/plans/completed/`; it moved when it closed.
- `packages/core/src/apply-fixes.ts:22` — "(plan 0066)". Likewise.

The second and third are exactly the lifecycle the submission describes: a
citation written when the target was live, left behind when our own close
convention moved the file. Written as relative links they would be 404s today.

**Two of the 51 are unambiguous, native, current drift.** `ADR-009` is cited as
an existing decision at `scripts/check-review-harness.mjs:23` and
`scripts/nonvacuity/bad-review-harness.mjs:8`. `adr/` stops at 008 — plan 0088
Phase 2 is what will create it. Both citations shipped in a PR merged the same
day this review ran, under a full green `npm run validate`. Filed as bug
[0103](../bugs/0103-adr-009-cited-but-does-not-exist.md).

The remaining 49 are ts-archunit ancestor numbers (plans 0001–0042, 0057,
proposals 010/011). This repo's own sequence starts at 0051, so they are not rot
— they are citations into a corpus we have not adopted yet, which is precisely
the work of plan
[0090](../plans/0090-adopt-ts-archunit-work-corpus.md). **This is the blocker
that defers the capability:** until 0090 resolves them, a citation-resolution
gate cannot go green here, and a gate that cannot go green cannot be dogfooded.

### The encoding gap — why the proposed API sees none of this

The 130 citations are **bare identifiers** — `(plan 0070)`, `ADR-008`,
`proposal 011`. Almost none use the markdown-link syntax this proposal
extracts. Running the design below exactly as specified over the same 218
files yields:

|                              | Extracted | True positives | False positives |
| ---------------------------- | --------- | -------------- | --------------- |
| Proposed `commentLinks()` v1 | 2         | **0**          | **2**           |
| Bare-identifier citations    | 130       | 79 resolve     | 51 dangling     |

Both false positives are prose _describing_ link syntax, inside inline-code
spans in a real comment: `packages/md/src/model/links.ts:34` and
`spec.rules.ts:160`. See _Review_ for why that is a design defect rather than a
tuning problem.

### The external corpus — unnamed, retained as a demand signal

The submitting project reports 18 source files carrying comment citations into
its own `work/bugs/**`, several as literal relative markdown links, in both
comment styles, against a corpus that has run `eess-md` in CI since 2026-07.
We cannot see that corpus and have not verified the figure. It is retained
because an unprompted, correctly-cited proposal from a real external consumer
is the strongest demand signal this project has had — and because it is the
only evidence that the _link_ encoding occurs in the wild at all.

## Review — 2026-08-12

**Ruling: adopt the problem, decline the primitive, defer the API behind plan
[0090](../plans/0090-adopt-ts-archunit-work-corpus.md).**

Everything below this section is the submission as received. It is preserved,
not endorsed — where the review falsified a claim, the claim is annotated in
place rather than edited away, so the record shows what was argued and what
survived.

### What the review accepted

The diagnosis is correct, and this repo has the defect worse than the
submitting one: a source file citing a doc is invisible to `corpus()`, the
citation rots on the corpus's own normal lifecycle, and nothing watches it.
The layering analysis is the strongest part of the submission — every field it
claims `linkResolves()` and `mdViolation()` read was checked against
`packages/md/src/conditions/resolve.ts:72` and found accurate, so the "condition
runs unmodified" and "autofix comes for free" claims both hold. That is what
makes the rework cheap rather than a rewrite.

### Why the primitive is rejected as specified

1. **It is shaped to the submitter's encoding, and that encoding is not the
   general one.** 130 of this repo's citations are bare identifiers; the
   proposed element type sees none of them. The honest primitive is a comment
   **reference** parameterised by matcher — link form resolving against
   `fileIndex`, identifier form against the corpus — not a comment **link**.
   The extraction machinery is identical; only the matcher and the resolution
   target differ.
2. **Measured 0 true positives and 2 false positives in this repo** (see
   _Evidence_).
3. **The false positives come from dropping a protection the cited precedent
   keeps.** `collectLinks()` gets inline-code and fenced-code immunity free
   from mdast — its own docstring says so at
   `packages/md/src/model/links.ts:34`. `extractPointers()` is **not** the pure
   line-by-line regex scan this proposal cites it as: it calls `fencedRanges()`
   first (`packages/md/src/model/pointers.ts:52`) precisely to buy that
   protection back. The submission cites the technique and drops the guard.
   Stripping inline-code spans removes both false positives — and still yields
   zero true positives here.
4. **It inherits bug [0086](../bugs/fixed/0086-links-to-directories-do-not-resolve.md),
   unnamed.** Reusing `linkResolves()` unmodified inherits every open defect in
   it, including "a link to a directory that exists is reported broken". A
   comment citing `../../work/bugs/` is exactly that shape. The submission cites
   bug 0087 and misses 0086.

### Corrections to specific claims in the text below

- **Design → Comment-span extraction** names one imprecision — a comment-shaped
  sequence inside a string literal — and dismisses its blast radius. The
  false-positive class actually observed is a different one the submission
  never considers: **link syntax written as documentation prose inside an
  inline-code span in a real comment.** It is the only class that occurs here,
  and it occurs in the very file the feature would sit beside.
- **Error Handling** asserts the approach "introduces no new failure shape" and
  is "consistent with how mdast's own link-node parsing already behaves
  elsewhere in the dialect." Both are false: mdast's link parsing skips inline
  code; a raw regex does not. The two measured false positives are the proof.
- **Open Question 1** asks what threshold of observed false positives justifies
  revisiting the regex approach. As posed it is unanswerable by this repo — it
  depends on a corpus we cannot see. It must be restated against evidence we
  can measure before it can be settled.

### Placement

`eess-md`, but as a narrower element type, not as `commentLinks()`. Resolving
`plan 0070` to a file is a **corpus** lookup, and no other dialect has a corpus:
not `eess-ts` (which does own the AST-exact alternative — it already exports
`comment(pattern)` at `packages/ts/src/index.ts:191`, so the submission's
costing of that path as unbuilt is wrong), not `eess-crossvalidate` (whose
charter is pairs importing two concrete dialects, and where landing it would
break standalone sufficiency for anyone who wrote rules against `eess-md`), and
not the kernel — nothing that knows what a plan number is belongs there.

### Unresolved, carried forward

- **Scope asymmetry:** `path:line` pointers in comments are the same drift
  class and are covered nowhere — not by this submission, not by its Scope
  section.
- **Naming:** `include` is a fourth word for "which files" beside
  `roots`/`ignore`/`frozen`, crossvalidate's `glob`, and 001's `within`. 001 and
  002 must land on one word before either ships.
- **`extensions`** is the wrong knob; the variable is comment _syntax_
  (`//` vs `#`), not file extension.

## Proposed API

```ts
import { corpus, commentLinks } from '@nielspeter/eess-md'

const c = corpus({ roots: ['work/**'] })

// New builder, parallel to links()/pointers() — reads a *different*,
// explicitly-scoped file set (source, not markdown), off the same Corpus.
commentLinks(c, { include: ['server/**', 'app/**', 'shared/**'] })
  .that()
  .areInternal()
  .should()
  .resolve()
  .because('a comment citing a moved/closed doc is a dangling pointer no one is watching')
  .check()
```

`.that()`/`.should()`/`.resolve()`/`.check()`/`.warn()` are the same
`RuleBuilder` surface every other md element type already has — this is a
`getElements()` plus a scope option, not a new fluent API.

## Design: `commentLinks()` — link elements sourced from source-code comments

**Recommended approach:** extract markdown-style `[text](url)` occurrences
from comment regions of source files with a regex scan (mirroring the
existing `extractPointers()` technique — line-by-line regex over raw text,
`model/pointers.ts:52-86`), and wrap each match in the _existing_ `MdLink`
shape, backed by a minimal document carrier built from the real source
file's real text — not a synthetic markdown-parsed document. Feed the result
straight into the **unmodified** `linkResolves()` condition
(`conditions/resolve.ts:72`).

**Why this layering wins:**

- `linkResolves()` and `mdViolation()` need zero changes. Reading
  `conditions/resolve.ts:84-100`, the only fields of `MdLink`/`link.doc` they
  touch are `url`, `line`, `external`, `urlStart`/`urlEnd`, and
  `doc.relPath`/`doc.file`/`doc.text` — none of `MdDocument`'s
  markdown-structural fields (`sections`, `tables`, `codeBlocks`, `root`).
  A carrier populating only the fields actually read, with `sections: []`,
  `tables: []`, `codeBlocks: []`, `root: <empty tree>`, satisfies the
  interface and the condition runs unchanged. The existing, tested doc↔doc
  link-resolution path carries zero risk from this addition.
- `Corpus.fileIndex` already indexes **every file in the repo, any
  extension** — it's built by `walk()` (`corpus.ts:50-67`) before the `.md`
  filter is applied (`corpus.ts:91`). `commentLinks()` needs no change to
  `corpus()`/`CorpusOptions` at all; it filters the existing `fileIndex` by
  its own `include` globs and reads those files directly.
- **Autofix comes for free.** `ArchFix` and its applier
  (`packages/core/src/apply-fixes.ts`) operate on `{file, start, end,
replacement}` with no markdown-specific assumption anywhere in that
  signature. `movedLinkFix()` (`conditions/resolve.ts:112-132`) already
  computes a relative-path rewrite from any `link.urlStart`/`urlEnd` inside
  any `link.doc.file` — pointed at a `.ts` file's comment instead of a `.md`
  file's prose, the same "byte-eksakt" repair `eess:fix` already gives
  markdown applies unchanged. This is a genuine, unplanned payoff of reusing
  `MdLink` rather than inventing a parallel element.
- Matches the established precedent for heuristic extraction: `fileRefs()`
  (proposal 001, `work/proposals/001-md-corpus-rule-coverage.md:342-344`)
  "must take an opt-in scope... Absent an explicit scope it should match
  nothing rather than guess." The same caution applies here for the same
  reason — this is heuristic text scanning, not an AST guarantee, so an
  unscoped default risks scanning `node_modules`/generated code and
  producing noise nobody asked for.

**Alternative rejected:** widen `corpus()` to also parse comment text through
`fromMarkdown()`/GFM and merge the results into `documents()`, so
`docs()`-based rules see source files as documents too. Rejected on three
grounds:

1. **Pollutes `docs()`'s element set.** Every existing `docs()`-based rule
   (`haveSection`, `haveTable`, `terms()`, `honestyAtClose()`) would start
   silently iterating source files that have no real markdown structure —
   scope creep into a builder surface this proposal doesn't need to touch.
2. **Reintroduces the exact stitching problem the recommended approach
   avoids.** Comments in a source file are scattered, non-contiguous spans.
   A synthetic per-file "document" built by concatenating them needs its own
   line-offset map back to the real file — machinery the recommended
   approach doesn't need at all, because it scans the real file's real text
   line-by-line and reports real line numbers directly, the same way
   `extractPointers()` already does for markdown pointer syntax.
3. **Would silently misparse JSDoc.** A JSDoc block's leading `*`
   continuation lines are not markdown bullets, but `fromMarkdown()` doesn't
   know that — it would produce spurious list/emphasis structure with no
   fixture watching for it. This is the same class of silent misparse that
   [bug 0087](../bugs/0087-frontmatter-parsed-as-setext-heading.md) already
   demonstrates this parser is capable of on a different construct
   (frontmatter's closing `---` read as a setext heading). Widening the
   parser's input surface without first closing that class of bug is buying
   a second instance of a known problem.

### Comment-span extraction — regex now, exact-AST deferred

Finding "where is a comment" without a real lexer is a known-imprecise
problem: a `//` or `/*` sequence inside a string or template literal can be
mistaken for a comment start by a pure regex scanner. Two paths exist, and
this proposal recommends the first as a first cut, not as a final answer:

1. **Regex-based (recommended for v1).** Line-comment (`//...`) and
   block-comment (`/\*[\s\S]*?\*\//`) spans found by pattern, no new
   dependency, stays inside `eess-md`'s existing charter (it never parses
   code, only markdown-shaped text — the same posture `extractPointers()`
   already has). Known limitation, named rather than hidden: a comment-shaped
   sequence inside a string/template literal can produce a false span. The
   blast radius of that false span is narrow — it only produces a violation
   if the misidentified region _also_ happens to contain well-formed
   `[text](url)` syntax pointing at a non-existent file, which is not a
   pattern that occurs by accident in real string literals.
2. **AST-exact (rejected for v1, candidate follow-on).** `@nielspeter/eess-ts`
   is `ts-morph`-backed (ADR-002, ADR-007) and exposes real comment nodes
   with no lexer ambiguity. Two ways to use it, both heavier than this
   proposal's evidence justifies today: pull `eess-ts` into `eess-md`
   (violates ADR-007's confinement of the AST engine behind one boundary),
   or add this as a new `@nielspeter/eess-crossvalidate` preset alongside
   `adrCitationsResolve`/`md-ts.ts`. The latter is architecturally cleaner
   but is a **behavioral binding tool** by charter
   (`docs/crossvalidate.md:5`: "the pairs that must import two concrete
   dialects") solving a **file-existence** problem — plain link resolution,
   the same claim `links()` already makes for md↔md. Reaching for
   cross-dialect AST binding to answer "does this file exist" is more
   machinery than the question needs, and ADR-006's "rules prove themselves
   in real projects first" argues for shipping the cheap version against a
   real corpus before justifying the expensive one. See Open Questions.

### Document carrier — real file text, not a synthetic parse

The carrier populated for each source file is not a parsed `MdDocument` in
any meaningful sense — it is a plain object shaped to satisfy the interface
at the fields `linkResolves()`/`mdViolation()` read: `file` (absolute path),
`relPath` (repo-relative, matching `corpus.fileIndex`'s convention),
`text` (the file's real, full source — so `urlStart`/`urlEnd` character
offsets from the regex match land in real, addressable positions for
autofix), `frozen` (computed the same way `corpus()` computes it today, via
the same frozen-glob match against `relPath`), and inert empties for
`sections`/`tables`/`codeBlocks`/`root` — fields no consumer of this
element type reads.

### Scope option — mirrors `fileRefs()`, not `links()`

`links()` scans every loaded `.md` document unconditionally, because being a
markdown document _is_ the scope. `commentLinks()` has no equivalent natural
boundary — most of a repo's source tree is not going to cite the doc corpus
— so, like `fileRefs()`, it requires an explicit `include` glob and matches
nothing without one, rather than defaulting to "everything under
`fileIndex`."

## Performance Considerations

`commentLinks()` reads the content of every file its `include` scope
matches — a cost `corpus()` does not otherwise pay for non-`.md` files today
(they're only ever listed in `fileIndex`, never read). This is the same
cost profile `extractPointers()` already pays per markdown document (a
`readFileSync` + line-by-line regex scan), scoped down to whatever `include`
names, so an unscoped-by-default design (see Design → Scope option) also
functions as the performance guard.

## Error Handling

- No comment link found in a scanned file → zero elements for that file, not
  an error — matches `links()`'s existing behavior for a `.md` file with no
  link nodes.
- Malformed link-looking text (unbalanced brackets/parens) → not matched, not
  reported — consistent with how mdast's own link-node parsing already
  behaves elsewhere in the dialect; this introduces no new failure shape.
- The comment-span false-positive risk named above (Design → Comment-span
  extraction) is a documented limitation of the regex approach, not a silent
  gap — recorded here and in Scope, per this corpus's own convention that a
  known imprecision must be named, never left implicit.

## Alternatives Considered

- **AST-exact extraction via a new `crossvalidate` preset.** Correct, but
  the wrong tier for a file-existence claim — see Design → Comment-span
  extraction.
- **Widen `corpus()`/`documents()` to include source files as
  `MdDocument`s.** Pollutes `docs()`'s element set and reintroduces a
  stitching problem the recommended design avoids entirely — see Design →
  Alternative rejected.
- **Leave it as a prose-only convention (status quo).** This is the
  alternative actually in effect today, and it is exactly the failure class
  `eess-md` exists to close on the markdown side (`docs/markdown.md:5`) —
  leaving the code→doc direction of the same graph unchecked is an
  inconsistency in the dialect's own thesis, not a neutral choice.

## Documentation

### `docs/markdown.md` — new "What it checks" entry

Add `commentLinks()` beside the existing `links()`/`pointers()` description
(`docs/markdown.md:30`, "What it checks"), naming the scope requirement
explicitly so a reader doesn't expect repo-wide coverage by default.

### `README.md` — capability table row

`packages/md/README.md`'s dialect surface (currently listing `docs()`,
`links()`, `pointers()` as entry points, `README.md:18,37`) gains
`commentLinks()`, with a one-line note that it reads source files, not
markdown.

### `CHANGELOG.md`

Under `### Added` (via changeset, matching this package's existing
changesets-based release flow):

- `commentLinks(corpus, { include, extensions? })` — markdown-style links
  embedded in source-code comments (`//`, `/** */`), resolved with the same
  `linkResolves()` condition `links()` uses. Opt-in scope required; no
  default include.

## Acceptance Criteria

Every capability below carries its break class — the specific corruption a
fixture must produce, and what the violation must say — per this corpus's
own convention that a gate whose red has never been watched is not evidence
(`work/proposals/001-md-corpus-rule-coverage.md:557-560`).

- [ ] **Broken comment link — block comment.** A `.ts` fixture with a
      `/** ... [text](../missing.md) ... */` comment goes **red**, naming the
      fixture file, the real source line the link occurs on, and the broken
      URL — the same message shape `linkResolves()` already produces for a
      broken md→md link.
- [ ] **Broken comment link — line comment.** The same, for a
      `// [text](../missing.md)` line comment.
- [ ] **Resolving comment link — no violation.** A fixture whose comment
      link points at a file that exists produces zero violations. Proven
      alongside the broken-link fixtures, not alone — a check that only ever
      has a red fixture is unproven in the direction that matters for
      day-to-day use (it must also stay quiet when nothing is wrong).
- [ ] **Out-of-scope file — no elements.** A fixture source file carrying a
      broken comment link, placed outside the configured `include` globs,
      produces zero elements and zero violations — proving the scope option
      is load-bearing, not decorative.
- [ ] **No `include` given — matches nothing.** `commentLinks(c)` with no
      scope option produces zero elements against a corpus whose source tree
      contains a known-broken comment link, proving the "absent scope matches
      nothing" rule actually holds rather than silently defaulting to
      everything under `fileIndex`.
- [ ] **Autofix — moved-file rewrite.** A comment link whose target moved to
      a uniquely-matching basename elsewhere in the repo produces a
      `movedLinkFix` autofix whose `file` is the **source `.ts` file**, and
      applying it rewrites only the URL span inside that file's comment,
      leaving the rest of the file untouched — the concrete proof behind this
      proposal's "autofix comes for free" claim, which is argued from reading
      `apply-fixes.ts`'s signature, not yet verified against a fixture.

## Open Questions

**Two** decisions are unresolved:

1. **Regex MVP vs. AST-exact, and when to revisit.** This proposal
   recommends shipping the regex approach first and treating real false
   positives/negatives observed against the reference corpus (or any other
   real consuming project) as the trigger for reconsidering the AST-exact
   path — consistent with ADR-006's "rules prove themselves in real projects
   first." Unresolved: what threshold of observed false positives justifies
   revisiting, and whether that revisit stays inside `eess-md` or becomes a
   `crossvalidate` preset.
2. **Which file extensions ship in v1.** `extractPointers()`'s `CODE_EXT`
   list (`model/pointers.ts:23`) already names a web-stack-plus-JVM/legacy
   set for markdown-side pointers. Whether `commentLinks()`'s default
   `extensions` option should mirror that list exactly, or start narrower
   (e.g. `ts|tsx|vue` only, matching what's actually been observed carrying
   comment-embedded links so far) and grow on demand, is not decided here.

## Scope

Not covered by this proposal:

1. AST-exact comment-span extraction (candidate follow-on — see Open
   Questions 1).
2. Any comment/language shape beyond what a v1 `extensions` list names (see
   Open Questions 2) — e.g. Python `#` comments or Java/Kotlin
   `//`/`/** */` are structurally similar but unvalidated against any real
   corpus here.
3. Validating that a comment's _prose_ accurately describes its link target
   (a behavioral claim, not a resolution claim — out of `eess-md`'s charter
   by the same reasoning that places AST-exact extraction outside it too).
