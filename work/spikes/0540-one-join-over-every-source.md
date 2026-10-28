# Spike 0540: one join over every source, keyed by where the link points

Measured 2026-10-21 for [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s
held asks B (the target) and the fix, on the maintainer's instruction to dogfood the design on this
repository, whose record numbers collide with ts-archunit's. It ran as throwaway scripts against the
built packages of `main` at 8e258550 on Node 24.14.0, over this repository's `work/`, `adr/` and
`docs/` (569 documents) and ts-archunit at b4084c9 as the upstream source. Nothing here is built;
[spike 0536](./0536-what-a-mention-of-a-record-needs.md) holds the walk and the instruments, reused
here with one change: the pattern is the one [plan 0539](../plans/completed/0539-a-mention-of-a-record-is-a-link.md)
declares, with `\s+`, so mentions across a soft break are counted.

## The question

[Proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s review held B and the fix until a prototype, from public blocks, showed:

1. one join over the union of sources, its left key carrying the source read from where the link
   points, green on correct links to both of two overlapping sources;
2. red on a crossed link, on a URL no source claims, and on a mention after a word in a link to
   another record (a `see`-then-mention link to another record, the review's one-word stamp);
3. a fix derived from the same sources, which does not fire on a collision;
4. a guard that makes an empty mention side red.

## The prototype

- **The sources** are one `Selection`: this repository's records (a lane's numbered files, keyed by
  kind and number) and ts-archunit's closed list (its numbered files, each with the URL it lives at,
  `https://github.com/nielspeter/ts-archunit/blob/main/<path>`). Each element carries its source.
- **Where a link points** is read from its URL: a repository path, or this repository's own GitHub
  URL (22 links in `docs/`), is `local`; a URL under the upstream's base is `upstream`; any other URL
  is `unclaimed`, which no source holds.
- **The join** is the kernel's `correspondence()`, unchanged: left key `source|kind:number`, right key
  the same; `beComplete({ direction: 'left-to-right' })` for "names nothing in the source it points
  at", `preserveRelations()` comparing the exact target, path or URL, for "points elsewhere". A
  `suggest` lists every source's record for the mention's kind and number.
- **Which link mentions are judged.** Every mention in a link's text, except one in a **title link**:
  a link whose text opens with its target record's own number (a link to [bug 0327](../bugs/0327-adr-011-is-written-about-the-kernel-and-the-family-now-has-two-internals.md) whose text is that bug's own title, naming an ADR).
  This replaces 019's "subject or quoted" rule, which left a `see`-then-mention link to another record green.
- **The fix** is the same sources keyed without the source: a plain mention whose kind and number
  exactly one record in any source holds gets that record's target; two or more is a collision and
  gets none; none names nothing.

The fixture, with records `work/bugs/0001-a.md`, `0002-b.md` and `0046-local.md`, and upstream
`bugs/fixed/0046-x.md` and `0047-y.md`:

```md
a local: [bug 0046](../work/bugs/0046-local.md)
b external: [ts-archunit bug 0046](https://github.com/nielspeter/ts-archunit/blob/main/bugs/fixed/0046-x.md)
c crossed: [bug 0046](https://github.com/nielspeter/ts-archunit/blob/main/bugs/fixed/0047-y.md)
d unknown source: [bug 0046](https://example.com/0046)
e wrong local after a word: [see bug 0001](../work/bugs/0002-b.md)
f title link: [0002 — bug 0001 is quoted](../work/bugs/0002-b.md)
g plain on a collision: bug 0046 here.
h plain, one candidate: bug 0002 here.
i external key outside the list: [bug 0048](https://github.com/nielspeter/ts-archunit/blob/main/bugs/fixed/0048-z.md)
j repository's own URL: [bug 0001](https://github.com/nielspeter/eess/blob/main/work/bugs/0001-a.md)
```

## Results

**The fixture: all ten as required.** Green: a, b, f, j. Red, each with its own message: c
(`relates to "…/0047-y.md" but its record counterpart does not`), d (`has no matching record`, the
suggestion naming 0046 in both the local and the upstream source), e (`relates to "work/bugs/0002-b.md"…`), i
(the `… in any source` message, naming the mention no source holds). Fix: h gets `work/bugs/0002-b.md`; g gets none, "local or upstream".
Seven milliseconds.

**This repository, whole corpus:** 6,435 mentions; 1,207 judged links, 5 title links skipped.
**The join reports nothing**, so no correct link here is red: not the links to ts-archunit records,
including the 3 qualified ones (`[ts-archunit bug 0046](…)`) now judged instead of skipped, and not
the 22 own-URL links. 2.8 seconds with the walk.

