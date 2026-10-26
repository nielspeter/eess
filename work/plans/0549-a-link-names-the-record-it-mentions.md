# Plan 0549: a link names the record it mentions

## Status

- **State:** Ready — frozen 2026-10-26 on Phase 0's census (5 exempt, 1 true red, Decision 3
  unamended), with no open question. Written 2026-10-25 for [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s
  held ask B (the target); its fix is [plan 0550](./0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md).
  Narrowed the same day after two review rounds (architect, enforcement; "Review — 2026-10-25"):
  B stays the caller's composition, as the proposal asked, and the fix, a separate capability, moved
  to its own plan.
- **Implements:** [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)
- **Priority:** Medium — without B a link to the wrong record is green in every project running
  [plan 0539](./completed/0539-a-mention-of-a-record-is-a-link.md)'s `beLinked()`.
- **Effort:** Medium, one PR in eess-md: two fields on a mention, one predicate, a worked example,
  docs. No kernel change, no new builder.
- **Created:** 2026-10-25
- **Builds after:** [plan 0539](./completed/0539-a-mention-of-a-record-is-a-link.md) (built) and
  [bug 0400](../bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md) (fixed).
- **Builds before:** [plan 0550](./0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md) and
  [plan 0542](./0542-this-repositorys-record-mentions-are-migrated.md).

## Problem

[Plan 0539](./completed/0539-a-mention-of-a-record-is-a-link.md) decides presence only: a link whose
text names one record and whose URL is another record's file is green. [Spike 0540](../spikes/0540-one-join-over-every-source.md)
showed the target can be judged by composition: one `correspondence()` over the union of every
source, its left key carrying the source read from where the link points, green on this repository's
1,207 links and right on every fixture row. Two things it needed by hand are a caller's to write
today only by walking mdast: where a link resolves, and whether a link quotes its target's title. Its
title-link rule was itself an escape.

## Decisions

### 1. B is the caller's composition; eess-md adds facts, not a builder

As [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md) asked: the join is the
kernel's `correspondence()`, unchanged, with `beComplete({ direction: 'left-to-right' })` and
`preserveRelations()`, written by the caller in the worked example. A second round of this plan
tried one eess-md factory building the join and the fix together; it read a title the caller did
not name ([ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md)), made correct
own-URL links red by fixing the relation itself, and still let two calls diverge, so it was dropped.

The caller's relation function maps a link to the target it names, including a repository's own
GitHub URL to a path, and must return a value for every link kind: `preserveRelations` skips an empty
list (`packages/core/src/correspondence.ts:279`), so the example returns the URL or the resolved path,
never `[]`, and the docs say why. `.expectNonEmpty()` is the caller's to write since
[bug 0400](../bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md); the example
writes it and the docs say what omitting it costs. The join reads only readable mentions: unread
ones are reported by `beLinked()`'s rule, so the docs pair the two.

### 2. eess-md says where a mention's link resolves

The mention's `link` gains `text`, the link's text joined as a heading's is, and `target`, the
resolution `links()` uses (`resolveLink`, `packages/md/src/model/resolve-link.ts:203`) as its own
`LinkTarget`, unchanged: `external`, `self`, `document` with its path and the `MdDocument` it names,
`not-in-corpus` or `directory` with their path, or `missing` with the paths tried. `self` carries no
fields, and needs none: its document is the mention's own, `m.doc` (`packages/md/src/model/mentions.ts:28`). Whether a URL is external is read by
`links.ts`'s `EXTERNAL_RE` (`packages/md/src/model/links.ts:42`), exported model-internally, not from
the root, so `mentions()` and `links()` cannot disagree about a link. Every kind is visible, so a caller cannot fold a missing file into "no
relation". `mentions(corpus, { pattern, resolve? })` takes the same `LinkResolveOptions` a
`links().resolve()` rule takes, so a corpus with extensionless links does not read every link as
`missing`. The builder fills both in `foundIn(doc)` (`packages/md/src/builders/mentions.ts:76`),
where the document's path is known; the public `collectMentions(root, pattern)` sees only a root and
gets its own return type without them. On an unread mention, reading the new fields throws the
builder's UNKNOWN, as `link` does (`packages/md/src/builders/mentions.ts:146-159`), so a predicate
over them reports it ([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)).

Both are required on the exported `MdMentionRef`, so a consumer that builds one by hand breaks at the
type level; no family package does, and the changeset marks it `**Breaking**`, a minor on 0.x.

### 3. A title link is exempt only when its text is its target's title

`areInTitleLinks({ pattern, linkPrefix?, titlePrefix? })` holds for a mention when all hold, reading
the target's title from `link.target`'s document, so it never resolves a link a second time:

1. the link resolves to a corpus document (`document`), never to itself (`self`);
2. the mention is not the link's whole text;
3. the link's text less `linkPrefix` equals the target's title less `titlePrefix`, whitespace
   collapsed and ASCII letter case ignored; both prefixes are the caller's `RegExp` (eess-md fixes
   none, [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md)), and the title is the first section's depth-1 heading as `haveTitle()` reads it
   (`packages/md/src/model/sections.ts:225-243`);
