# Proposal 019 — md: a mention of a record is a link, built from blocks

**State:** Draft — filed 2026-10-21 at the maintainer's request, as the successor of
[proposal 018](./018-md-a-mention-of-a-record-is-a-link.md); not reviewed.
**Priority:** Medium — most references between records are plain text, which nothing reads, and an
agent copies the corpus it is shown.
**Origin:** self-found · the maintainer's observation about an adopter monorepo's records,
2026-10-21, measured here, there and in ts-archunit by
[spike 0536](../spikes/0536-what-a-mention-of-a-record-needs.md).
**Affects:** `@nielspeter/eess-md` (one new element type), `@nielspeter/eess` (one additive change
to `correspondence()`'s relation message).

## Problem

A project's records name each other by kind and number. Written as a link, the reference is
checked on every run; written as text, it is checked by nothing, so it can name a record that moved,
never existed, or is of another kind and stay green. In this repository 4,597 mentions are not links
(after self-mentions), in an adopter monorepo 2,676, and the record-authoring skills now tell an
agent to link while the corpus shows it not to. A project should be able to state "a mention of our
records is a link to the record it names" in its own rule file, in its own words, and have it fail
the build.

## What 018's review decided, and where this proposal answers it

[Proposal 018](./018-md-a-mention-of-a-record-is-a-link.md) was ruled Reject on 2026-10-21; its
review listed eight decisions a successor must make in its text. Each is made here, from spike
0536's measurements, and can be overruled in review.

| 018's review asked for                                       | here                                                                                                                                          |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. inline code read; the waiver named as the one marker      | inline code is read (100 quotations here, 23 bare stamps); the kernel's reason-required waiver is the one marker, disclosed on green          |
| 2. "linked" is presence only; a wrong target is the join's   | ask A is presence only; ask B decides the target                                                                                              |
| 3. the target decided by `correspondence()`, causes separate | ask B is composition: `correspondence()` gives "names nothing" and "names two"; ask C makes "points elsewhere" name the expected record       |
| 4. an external link agrees with a URL built from the key     | an external source is the caller's `Selection`, joined like a local one; its URL is a relation, so a prefix alone never agrees                |
| 5. self-exemption from the document's own identity           | `excludeSelf` reads the document's own key through the same caller function as the records side, never by resolving the mention               |
| 6. a fix only when provably unambiguous                      | `ArchFix` only when the caller's candidates hold exactly one local record and the span is exact; measured: 61% of the backlog here            |
| 7. one inline walk with its edge cases stated                | ask A's element states each: reference-style links and raw HTML reported as not read, HTML comments not read, a mention split by markup found |
| 8. named captures, read statelessly                          | the pattern is the caller's, read through `stateless()`; its captures are on the element                                                      |

The rejected part of [proposal 017](./017-md-blocks-to-check-a-documents-shape.md)'s D2 — deciding
what a plain mention names — stays rejected. Nothing here decides it: a plain mention is a finding
because it is not a link, and the author's link is what the join then checks.

## Measured

[Spike 0536](../spikes/0536-what-a-mention-of-a-record-needs.md) holds the numbers. In short:

- **Where mentions sit.** Here 6,267 mentions: 4,724 plain, 1,110 in a link, 283 in emphasis, 120 in
  inline code, 22 split by markup, 8 in HTML comments, none in a reference-style link. In the adopter
  4,878, in the same proportions. 19 of 19 and 22 of 22 links of the number alone
  (`bug [0119](…)`) name the right record.
- **No link names the wrong record today.** Over 1,119 subject links here and 1,861 in the adopter,
  the kernel's join found none. Judging every mention inside a link's text instead would have been
  red seven times, each a quoted title (`[0327 — ADR-011 is written…](./0327-….md)`), and right
  none; that fixed the subject rule in ask A.
- **Patterns are the project's.** The adopter writes its own bugs and plans with three digits and
  its ADRs with four; its mentions of this repository's records use four. Keyed by number alone, the
  two collide on 1,057 mentions; told apart by each source's own pattern, on none.
- **The fix.** 2,793 of this repository's 4,597 plain mentions (61%) could carry a provably
  unambiguous fix. 1,580 cannot, because ts-archunit holds the same key: that is this repository's
  history, a one-off migration a reader makes.
- **Cost.** The prototype walked all 564 documents and joined both sides in 2.5 seconds.

## Existing code survey

- **Records are a selection that exists.** `docs(c).that().resideInFile(glob).select({ label,
identify })` is a `Selection`, and the caller's function reads a key from the path. This repository
  already does exactly that for proposals and plans (`scripts/check-corpus.mjs:533`).
- **The join exists.** `correspondence()` with `keyBy: { left, right }`, `beComplete()` (no
  counterpart, and `leftAmbiguous`: "matches multiple") and `preserveRelations()`
  (`packages/core/src/correspondence.ts:165`). The prototype used it unchanged and it decided every
  fixture case correctly.
- **Its relation message cannot name the expected counterpart.** `preserveRelations` says
  `relates to "X" but its record counterpart does not`; `suggest` applies to `beComplete` only. The
  corpus gate already reaches around `correspondence()` to `matchSelections` to write its own
  message (`scripts/check-corpus.mjs:557-575`). Genuinely new, and the kernel's: ask C.
- **The fix mechanism exists.** `ArchFix` and `applyFixes` ([plan 0066](../plans/completed/0066-eess-deterministic-autofix.md),
  `packages/core/src/violation.ts:15`), with `movedLinkFix` as the eess-md precedent
  (`packages/md/src/model/resolve-link.ts:257`), applied by `eess-ts check --fix --apply`. eess-md
  has no `bin` and `applyFixes` is exported from `@nielspeter/eess/internal` only, so an adopter
  using eess-md alone applies fixes through `eess-ts`; that is true of `movedLinkFix` today and is
  not changed here.
- **The waiver exists and discloses itself.** `<!-- eess-exclude <rule-id>: <reason> -->` reads
  Markdown (`packages/core/src/exclusion-comments.ts:117-122`); every suppression is named by rule
  and file on a green run (`packages/core/src/comment-suppression.ts`).
- **No element reads a mention.** `links()` reads `link` nodes (`packages/md/src/model/links.ts:171`);
  `terms()` and `fields()` read a labelled value per line (`packages/md/src/builders/vocabulary.ts:130`)
  and cannot say whether it sits in a link; `pointers()` reads `path.ext:line` for code extensions
  (`packages/md/src/model/pointers.ts:27`). The link walk is the one that tracks inline ancestry and
  source spans; a mention walk shares it. Genuinely new, and eess-md's: ask A.
- **Precedent for a caller's spelling matched where the parser says text is:** eess-ts's `access()`
  and `call()`.

## Asks

### A — `mentions(corpus, { pattern })`, an element type in eess-md

Every match of the caller's pattern in a document's phrasing text: paragraphs, headings, table
cells, list items. One element per match:

- `doc`, `line` (from the match's source offset), `text`, `groups` (the pattern's named captures),
  and `span` (`start`/`end` in the source) when the matched text is found there exactly, otherwise
  absent.
- `placement`: `'text'`, `'inlineCode'`, `'linkSubject'` (the mention is the link's whole text or
  opens it), `'linkQuoted'` (later in a link's text), with `link` (its URL and, for a repository
  path, the resolved target, by the resolution `links()` uses) when it sits in one. A number alone
  in a link (`bug [0119](…)`) is a `'linkSubject'`.
- The match runs over each run's joined text, so a mention split by emphasis is found.
- Not read, so never an element: fenced and indented code, front matter, HTML comments.
- **Reported as not read**, never skipped: a match inside other raw HTML, and one in a
  reference-style link's text ([plan 0405](../plans/completed/0405-md-select-the-links-a-block-declares.md)'s precedent). Both are findings under every rule over
  `mentions()`; neither occurs in the two corpora measured.
