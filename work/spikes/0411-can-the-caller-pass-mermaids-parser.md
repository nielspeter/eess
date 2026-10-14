# Spike 0411: can the caller pass Mermaid's parser, isolated, so no eess package depends on it?

Measured 2026-10-14 for [proposal 006](../proposals/006-mermaid-beyond-classdiagram.md) Ask C, whose
review held it on four conditions. This spike answers condition 4, placement and the dependency. Condition 2, nested fences,
is [bug 0290](../bugs/0290-a-code-block-nested-in-a-list-is-never-checked.md), fixed separately.

## The question

The review's product lens argued the smallest shape: eess-md checks a language's code blocks with a
parser the caller passes, so eess never depends on Mermaid. Two facts decide whether that shape
holds:

1. `mermaid` needs a DOM for some diagram kinds, and the usual shim, `jsdom`, writes `window`,
   `document`, `DOMParser` and `Element` onto `globalThis`. Under vitest that reaches the adopter's
   other tests. Can the parse run where those globals cannot leak?
2. A missing or broken environment must fail closed as one finding (ADR-009), not as one syntax
   finding per fence. Can a thrown syntax error be told apart from an environment failure?

## Method

`mermaid` 11.17.2 and `jsdom` 29.1.1, installed in a scratch directory outside the repository, on
Node 24. Fourteen fences: valid and broken flowcharts, class, sequence, ER, state, mindmap, pie, packet,
`info`, a misspelt kind and an empty fence.

- **Plain Node, no DOM** (`plain.mjs`): parse each fence in the main thread.
- **Worker** (`host.mjs` + `worker.mjs`): the host starts one `worker_threads` worker. The worker
  installs the `jsdom` globals on its own `globalThis`, imports `mermaid` and parses a batch of 39
  fences. 39 is the count the review measured for this repository, fixtures included. The host
  records which of the four globals exist before and after.

## Result

**Plain Node.** 3 of 11 fences parse: an unlabelled flowchart, a sequence and an ER diagram. A labelled flowchart, a class diagram, a state diagram and a
mindmap throw `TypeError: DOMPurify.addHook is not a function`, an environment failure, valid or not.
`class-bad` throws the same `TypeError`: without a DOM, a syntax error in those kinds is not even
reached.

**Worker.** `39 fences in 588 ms (worker incl. jsdom + import) · host globals before=[] after=[]`.
Every valid fence parses, the four DOM-needing kinds included. The host's `globalThis` gains nothing.

| fence        | plain Node                  | worker                                                 |
| ------------ | --------------------------- | ------------------------------------------------------ |
| flow-plain   | OK                          | OK                                                     |
| flow-label   | `TypeError` (DOMPurify)     | OK                                                     |
| flow-bad     | `Error` with `hash`, line 3 | the same                                               |
| class        | `TypeError` (DOMPurify)     | OK                                                     |
| class-bad    | `TypeError` (DOMPurify)     | `Error` with `hash`, "Parse error on line 2"           |
| sequence, er | OK                          | OK                                                     |
| state        | `TypeError` (DOMPurify)     | OK                                                     |
| mindmap      | `TypeError` (DOMPurify)     | OK                                                     |
| misspelt     | `UnknownDiagramError`       | the same                                               |
| empty        | `UnknownDiagramError`       | the same                                               |
| pie-bad      | not run                     | `MermaidParseError`, "Lexer error on line 2, column 9" |
| packet-bad   | not run                     | `MermaidParseError`, "Parse error on line 2, column 8" |
| info         | not run                     | OK                                                     |

**Syntax errors are recognisable by shape.** Three forms cover every syntax error seen:

- the jison kinds throw an `Error` carrying `hash`;
- the Langium kinds throw a `MermaidParseError`;
- an empty or unknown kind throws an `UnknownDiagramError`.

