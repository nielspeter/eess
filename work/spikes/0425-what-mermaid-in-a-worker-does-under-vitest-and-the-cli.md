# Spike 0425: what Mermaid in a worker does under vitest and the eess-ts CLI

Measured 2026-10-15 for the freeze of
[plan 0413](../plans/0413-eess-mermaid-ships-mermaids-own-parser.md). The plan deferred several
measurements to its own build, and one of them ("if the worker cannot run under vitest and the CLI
loader, the feature does not ship") would have sent it back for a decision mid-build. Time-boxed to an
hour; it took about 35 minutes.

## The questions

1. Does the worker of [spike 0411](./0411-can-the-caller-pass-mermaids-parser.md) run under vitest
   (both pools) and from a rule file the eess-ts CLI loads, leaving the host's globals clean?
2. Can `mermaid`'s version be read, given its `exports` map?
3. What do the error shapes look like on today's `mermaid`, and where is each one's line?
4. How does Mermaid count an error's line after frontmatter, a directive or blank leading lines?
5. What does a missing peer look like, and an early exit?
6. What does the install cost?

## Method

`mermaid` 11.17.2, `jsdom` 29.1.1 and `vitest` 4, installed in a scratch directory outside the
repository, on Node 24. The worker installs the `jsdom` globals on its own `globalThis`, imports
`mermaid`, posts the index of each block before parsing it, and posts its verdicts. The host records
which of `window`, `document`, `DOMParser` and `Element` exist before and after.

## Result

**1. It runs everywhere it needs to, and the host stays clean.**

| host                                                      | result                           | host globals before → after |
| --------------------------------------------------------- | -------------------------------- | --------------------------- |
| plain Node, 14 blocks                                     | all parsed, 485 ms with start-up | none → none                 |
| vitest 4, `--pool=forks`                                  | passes                           | none → none                 |
| vitest 4, `--pool=threads`                                | passes                           | none → none                 |
| a `.rules.ts` file run by `eess-ts check` (the built CLI) | parsed (`[true, false]`)         | none → none                 |

The labelled flowchart, class, state and mindmap blocks, the four that fail in plain Node, all parse.

**2. The version is readable.** `mermaid`'s `exports` map has no `./package.json` entry, yet
`createRequire(import.meta.url).resolve('mermaid/package.json')` resolves it. Walking up from
`import.meta.resolve('mermaid')` gives the same file. Both read `11.17.2`.

**3. The shapes are as plan 0413's table says.**

| block                                              | thrown                                     | line                                    |
| -------------------------------------------------- | ------------------------------------------ | --------------------------------------- |
| a jison kind with a syntax error (`flowchart`)     | `Error` with `hash`                        | `hash.loc.first_line`                   |
| a Langium kind with a syntax error (`packet-beta`) | `MermaidParseError`                        | only in the message: "line 2, column 8" |
| a misspelt kind (`flowchrt`), `zenuml`             | `UnknownDiagramError`                      | —                                       |
| an empty block, comments only, a directive only    | `UnknownDiagramError`, one message for all | —                                       |

For the jison kinds, **the message's line is wrong**: a missing target at the end of body line 3
reads "Parse error on line 4" (the end of input), while `hash.loc.first_line` is 3. The line is taken
from `hash`, never the message. An empty block, comments only and a directive only cannot be told
apart from the error; the preamble walk has to.

**4. Mermaid drops the preamble before it counts.** Every line before the kind line (frontmatter,
`%%` lines, directives, blank lines) is removed, and the error's line is counted from the kind line.

| body                                               | error on body line | Mermaid's line (jison `hash` / Langium message) |
| -------------------------------------------------- | ------------------ | ----------------------------------------------- |
| frontmatter (3 lines), kind, broken line           | 5                  | 2                                               |
| a directive, kind, broken line                     | 3                  | 2                                               |
| two blank lines, kind, broken line                 | 4                  | 2                                               |
| frontmatter, kind, broken Langium line             | 5                  | 2                                               |
| a directive and a blank line, kind, broken Langium | 4                  | 2                                               |

So the body line is Mermaid's line plus the number of lines before the kind line, in every case.

**5. Failures are recognisable.** A worker in a directory where the peers cannot be resolved rejects
with `ERR_MODULE_NOT_FOUND`, naming the package (`Cannot find package 'jsdom'`, the first import). A
worker that exits without a result is seen by the host's `exit` handler with its code (13 measured),
and the index posted before each block names the block in flight.

**6. The install is 179 MB**: `mermaid` 83 MB and `jsdom` 8.3 MB, the rest their dependencies. The
2026-10-14 review's figure of about 180 MB holds.

## Decision

Plan 0413's design holds as written; nothing here sends it back. The freeze records:

- the worker is gated on running under vitest and the CLI loader, which it does;
- the version is read with `createRequire(...).resolve('mermaid/package.json')`;
- the line rule: Mermaid's line plus the lines before the kind line, from `hash.loc.first_line` for
  jison and the message for Langium;
- the install cost, 179 MB.

## Not measured

- Windows.
- A `mermaid` major other than 11.
- The worker inside `eess-ts check --watch`.

## Harness

`worker.mjs`, `host.mjs` and probe scripts in a directory where `npm i mermaid@11 jsdom vitest@4` has
run. The worker:

```js
import { parentPort, workerData } from 'node:worker_threads'
let mermaid
try {
  const { JSDOM } = await import('jsdom')
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  for (const k of [
    'window',
    'document',
    'DOMParser',
    'Element',
    'HTMLElement',
    'Node',
    'navigator',
  ]) {
    if (!(k in globalThis)) globalThis[k] = k === 'window' ? dom.window : dom.window[k]
  }
  mermaid = (await import('mermaid')).default
} catch (e) {
  parentPort.postMessage({ type: 'load-error', code: e?.code, message: String(e?.message ?? e) })
  process.exit(0)
}
const out = []
for (const [i, text] of workerData.texts.entries()) {
  parentPort.postMessage({ type: 'progress', index: i })
  try {
    const r = await mermaid.parse(text)
    out.push({ ok: true, r: r?.diagramType ?? r })
  } catch (e) {
    out.push({
      ok: false,
      name: e?.constructor?.name,
      hashLine: e?.hash?.loc?.first_line,
      msg: String(e?.message),
    })
  }
}
parentPort.postMessage({ type: 'done', out })
```

The host starts it with `new Worker(new URL('./worker.mjs', import.meta.url), { workerData: { texts } })`,
records the last `progress` index, resolves on `done`, and rejects on `load-error`, `error` or `exit`.
The CLI probe is a `probe.rules.ts` that imports the host and parses two blocks at top level, run by
`node packages/ts/dist/cli/bin.js check probe.rules.ts`.
