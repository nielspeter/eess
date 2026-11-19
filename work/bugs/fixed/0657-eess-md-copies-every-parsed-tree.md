# Bug 0657: eess-md copies every parsed tree

## Status

- **State:** Fixed — `parseMarkdown` hands out the memo's frozen tree; a write to a document's `root`
  throws.
- **Severity:** Low — no false verdict; only time. Measured locally on 2026-11-19, three runs each,
  before and after on `main` at 092c2574: `check:ledger` 7.0 s → 5.5 s (−21%), `check:corpus`
  8.6 s → 8.1 s (−6%). An earlier estimate of 15–20% for a corpus check, from a profile of eess-md's
  own share, was too high for `check:corpus`; it held for `check:ledger`, which builds three corpora
  over the same files.
- **Origin:** self-found · a profile of where the family spends its time, 2026-11-19.
- **Reported:** 2026-11-19

## Symptom

`parseMarkdown` (`packages/md/src/model/prose.ts`) returned `structuredClone(memo.master(text))`: the
parse memo of [bug 0547](./0547-eess-md-parses-a-text-more-than-once-per-process.md) parsed each
text once, then every document of that text got a deep copy. A gate that builds several corpora over
one tree of files paid a full copy of every tree per corpus.

## Root cause

The copy was a decision, not an oversight.
[Spike 0546](../../spikes/0546-where-a-corpus-check-spends-its-time.md) ("Decided, 2026-10-25")
refused to share frozen trees for three reasons, and routed an immutable `MdDocument.root` to "a
proposal and an ADR". This record overrules the refusal, reason by reason:

1. **"Twin-text documents would share node objects, so a node-keyed set or map would merge two
   documents and hide a finding."** No such set or map exists in the family: the only caches keyed by
   a tree, `walked` (`packages/md/src/model/links.ts`) and `itemContinuations`
   (`packages/md/src/rules/ledger.ts`), are functions of the tree and its text, and every collection
   of findings is keyed by an `MdDocument`, a `Corpus` or a string holding the file (measured by the
   architect review of this PR across `packages/md`, `packages/crossvalidate`, `scripts`, `examples`
   and `kit`). A test pins it: two documents sharing a tree each report their own broken link. An
   adopter's own cache keyed by `root` would merge them silently; the changeset and the docs say to
   key by the document.
2. **"A write to a frozen node is silently dropped in sloppy-mode CommonJS."** True, and narrow:
   eess-md is ESM only, so its own code is strict, and only an adopter's sloppy-mode code that writes
   to `doc.root` loses the write without an error. The changeset's `TypeError` is the strict-mode
   behaviour.
3. **"It would be an unmarked break."** It is marked: a `minor` changeset with a breaking line.

The spike's "Not decided here" item is a different decision, kept open: a deep-readonly type for
`root` across every dialect's element model. This change freezes one dialect's tree at run time and
leaves the type `Root`, so a write still type-checks and throws only when it runs; making the type
say so stays with a proposal.

The copy cost more than the spike projected: it estimated an adopter with one corpus pays about 13%
more for the copies, and a gate building several corpora pays a copy per corpus. Nothing in the
family writes to a tree: this PR's suite runs every `doc.root` reader against the frozen master, and
a grep of `packages/md`, `packages/crossvalidate`, `scripts` and `examples` for writes to mdast nodes
found only the test that pinned the copy. ([Bug 0547](./0547-eess-md-parses-a-text-more-than-once-per-process.md)'s
suite could not show this: its documents were each handed a copy.)

## Fix

- `parseMarkdown` returns the frozen master. Every document of one text shares it, and a write throws
  `TypeError` instead of changing one document's copy.
- The two caches keyed by a tree stay correct when it is shared: `collectLinkBlocks`
  (`packages/md/src/model/links.ts`) compares its `source` before reusing a walk, and the ledger's
  `continuesListItem` reads only the tree.
- `MdDocument.root`'s doc comment and the parse memo's say so.
- A `minor` changeset for `@nielspeter/eess-md`, marked breaking, with the remedy:
  `structuredClone(doc.root)` before writing, and that two documents may share one `root`.
  `docs/markdown.md` and the eess-md README say the same.
- Not taken: an option to keep the copy, or a copy made only when `root` is first read. Nothing in
  the family writes to a tree, a write throws loudly rather than changing a verdict, and the
  remedy is one line, so an option would serve no measured caller. Neither was measured; either can
  be added if an adopter asks, through a proposal.

## Verification

- [x] Red first, through the public `corpusFromText`: "two documents of one text share one frozen
      tree, and a write to it throws and changes nothing" fails against the copy and passes without it.
- [x] Three memo tests used `parseMarkdown` as a parser returning a fresh tree; they now use
      `parseUncached`.
- [x] Two documents sharing one tree each report their own broken link ([spike 0546](../../spikes/0546-where-a-corpus-check-spends-its-time.md)'s first reason,
      pinned through the public `corpusFromText` and `links()`).
- [x] The eess-md suite (1,317 tests, 12 s) and eess-crossvalidate's (170) pass; `check:corpus`,
      `check:ledger`, `check:crossval`, `check:mermaid-parses`, `check:examples`, `check:docs-code`
      and `check:spec` pass.