Anything else is the instrument failing, not the diagram. That covers the `TypeError` above, a
missing `mermaid` or `jsdom` (the worker's import throws), and a worker that dies.

## Decision

The shape the review's product lens argued holds, and it needs no ADR:

- **eess-md owns the loop.** It checks the code blocks of one language with a parser the caller
  passes. The parser answers one fence with a tagged result: valid, or a syntax error with its
  message and, where known, its line. Anything the parser throws is one instrument finding per run,
  naming the environment, unsuppressable (ADR-009; ADR-016's shape for an instrument that cannot
  answer). Because a parse is asynchronous, the parse runs as one asynchronous batch that builds the
  facts, and a synchronous rule reads them: condition 1's answer, and the shape ADR-007 and ADR-013
  already set.
- **eess-mermaid ships the parser** as a function behind optional peers `mermaid` and `jsdom`,
  run in one `worker_threads` worker, so the DOM shim never reaches the caller's `globalThis`. It
  classifies by the three syntax shapes above and maps everything else to the instrument failure.
- **Neither owns what the other does.** eess-md gains no Mermaid dependency, and eess-mermaid does
  not own the fence loop, so this is not OQ1's "corpus dialect" branch that the review said needs an
  ADR.

This is decided by delegation from the measurements and can be overruled.

## Not measured

- **The line inside the diagram.** The jison error's "line 3" counts after Mermaid's preamble; the
  review's criteria list the rows a plan must pin. Not attempted here.
- **The worker under vitest and under the eess-ts CLI's loader.** The globals result is from a
  plain host. A plan's tests must run the worker in vitest.
- **Cold-start cost per run** beyond the one figure above. 588 ms covers 39 fences including the worker's start-up.

## Corrections after review (2026-10-14)

- **The 39.** The batch was the fourteen fences above repeated to 39 so the figure matched the
  review's count of fences in this repository, fixtures included. It is not this repository's corpus.
  mdast counts 4 top-level `mermaid` fences and 0 nested in `work/`, `adr/` and `docs/`. The cost figure
  stands.
- **A fourth classifier.** `worker.mjs` below also classified an error as syntax when its message
  matched `/Parsing failed|Parse error|Lexer error|Expecting/`, which the Result section did not
  disclose. It was unnecessary: the architect re-ran without it, and enforcement measured 17 more
  broken kinds, all falling into the three shapes. It was also fail-open in kind, since it could turn
  one environment failure into a syntax finding per fence. Proposal 006's 2026-10-14 review rules
  shape-only classification.
- **Two cases the Decision missed,** both measured by enforcement:
  - a worker that exits without posting leaves the host unsettled (Node exits 13, naming nothing);
  - a parse that never returns hangs the gate.

  Both are conditions in proposal 006's 2026-10-14 review.

- **`UnknownDiagramError` is not one break class.** An empty block, a directive or comment only, a
  misspelt kind and `zenuml` all throw it. The Decision's "invalid" bin was too coarse; the review
  gives it its own outcome, `unrecognised`.

The harness below is kept as it ran.

## Harness

`fences.mjs`, `plain.mjs`, `worker.mjs`, `host.mjs`, in a directory where `npm i mermaid@11 jsdom`
has run:

```js
// fences.mjs
export const fences = {
  'flow-plain': 'flowchart TD\n  A --> B',
  'flow-label': 'flowchart TD\n  A[Start] --> B[End]',
  'flow-bad': 'flowchart TD\n  A -->',
  class: 'classDiagram\n  class Foo',
  'class-bad': 'classDiagram\n  class Foo {',
  sequence: 'sequenceDiagram\n  A->>B: hi',
  er: 'erDiagram\n  A ||--o{ B : has',
  state: 'stateDiagram-v2\n  [*] --> A',
  mindmap: 'mindmap\n  root((r))\n    child',
  misspelt: 'flowchrt TD\n  A --> B',
  empty: '',
}
export const more = {
  'pie-bad': 'pie\n  "a" : x',
  'packet-bad': 'packet-beta\n  0-1: ',
  info: 'info',
}

// plain.mjs
import mermaid from 'mermaid'
import { fences } from './fences.mjs'
for (const [k, t] of Object.entries(fences)) {
  try {
    const r = await mermaid.parse(t)
    console.log(k.padEnd(11), 'OK', r?.diagramType)
  } catch (e) {
    console.log(
      k.padEnd(11),
      'ERR',
      e?.constructor?.name,
      JSON.stringify(Object.keys(e ?? {})),
      String(e?.message ?? e)
        .split('\n')[0]
        .slice(0, 70),
    )
  }
}

// worker.mjs
import { parentPort, workerData } from 'node:worker_threads'
import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><html><body></body></html>')
for (const k of ['window', 'document', 'DOMParser', 'Element', 'HTMLElement', 'Node'])
  globalThis[k] = k === 'window' ? dom.window : dom.window[k]
const { default: mermaid } = await import('mermaid')
const out = []
for (const [id, text] of workerData.fences) {
  try {
    const r = await mermaid.parse(text)
    out.push({ id, ok: true, kind: r.diagramType })
  } catch (e) {
    const syntax =
      e?.name === 'UnknownDiagramError' ||
      (e && 'hash' in e) ||
      e?.constructor?.name === 'MermaidParseError' ||
      /Parsing failed|Parse error|Lexer error|Expecting/.test(String(e?.message))
    out.push({
      id,
      ok: false,
      syntax,
      cls: e?.constructor?.name,
      msg: String(e?.message ?? e)
        .split('\n')
        .slice(0, 2)
        .join(' | ')
        .slice(0, 90),
    })
  }
}
parentPort.postMessage({
  version: (await import('mermaid/package.json', { with: { type: 'json' } })).default.version,
  out,
})

// host.mjs
import { Worker } from 'node:worker_threads'
import { fences, more } from './fences.mjs'
const before = ['window', 'document', 'DOMParser', 'Element'].filter((k) => k in globalThis)
const t0 = performance.now()
const all = Object.entries({ ...fences, ...more })
// 39 fences, as the repo-wide count in the review: repeat the set
const batch = Array.from({ length: 3 }, () => all)
  .flat()
  .slice(0, 39)
const res = await new Promise((ok, no) => {
  const w = new Worker(new URL('./worker.mjs', import.meta.url), { workerData: { fences: batch } })
  w.once('message', ok)
  w.once('error', no)
})
const ms = Math.round(performance.now() - t0)
const after = ['window', 'document', 'DOMParser', 'Element'].filter((k) => k in globalThis)
console.log(
  `mermaid ${res.version} · ${batch.length} fences in ${ms} ms (worker incl. jsdom + import) · host globals before=${JSON.stringify(before)} after=${JSON.stringify(after)}`,
)
for (const r of res.out.slice(0, all.length))
  console.log(r.id.padEnd(11), r.ok ? `OK ${r.kind}` : `ERR syntax=${r.syntax} ${r.cls}: ${r.msg}`)
```
