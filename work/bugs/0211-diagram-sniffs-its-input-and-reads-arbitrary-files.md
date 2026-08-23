# Bug 0211: `diagram()` sniffs its input, so a markdown fence can make it read an arbitrary local file

## Status

- **State:** Draft — reproduced against the shipped build; not yet fixed.
- **Deferred:** none
- **Found:** 2026-08-22, architect review of
  [proposal 006](../proposals/006-mermaid-beyond-classdiagram.md).

## Symptom

`diagram()` decides "is this a path or a diagram body?" by **content sniffing**
(`packages/mermaid/src/core/diagram.ts:8`):

```ts
if (!HEADER_PATTERN.test(input) && existsSync(input)) {
```

`HEADER_PATTERN` matches `classDiagram` only, so **any** input that is not a class
diagram is probed against the filesystem. Measured against the shipped build:

```
diagram('/etc/hosts')            -> file READ; threw with
                                    "lexer:5:29 unexpected character: ->.<- at offset: 105"
diagram('docs/architecture.mmd') -> PARSED, filePath = docs/architecture.mmd
```

Two distinct defects:

1. **Arbitrary local file read from corpus content.** `embeddedDiagramsMatchCode`
   passes fence bodies straight to `diagram()`. `mdast` strips a code node's trailing
   newline, so a one-line fence is an exact path string, and `classDiagramBlocks()`
   does not exclude it (a path is not a `FOREIGN_HEADER`). A fragment of the read
   file's content then reaches CI output through `detailOf()`, which deliberately
   takes `lines[1]` — the lexer line that quotes the offending characters.
2. **Wrong-artifact comparison.** A fence whose body is a path to a real `.mmd` file
   is silently compared against code _as that file_, with violations attributed to the
   markdown document and fence line. The finding is about a diagram the document never
   contained — green or red, it is answering the wrong question.

## Trust boundary

Worth stating plainly: the input is **contributor-authored Markdown**, read in CI. For any
consumer running eess over a corpus they do not fully control, the read path is unbounded —
`/etc/hosts` is measured, not illustrative — and a fragment surfaces in CI logs.

## Root cause

One function serves two callers with incompatible contracts. `diagram(path)` for a
standalone `.mmd` file is a loader; `diagram(source)` for a lifted fence is a parser.
A content-driven branch cannot tell them apart, and the caller always knows which it
meant.

Note the interaction with [bug 0209](./fixed/0209-md-mermaid-crashes-on-a-non-classdiagram-fence.md):
0209's fix made the fence selector fail-**closed**, so an unrecognised kind reaches the
parser deliberately. That is right for parsing and wrong here — it is exactly the path
that carries a fence body into `existsSync`.

## Fix

Split the entry point so there is no sniff:

- a **path loader** — reads the file, sets `filePath`;
- a **source parser** taking `(text)` — never touches the filesystem. It gains an optional
  `provenance` parameter in [plan 0213](../plans/0213-diagram-provenance-for-fence-callers.md),
  which adds **and consumes** it in one delivery; adding an optional parameter later is
  additive, so nothing is gained by landing it here unconsumed.

Keep `diagram()` as a deprecated alias if consumers need it, but it must stop
dispatching on content.

**This record removes the sniff and nothing else.** The parser takes `(text)`;
[plan 0213](../plans/0213-diagram-provenance-for-fence-callers.md) adds `provenance` **and
consumes it** in one delivery.

> A previous draft had this record land `(text, provenance?)` with provenance _unconsumed_,
> justified as avoiding "two breaking changesets instead of one". Review falsified that:
> only the split is breaking — adding an optional parameter later is **additive**, a minor.
> So the clean seam costs nothing, and the draft would have published a front door that
> accepts evidence and silently discards it, with no verification box covering it.
>
> Recorded twice over, because the correction itself failed once: it was reported as
> applied in a commit message while the edit had silently no-opped against reflowed text,
> leaving this record and 0213 specifying contradicting signatures for one published
> export — the exact defect the paragraph above warns about.

**Release.** `diagram()` is public API of `@nielspeter/eess-mermaid` (`packages/mermaid/src/index.ts:18`)
and its only README example is the path form. Narrowing it is a break: a `minor` on 0.x
carrying a `**Breaking …**` marker and a migration line. Naming `@nielspeter/eess-crossvalidate` in the same changeset is **optional**, not required:
it consumes `diagram()` but declares `@nielspeter/eess-mermaid` under `peerDependencies`, and
`scripts/check-release.mjs` weighs regular `dependencies` only ("Who would inherit a break.
Regular `dependencies` only."). An earlier draft cited bug 0185 as compelling it; review
measured that `release/break-names-dependents` will not require it and that crossvalidate is
not bumped at all, so the "Updated dependencies" outcome cannot occur. Naming it is a choice
that costs crossvalidate a version.

## Verification

- [ ] Red first: a fixture whose fence body is a path to an existing file. Today it is
      read; after the fix it is parsed as text and reports a parse finding.
- [ ] A fence body that is a path to a **real `.mmd`** no longer parses as that file.
- [ ] No violation message can contain content from a file the corpus did not name —
      instantiated: the `/etc/hosts` fixture's message must not carry a lexer offset beyond
      the fence body's own length.
- [ ] The standalone-`.mmd` path still loads and still reports `filePath`.
- [ ] A break class in `scripts/nonvacuity/` — the selector-and-parser rows 0209 added
      show the shape.

## Out of scope

- **Consuming the provenance** — attribution arithmetic, removing the workaround, and the
  fixtures are [plan 0213](../plans/0213-diagram-provenance-for-fence-callers.md). This
  record removes the sniff; 0213 adds the parameter and consumes it.