- The pattern is read through `stateless()`; a pattern that can match an empty string is an
  `ArchConfigError`.

Predicates: `areLinked()`, `areInInlineCode()`, `areLinkSubjects()`, `areQuotedInLinks()`, plus the
inherited `resideInFile()` and `satisfy()`. Conditions: `beLinked({ candidates? })`, a finding per
mention not in a link, naming where it sits. `candidates` is the caller's function from a mention to
the paths it may name; when it returns exactly one repository path and the span is exact, the finding
carries an `ArchFix` rewriting the mention as a link to it. Otherwise it carries none, and the
message names the candidates. `excludeSelf(key)` drops a mention whose key, by the caller's function,
is its own document's key.

### B — the target is the join's, shown as composition

No new API. A worked example under `examples/` and a section in `docs/markdown.md`, built from public
blocks only (the examples gate forbids hand-built conditions):

```ts
const key = (kind: string, n: string) => `${kind.toLowerCase()}:${Number(n)}`
const records = docs(c)
  .that()
  .resideInFile('work/{bugs,plans}/**/*.md')
  .select({ label: 'record', identify: (d) => ({ name: d.relPath, file: d.file }) })
const subjects = mentions(c, { pattern: /\b(?<kind>bug|plan)[ -](?<n>\d{3})\b/gi })
  .that()
  .areLinkSubjects()
  .select({ label: 'mention', identify: (m) => ({ name: m.text, file: m.doc.file, line: m.line }) })

correspondence({
  left: subjects,
  right: records,
  keyBy: { left: (m) => key(m.groups.kind, m.groups.n), right: (d) => keyFromPath(d.relPath) },
})
  .should()
  .beComplete({ direction: 'left-to-right' }) // names nothing · names two
  .andShould()
  .preserveRelations({ left: (m) => [m.link.target], right: (d) => [d.relPath] }) // points elsewhere
  .check()
```

