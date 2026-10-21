# Spike 0536: what a mention of a record needs to be checked as a link

Measured 2026-10-21 for [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md),
after [proposal 018](../proposals/rejected/018-md-a-mention-of-a-record-is-a-link.md) was ruled Reject. It ran
as throwaway scripts in a scratch directory against the built packages of `main` at 8e258550 (eess-md
0.12.0, eess 0.8.0), on Node 24.14.0, over three corpora read-only: this repository's `work/`, `adr/`
and `docs/` (564 documents); an adopter monorepo's `work/` and `docs/` (435 documents); and the
ts-archunit repository at b4084c9, for its record numbers only. Nothing here is built. Every pattern,
lane and URL form below is the one each corpus uses, written into the scripts as the measuring
instrument; none of them is a proposed default.

## The question

[Proposal 018](../proposals/rejected/018-md-a-mention-of-a-record-is-a-link.md)'s review left eight decisions for a successor. Four of them are questions about
corpora, not about taste, and were answered by measuring:

1. Where do mentions of records sit in the parsed Markdown, and what would reading inline code cost?
2. Can the kernel's `correspondence()` decide whether a link names the record its mention names, and
   with what false findings?
3. How far does the number collision with ts-archunit reach, and is it general or this repository's?
4. How much of the plain-text backlog could carry a fix that is provably unambiguous?

## The instruments

- **The walk.** Each paragraph, heading and table cell is one phrasing run; its inline children are
  flattened into segments, each tagged with what it sits in (a link, inline code, emphasis, raw
  HTML). The caller's pattern runs over the joined text, so a mention split by markup (`**bug** 0338`)
  is found. Fenced and indented code, front matter and block HTML are not walked. Lines come from the
  segment's node position plus the newlines before the match inside it.
- **The records.** A file is a record when its path is in one of the corpus's lanes and its name
  starts with a number (`0338-slug.md`, or a directory `0001-slug/`); its key is the lane's kind and
  the number. This is the shape `scripts/check-corpus.mjs:533` already uses for proposals:
  `docs().select()` with a key read from the path.
- **The prototype.** Mentions became a `Selection`; records a second one; the kernel's
  `correspondence()` joined them by key, unchanged, with `beComplete({ direction: 'left-to-right' })`
  and `preserveRelations()` for "the link points elsewhere". "Not a link" and the external-URL checks
  were hand-written, as a new element's conditions would be.

The fixture the prototype was checked against, one case per behaviour (records `work/bugs/0001-a.md`,
`work/bugs/0002-b.md`, `work/plans/0003-c.md`, `adr/001-x.md`, `README.md`):

```md
01 good: [bug 0001](../work/bugs/0001-a.md)
02 wrong target: [bug 0001](../work/bugs/0002-b.md)
03 names nothing: [bug 0009](../work/bugs/0002-b.md)
04 plain: see bug 0002 for it.
05 wrong kind: [plan 0001](../work/bugs/0001-a.md)
06 external ok: [ts-archunit bug 0046](https://github.com/nielspeter/ts-archunit/blob/main/bugs/fixed/0046-cross-document-links-rot-silently.md)
07 external stamp: [bug 0047](https://github.com/nielspeter/ts-archunit/)
08 backticks: `bug 0002`
09 quoted title: [0002 — bug 0001 is quoted](../work/bugs/0002-b.md)
10 quoted stamp: [see bug 0002 here](../README.md)
11 partial: bug [0001](../work/bugs/0001-a.md)
12 adr ok: [ADR-001](../adr/001-x.md)
13 split by emphasis: **bug** 0002
```

plus a fenced `bug 0002`, and each record mentioning itself in its title and body. All eight red cases
(02, 03, 04, 05, 07, 08, 10, 13) were red and nothing else was.

## 1. Where mentions sit

