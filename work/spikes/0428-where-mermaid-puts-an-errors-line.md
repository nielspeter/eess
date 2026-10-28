# Spike 0428: where Mermaid puts an error's line, and what the worker must carry home

Measured 2026-10-15, after the post-merge architect and enforcement review of
[plan 0413](../plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md) (frozen in PR #217) found that
its line rule, measured in [spike 0425](./0425-what-mermaid-in-a-worker-does-under-vitest-and-the-cli.md)
only on blocks whose comments came first, did not hold. Time-boxed to an hour; it took about 45
minutes. `mermaid` 11.17.2, `jsdom` 29.1.1, Node 24, the [spike 0425](./0425-what-mermaid-in-a-worker-does-under-vitest-and-the-cli.md) harness.

## The questions

1. Which steps of Mermaid's preprocessing move lines, and can a map from Mermaid's line back to the
   block's line mirror them?
2. Is Mermaid's own line right once the preprocessing is accounted for?
3. What survives the thread boundary from a thrown error?
4. Where does a Langium error keep its lines?
5. What do unclosed frontmatter and frontmatter alone throw?
6. Can the real worker be tested against a stub or absent `mermaid` without a public option, and can
   it report the version it actually loaded?

## Result

**1. Four steps move lines, and a mirror of them maps every measured preprocessing case.**
`preprocessDiagram` (in `dist/mermaid.core.mjs`) runs five transformations, in order; the four below
are the ones that touch line breaks (the fifth, `cleanupText`'s rewrite of `="…"` inside tags, moves
no line):

| step                       | regex                                                      | effect on lines                                                                                                                                                  |
| -------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRLF to LF                 | `/\r\n?/g`                                                 | none                                                                                                                                                             |
| frontmatter                | `/^([^\S\n\r]*)-{3}\s*[\n\r](.*?)[\n\r]\1-{3}\s*[\n\r]+/s` | removes the block **and the blank lines after it**                                                                                                               |
| directives                 | `directiveRegex`                                           | removes the directive's text and keeps the newline after it: a one-line directive leaves an empty line (no shift); a multi-line one collapses to one line        |
| comments, then `trimStart` | `/^\s*%%(?!{)[^\n]+\n?/gm`                                 | removes **every** whole-line `%%` comment anywhere, **with the blank lines before it** (`^\s*` spans newlines); a bare `%%` line is kept; leading blank lines go |

A map built by applying those four regexes to the text while carrying each character's original line
(`linemap.mjs` in the harness) put Mermaid's line back on the true body line in **17 of 18** blocks:
mid-body comments (one and two, indented, after a blank line, last line without a newline), a bare
`%%`, a one-line directive mid-body, a three-line directive before and mid-body, frontmatter followed
by blank lines, a comment before the kind line, CRLF, a jison lexical error after a mid-body comment,
and two `packet-beta` (Langium) blocks. All jison cases are `flowchart`. The 18th is question 2. The
"Mermaid's line" column in `checkmap.mjs` was transcribed from the probes' output, not read live.

**2. No: two of Mermaid's own lexers lose a line per trailing comment.** A `%%` comment at the end of a
code line (`A --> B %% note`) is not touched by the preprocessing, so the map cannot see it, and the
diagram's lexer then counts one line fewer for each:

| kind                                                 | error on body line 3 after `… %% t` on line 2 | without the comment |
| ---------------------------------------------------- | --------------------------------------------- | ------------------- |
| `flowchart`                                          | 2 (and 2 for body line 4 after two of them)   | 3                   |
| `erDiagram`                                          | 2                                             | 3                   |
| `sequenceDiagram`, `classDiagram`, `stateDiagram-v2` | 3                                             | 3                   |
| `packet-beta` (Langium)                              | 3                                             | 3                   |

So "the exact Markdown line" cannot be promised for every block: after a trailing comment, in two
kinds, Mermaid's own number is wrong, and nothing in the error says so.

**3. Nothing that identifies the error survives `postMessage`.** `structuredClone` of an `Error`
carrying `hash`, and of a subclass carrying `result`, both come back as a plain `Error` with neither
property. The worker has to read the error and post plain facts.

**4. A Langium error keeps its lines in `result`.** `e.result.lexerErrors[i].line` and
`e.result.parserErrors[i].token.startLine`, 1-based, counted on the preprocessed text like jison's. A
block with errors on body lines 3 and 5 gave `lexerErrors` lines `[3, 5]`; the message prints only the
first. The error's `name` is `Error`; only `constructor.name` says `MermaidParseError`.

**5. Unclosed frontmatter is a plain `Error` with no `hash`; frontmatter alone depends on a newline.**

| block                                         | thrown                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `---` / `title: x` / kind / … (no close)      | `Error`: "Diagrams beginning with --- are not valid. If you were trying to use a YAML front-matter, …" |
| `---` / `title: x` / `---` (no newline after) | the same `Error`                                                                                       |
| the same with a newline after                 | `UnknownDiagramError`                                                                                  |
| `%%{init: …}` never closed, then a kind       | `UnknownDiagramError`                                                                                  |

The first two are the author's error, and only the text says so: under [plan 0413](../plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md)'s outcome table they
fall to "anything else", the instrument.

**6. Yes to both, by copying a self-contained worker file.** A ten-line worker (no `jsdom`; it reads
the version two ways and calls `parse`), placed in a scratch directory whose
`node_modules/mermaid` is a stub (version `11.99.0`, `parse` never throws, `exports` with no `./*`),
loaded the stub through its own bare import. Inside the worker:

- `createRequire(import.meta.url)('mermaid/package.json')` threw `ERR_PACKAGE_PATH_NOT_EXPORTED`;
- walking up from `import.meta.resolve('mermaid')` to the first `package.json` named `mermaid` read
  `11.99.0`, the version that actually parsed.

No option on `mermaidParser()` is needed for the stub, the missing-peer or the out-of-range rows.

## Recommendation for the re-freeze

[Plan 0413](../plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md) goes back to Draft. The findings above are measured; what follows is this spike's
recommendation to the re-freeze, which decides each item (the plan's "Owed at the re-freeze" list):

- **The line comes from a map, not an offset.** eess-mermaid mirrors the four preprocessing regexes
  with each character's origin line, beside `diagramPreamble`'s walk, as an internal function. A
  **line canary** runs with the parse canaries: a known-broken block with a mid-body comment, a
  multi-line directive and frontmatter, whose true line is known. A map that disagrees with the
  installed `mermaid` is an instrument finding, so a Mermaid release that changes its preprocessing
  goes red instead of misplacing lines.
- **After a trailing `%%` comment, the verdict claims no line.** When any line before the mapped line
  carries a `%%` after code, the verdict is attributed to the block's first line and its message says
  Mermaid's count is unreliable after a trailing comment, quoting Mermaid's own line. This is
  conservative, not exact: it withholds the line in kinds measured to count right after a trailing
  comment (sequence, class, state, packet), and it claims the mapped line in kinds nobody measured
  (gantt, pie, gitGraph, …). That residual belongs in the README beside the one-kind-per-shape canary
  residual.
- **The worker posts facts; the host decides.** Per block: `{ shape: 'jison' | 'langium' |
'unknown-diagram' | 'other' | 'non-result', locFirstLine, hashLine, langiumLines, message }`, and
  once per run the version the worker loaded. The host combines them with `diagramPreamble(text)` and
  the map. Nothing in the worker duplicates the preamble walk.
- **Langium lines come from `result`, the smallest one.**
- **Unclosed frontmatter is decided from the text, per block,** as the unclosed directive already is:
  a reason of its own, the author's error, never the instrument.
- **The version is the worker's, by the walk up.** The host compares it with the version it declared
  and reports a mismatch as an instrument finding.
- **Tests copy the built worker file** into a scratch directory with a stub or no `mermaid`. No public
  option names a module to run ([ADR-015](../../adr/015-the-kernel-extends-resolution-never-execution.md)).

## Correction after review (2026-10-15)

PR #219's enforcement review measured a trailing comment **on the kind line**: `flowchart TD %% t`,
then a valid line, then an error on body line 3, is reported on line 1, an undercount of two, not
one. So "one line fewer for each" in Q2 is not a law; [plan 0413](../plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md)'s re-freeze withholds the line for
any block with a trailing comment rather than bounding the undercount.

## Not measured

- Kinds other than the six above for the trailing-comment undercount; the rule above does not depend
  on knowing which kinds undercount.
- A `%%` inside a quoted label, which the trailing-comment rule would treat as a comment and so only
  withhold a line.
- Windows, and a `mermaid` major other than 11.

## Harness

`probe4.mjs`, `probe5.mjs`, `probe6.mjs` (the blocks above, through [spike 0425](./0425-what-mermaid-in-a-worker-does-under-vitest-and-the-cli.md)'s worker),
`linemap.mjs` and `checkmap.mjs` (the map and its 18 cases), and `seam/` (the copied worker against a
stub), in a directory where `npm i mermaid@11 jsdom` has run. The map, as measured:

```js
const FM = /^([^\S\n\r]*)-{3}\s*[\n\r](.*?)[\n\r]\1-{3}\s*[\n\r]+/s
const DIR = /%{2}{\s*(?:(\w+)\s*:|(\w+))\s*(?:(\w+)|((?:(?!}%{2}).|\r?\n)*))?\s*(?:}%{2})?/gi
const COM = /^\s*%%(?!{)[^\n]+\n?/gm
function cut(t, o, re) {
  let s = '',
    so = [],
    last = 0
  for (const m of t.matchAll(re.global ? re : new RegExp(re.source, re.flags + 'g'))) {
    s += t.slice(last, m.index)
    so.push(...o.slice(last, m.index))
    last = m.index + m[0].length
    if (!re.global) break
  }
  return [s + t.slice(last), so.concat(o.slice(last))]
}
export function mermaidLineMap(text) {
  let t = text.replace(/\r\n?/g, '\n')
  let o = []
  let ln = 1
  for (const ch of t) {
    o.push(ln)
    if (ch === '\n') ln++
  }
  ;[t, o] = cut(t, o, FM)
  ;[t, o] = cut(t, o, DIR)
  ;[t, o] = cut(t, o, COM)
  const lead = t.length - t.trimStart().length
  t = t.slice(lead)
  o = o.slice(lead)
  const starts = [o[0]]
  for (let i = 0; i < t.length; i++) if (t[i] === '\n' && i + 1 < t.length) starts.push(o[i + 1])
  return (mermaidLine) => starts[mermaidLine - 1] ?? null
}
```

It iterates by code point while `matchAll` indexes by UTF-16 unit; the fixtures were ASCII, and the
build indexes by unit.
