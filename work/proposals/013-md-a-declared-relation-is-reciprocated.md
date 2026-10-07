# Proposal 013 — md: a declared relation between two documents is reciprocated

**State:** Draft — filed 2026-10-07 at the maintainer's request ("yes file the proposal"), after an
inbound question from an agent in a consuming project. Surveyed against this repo's source at
`9d18f0e`, with the composition measured on a fixture (below). Revised the same day after method
review (see "Corrections"). Not reviewed as a proposal.
**Priority:** Medium — no shipped rule checks this property, so none is falsely green on it. One consuming project checks the
property by hand, and the obvious composition with released parts both fails open and gives a
false red.
**Origin:** inbound · consuming project. Verified here: the composition below was measured on a
fixture in this repo; the consumer's own rule was not run here.
**Affects:** `@nielspeter/eess-md` (a selector and a rule); `@nielspeter/eess` through bug 0400 (a
one-way `beComplete()` counts the side it never reads).

## Problem

eess-md checks that a link resolves (`linkResolves`, `packages/md/src/conditions/resolve.ts:118`).
Nothing checks that a relation two documents declare is held from both ends.

Most links are one-way by nature, so "every link must link back" is not a spec. What two corpora
actually want is narrower: links made under a **declared marker** must be answered by the target.

- **The consumer's.** A `**Related to:**` line lists the records a record relates to; each must
  link back. It wrote this as a custom rule: a `definePredicate` for links on that line and a
  `defineCondition` that regex-scans the target's text for a link back.
- **An analogue in this repo, not a second consumer.** A proposal with an accepting ruling must be
  answered by a plan that declares `**Implements:** proposal NNN`. That check lives in a project
  script (`scripts/lib/proposal-ruling.mjs`, called from `scripts/check-corpus.mjs`). It is not a
  link-back check (one side is a ruling, the other a header field), so it may not fit this ask
  (open question 5). Its script records one lesson that does apply: it matches with
  `matchSelections`, not `correspondence().beComplete()`, because `beComplete()` reports several
  answers as an ambiguity, and several answers are legal there (`scripts/check-corpus.mjs:271-278`).

## Existing code survey

- **Links are parsed with their source and line.** `MdLinkRef` carries `url`, `text`, `line` and
  `external` (`packages/md/src/model/links.ts:6-23`); `MdLink` adds `doc`
  (`packages/md/src/model/links.ts:72-74`). Only inline links become `MdLink`s:
  `collectLinks` visits `link` nodes (`packages/md/src/model/links.ts:36`), so a reference-style
  link, `[text][ref]`, is invisible to eess-md as well as to the consumer's regex.
- **Resolution exists and is internal.** `resolveTargets` strips `#fragment`, URL-decodes, treats a
  leading `/` as repo-rooted, and joins with `posix` (`packages/md/src/conditions/resolve.ts`,
  around lines 55-70). It is not exported. The consumer's rule re-implemented it with
  `path.join` and a text regex, which missed anchors, decoding, repo-rooted links, and different
  spellings of the same path.
- **`correspondence()` is re-exported by eess-md** (`packages/md/src/index.ts:50`) and reports what
  is missing from either side (`beComplete`, `packages/core/src/correspondence.ts:109`).
- **Emptiness can already be declared.** Every kernel terminal has `.expectNonEmpty()`
  (`packages/core/src/terminal-builder.ts:74-91`), and eess-ts's `crossProject()` reports an empty
  side with a per-side `.expectEmpty(side)` (`packages/ts/src/builders/correspondence-builder.ts:273`).
  The kernel `correspondence()` has the first, but bug 0400 keeps it from firing on a one-way check.
- **No marker selector.** Selecting "links on a `**Related to:**` line" needs a hand-written
  predicate over `doc.text`. The nearest selector is `docs(c).that().haveSection()`
  (`packages/md/src/builders/docs.ts:45`), which selects documents, not links.

## Measured: the composition with released parts

A fixture of four documents, run with this repo's built CLI (about 50-90 ms per run):

- `docs/a.md` relates to `b.md`; `b.md` does not link back.
- `docs/c.md` relates to `./sub/d.md#top`; `sub/d.md` links back as `../c.md`.