| sits in                                          | this repository | the adopter |
| ------------------------------------------------ | --------------- | ----------- |
| plain text                                       | 4,724           | 2,670       |
| a link                                           | 1,110           | 1,829       |
| emphasis, whole                                  | 283             | 272         |
| inline code                                      | 120             | 76          |
| split by markup: the number alone in a link      | 19              | 23          |
| split by markup: other (backticks, emphasis)     | 3               | 8           |
| raw HTML block                                   | 8               | 0           |
| a reference-style link, image alt, footnote      | 0               | 0           |
| **all**                                          | **6,267**       | **4,878**   |
| of which in a heading (mostly a record's own H1) | 571             | 303         |

Reference-style links do not occur in either corpus, so a mention inside one can be reported as not
read ([plan 0405](../plans/completed/0405-md-select-the-links-a-block-declares.md)'s precedent) at no measured cost. The 8 raw-HTML mentions are all inside HTML
comments, such as the enforcement-table marker at the foot of each ADR
(`<!-- eess enforcement-table v1 (plan 0060; … -->`): text no reader sees, so not a reference a
reader could follow.

**Inline code.** Of this repository's 123 mentions touching inline code (the 120 above and 3 split
by emphasis), 23 are a bare mention (`` `ADR-009` ``), the form 018's review called a stamp. The
other 100 quote literal text that contains one: a field example (`` `deferred→bug 0421` ``, 37), a
path or command (14), a test title (5), or other quoted prose (44). Reading inline code therefore
costs about a hundred edits here, once; skipping it leaves a one-character escape.

## 2. Whether a link names its mention's record

Before choosing a rule, every existing link holding a mention was checked against the record the
mention names.

| outcome                                        | this repository  | the adopter      |
| ---------------------------------------------- | ---------------- | ---------------- |
| the target is the mention's record             | 1,078            | 1,830            |
| the target is this repository's own GitHub URL | 22               | 0                |
| the target is a ts-archunit record URL         | 5                | 0                |
| the number alone is linked (`bug [0119](…)`)   | 19, all agreeing | 22, all agreeing |
| the target is another file                     | 5                | 2                |

**All seven "another file" cases are false.** Each is a link whose text quotes a title that mentions
a second record: `[0327 — ADR-011 is written about the kernel…](./0327-….md)` points at bug 0327,
correctly. **Not one link in either corpus points at the wrong record today.** A rule that judges
every mention inside a link's text would be red seven times and right none.

Where a mention sits inside link text:

| position                                  | this repository | the adopter |
| ----------------------------------------- | --------------- | ----------- |
| it is the whole link text                 | 1,086           | 1,933       |
| it opens the link text (`[Plan 047 — …]`) | 16              | 14          |
| it comes later in the text                | 8               | 3           |

So a link's **subject** is a mention that is its whole text or opens it, and the subject must name
the link's target. A mention later in the text is quoted; the link it sits in must still point at
_a_ record, which closes `[see bug 0338](./README.md)`. Measured with the prototype: 0 findings over
this repository's 1,119 subject links (2.5 s for the whole corpus, walk included) and 0 over the
adopter's 1,861; the quoted rule found 0 here and 2 in the adopter, both links to meeting notes that
mention plans, which are records or not as that project's selection says.

**`correspondence()` decides it, and does not say it well.** Joined by key, the kernel reported each
fixture case correctly: "has no matching record" for 03 and 05, with `suggest` adding "0001 is a bug
here — the mention says plan"; `preserveRelations` for 02. But its relation message is
`relates to "work/bugs/0002-b.md" but its record counterpart does not`, and `suggest` applies only to
`beComplete`, so the message cannot name the record the link should point at. The corpus gate
already reaches around `correspondence()` to `matchSelections` to write its own message and fix
(`scripts/check-corpus.mjs:557-575`); this is the second place that would need to.

## 3. The collision

ts-archunit's records: ADR 001–010, bugs 0001–0080, plans 0000–0106, proposals 001–028. This
repository: ADR 001–023, bugs from 0074, plans from 0051, proposals 001–018. Every ts-archunit ADR
and proposal number is also one here.

Of this repository's mentions that name a local record whose key ts-archunit also holds (1,865,
self-mentions included):

| written as | ts-archunit on the same line | in the same paragraph | not nearby |
| ---------- | ---------------------------- | --------------------- | ---------- |
| plain      | 72                           | 244                   | 1,351      |
| linked     | 16 to ts-archunit, 4 local   | 16 local              | 162 local  |

