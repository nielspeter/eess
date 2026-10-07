# Proposal 013 — md: a declared relation between two documents is reciprocated

**State:** Draft — filed 2026-10-07 at the maintainer's request ("yes file the proposal"), after an
inbound question from an agent in a consuming project. Surveyed against this repo's source at
`9d18f0e`, with the composition measured on a fixture (below). Not reviewed.
**Priority:** Medium — no false green in a shipped rule today. Two corpora already check the same
property by hand, and the obvious composition with released parts fails open.
**Origin:** inbound · consuming project, verified here; this repo is the second consumer.
**Affects:** `@nielspeter/eess-md` (a selector and a rule); possibly `@nielspeter/eess` (the
`beComplete()` exemption over an empty side, see bug 0400).

## Problem

eess-md checks that a link resolves (`linkResolves`, `packages/md/src/conditions/resolve.ts:118`).
Nothing checks that a relation two documents declare is held from both ends.

Most links are one-way by nature, so "every link must link back" is not a spec. What two corpora
actually want is narrower: links made under a **declared marker** must be answered by the target.

- **The consumer's.** A `**Related to:**` line lists the records a record relates to; each must
  link back. It wrote this as a custom rule: a `definePredicate` for links on that line and a
  `defineCondition` that regex-scans the target's text for a link back.
- **This repo's.** A proposal with an accepting ruling must be answered by a plan that declares
  `**Implements:** proposal NNN`. That check lives in a project script
  (`scripts/lib/proposal-ruling.mjs`, called from `scripts/check-corpus.mjs`), not in eess-md, and
  was never generalised. It is not a link-back check (the proposal side is a ruling, the plan
  side a header field), but it is the same property: a declaration on one document that another
  document must answer.

## Existing code survey

- **Links are parsed with their source and line.** An `MdLink` carries `url`, `line`, `external`
  and `doc` (`packages/md/src/model/links.ts:72-74`).
- **Resolution exists and is internal.** `resolveTargets` strips `#fragment`, URL-decodes, treats a
  leading `/` as repo-rooted, and joins with `posix` (`packages/md/src/conditions/resolve.ts`,
  around lines 55-70). It is not exported. The consumer's rule re-implemented it with
  `path.join` and a text regex, which misses anchors, decoding, repo-rooted links,
  reference-style links, and different spellings of the same path.
- **`correspondence()` is re-exported by eess-md** (`packages/md/src/index.ts:50`) and reports what
  is missing from either side (`beComplete`, `packages/core/src/correspondence.ts:109`).
- **No marker selector.** Selecting "links on a `**Related to:**` line" needs a hand-written
  predicate over `doc.text`; there is no `links(c).that().onLineStarting(…)` or section selector.

## Measured: the composition with released parts

A fixture under the scratchpad, run with this repo's built CLI (about 60 ms per run):

- `docs/a.md` relates to `b.md`; `b.md` does not link back.
- `docs/c.md` relates to `./sub/d.md#top`; `sub/d.md` links back as `../c.md`.

The rule: `links(c)` selected twice with `.select()`. The left side is the `**Related to:**`
links, keyed `source->target`. The right side is every internal link, keyed `target->source`.
Then `correspondence(…).should().beComplete({ direction: 'left-to-right' })`. Targets were
resolved with a hand-written posix join that strips the fragment and decodes.

| case                                                             | result                    |
| ---------------------------------------------------------------- | ------------------------- |
| as above                                                         | red: `a.md` → `b.md` only |
| `b.md` given a link back                                         | green                     |
| no `**Related to:**` lines                                       | **green**                 |
| no links at all                                                  | **green**                 |
| the predicate's marker misspelt, `**Related to:**` lines present | **green**                 |

The first two rows are the property working, including the `./`, `../` and `#anchor` spellings.
The last three are a vacuous pass: the rule examined no relation and stayed green. The consumer's
own rule refuses zero units, so it is safer than this composition.

The misspelt-marker row is the dangerous one. `beComplete()` is an absence assertion ("no element
lacks a counterpart"), so it is exempt from the zero-examined finding by design
(`packages/core/src/correspondence.ts:104-107`). With `direction: 'left-to-right'` and an empty
left side, it has nothing to check and nothing to refuse, so a selector that matches nothing is
never reported. That is filed separately as bug 0400, because it is a gap in shipped kernel code
whatever this proposal's ruling is.

## Asks

- **A — a selector for links under a declared marker.** Links on a line starting with a given
  marker, or in a given section, without hand-parsing `doc.text`.
- **B — a reciprocity rule over that selection.** Each selected link's target must link back to
  its source, resolved with eess-md's own resolver on both ends. It refuses zero selected links
  unless the rule declares that empty is expected.
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
- **Break class:** the rule passes having examined nothing. Fixtures: no marker lines, and no
  links. Both red unless empty is declared expected.
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