The rule:

```ts
import { posix } from 'node:path'
import { corpus, links, correspondence, type MdLink } from '@nielspeter/eess-md'
import { definePredicate } from '@nielspeter/eess'

const c = corpus({ roots: ['docs/**'] })
const target = (l: MdLink) =>
  posix.normalize(
    posix.join(posix.dirname(l.doc.relPath), decodeURIComponent(l.url.split('#')[0] ?? '')),
  )
const onMarker = definePredicate<MdLink>('on a marker line', (l) =>
  (l.doc.text.split('\n')[l.line - 1] ?? '').startsWith('**Related to:**'),
)
const id = (l: MdLink) => ({
  name: `${l.doc.relPath}:${l.line} ${l.url}`,
  file: l.doc.relPath,
  line: l.line,
})
const related = links(c)
  .that()
  .areInternal()
  .and()
  .satisfy(onMarker)
  .select({ label: 'Related-to link', identify: id })
const all = links(c).that().areInternal().select({ label: 'internal link', identify: id })

export default [
  correspondence({
    left: related,
    right: all,
    keyBy: {
      left: (l) => `${l.doc.relPath}->${target(l)}`,
      right: (r) => `${target(r)}->${r.doc.relPath}`,
    },
  })
    .should()
    .beComplete({ direction: 'left-to-right' })
    .rule({ id: 'corpus/related-to-links-back' }),
]
```

| case                                                 | declaration         | result                                     |
| ---------------------------------------------------- | ------------------- | ------------------------------------------ |
| as above                                             | none                | red: `a.md` → `b.md` only                  |
| `b.md` given a link back                             | none                | green                                      |
| `b.md` links back twice (`a.md` and `./a.md#x`)      | none                | **red: "the correspondence is ambiguous"** |
| no `**Related to:**` lines                           | none                | **green**                                  |
| no links at all                                      | none                | **green**                                  |
| no links at all                                      | `.expectNonEmpty()` | red: declared non-empty, examined zero     |
| the marker misspelt, `**Related to:**` lines present | none                | **green**                                  |
| the marker misspelt, `**Related to:**` lines present | `.expectNonEmpty()` | **green**                                  |

- **It works** for the plain property, including the `./`, `../` and `#anchor` spellings.
- **A false red.** A target that links back more than once is ordinary prose, and `beComplete()`
  reports it as ambiguous. This is the lesson the proposal↔plan script already recorded.
- **A false green the declaration cannot catch.** With the marker misspelt, the left side is empty
  but the right side is not. `examined` counts both sides, so the zero-examined path, and
  `.expectNonEmpty()` with it, never runs. That is bug 0400, filed separately because it is a
  defect in shipped kernel code whatever this proposal's ruling is.
- With no links at all, `.expectNonEmpty()` works as documented.

## Asks

- **A — a selector for links under a declared marker.** Links on a line starting with a given
  marker, or in a given section, without hand-parsing `doc.text`.
- **B — a reciprocity rule over that selection.** Each selected link's target must link back to
  its source, resolved with eess-md's own resolver on both ends. Any number of links back counts
  as an answer. It refuses zero selected links unless the rule declares that empty is expected.
- **C — expose the resolved target.** Either a resolved path on `MdLink`, or an exported resolver,
  so a custom rule does not re-implement resolution.

## Acceptance criteria

**A — the selector.**

- **Break class:** a marker that matches nothing. It must not leave the rule green; it is reported
  as a dead selector, the way an empty glob is today (ADR-010).
- **Non-vacuity:** a fixture with the marker misspelt goes red.

**B — the reciprocity rule.**

- **Break class:** a one-way relation is not reported. Fixture: one one-way pair, one reciprocal
  pair written with `./`, `../` and `#anchor` spellings. Red names only the one-way pair.
- **Break class:** the rule passes having examined nothing. Fixtures: no marker lines, no links,
  and a misspelt marker with other links present. All red unless empty is declared expected.
- **Break class:** a target that links back more than once is reported. Fixture: two links back,
  one with a fragment. Green.