The text alone cannot say which project a plain one means; "ts-archunit nearby" is a hint for a
reader, never a rule. 110 mentions name a number this repository holds under another kind ("bug
0066", where 0066 is a plan here); 108 of them name a record ts-archunit holds under the kind
written, so a "wrong kind" message would send the author to the wrong fix unless it names the
external candidate too.

**The collision is not general.** The adopter writes its own bugs and plans with three digits (2,562
and 1,855 mentions) and ADRs with four (447). Its eleven mentions of this repository's records all
use four digits (`bug 0278`, `plan 0470`), and the twelfth four-digit match is a year (`BUG 2026`).
Keyed by number alone, declaring this repository as the adopter's external source collides on 1,057
mentions; told apart by each source's own pattern, on none. The difference is a convention only the
project knows, which is why the pattern must be the caller's.

## 4. The fix

A fix is provably unambiguous only when one source holds the key, one record has it, and the
mention's text is found exactly on its source line. Over the plain and inline-code mentions that are
not self-mentions:

| outcome                                                    | this repository | the adopter, own pattern |
| ---------------------------------------------------------- | --------------- | ------------------------ |
| fixable, one exact span                                    | 2,691           | 1,474 + up to 1,057      |
| fixable, repeated on its line (fixed by occurrence)        | 102             | 107                      |
| no fix: ts-archunit holds the same key                     | 1,580           | —                        |
| no fix: names no local record, an external source holds it | 191             | 4                        |
| no fix: inline code (link it, fence it, or waive it)       | 25              | 32                       |
| no fix: names nothing anywhere                             | 8               | 2                        |

The adopter's "up to 1,057" are its number-only collisions, which the width split above shows
belong to its own pattern; this run stopped at the collision and did not test their spans. In this repository 61% of the backlog is fixable by the existing
mechanism (`ArchFix`, [plan 0066](../plans/completed/0066-eess-deterministic-autofix.md), applied by `eess-ts check --fix --apply`); the 1,580 collisions
and 191 external-only mentions are a one-off migration a reader makes, not a fix.

## 5. The waiver

The kernel's waiver reads Markdown: `<!-- eess-exclude <rule-id>: <reason> -->` covers the next
line, and `eess-exclude-start`/`-end` a region (`packages/core/src/exclusion-comments.ts:117-122`).
A waiver without a reason is refused and reported in place of the finding it would have hidden.
A waiver that suppresses something is named by rule and file on every green run
(`packages/core/src/comment-suppression.ts`), so a region waiver over a whole file is visible, not
silent. A waiver that suppresses nothing gets a stderr line only.

## Decision

Made from the manifesto, [ADR-009](../../adr/009-agent-first-failure-surfaces.md), [ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md) and [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) and the measurements above; each can be
overruled in [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s review.

1. **No pattern, lane, key or URL form is eess-md's.** Section 3 is the reason: what tells two
   sources apart is the project's own convention.
2. **Inline code is read.** About a hundred edits once, against a stamp forever ([ADR-009](../../adr/009-agent-first-failure-surfaces.md) rule 3).
3. **A mention is linked when its text or its number sits in a link.** The partial form agreed 41 of
   41 times.
4. **A link's subject must name its target; a quoted mention needs a link to some record.** Seven
   false findings and no true one otherwise.
5. **The join is `correspondence()`**, with its relation message able to name the expected record.
6. **The fix is `ArchFix`**, emitted only under section 4's three conditions.
7. **A self-mention is known from the document's own key**, not from resolving the mention.
8. **The kernel waiver is the one sanctioned marker.** It is reason-required and disclosed on green.
9. **HTML comments are not read; any other raw HTML holding a mention is reported as not read.**

## Not decided here

Whether this repository migrates its 1,580 colliding mentions by hand, by a reviewed one-off script,
or by waiving the historical records; and whether frozen records are edited by the migration or
selected out by the project's own rule. Both are this repository's rule file's, not eess-md's.

## Corrections — 2026-10-21, from proposal 019's review

Kept, not edited away (see [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s
"Review — 2026-10-21"):

- **Soft breaks.** The instruments' patterns matched `[ -]` between the kind word and the number,
  so a mention broken across a line was not counted. 228 lines in this repository's corpus end with
  a kind word; the counts above are low by up to that many.
- **Section 5's "named … on every green run"** holds only under eess-ts's runner:
  `commentSuppressionNotice()` is called by eess-ts alone, so a rule run through eess-md from a
  script or test discloses nothing ([bug 0537](../bugs/0537-eess-md-alone-has-no-run-level-services.md)).
- **Section 2's "`correspondence()` decides it"** was shown for one source. For two sources whose
  keys overlap, which the B2 check here hand-wrote, two joins cannot be combined (a correspondence
  is a terminal) and one join over both makes every collision ambiguous; that case was not
  prototyped.
- **Decision 4's quoted rule** leaves `[see bug 0002](./0001-a.md)` green: a mention later in a link's
  text only needs the link to name some record.
- **Two figures that do not reconcile, named** (PR #256's method review): the adopter's "number
  alone in a link" is 23 in section 1 and 22 in section 2, because section 1 counts mentions split
  by a link and section 2 counts links checked against their record; and section 2's "1,119
  subject links" is the agreement table's 1,078 + 22 + 19, not the position table's 1,086 + 16 + 19,
  because the two tables were run with different instruments.
