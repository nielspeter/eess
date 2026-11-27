# Plan 0659: a parsed document is read back when its text is unchanged

## Status

- **State:** Draft — filed 2026-11-27 at the maintainer's request, from a session that measured
  where the gates spend their time; rewritten the same day so it can be built from this page alone.
  Two decisions are left for Phase 0, each with the answer this plan would take.
- **Priority:** Medium — a green run means the same after this; it is reached sooner. The
  repository's slowest gate spends most of its time here.
- **Effort:** Small to medium. One wrapper around the parser, a way to switch it on, and a
  differential that proves a read-back tree is the parsed one.
- **Created:** 2026-11-27

## Problem

A corpus check parses every document on every run, and almost all of them have not changed since
the last run.

Measured 2026-11-26 on this repository at `main` cbc8eed2 (Node 24.22.0, Linux, 12 cores, one run
each, by throwaway scripts that are not kept):

| measure                                                      | result                 |
| ------------------------------------------------------------ | ---------------------- |
| `check:corpus`, whole process                                | 8.3 s                  |
| `check:ledger`, whole process                                | 5.8 s                  |
| share of a `check:corpus` CPU profile in the parser          | 57%                    |
| share in eess-md itself                                      | 23%                    |
| parsing 1,507 tracked Markdown documents (11.4 M characters) | 5.3 s                  |
| writing those trees as JSON                                  | 0.19 s                 |
| reading the same trees back from one JSON file               | 0.37 s (58 MB on disk) |

**How the last three rows were measured**, so Phase 0 can repeat them: every `.md` file git tracks
under `work/`, `adr/`, `docs/` and the repository root was read, parsed once with `parseUncached`
from `packages/md/src/model/prose.ts`, written with `JSON.stringify`, and read back with
`JSON.parse`. The first tree's JSON was equal before and after. Nothing else was compared.

[Spike 0546](../spikes/0546-where-a-corpus-check-spends-its-time.md) found the same shape a month
earlier and removed the repeats inside one process; [bug 0657](../bugs/fixed/0657-eess-md-copies-every-parsed-tree.md)
then stopped the copy of each tree. What is left is one parse per document per process.

That cost is paid many times over by `check:nonvacuity`. Each of its corpus rows runs the real
`scripts/check-corpus.mjs` twice in fresh processes
([bug 0127](../bugs/fixed/0127-nonvacuity-proves-a-condition-not-a-wired-rule.md) is why), and a
row changes one document. [Spike 0546](../spikes/0546-where-a-corpus-check-spends-its-time.md)
measured those rows at 62% of the gate's row time in CI, and
[bug 0552](../bugs/0552-nonvacuity-shard-3-runs-near-its-timeout.md) records a shard near its
timeout because of them.

**Not measured:** what a corpus check costs with the trees read back. The 0.37 s is the read
alone, from one file holding every tree. Phase 0 measures the real thing.

## Design

### Where it sits

`createParseMemo(limit, parse, keyOf)` in `packages/md/src/model/parse-memo.ts` keeps frozen trees
for one process, up to a size limit, and takes the parser as an argument. The parser it is given
today is `parseFresh` in `packages/md/src/model/prose.ts`.

The disk layer is a wrapper around that argument and nothing else:

```ts
// the shape, not the code
const stored =
  (parse: (text: string) => Root, store: ParseStore | undefined) =>
  (text: string): Root =>
    store?.read(text) ?? store?.write(text, parse(text)) ?? parse(text)
```

- The memo is unchanged. It still freezes whatever the parser returns, so a tree read from disk is
  frozen exactly as a parsed one is.
- `parseUncached` stays as it is and never touches the store. It exists for a text read once and
  dropped, such as a document with a fix written into it.
- With no store, `stored(parse, undefined)` is `parse`.

### What is stored

**A parse, never a verdict.** A stored finding is the false green
[ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md) exists to refuse, and
[proposal 010](../proposals/010-ts-performance-at-scale.md)'s ask D was rejected for that reason.
Every rule still runs on every document, every run.

One entry per text, one file per entry:

- **The key is the text.** SHA-256 of the document's exact characters. Never a path and never a
  modification time: a key that can be right for the wrong text is a document judged on another
  document's tree.