**The fix over this repository's 4,682 plain mentions:**

| outcome                                        | count |
| ---------------------------------------------- | ----- |
| one record in any source: fixed                | 3,079 |
| a record in both sources: no fix, a reader's   | 1,598 |
| no record in any source: no fix, names nothing | 5     |

The 3,079 include the mentions only ts-archunit holds, which [spike 0536](0536-what-a-mention-of-a-record-needs.md) counted as unfixable: with
the upstream declared as a source, they get its URL.

**An empty mention side is green**, with or without `.expectNonEmpty()`:

| left (mentions) | right (sources) | declaration         | result |
| --------------- | --------------- | ------------------- | ------ |
| none            | one             | none                | green  |
| none            | one             | `.expectNonEmpty()` | green  |

This is [bug 0400](../bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md), open,
reproduced on this composition. A pattern that matches nothing, or a judged-link filter that drops
everything, passes the join.

## Findings

1. **One join over the union, keyed by source, holds** (conditions 1 and 2). No new API: the sources
   are a caller's `Selection`, the key and the target are the caller's functions, and the join and
   both checks are the kernel's.
2. **The fix can share the join's sources** (condition 3), so the two cannot drift: the same
   `Selection`, keyed without the source. Two shapes carry it, not chosen here: a kernel hook on
   `correspondence()` that builds an `ArchFix` for a left element with exactly one counterpart, which
   any dialect's correspondence could use; or eess-md's `beLinked()` taking the same sources
   `Selection` and key functions by value. The first is the review architect's recommendation.
3. **The empty-side guard needs [bug 0400](../bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md)** (condition 4). Until then the guard available is
   [plan 0539](../plans/completed/0539-a-mention-of-a-record-is-a-link.md)'s element: B's rule paired with ask A's `beLinked()` over the same pattern constant, which is red on
   an empty selection. That covers a broken pattern, not a broken judged-link filter.
4. **The key's normalisation is the caller's.** The prototype keyed numbers as integers, which is
   right here and wrong for a project whose sources differ by width: the adopter in [spike 0536](0536-what-a-mention-of-a-record-needs.md) writes
   its own bugs `081` and this repository's `0081`, and an integer key would merge them. A key that
   keeps the digits as written keeps them apart.
5. **The title-link rule** was checked on this corpus only: no false finding here. In the adopter
   ([spike 0536](0536-what-a-mention-of-a-record-needs.md)'s figures), the one link whose text mentions plans later and points at a meeting
   note would be red; that is a mention linked to something other than its record, which is what
   the rule reports.

## Not decided here

Which of finding 2's shapes carries the fix; whether [bug 0400](../bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md)'s fix lands before B; and whether the
title-link rule's "opens with the target's own number" should be the caller's function rather than
eess-md's (019's review, architect M6, on eess-md fixing a convention).

## Corrections — 2026-10-21, from PR #256's review

Kept, not edited away (PR #256's enforcement and method reviews):

- **The title-link rule is a stampable escape.** It skips a link whose text opens with its target's
  number, so a crossed link whose text opens with the target's number is green: fixture row e with the target's
  number put in front, the remedy an agent reaches for when a crossed link is red. It checks the
  number only, not the kind. The "no false finding" in finding 5 was measured over 5 skipped links
  and says nothing about abuse. A rule that holds by construction exempts a link only when its text
  is the target's own title, read from the target; that, with the escape as a fixture row that must
  be red, is now one of B's conditions in [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md).
- **"Fixed" means one candidate, not a correct fix.** The 3,079 are mentions exactly one record in
  either source holds; none was sampled against what its author meant. A mention meant for an
  upstream record missing from the closed list would be fixed to a local one. A correctness sample
  is now one of the fix's conditions in [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md).
- **[Bug 0400](../bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md) is a blocker, not an open question.** "Whether [bug 0400](../bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md)'s fix lands before B" (Not
  decided here) is wrong: condition 4 fails without it, so B and the fix wait for it.
- **The integer key merged nothing here.** Both repositories number ADRs and proposals with three
  digits and bugs and plans with four (ts-archunit at b4084c9: 10, 28, 81 and 101 files), so keying
  by integer and keying by digits as written give the same joins.
- **Three counts of the same backlog differ.** [Plan 0539](../plans/completed/0539-a-mention-of-a-record-is-a-link.md)
  first said 4,657, this spike 4,682, the method review 4,696 at 659c076f: three instruments that
  decide self-mentions differently, run on a corpus this PR was adding records to. [Plan 0541](../plans/completed/0541-this-repositorys-record-mentions-are-gated.md)'s gate
  prints the number it holds.