- **Non-vacuity:** a `check:nonvacuity` row that plants a one-way relation into this repo's corpus
  and requires the rule's id to fire.

**C — the resolved target.**

- **Break class:** a custom rule and `linkResolves` disagree about where one link points. One
  resolver, tested against the spellings above.

## Open questions

1. **How is a relation declared?** A marker line, a header field, a section, or a front-matter
   key. The consumer uses a marker line; this repo uses a header field on one side and a ruling on
   the other, which is not a link at all.
2. **What counts as the answer?** Any link back, or a link back under the same marker. The
   consumer accepts any; a stricter rule would catch a back-link that exists only in passing.
3. **Frozen targets.** A record in a frozen folder cannot be edited to add a back-link. Exempt it,
   and if so, say so in the finding count rather than skipping silently (ADR-009).
4. **A target that does not resolve.** Leave it to `linkResolves`, as the consumer does, or report
   it here too. Leaving it creates a dependency on the other rule running.
5. **Whether this repo's proposal↔plan check should move onto it,** or stays a script because its
   two sides are not both links.

## Out of scope

- Reciprocity of every link. Most links are one-way by design.
- Links into non-Markdown files.
- Bug 0400's fix, which belongs to the bug lane.
- Reference-style links, which eess-md does not parse at all; that is its own question.

## Corrections

The first version of this record (2026-10-07) called this repo's proposal↔plan check a second
consumer, blamed the misspelt-marker pass on `beComplete()`'s cardinality exemption, and left out
`.expectNonEmpty()` and eess-ts's `crossProject()` from the survey. Method and enforcement review
found all three, and found the false red on several links back, which the first table did not
test.

## Review — 2026-10-07

**Ruling: Split and sequence**

Reviewed by the architect, product and enforcement lenses, after an existing-code survey that found
no reciprocity or backlink capability in any package. All three agree the problem is real and
correctly narrowed to declared relations. They disagree only on the verdict's name: the architect and
enforcement lenses ruled "Ship with changes" once restructured, and the product lens ruled "Split and
sequence". The asks are three shippable things with different risk and different blockers, so they
are split here. No ask is accepted by this review; each row below is `Held` until the maintainer
accepts it and a plan owns it.

### What the review changes about the design

- **B is a condition on `links()`, not a `correspondence()` composition** (architect). For each
  selected link, the check is whether the target holds any link resolving to the source: set
  membership against an index of every internal link in the corpus, the same shape as
  `linkResolves` (`packages/md/src/conditions/resolve.ts:118`). Built that way:
  - several links back are one answer, so the measured false red disappears;
  - `examined` is the selected links only, so a misspelt marker selects nothing and the existing
    zero-examined finding fires, with no dependence on bug 0400's decision;
  - each finding reports its own source line, and the condition composes through `satisfy()`.
    The condition must not be marked cardinality-exempt (`packages/core/src/cardinality.ts`): "no
    selected link lacks a back-link" has the form of an absence assertion, which is the reasoning that
    made `beComplete()` exempt (enforcement).
- **A's break class belongs to the rule that consumes the selector, not the selector.**
  `RuleBuilder.select()` returns a bare `Selection` with no evidence
  (`packages/core/src/rule-builder.ts:195-197`), so a selector cannot go red (architect,
  enforcement).
- **"A line starting with the marker" fails open.** A header field that wraps, or a marker followed
  by a list, leaves links unselected while `examined` stays above zero (architect), and a
  reference-style link on a marker line is invisible (enforcement, measured). The unit is the
  Markdown block: a paragraph or list item whose leading label matches. eess-md already has a label
  grammar, private to the ledger rule (`packages/md/src/rules/ledger.ts:147-152`); A shares it
  rather than writing a second one (architect). A section form, mirroring
  `docs(c).that().haveSection()`, is the more common declaration and has no parsing ambiguity
  (product).
- **C is a function, not a field on `MdLink`.** The resolved target depends on
  `LinkResolveOptions` and can be several candidates (`packages/md/src/conditions/resolve.ts:57-70`),
  while the corpus is parsed before any rule's options exist. So: an exported
  `resolveLink(link, options)`, used by `linkResolves` and by B (architect, product).
