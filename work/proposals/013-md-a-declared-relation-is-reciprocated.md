# Proposal 013 — md: a declared relation between two documents is reciprocated

**State:** Draft — filed 2026-10-07 at the maintainer's request ("yes file the proposal"), after an
inbound question from an agent in a consuming project. Surveyed against this repo's source at
`9d18f0e`, with the composition measured on a fixture (below). Revised the same day after method
review (see "Corrections"). Reviewed 2026-10-07 (architect · product · enforcement), ruling
`Split and sequence`; every ask `Held` (see "Review — 2026-10-07").
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
correctly narrowed to declared relations. Their verdicts differ (architect and enforcement: "Ship
with changes" once restructured; product: "Split and sequence"), and so do their positions on
Open Questions 1 to 4 and on a kernel gap (question 6 below). The asks are three shippable things
with different blockers, so they are split here. No ask is accepted by this review; each row below
is `Held` until the maintainer accepts it and a plan owns it. This section was revised before
merge after a method review found the first synthesis unfaithful in five places.

### What all three lenses support

- **B is a condition on `links()`, not a `correspondence()` composition.** The architect argued it
  (C1), product preferred it (its I3), and enforcement's criteria are met by it. For each selected
  link, the check is whether the target holds any link resolving to the source: set membership
  against an index of every internal link in the corpus, the same shape as `linkResolves`
  (`packages/md/src/conditions/resolve.ts:118`). Built that way:
  - several links back are one answer, so the measured false red disappears;
  - `examined` is the selected links only, so a misspelt marker selects nothing and the existing
    zero-examined finding fires, with no dependence on bug 0400's decision;
  - each finding reports its own source line, and the condition composes through `satisfy()`.
- **The condition is not cardinality-exempt** (enforcement). "No selected link lacks a back-link"
  has the form of an absence assertion, which is the reasoning that made `beComplete()` exempt
  (`packages/core/src/cardinality.ts`); the plan must say it is not. Zero loaded documents outranks
  an `.expectEmpty()` on it (ADR-010 §3).
- **A's break class belongs to the rule that consumes the selector**, because
  `RuleBuilder.select()` returns a bare `Selection` with no evidence
  (`packages/core/src/rule-builder.ts:195-197`) (architect, enforcement).
- **"A line starting with the marker" fails open** (architect, enforcement, measured): a wrapped
  header field or a marker followed by a list leaves links unselected while `examined` stays above
  zero, and a reference-style link on a marker line is invisible. The unit is the Markdown block. A
  label form shares eess-md's existing label grammar, private to the ledger rule
  (`packages/md/src/rules/ledger.ts:147-152`), rather than adding a second (architect).
- **C is a function, not a field on `MdLink`** (architect, product): the resolved target depends on
  `LinkResolveOptions` and can be several candidates (`packages/md/src/conditions/resolve.ts:57-70`),
  while the corpus is parsed before any rule's options exist. The lenses disagree on its signature:
  the architect proposes `resolveLink(link, corpus, options)` returning the one existing repo path
  or `undefined`; product proposes `resolveLink(link, options?)` returning every candidate. B must
  take the same `LinkResolveOptions` either way.

### What the acceptance criteria must add before any plan

- **One finding per cause, each with a remedy that clears it** (enforcement, measured). Today a
  one-way relation, a target outside the corpus roots that does link back, a missing target and a
  frozen target all produce the same message with the same remedy, which works for only the first
  (ADR-009 rule 2). The finding is anchored at the source's marker line and names the target.
- **Silent shapes are findings.** A marker block from which no link is selected (a reference-style
  link, an unparsed form) is reported, not passed (ADR-016). A target whose back-link is
  reference-style is a false red for B, since eess-md does not parse those (product); the plan
  states that limit or settles reference links first.
- **A near-miss marker** in one record (`**Related To:**` beside `**Related to:**`) is reported or
  named as a residual; today it is silently unexamined (enforcement, measured).
- **Self-links.** `[self](a.md#a)` passes by construction; `[self](#a)` gives a false red through a
  hand-written resolver. Both are excluded with a count or reported (enforcement).
- **The non-vacuity row cannot be built as written**: this repo runs no such rule. It becomes a
  fixture corpus under `scripts/nonvacuity/`, one row per cause, recorded as one tier weaker than a
  production gate (enforcement).
- **C's break class cannot fail as worded.** It names the real corruptions: an emptied resolver
  reddens a spelling table (`./`, `../`, `#frag`, `%20`, leading `/`), and `linkResolves` not
  calling the exported function is caught (enforcement).
- **Fixtures pin code fences and HTML comments**: a back-link only inside either stays red
  (enforcement M5).
- **Element names carry no line number**, or every edit above a link makes an exclusion stale
  (ADR-018) (architect M2). The measured fixture's `identify` does this; the shipped condition does
  not.
- **The several-back-links row is a false-positive pin, not a break class**; it stays, relabelled
  (enforcement).

### Open questions, argued and left to the maintainer

1. **How a relation is declared.** Blocks A (all three). Product argues for the section form first
   (mirroring `haveSection()`) and a label form once its matching rule has a fixture; the
   architect argues for the block-scoped label, optionally with a section, and asks for a
   `sectionPath` on links rather than a third heading walk. Front matter is a separate ask: eess-md
   has no front-matter model.
2. **What counts as the answer.** Not blocking if it is a parameter. Product argues for a generic
   form, a link back that satisfies a predicate, with "any link" as the default; that also covers
   asymmetric pairs such as "Supersedes" answered by "Superseded by". It wants this decided before
   B. The architect also argues for "any link" as the default, with the strict form one argument
   away. Enforcement argues the reverse default, since "any link" misses a relation removed from
   the marker but still mentioned in prose.
3. **Frozen targets.** Enforcement calls it blocking for B; the architect and product do not.
   Enforcement: exempt with a count in the summary, or report with the remedy "remove the
   relation". Product: add `areLive()`/`areFrozen()` to `links()`, the words `pointers()` already
   has, and count frozen targets. Architect: no new mechanism; bug 0253 decided frozen documents'
   links are still checked, so an uncounted exemption would contradict it, and the remedy is on the
   editable source line.
4. **An unresolvable target.** Enforcement and the architect call it blocking for B; product does
   not, but wants it to fail closed. All three argue for a finding of its own here rather than
   leaving it to `linkResolves`.
5. **The proposal↔plan check** stays a script; one side is not a link. Not blocking (all three).
6. **A public "at least one counterpart" option on the kernel's `correspondence()`.** Product calls
   it blocking for B's shape and counts two consumers (the proposal↔plan script, which reaches
   `matchSelections` through `@nielspeter/eess/internal`, and this proposal's composition). The
   architect counts one, since with B as a condition this proposal no longer needs it, and would
   build it once a second consumer appears, designed with bug 0400's count decision. No record owns
   this gap today; it is recorded here until the maintainer decides whether it gets its own.

**Dogfooding.** This repo has no link-based two-way relation today. The nearest candidate is the ADR
"Extends" headers (ADR-016 and ADR-018 extend ADR-009, which does not link back); whether ADRs gain
"Extended by" links is the maintainer's call, and would give B a production rule.

### Disposition, per ask

| ask                                        | disposition | what would unhold it                                                                                               |
| ------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| **C** — exported `resolveLink()`           | **Held**    | a plan owns it. Its signature is decided below (decision 7). It is the recommended first step                      |
| **A** — selector for a declared relation   | **Held**    | a plan owns it. Open Question 1 is decided below (decision 2)                                                      |
| **B** — reciprocity condition on `links()` | **Held**    | A and C built; the acceptance criteria above added; a plan owns it. Open Questions 2, 3, 4 and 6 are decided below |

### Corrections

The submission above:

1. proposed the reciprocity rule's shape through a `correspondence()` composition;
2. attached A's break class to the selector;
3. selected by physical line;
4. left the message unspecified;
5. did not state that its "refuses zero" depended on bug 0400;
6. specified a non-vacuity row this repo cannot build;
7. wrote a break class for C that cannot fail;
8. labelled a false-positive pin as a break class;
9. gave a rule example that imports `definePredicate` from `@nielspeter/eess`, which an
   eess-md-only adopter does not have. `docs/markdown.md` (lines 206-209) documents the
   alternative: a plain `Predicate<MdLink>` object literal, since eess-md re-exports the types and
   not the helper. The example stands as the measurement that was run. The lenses read this
   differently: product treats it as a documented limitation; the architect asked for it to be
   recorded separately as a standalone-sufficiency gap that `check:family` cannot see. Product adds a
   criterion either way: whatever this proposal exports (Ask C, or a kernel option under question
   6), eess-md re-exports in the same change.

All nine were found by this review and are recorded here rather than edited away.

**Found beside this review, recorded separately:** the architect lens found that `CorrespondenceBuilder`
shares its checks between builders derived from one base, so one rule can report another rule's
finding. Confirmed by measurement; filed in the bug lane as bug 0402.

## Decision — 2026-10-07

Made by the coordinating agent; the maintainer can overrule any of it. The first synthesis left
these questions to the maintainer, who answered that they are not the maintainer's: none depends
on a business priority, taste, a risk to accept or money. They are answered by eess's mission and
its binding ADRs, read for this decision:

- **The mission** (`docs/manifesto.md`, Core Thesis): spec and code are validated against each
  other, and drift in either direction fails the build. eess verifies invariants on what authors
  declare and does not prescribe how they write ("Constraints, not a map").
- **ADR-006:** rules prove themselves in real projects first, then are extracted. Never add a rule
  to a package without real-world validation.
- **ADR-009:** a check that can pass while its drift is present is a false green (rule 1); every
  finding carries a remedy that works on its path (rule 2); published API is guarded to the
  deepest level, with adversarial review and mutation (rule 6).
- **ADR-010 §1 and §3:** for a `RuleBuilder` family the examined unit is the post-filter subject set
  handed to conditions; zero examined is a failing finding absent a declaration. A user-authored
  condition that skips subjects internally is outside that guarantee.
- **ADR-016 rule 7:** an instrument says honestly what it cannot see.
- **ADR-017 rules 6 and 7:** one word means one thing across the family, and no variant ships until
  someone needs it.
- **ADR-018:** a string that names something resolves, or the rule says why not.

**Why B belongs in eess-md at all.** The consumer's rule is the real-world validation ADR-006 asks
for: it runs in that project's gate, refuses zero units, and kills four mutants. As a user-authored
condition it skips frozen and missing targets internally, which ADR-010 §1 places outside the
evidence guarantee. Shipping it in eess-md brings those skips inside the guarantee and gives them
findings of their own.

1. **What counts as an answer: any link back from the target, by default.** This is what the
   validated rule checks, and the consumer's convention needs it: a mail's `**Related to:**` line
   names plans and bugs, and they link back from their own prose, not from a matching line. A
   "counterpart" default would red that project's correct records. The condition takes one
   optional argument, a predicate the link back must satisfy, so a symmetric convention ("Extends"
   answered by "Extended by") is the same condition with a narrower answer, not a second variant
   (ADR-017 rule 7). The drift this default cannot see, a link back that survives in prose after
   the declared relation is removed, is the reason the argument exists, and the condition's
   documentation names it.
2. **How a relation is declared: by the author, as a label or a section.** eess does not choose the
   convention. Both are one mechanism, links owned by a Markdown block, so Ask A covers both. The
   label form shares the ledger rule's grammar (`packages/md/src/rules/ledger.ts:147-152`). A
   label or section that selects nothing is a failing finding (ADR-010 §3, ADR-018).
3. **Frozen targets are reported, never silently skipped.** An unreciprocated link into a frozen
   record is still a disagreement. The finding sits on the source line, which is editable, says
   the target is frozen, and names the remedies that work there: remove the link from the
   declaration, or a counted `.excluding()` that goes stale under ADR-018 (ADR-009 rule 2: "add a
   back-link" is impossible on that path). This follows bug 0253, which decided a frozen
   document's links are still checked. The consumer's rule exempts frozen targets and states it in
   `because`; adopting the shipped condition moves that choice into a finding.
4. **A target that does not resolve is a finding of its own,** not left to `linkResolves`, so this
   rule's verdict never depends on another rule being configured (ADR-009 rule 1).
5. **The proposal↔plan check stays a script.** One of its sides is a ruling, not a link.
6. **No kernel "at least one counterpart" option now.** With B as a condition on `links()`, nothing
   here needs it, and the kernel takes facts, not concepts it has no consumer for (ADR-013). It is
   revisited with bug 0400's decision if a second consumer appears.
7. **C is `resolveLink(link, corpus, options)`,** returning the existing repository path or
   `undefined`, and `linkResolves` calls it, so a custom rule and `linkResolves` cannot disagree
   about where a link points.
8. **Names avoid "relation".** The kernel already uses it (`preserveRelations`, `RelationSpec`), and
   ADR-017 rule 6 gives one word one meaning. The proposal's title keeps its wording as history; the
   API does not use it (for example `.should().beLinkedBack()`).
9. **Dogfooding is not a precondition.** ADR-006 asks for validation in a real project, and the
   consumer supplies it. This repository's nearest candidate, ADR "Extends" headers answered by
   "Extended by", would use the predicate argument from decision 1; whether ADRs gain those lines is
   a separate change to binding documents, decided with the build plan, not here.
10. **The build is published API** (ADR-009 rule 6): its plan carries a sabotage matrix and an
    adversarial review, and the non-vacuity rows run over a fixture corpus.

With these settled, the asks are buildable in order: C, then A, then B. Each disposition row stays
`Held` until a plan owns it.