4. the mention lies in the compared text, not in a stripped prefix, and `pattern` matches at its
   place in the title.

The three `RegExp`s are read through a private copy with the caller's `g` and `y` dropped, as
`validateMentionPattern` makes one (`packages/md/src/model/mentions.ts:58`), so no `lastIndex` is
shared, and a prefix strips once, at the text's start. `pattern` must be the builder's own; the docs say so and a test row holds it.

Equality, not containment: a link text that only has to be found in the title is a one-word stamp
(the mention and the title's next word, linked to a record whose title opens with that mention). To stamp a link green under
equality, its text must be the target's whole title, which makes it a correct title link.

Measured by eye on this repository, 2026-10-25, with link prefix `^\d{4} — ` and title prefix
`^(Plan|Bug) \d{4}: `: of the 5 links that quote a record in a link to another record, the board rows
for [plan 0448](./completed/0448-a-bun-load-guard-and-bug-0439s-fix.md),
[plan 0263](./completed/0263-adr-014s-residual-enforcement-rows.md),
[bug 0327](../bugs/0327-adr-011-is-written-about-the-kernel-and-the-family-now-has-two-internals.md) and
[bug 0501](../bugs/0501-md-and-kernel-leftovers-from-plan-0457.md) are exempt. The board row for
[plan 0454](./completed/0454-box-marks-are-the-callers.md) (in `work/plans/ROADMAP.md`) is red: it
quotes a bug its target's title does not name.

```md
[0448 — a Bun load guard, and bug 0439's fix](./completed/0448-a-bun-load-guard-and-bug-0439s-fix.md)

# Plan 0448: a Bun load guard, and bug 0439's fix

[0454 — box marks are the caller's (bug 0445's fix)](./completed/0454-box-marks-are-the-callers.md)

# Plan 0454: box marks are the caller's
```

The example's join suggests linking the record the mention names; it never suggests editing a
title.

### 4. Carried, not re-made

- **The relation message is not changed.** Ask C stays held as its own kernel record; the example's
  messages name the expected record through the existing `suggest`.
- **Keys keep the digits as written** ([spike 0540](../spikes/0540-one-join-over-every-source.md),
  finding 4): a four-digit mention and a three-digit record of the same value are different records.

## Phases

### Phase 0 — the exemption census (before the freeze)

Decision 3 over this repository by a throwaway script, as [spike 0540](../spikes/0540-one-join-over-every-source.md)'s:
how many links it exempts and how many B reds the join reports, each read and recorded here, the
exemptions as well as the reds. A false red may amend Decision 3 only if rows e, k, l, l2, m, m2 and
s of Phase 2 stay red.

**Files:** this plan only.

**Measured 2026-10-26** on `main` at c9e55336, Node 24.22.0, by throwaway scripts over the built
packages, with ts-archunit at b4084c9 as the second source and the two prefixes of Phase 2:

- **The instrument first.** On Phase 2's fixture every row came out as required: e, k, l, l2, m, m2,
  s, c, d, i, the missing-file and the directory row red; a, b, f and j green, f the only
  exemption; an empty mention side under `.expectNonEmpty()` red. All three sabotage rows fired, and
  so did a fourth, the exemption switched off, which turns f red. 0.17 s.
- **The corpus.** 582 documents, 6,673 mentions (none unread), 1,414 in a link. Decision 3 exempts 5,
  the join judges 1,409 (1,381 to a local document, 22 own GitHub URLs, 6 to ts-archunit, none to
  `self`, a missing file or a directory) and reports **1 red**. 5.2 s a run; a run that only loads the
  corpus took 4.9 s, so loading is most of it.
- **Every exemption is correct**, its link text the target's whole title less the prefixes: the
  board rows above for [plan 0448](./completed/0448-a-bun-load-guard-and-bug-0439s-fix.md), [plan 0263](./completed/0263-adr-014s-residual-enforcement-rows.md), [bug 0327](../bugs/0327-adr-011-is-written-about-the-kernel-and-the-family-now-has-two-internals.md) and [bug 0501](../bugs/0501-md-and-kernel-leftovers-from-plan-0457.md), and a fifth this record's count
  by eye missed, `docs/tests-cannot-lie.md:4`, a link to [ADR-009](../../adr/009-agent-first-failure-surfaces.md) whose text is its title.
  The fifth changes no verdict: judged, it is green.
- **The one red is true**: the [plan 0454](./completed/0454-box-marks-are-the-callers.md) board row above, a click on [bug 0445](../bugs/fixed/0445-a-checkbox-state-other-than-space-or-x-is-invisible.md) in its text landing on the plan. Its fix is the board row's, in [plan 0542](./0542-this-repositorys-record-mentions-are-migrated.md)
  when B gates this repository.
- **No false red, so no amendment.** Only the two prefixes were needed: every link here that quotes
  another record is a board row to a bug or a plan. A wider pair covering spikes, proposals and
  ADRs still reports 1 red; it exempts 4, since it strips the ADR's number from its title and not
  from the link text, and that link is then judged and green. A prefix stripping one side only turns
  a title link into a judged one, which is safe.
- **For Phase 2:** the census's first run matched this repository's own GitHub URL by case and made
  3 correct `github.com/NielsPeter/…` links red. That is the caller's relation, not Decision 3; the
  example matches the owner and repository in any letter case, and a row j2 (`NielsPeter`) holds it;
  a row j3, an own URL whose path is in the wrong case, stays red, so the relation ignores case in
  the owner and repository only.

### Phase 1 — the model and the predicate

`link.text` and `link.target` (Decision 2), `EXTERNAL_RE` exported model-internally, the `resolve`
option, `collectMentions`' own return type, UNKNOWN for the new fields on an unread mention, and
`areInTitleLinks` (Decision 3).

**Files:** `packages/md/src/model/phrasing.ts`, `packages/md/src/model/mentions.ts`,
`packages/md/src/model/links.ts`, `packages/md/src/builders/mentions.ts`,
`packages/md/src/predicates/mentions.ts`, `packages/md/src/index.ts`.

### Phase 2 — the worked example and docs

`examples/md/a-link-names-the-record-it-mentions.test.ts`, public blocks only, with `linkPrefix`
`^\d{4} — ` and `titlePrefix` `^(Bug|Plan) \d{4}: `. Rows a to j are
[spike 0540](../spikes/0540-one-join-over-every-source.md)'s, row j (a repository's own URL) green by
the caller's relation, and row j2, the same URL with the owner written `NielsPeter`, green too; row
j3, an own URL whose path is in the wrong case, is red as a missing file. In the corpus of rows e and f, `0002-b.md`'s title is row f's link text with
the title prefix for its number, so row f is the one green title link; six rows more are each red,
two of them failing one clause alone:

```md
the title of 0002-b.md: Bug 0002: bug 0001 is quoted
f the title link: [0002 — bug 0001 is quoted](../work/bugs/0002-b.md)
k the escape: [0002 see bug 0001](../work/bugs/0002-b.md)
l a crossed subject: [bug 0001](../work/bugs/0002-b.md)
l2 whole text only, to 0003-c.md titled "Bug 0003: bug 0001": [bug 0001](../work/bugs/0003-c.md)
m a self anchor, in a document whose title quotes bug 0001: [bug 0001](#phase-1)
m2 self only, in 0004-d.md titled "Bug 0004: bug 0001 is quoted": [bug 0001 is quoted](#bug-0004-bug-0001-is-quoted)
s a one-word stamp: [bug 0001 is](../work/bugs/0002-b.md)
```

Red: e, k, l, l2, m, m2, s, j3, a missing-file link and a directory link, each its own
`violating-<row>/` (`scripts/check-nonvacuity.mjs:1053-1190`); green: a, b, f, j, j2 in `clean/`. An empty
mention side under `.expectNonEmpty()` is red. The example asserts how many links the exemption
drops, so a widened exemption is a red test. Each red folder adds two runs of the example's file to
`check:nonvacuity`; the added duration is recorded at the build.

`docs/markdown.md`'s Mentions section gains the join, the title exemption, `.expectNonEmpty()` (and
that a corpus with no linked mention yet reds it as examined zero, its cause nothing linked rather
than a broken pattern), the relation that never returns `[]`, and the pairing with `beLinked()` for
unread mentions.

**Files:** the example and its fixtures (new), `docs/markdown.md`, `packages/md/README.md`.

### Phase 3 — the vacuity matrix

`areInTitleLinks` builds no check: it joins `SIBLING_NOT_CONSTRUCTORS` (`scripts/vacuity-matrix.mjs:428`).

**Files:** `scripts/vacuity-matrix.mjs`.

## Files Changed

| file                                                                     | phase |
| ------------------------------------------------------------------------ | ----- |
| `packages/md/src/model/phrasing.ts`, `packages/md/src/model/mentions.ts` | 1     |
| `packages/md/src/model/links.ts`                                         | 1     |
| `packages/md/src/builders/mentions.ts`                                   | 1     |
| `packages/md/src/predicates/mentions.ts`, `packages/md/src/index.ts`     | 1     |
| `packages/md/tests/builders/mentions.test.ts`                            | 1     |
| `examples/md/a-link-names-the-record-it-mentions.test.ts` (new)          | 2     |
| `docs/markdown.md`, `packages/md/README.md`                              | 2     |
| `scripts/vacuity-matrix.mjs`                                             | 3     |
| `.changeset/*.md` (eess-md minor, `**Breaking**`)                        | —     |