- **A kernel "at least one counterpart" option for `correspondence()` is not part of this
  proposal.** With B as a condition, this proposal no longer needs it. The gap is real but has one
  consumer today (the proposal↔plan script, which reaches `matchSelections` through
  `@nielspeter/eess/internal`); it belongs with bug 0400's decision (architect; the product lens
  argued for it, before the condition shape removed this proposal's need).

### What the acceptance criteria must add before any plan

- **One finding per cause, each with a remedy that clears it** (enforcement, measured). Today a
  one-way relation, a target outside the corpus roots that does link back, a missing target, and a
  frozen target all produce the same message with the same remedy, which works for only the first
  (ADR-009 rule 2). The finding is anchored at the source's marker line and names the target.
- **Silent shapes are findings.** A marker block from which no link is selected (a reference-style
  link, an unparsed form) is reported, not passed (ADR-016).
- **A near-miss marker** in one record (`**Related To:**` beside `**Related to:**`) is either reported
  or named as a residual; today it is silently unexamined (enforcement, measured).
- **Self-links** are excluded with a count or reported; today one passes by construction
  (enforcement, measured).
- **The non-vacuity row cannot be built as written**: this repo runs no such rule. It becomes a
  fixture corpus under `scripts/nonvacuity/`, one row per cause, recorded as one tier weaker than a
  production gate (enforcement).
- **C's break class cannot fail as worded.** It names the real corruptions: an emptied resolver
  reddens a spelling table (`./`, `../`, `#frag`, `%20`, leading `/`), and `linkResolves` not
  calling the exported function is caught (enforcement).
- **The several-back-links row is a false-positive pin, not a break class**; it stays, relabelled
  (enforcement).

### Open questions, argued and left to the maintainer

1. **How a relation is declared** blocks A. The reviewers argue for the section form first and a
   block-scoped label second; front matter is a separate ask, since eess-md has no front-matter model.
2. **What counts as the answer** does not block if it is a parameter. The architect and product lenses
   argue for "any link back" as the default with a stricter form one argument away; enforcement
   argues the reverse, since "any link" misses a relation removed from the marker but still
   mentioned in prose, and is a weaker claim than the title.
3. **Frozen targets** blocks B. Enforcement: exempt with a count, or report with the remedy "remove
   the relation". Architect: bug 0253 decided frozen documents' links are still checked, so a
   silent exemption would contradict it.
4. **An unresolvable target** blocks B. All three lenses argue for a finding of its own here rather
   than leaving it to `linkResolves`, which would make this rule's green depend on another rule.
5. **The proposal↔plan check** stays a script; one side is not a link. Not blocking.

**Dogfooding.** This repo has no link-based two-way relation today. The nearest candidate is the ADR
"Extends" headers (ADR-016 and ADR-018 extend ADR-009, which does not link back); whether ADRs gain
"Extended by" links is the maintainer's call, and would give B a production rule.

### Disposition, per ask

| ask                                        | disposition | what would unhold it                                                                                                                             |
| ------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **C** — exported `resolveLink()`           | **Held**    | the maintainer accepts it and a plan owns it. No open question blocks it; it is the recommended first step, and helps any custom link rule today |
| **A** — selector for a declared relation   | **Held**    | Open Question 1 settled (section, label, or both), the label grammar shared with the ledger, and a plan owns it                                  |
| **B** — reciprocity condition on `links()` | **Held**    | A and C built; Open Questions 3 and 4 settled; the acceptance criteria above added; a plan owns it                                               |

### Corrections

The submission above proposed the reciprocity rule's shape through a `correspondence()` composition,
attached A's break class to the selector, selected by physical line, left the message unspecified,
did not state that its "refuses zero" depended on bug 0400, and specified a non-vacuity row this
repo cannot build. All six were found by this review and are recorded here rather than edited away.

**Found beside this review, recorded separately:** the architect lens found that `CorrespondenceBuilder`
shares its checks between builders derived from one base, so one rule can report another rule's
finding. Confirmed by measurement; filed in the bug lane as bug 0402.
