# Migrating to 0.17

> Written for the release tagged `v0.17.0`. All six packages move; the kernel goes to 0.10.0. The tag
> is not `v0.10.0` because `v0.10.0` and [Migrating to 0.10](./migrating-to-0.10.md) are an earlier,
> unrelated release, and tags only go up (RELEASING.md). Check what you have with
> `npm ls @nielspeter/eess @nielspeter/eess-ts @nielspeter/eess-md @nielspeter/eess-mermaid @nielspeter/eess-gherkin @nielspeter/eess-crossvalidate`.

| package                          | from   | to     |
| -------------------------------- | ------ | ------ |
| `@nielspeter/eess`               | 0.9.0  | 0.10.0 |
| `@nielspeter/eess-ts`            | 0.15.0 | 0.15.1 |
| `@nielspeter/eess-md`            | 0.13.0 | 0.14.0 |
| `@nielspeter/eess-mermaid`       | 0.9.0  | 0.9.1  |
| `@nielspeter/eess-gherkin`       | 0.8.0  | 0.8.1  |
| `@nielspeter/eess-crossvalidate` | 0.11.0 | 0.12.0 |

Every dialect at this release depends on the kernel at `^0.10.0`, which on `0.x` does not admit
0.9.x. A dialect left at its old version installs a second kernel beside it. **Upgrade the packages
you use together.** `eess-crossvalidate` 0.12.0 raises its peer floors to this release's dialects:
`eess-ts` 0.15.1, `eess-md` 0.14.0, `eess-mermaid` 0.9.1 and `eess-gherkin` 0.8.1 or later. An older
dialect installed beside it is a peer-dependency conflict at install (`ERESOLVE`).

**Nearly all of it is `eess-md`'s links.** Twelve of the thirteen breaking changesets are eess-md's,
and each one makes `links()`, `pointers()`, `mentions()` or `fields()` read something it used to skip:
reference-style links, `href`s in raw HTML, `#fragments`, line-1 `---` blocks, non-ASCII labels.
Expect findings on documents you did not change. They are real: a broken link this release reports
was broken before, and nothing checked it.

## Code edits

Few rule files need an edit. These do:

### eess-md: a `select()` can now refuse

`links().select()` refuses when its predicates reach an HTML link eess-md cannot read, or a link
only one reading of a line-1 `---` block holds. `mentions().select()` refuses when they reach a
mention it cannot read: one inside a raw HTML block, an HTML link its paragraph never closes, a
reference-style link's text, a definition's title, or an image's alt or title. Each throws the
kernel's undecided-selection error, naming each site's line and what to do. Before, the selection
came back without them, so a `correspondence()` built on it was short and said nothing.

To migrate: do what the error names (move the mention or link out of the construct, write the HTML
link so eess-md can read it, or write it in Markdown), or narrow the selection with a predicate that
leaves the site out.

### eess-md: drop an `.excluding()` for `(reference links)`

`links().areLabelled()` no longer reports a declaration that "holds reference-style links, which
eess-md does not read": it reads them now. An `.excluding()` that sanctioned that finding by its
`(reference links)` element matches nothing; remove it.

### eess-md: `FragmentVerdict` gains two members

`FragmentVerdict` gains `'out-of-range'` and `'not-judged'`, and `resolveLink()` sets `fragment` on
`not-in-corpus` and `directory` targets too. An exhaustive `switch` over the verdict fails to
type-check until it handles them.

### Text output carries the rule id

The terminal format prints `Rule: <id> — <description>` for a rule with an id, and the plain format
prefixes `[<id>] ` to each violation's line ([bug 0606](../work/bugs/fixed/0606-the-terminal-formats-never-print-a-rule-id.md), in the kernel, so every dialect's CLI prints
it). A script that parses the text output must expect the id. Prefer `--format json`, whose
`ruleId` field is unchanged.

### Optional: crossvalidate presets return their findings

`diagramMatchesCode` and `adrCitationsResolve` finish through `finishPreset` now, as every other
preset does. Without options nothing changes. A caller that wrapped either in `try`/`catch` to read
`error.violations` can ask for the findings instead:

```ts
import { diagramMatchesCode } from '@nielspeter/eess-crossvalidate/mermaid-ts'
```

and pass `{ report: 'return' }` as its options.

## What can go red on update

Each of these is a finding that used to be a pass. The ones marked **unsuppressable** are not hidden
by `.excluding()`, `.warn()`, an exclusion comment or a baseline: they say a check could not judge
something, and the remedy is in the finding.

### Links: reference-style links are links

`[text][label]`, `[label][]` and `[label]` are links wherever the label has a definition. Every
`links()` rule sees them, `examined` included.

- `.resolve()` reports a broken one once, at the definition's line, however many references use it.
  An exclusion comment for it goes above the definition, not the reference.
- `.beLinkedBack()` counts a link back written as a reference, and a reference-style link in a
  declaration needs its own link back, like an inline one.
- `sections().haveLink()` holds for a section whose only link is reference-style.

To migrate: fix the definition's URL.

### Links: an `href` in raw HTML is a link