## Test inventory

Each drives `mentions(corpus, { pattern })` over `corpusFromText` or a disk fixture.

| test                                                                                                                                             | phase |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| `link.text` is the link's whole text, joined across emphasis and inline code as a heading's is                                                   | 1     |
| `link.target` is each of the six kinds: external, a `#fragment`, a document, a file outside the corpus, a directory, missing                     | 1     |
| an extensionless link is a `document` under the `resolve` option that tries `.md`, and `missing` without it                                      | 1     |
| an unread mention under a predicate reading `link.target` is reported as `md/unread-mention`, not dropped                                        | 1     |
| `areInTitleLinks`: each of the four clauses decides a row of its own; letter case and markup in the title; a prefix that would strip the mention | 1     |
| a `g` prefix strips once, at the start; a `g` pattern gives the same verdict twice                                                               | 1     |
| the example's rows, a to m, l2, m2 and s, with the missing-file and directory rows and the empty mention side                                    | 2     |

**Sabotage, before the PR:** clause 3 as containment turns row s green; dropping clause 2 turns row
l2 green; accepting `self` as a document whose title is the mention's own (`m.doc`) turns row m2
green; each must turn its test red.

## Release

| package               | bump                | why                                                                                                                                               |
| --------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@nielspeter/eess-md` | minor, **Breaking** | a predicate and an option; two required fields on the exported `MdMentionRef`, which no family package builds, `collectMentions`' own return type |
| every other package   | none                | nothing a consumer can observe                                                                                                                    |

## Out of scope

- **The fix:** [plan 0550](./0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md).
- **This repository adopting B**, and its migration: [plan 0542](./0542-this-repositorys-record-mentions-are-migrated.md).
- **The relation message** (ask C): held as its own kernel record by [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s review, with [bug 0084](../bugs/0084-preserve-relations-right-to-left.md) first.

## Review — 2026-10-25

Two rounds, architect and enforcement separately, both Changes needed each round (round 1: Critical
1 and 2; round 2: Critical 0 and 1). Kept, not edited away:

- **Round 1, both C1:** the first title exemption read only the target's title, so a crossed link
  whose whole text is the mention was exempt wherever the title named it. **Round 2, enforcement
  C1:** "found in the title, longer than the mention" was a one-word stamp. Decision 3 is now
  equality of the texts less the caller's prefixes.
- **Round 2, architect I1–I4, enforcement I1–I2:** the single-declaration factory made own-URL links
  red, applied the exemption unasked, let two calls diverge, and turned B into new API. Dropped:
  Decision 1.
- **Round 2, architect I5:** one PR had outgrown a sitting. Split: this plan is B; the fix is
  [plan 0550](./0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md).
- **Kept from both rounds:** `link.target` as every kind, filled by the builder, with the caller's
  resolve options; UNKNOWN on unread mentions; the exempt-count assertion; the census reading the
  exemptions as well as the reds.
- **Round 3 (capped; architect Ship as Draft with three Important, enforcement Changes needed):**
  `EXTERNAL_RE` exported here, not in [plan 0550](./0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md),
  and the target's `MdDocument` kept on `link.target`, so the predicate never resolves again
  (architect I1); rows l2 and m2, each failing one clause alone, so the clause-2 and `self` sabotage
  rows can fire, and the example's prefixes and titles stated (enforcement I1); the flag convention
  for the three `RegExp`s; the suggestion's owner; the wider break; the stale board pointer dropped.
- **Architect re-check of the verification edits (Not verified, two Important):** the verification
  pass had widened the exported `LinkTarget`'s `self` with a path and a document, so the m2 sabotage
  could read a title. It was not needed, since the mention carries its own document, and it could
  not be built, since `resolveLink`'s input holds only a path. `LinkTarget` stays unchanged and the
  m2 sabotage reads `m.doc`; the flag wording now names the copy `validateMentionPattern` makes.

## Progress ledger

- [x] Phase 0 — the exemption census, recorded (2026-10-26: 5 exempt, 1 true red, no amendment)
- [ ] Phase 1 — `link.text`, `link.target`, the `resolve` option, `areInTitleLinks`, exports
- [ ] Phase 2 — the worked example and docs
- [ ] Phase 3 — the vacuity-matrix entry
- [ ] Every row of the Test inventory written and green, and the three sabotage rows red
- [ ] The eess-md minor changeset, marked breaking
