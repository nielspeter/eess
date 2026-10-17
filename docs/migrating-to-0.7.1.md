# Migrating to 0.7.1

> Written for the release tagged `v0.7.1`. The tag carries the kernel's version (RELEASING.md), so
> it follows `v0.13.0`, which was the kernel's 0.7.0. Five packages move. Check what you have with
> `npm ls @nielspeter/eess @nielspeter/eess-ts @nielspeter/eess-md @nielspeter/eess-mermaid @nielspeter/eess-crossvalidate`.

| package                          | from   | to     |
| -------------------------------- | ------ | ------ |
| `@nielspeter/eess`               | 0.7.0  | 0.7.1  |
| `@nielspeter/eess-ts`            | 0.13.0 | 0.13.1 |
| `@nielspeter/eess-md`            | 0.10.0 | 0.11.0 |
| `@nielspeter/eess-mermaid`       | 0.7.0  | 0.8.0  |
| `@nielspeter/eess-crossvalidate` | 0.8.0  | 0.9.0  |
| `@nielspeter/eess-gherkin`       | 0.6.0  | 0.6.0  |

`eess-crossvalidate` 0.9.0 declares its sibling dialects as peers at this release's versions:
`eess-ts` 0.13.1, `eess-md` 0.11.0 and `eess-mermaid` 0.8.0 or later (`eess-gherkin` stays at 0.6.0).
Upgrading it alone, beside an older dialect, fails at `npm install` with a peer-dependency conflict
(`ERESOLVE`). **Upgrade the dialects you use together.**

## If you only use the kernel and eess-ts

Nothing to do. `@nielspeter/eess` 0.7.1 and `eess-ts` 0.13.1 are patches: the family loads under Bun
again (bug 0439). From 0.5.1 on, importing most entries under Bun failed at link time with
`SyntaxError: Export named 'registerHooks' not found in module 'node:module'`. All published entries
and both CLIs load under Bun 1.4.3, and CI checks that on every change. This is a load guard, not a
claim of support: Node stays every package's runtime (ADR-020).

## What can go red on update

| package              | what is now checked                                                                                  | why it passed before                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `eess-md`            | `parseCodeBlocks` parses a fence whose tag differs only in letter case (` ```Mermaid `, ` ```JSON `) | it was skipped and named as a near miss (bug 0426)     |
| `eess-mermaid`       | `diagramKind` reads past a `%%{init}%%` directive that closes mid-line                               | the line was read as a directive still open (bug 0429) |
| `eess-crossvalidate` | `tableErAgree` compares an `erDiagram` behind such a directive line                                  | `diagramKind` returned `''`, so it was skipped (0429)  |

Nothing else in a tag is normalised: ` ```mmd ` is not `mermaid`, and ` ```json5 ` is not `json`
(ADR-019).

With the kind on the directive's own line, or behind a multi-line directive, eess-mermaid's ER grammar
does not parse the diagram, so `tableErAgree` reports it as a gap in that grammar rather than
comparing it. Put the directive and `erDiagram` on lines of their own to have it compared (the
one-line case is bug 0433).

`embeddedDiagramsMatchCode` goes the other way: a sequence or other non-class diagram behind such a
line is now skipped, where it used to be read as a class diagram and reported.

## Code edits

- **`eess-md`: `NearMissTag` and `ParsedCodeBlocks.nearMisses` are removed**, with the near-miss
  text in `summary()` and in the zero-examined finding. A block that used to be a near miss is now
  parsed. Delete any code that reads them.
- **`eess-md`: an `.expectEmpty()` that is now false.** A rule that declared `.expectEmpty()` because
  its only blocks had a capitalised tag now has blocks, and the declaration is reported as expired.
  Remove it.
- **`eess-md`: the caller's language is folded too.** `language: 'JSON'` selects ` ```json ` blocks;
  `ParsedCodeBlocks.language` and `summary()` keep your spelling.

## New

- **`eess-mermaid`: `mermaidParser()`**, Mermaid's own parser for `parseCodeBlocks`, so a corpus can
  require every ` ```mermaid ` block to parse with the parser GitHub renders with.

  ```ts
  import { codeBlocks, parseCodeBlocks } from '@nielspeter/eess-md'
  import { mermaidParser } from '@nielspeter/eess-mermaid'

  const parsed = await parseCodeBlocks(corpus, { language: 'mermaid', parser: mermaidParser() })
  codeBlocks(parsed).should().parse().check()
  ```

  `mermaid` (11) and `jsdom` are optional peers, loaded only inside a worker thread. An adopter who
  never calls `mermaidParser()` installs and loads neither. To use it: `npm i -D mermaid@11 jsdom`
  (about 179 MB). Every way the instrument can fail (a missing or out-of-range `mermaid`, a worker
  that exits or hangs, a throw that is not a syntax error) is a finding naming its cause, never a pass.

## Package by package

- **`@nielspeter/eess`**: loads under Bun again. Nothing else.
- **`@nielspeter/eess-ts`**: loads under Bun again. Nothing else.
- **`@nielspeter/eess-md`**: language tags in any letter case; `NearMissTag` and `nearMisses` removed.
- **`@nielspeter/eess-mermaid`**: `mermaidParser()`; `diagramKind` past a mid-line directive.
- **`@nielspeter/eess-gherkin`**: unchanged.
- **`@nielspeter/eess-crossvalidate`**: Mermaid tags compared by eess-md's rule; the selection change
  above; the peer floors above.