Every `<a>` and `<area>` with an `href`, in an HTML block or inline, is a link at the line its `href`
sits on: `.resolve()` checks it, `.beLinkedBack()` counts it, `sections().haveLink()` sees it. It is
read as GitHub renders it, so `:href`, `v-bind:href`, `data-href` and `xlink:href` are not links. A
broken one was green before.

An HTML link eess-md cannot read is `md/unread-link` (**unsuppressable**): a tag a blank line cuts
inside its block (remove the blank lines), a tag that never closes in its block (close it), or an
`<a>` whose unquoted value holds a `/` (quote it). Where such a link is the only one that could
answer, `sections().should().haveLink()` and `.beLinkedBack()` report it instead of "holds no link"
or "does not link back", so a rule that suppressed those findings now sees an unsuppressable one.

HTML is read in one place now, the way HTML reads it: a block of only HTML comments (`<!DOCTYPE …>`
and `<?…>` included) is invisible to `mentions()` and to `sections().haveContent()`, and text
between two comments counts. A section that holds only a doctype now fails `.should().haveContent()`.

### Links: a `#fragment` is checked

`.resolve()` used to throw the fragment away, so `[x](./b.md#gone)` passed. Now:

- A fragment naming no heading or anchor in its target is `broken fragment`, with the nearest
  anchors on the finding's `Fix:` line. The comparison is exact after decoding, letter case included.
- A line fragment (`#L5`, `#L5-L9`) on a file that is not Markdown, or after `?plain=1`, is judged
  against the file's lines.
- A fragment on a directory link is judged against its `README.md` under `githubAnchors`.
- A fragment `resolve()` cannot judge (on a PDF or an image, an anchor on a text file that is not
  Markdown, a file the corpus ignores) is `md/fragment-not-judged` (**unsuppressable**), one per
  target file and cause.

To migrate: correct the fragment, link a file that is not text without one, and link a text file
that is not Markdown without one or as a line (`#L5`).

### Links: a line-1 `---` block is judged as both readers see it

GitHub and VitePress drop front matter; a reader of the whole file as Markdown does not. A link only
one of those readings holds (a body reference whose definition sits in the block, a body definition
behind a block one of the same label, an `<a href>` in a YAML value, a body link a fence or comment
opened in the block would swallow) is `md/link-one-reading-holds` (**unsuppressable**), even where it
resolves. Ordinary front matter adds nothing: a URL in a YAML value is metadata. Measured over 2,177
Markdown files, only test fixtures held such a link.

To migrate: move the link or its definition out of the block, remove one of two definitions of a
label, or close in the block what it opens. An unquoted `<a href=…/…>` in a YAML value is now
`md/unread-link`; quote the value.

A reference-style link in front matter whose definition is in the body is now checked too, and
`tags: [adr]` is read as Markdown when the body defines `[adr]` with an internal URL.

### Mentions: one inside an HTML link is linked

A mention inside a readable `<a href>…</a>` is linked to the tag's target, so `beLinked()` passes it.
It used to be `md/unread-mention`. A rule that counted those findings sees fewer. A mention inside
`<a data-href>` or `<a v-bind:href>` is judged as plain text; one inside `<a title="a>b" href>` is
now unread. A rule over only unread mentions reports them and no "examined zero units" finding beside.

### Pointers: a pointer past the last line is stale

`pointers().should().resolve()` counted one line too many for every file ending in a newline, so a
pointer to the line after the last passed. Point it at the line you meant.

### Fields and the ledger: a non-ASCII label is a label

`## Größe: F7` used to end a record's header, so a `fields()` rule over `region: 'header'` skipped
every field below it, and a value continued over lines ran on into a plain `Größe: F7` below it. A
label's letters are Unicode letters and their combining marks now. `honestyAtClose` reads a state
below such a heading too, so a closed record outside its done folder is
`ledger/state-folder-mismatch` where it used to pass. A corpus written in another language can newly
go red.

### Zero examined: the remedy depends on the cause

The "this rule examined zero units" finding names each cause with its own remedy, and offers
`.expectEmpty()` only for a source that is legitimately empty. Its first sentence is unchanged; a
caller that matches the message past it must update its pattern.

## Coming from an earlier release

`v0.16.0` carried one break, [bug 0400](../work/bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md)'s
change to `correspondence()`, and no migration page: read its entry in the kernel's `CHANGELOG.md`.
From 0.15 or earlier, read [Migrating to 0.15](./migrating-to-0.15.md) first.

## New

- A finding's text output names its rule id (above).
- A local link with a query string resolves: `./logo.png?raw=true` is `logo.png`.
- A link's autofix rewrites its URL and is applied once, however many rules propose it, so
  `eess-ts check --fix --apply` no longer skips a link two rules find broken.
- `ONE_READING_LINK`, `UNREAD_LINK` and `FRAGMENT_NOT_JUDGED` export the new finding ids:

```ts
import { FRAGMENT_NOT_JUDGED, ONE_READING_LINK, UNREAD_LINK } from '@nielspeter/eess-md'
```

## Package by package

Each package's `CHANGELOG.md` holds every changeset in full; this page groups the breaks.