The same shape, with the caller's own sides, covers the rest:

- **A quoted mention needs a link to a record**: quoted mentions keyed by their link's target,
  joined to records keyed by path.
- **An external source** (a retired upstream, a tracker, an issue number such as `#123`): a
  `Selection` the caller builds from its own list of keys, with the URL each key lives at as the
  relation. A link agrees only when its URL is the one for its key, so linking under a prefix agrees
  with nothing; a key outside the list names nothing.
- **Two sources whose patterns overlap** are two joins over the same mentions; a mention either
  agrees with is green. Which one the author meant is the author's, and the docs say so (section
  "What this cannot see").

### C — `preserveRelations` names the counterpart, in the kernel

When a matched pair disagrees, the message names the counterpart and its relations:
`mention "bug 0338" relates to "work/bugs/0339-x.md"; its record counterpart "work/bugs/0338-y.md"
relates to "work/bugs/0338-y.md"`, and `RelationSpec` takes an optional `suggest`, as
`beComplete` does. Additive; every dialect's correspondences gain it.

### D — "What this cannot see", in the docs

A pattern-based rule cannot see a mention its pattern misses (`bug number 338`, a bare `0338`, a
spelling the pattern does not allow), and cannot see which of two sources an author meant when both
hold the key. Both are written down beside the example, as `pointers()` writes down its limits.

## Acceptance criteria

Each break class is a test that drives the public entry point. `mentions()` gets a row in the
zero-file vacuity matrix (`scripts/vacuity-matrix.mjs`). The sabotage matrix
(`scripts/check-nonvacuity.mjs`) gets a row when a repository's own gate adopts the rule, which is
that adoption's plan.

**A**

- **Break class:** a plain mention beside a linked one is red at the plain one's line, and the
  message says it is plain text; a mention in inline code is red and says so; `**bug** 0338` is red.
- **Break class (false red):** a fenced mention, one in an HTML comment, and one in front matter are
  not elements; `bug [0119](…)` is a link subject.
- **Break class:** a mention in a raw `<span>` and one in a reference-style link's text are red as
  "not read", with their own message.
- **Break class:** with `excludeSelf`, a record's own title is not reported; a mention of another
  record in its title is.
- **Fix:** applied to the plain case, the fix turns the row green and changes nothing else; a
  mention whose `candidates` returns two paths, or whose span is not exact, carries no fix and names
  the candidates.
- **Vacuity:** a rule over `mentions()` that selects no mention fails as any empty selection does
  ([ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md)); a pattern that can match an empty string is a configuration error.

**B (the example's tests)**

- `[bug 0001](./0002-b.md)` is red, naming both records; `[bug 0009](…)` is red as naming nothing;
  `[plan 0001](…)` where 0001 is a bug is red, and the example's `suggest` names the bug.
- `[0002 — bug 0001 is quoted](./0002-b.md)` is green; `[see bug 0002](./README.md)` is red.
- An external link whose URL is not the one for its key is red; the right URL is green; a key
  outside the caller's list is red.

**C**

- A disagreeing pair's message names the counterpart and both relations; `suggest` is appended.

## Open questions

1. **`candidates` on `beLinked`, or a separate fix step.** It keeps the fix with the finding it
   repairs, as `movedLinkFix` does, but it is a second place a caller states its sources.
2. **The element's link field.** Whether `link.target` resolves own-repository URLs (this
   repository's docs link to 22 records by their GitHub URL), or the caller maps them in its
   relation function.
3. **The shape of C.** Naming the counterpart always, or only through `suggest`.

## Out of scope

- **Deciding what a plain mention names.** 017's D2; it stays rejected.
- **A path to a document written in inline code.** 018's ask C; a separate record if wanted, framed
  as "a document pointer resolves".
- **This repository's own adoption,** including its 1,580 mentions that collide with ts-archunit's
  record numbers. A plan after this ships.
- **Any default pattern, lane or key.** eess-md fixes no document's shape
  ([ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md)).
