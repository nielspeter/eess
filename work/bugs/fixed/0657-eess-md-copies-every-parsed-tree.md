# Bug 0657: eess-md copies every parsed tree

## Status

- **State:** Fixed — `parseMarkdown` hands out the memo's frozen tree; a write to a document's `root`
  throws.
- **Severity:** Low — no false verdict; only time. Measured locally on 2026-11-19, three runs each,
  before and after on `main` at 092c2574: `check:ledger` 7.0 s → 5.5 s (−22%), `check:corpus`
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

[Bug 0547](./0547-eess-md-parses-a-text-more-than-once-per-process.md) kept the copy so that "nothing an adopter can observe changes": `MdDocument.root` was a
mutable tree per document. No reader in the family writes to a tree ([bug 0547](./0547-eess-md-parses-a-text-more-than-once-per-process.md)'s suite ran against a
frozen master; a grep of `packages/md`, `packages/crossvalidate`, `scripts` and `examples` for writes
to mdast nodes found only the test that pinned the copy). The copy protected only an adopter who
writes to `doc.root`.

## Fix

- `parseMarkdown` returns the frozen master. Every document of one text shares it, and a write throws
  `TypeError` instead of changing one document's copy.
- The two caches keyed by a tree stay correct when it is shared: `collectLinkBlocks`
  (`packages/md/src/model/links.ts`) compares its `source` before reusing a walk, and the ledger's
  `continuesListItem` reads only the tree.
- `MdDocument.root`'s doc comment and the parse memo's say so.
- A `minor` changeset for `@nielspeter/eess-md`, marked breaking, with the remedy:
  `structuredClone(doc.root)` before writing.

## Verification

- [x] Red first, through the public `corpusFromText`: "two documents of one text share one frozen
      tree, and a write to it throws and changes nothing" fails against the copy and passes without it.
- [x] Three memo tests used `parseMarkdown` as a parser returning a fresh tree; they now use
      `parseUncached`.
- [x] The eess-md suite (1,317 tests, 12 s) and eess-crossvalidate's (170) pass; `check:corpus`,
      `check:ledger`, `check:crossval`, `check:mermaid-parses`, `check:examples`, `check:docs-code`
      and `check:spec` pass.