- **The entry names what made it.** It holds a format number, the eess-md version, the text's
  length and hash, and the tree. A reader accepts an entry only when all four match what it would
  have written; anything else is a miss.
- **A miss costs a parse.** A missing, truncated, unparsable or foreign entry is never an error
  and never a tree. The text is parsed and the entry rewritten.
- **A write is atomic.** The entry is written beside its final name and renamed into place, so two
  processes sharing a directory (the shards of `check:nonvacuity`, or two terminals) never read
  half a file.
- **Nothing is evicted.** The directory may be deleted at any time and is rebuilt on the next run.
  Its size is reported, not managed.

### What it does not defend against

The directory is trusted the way `dist` is. A tree edited by hand inside a well-formed entry is
read as written. The entry's own hash catches a file moved to another key; it cannot catch a
changed tree. This is stated here so it is a decision and not a surprise. A reviewer who wants it
closed has one route: a second hash over the tree, at the cost of hashing 58 MB per run.

### Decisions left for Phase 0

- **Where the switch lives.** This plan takes a function on `@nielspeter/eess-md/internal` that
  this repository's scripts call with a directory. It is the smaller commitment: an option on
  `corpus()` reaches every adopter and adds to a root
  [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) keeps small, and it can follow
  later without breaking anything.
- **What format the tree is stored in.** This plan takes JSON, if Phase 0 shows that every member
  of every tracked document's tree survives it. What can fail: a member whose value is `undefined`
  is dropped, and a tree holding anything but plain objects, arrays, strings, numbers, booleans and
  `null` does not round-trip.

## Phases

### Phase 0: measure and decide (time-boxed, about an hour)

No file in the repository changes.

- Parse every tracked document, store it, read it back, and compare the two trees member by
  member, including members that are present and `undefined`. Record every difference.
- Run `check:corpus` and `check:ledger` with the parser wrapped by hand, and record the whole
  process times beside the table in Problem.
- Run five corpus rows of `check:nonvacuity` the same way.
- Decide the two questions above from those numbers and write the decisions into this plan.
- **Stop rule:** if `check:corpus` as a whole process gains less than a third, close this plan
  `Won't-do` with the measurement.

### Phase 1: the store

- `packages/md/src/model/parse-store.ts` (new): `read`, `write`, and two counters, parsed and read
  back.
- `packages/md/src/model/prose.ts`: the memo is created with the wrapped parser.
- `packages/md/src/internal.ts`: the switch Phase 0 chose.
- A changeset for `@nielspeter/eess-md`.

### Phase 2: this repository uses it

- `scripts/check-corpus.mjs` and `scripts/check-ledger.mjs` name the directory.
- `scripts/check-nonvacuity.mjs`: the corpus rows inherit it, and one row proves a changed document
  is parsed and not read back.
- `.gitignore`: the directory.
- `CLAUDE.md`: each gate's summary line gains the two counts, so a run that read nothing back is
  visible, and the table of summary formats says so.

## Test inventory

In `packages/md/tests`, named as a sabotage matrix: each row is a way the store could lie.

- A read-back tree deep-equals a fresh parse, for a fixture corpus holding front matter, a table, a
  footnote, raw HTML, a fenced block, and a document with no trailing newline.
- A read-back tree is frozen.
- An entry moved to another text's key is a miss.
- A truncated entry is a miss.
- An entry with another format number, or another eess-md version, is a miss.
- Two texts that differ in one character have different keys.
- With no directory named, nothing is written to disk.
- `parseUncached` writes nothing, with a directory named.
- CONTROL: with a directory named, a second process parses nothing and reads every document back.

## Release

A patch for `@nielspeter/eess-md` if the switch is internal, a minor if it is an option on
`corpus()`. Phase 0 decides which.

## Out of scope

- Storing findings, counts or any verdict.
- A faster parser. [Spike 0546](../spikes/0546-where-a-corpus-check-spends-its-time.md) names it as
  a separate candidate.
- Running one corpus row once where it runs twice today.
- Closing the hand-edited-tree gap named above.
- The other dialects.

## Progress ledger

- [ ] Phase 0: measured, and the two open questions decided
- [ ] Phase 1: the store, with its sabotage matrix
- [ ] Phase 2: this repository's gates read through it

Deferred: none
