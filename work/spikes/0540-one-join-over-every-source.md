# Spike 0540: one join over every source, keyed by where the link points

Measured 2026-10-21 for [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s
held asks B (the target) and the fix, on the maintainer's instruction to dogfood the design on this
repository, whose record numbers collide with ts-archunit's. It ran as throwaway scripts against the
built packages of `main` at 8e258550 on Node 24.14.0, over this repository's `work/`, `adr/` and
`docs/` (569 documents) and ts-archunit at b4084c9 as the upstream source. Nothing here is built;
[spike 0536](./0536-what-a-mention-of-a-record-needs.md) holds the walk and the instruments, reused
here with one change: the pattern is the one [plan 0539](../plans/0539-a-mention-of-a-record-is-a-link.md)
declares, with `\s+`, so mentions across a soft break are counted.

## The question

Proposal 019's review held B and the fix until a prototype, from public blocks, showed:

1. one join over the union of sources, its left key carrying the source read from where the link
   points, green on correct links to both of two overlapping sources;
2. red on a crossed link, on a URL no source claims, and on a mention after a word in a link to
   another record (`[see bug 0002](./0001-a.md)`, the review's one-word stamp);
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
  a link whose text opens with its target record's own number (`[0327 — ADR-011 is written…](./0327-….md)`).
  This replaces 019's "subject or quoted" rule, which left `[see bug 0002](./0001-a.md)` green.
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
suggestion naming the local and the upstream bug 0046), e (`relates to "work/bugs/0002-b.md"…`), i
(`no bug 0048 in any source`). Fix: h gets `work/bugs/0002-b.md`; g gets none, "local or upstream".
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

The 3,079 include the mentions only ts-archunit holds, which spike 0536 counted as unfixable: with
the upstream declared as a source, they get its URL.

**An empty mention side is green**, with or without `.expectNonEmpty()`:

| left (mentions) | right (sources) | declaration         | result |
| --------------- | --------------- | ------------------- | ------ |
| none            | one             | none                | green  |
| none            | one             | `.expectNonEmpty()` | green  |

This is [bug 0400](../bugs/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md), open,
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
3. **The empty-side guard needs bug 0400** (condition 4). Until then the guard available is plan
   0539's: B's rule paired with ask A's `beLinked()` over the same pattern constant, which is red on
   an empty selection. That covers a broken pattern, not a broken judged-link filter.
4. **The key's normalisation is the caller's.** The prototype keyed numbers as integers, which is
   right here and wrong for a project whose sources differ by width: the adopter in spike 0536 writes
   its own bugs `081` and this repository's `0081`, and an integer key would merge them. A key that
   keeps the digits as written keeps them apart.
5. **The title-link rule** was checked on this corpus only: no false finding here. In the adopter
   (spike 0536's figures), the one link whose text mentions plans later and points at a meeting
   note would be red; that is a mention linked to something other than its record, which is what
   the rule reports.

## Not decided here

Which of finding 2's shapes carries the fix; whether bug 0400's fix lands before B; and whether the
title-link rule's "opens with the target's own number" should be the caller's function rather than
eess-md's (019's review, architect M6, on eess-md fixing a convention).
