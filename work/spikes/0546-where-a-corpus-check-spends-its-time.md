# Spike 0546: where a corpus check spends its time

Measured 2026-10-25, after [plan 0541](../plans/completed/0541-this-repositorys-record-mentions-are-gated.md)'s
build (PR #260) timed out a `check:nonvacuity` shard at its 20-minute limit
(`.github/workflows/ci.yml:126`), and the maintainer observed that every project running eess-md
pays for its corpus checks, not only this one. It ran as throwaway scripts against the built
packages of `main` at 62473535 on Node 24.22.0, Linux, 12 cores, over this repository's `work/`,
`adr/` and `docs/` (575 Markdown files git sees, 8.1 M characters). CI figures are read from the job logs of
`main`'s run 39598310751 and PR #260's run 40140071770. Nothing here is built.

[Spike 0366](./0366-where-validate-spends-its-time.md) measured `check:corpus` at 3.8 s on
2026-09-29, on another machine (macOS). The figures below are this machine's and are not compared
with it.

## The question

1. Where does eess's own CI spend its time, and how much of it is the corpus checks?
2. Inside one corpus check, what costs: eess's rules, or the Markdown parser?
3. What does every eess-md user pay, whatever this repository's scripts do?
4. What would each candidate fix buy, measured, before one is chosen?

## 1. Where CI spends its time

`main`'s run, per step, every step over 20 s:

| job                    | step                                                 | time                           |
| ---------------------- | ---------------------------------------------------- | ------------------------------ |
| `nonvacuity-shard` × 4 | `npm run check:nonvacuity`                           | 41 min in all (523–719 s each) |
| `test`                 | `npm run test`                                       | 396 s                          |
| `test`                 | `format:check`, `lint`, `check:arch`, `check:ledger` | 20–27 s each                   |

`check:corpus` itself is under 20 s. The non-vacuity rows, grouped by the gate they drive:

| gate       | rows | row time | share |
| ---------- | ---- | -------- | ----- |
| `corpus`   | 140  | 1,528 s  | 62%   |
| `arch`     | 12   | 453 s    | 18%   |
| `examples` | 7    | 148 s    | 6%    |
| the rest   | 84   | 352 s    | 14%   |

Of the 140 corpus rows, 41 take over 20 s: each runs the production `scripts/check-corpus.mjs`
twice, once with `--format json` for the finding's identity and once as CI invokes it, for its exit
code. That is deliberate ([bug 0127](../bugs/fixed/0127-nonvacuity-proves-a-condition-not-a-wired-rule.md)).
On PR #260 the same rows took 47–49 s against 32–34 s on `main`, so shard 2 ran 61 of its 63
fixtures before it was cancelled.

## 2. Inside one corpus check

A CPU profile of one `check:corpus` run (15.4 s sampled, on PR #260's branch): micromark and the mdast
packages take about two thirds, garbage collection 7%, eess-md and the kernel about 10%.

Counting the calls to `parseMarkdown` (`packages/md/src/model/prose.ts:81`), the parser eess-md's
`corpus()` reads every document with (`packages/md/src/corpus.ts:158`):

| run                     | parses | distinct texts | parse time | run    |
| ----------------------- | ------ | -------------- | ---------- | ------ |
| `check:corpus`, `main`  | 1,148  | 575            | —          | 9.7 s  |
| `check:corpus`, PR #260 | 1,721  | 598            | 12.1 s     | 14.1 s |
| `check:ledger`, `main`  | 1,946  | 502            | 12.0 s     | 12.5 s |

Parsing is nearly the whole run, and most of it parses a text already parsed in the same process.
Where the repeats come from:

- **`check:corpus`:** the main corpus (575, `scripts/check-corpus.mjs:197`); then
  `scripts/lib/proposal-ruling.mjs` reparses each document it is asked about (487 at
  `scripts/lib/proposal-ruling.mjs:154`, 62 at `scripts/lib/proposal-ruling.mjs:129`), because
  `proseText` and `unclosedFences` parse when no tree is handed to them; a second corpus over `adr/`
  (23). PR #260 adds a corpus at the base (573), almost all of it text unchanged since the base.
- **`check:ledger`:** three corpora over the same lanes: per lane (473, `scripts/check-ledger.mjs:40`),
  `laneClaims` (502, `scripts/lib/lane-claims.mjs:28`) and `findFinishedNotClosed` (473,
  `scripts/lib/finished-not-closed.mjs:141`); and eess-md's public `findState`, called without its
  optional tree (`scripts/lib/finished-not-closed.mjs:151`), reparses each document once more
  (473, `packages/md/src/rules/ledger.ts:297`).

Every repeat is one of two shapes: a reader whose tree is optional and was not passed, or a second
`corpus()` over files another one already read. The second is what an adopter does too, with one
corpus per rule file or preset.

## 3. What every eess-md user pays

Sizes here are UTF-16 characters (`text.length`), the unit a bound on the text would count. Parsing
each file once, timed one by one: 7.7 M characters in 3.63 s, **about 2 M characters a second**,
median 1.87 M per file. It is linear: the ten slowest files take 18% of the time and hold 23% of the
characters, and the largest (`work/bugs/BUGS.md`, 0.96 M) parses at 4.3 M a second. So a corpus costs
about 0.5 s per million characters of Markdown each time it is built, before any rule runs.

| variant (all 575 files)                         | time   |
| ----------------------------------------------- | ------ |
| `parseMarkdown` (GFM and front matter)          | 3.69 s |
| GFM only                                        | 3.72 s |
| CommonMark only, no GFM                         | 1.88 s |
| 8 worker threads, parse and copy the trees back | 1.74 s |
| `structuredClone` of every tree (the copy-back) | 0.38 s |

GFM doubles the cost, and eess-md needs it (tables, autolink literals). Parallel parsing gains 2.1×
on 8 threads, but `corpus()` is synchronous, so it needs an asynchronous `corpus()`. Faster parsers on
npm: `comrak` (0.48.0-rc.0) and `pulldown-cmark-wasm` (0.1.0) emit no mdast with positions, which
every reader in eess-md works on; `markdown-rs` on npm is a 0.1.0 package. None is a drop-in.

The trees take 85 MB of heap for the 8.1 M characters, about 10 bytes a character. A grep finds no
source file in `packages/*/src`, `scripts/`, `examples/` or `kit/` that assigns to a node's fields or
splices a node's children; a grep proves only that it found none. The trees reach callers:
`MdDocument.root` is public (`packages/md/src/model/document.ts:69`), and the package's README
invites a loop over it. Deep-freezing all 575 trees takes 115 ms; looking all 575 up by exact text,
reading the files included, takes 15 ms on this corpus, whose long texts mostly differ in length.

## Findings

1. **The corpus checks are most of eess's CI**, and parsing is most of each corpus check. The cost
   that grows with every gate added is a parse of a text already parsed in the same process.
2. **The waste is reachable from eess-md's public surface**: a second `corpus()` over the same files,
   and `findState` (`@nielspeter/eess-md/rules/ledger`), whose tree is optional. `proseText` and
   `unclosedFences` reparse too, but are on `/internal`, family plumbing ([ADR-011](../../adr/011-the-kernels-public-api-is-explicit.md)). An adopter with
   several rule files pays the first as this repository's scripts do. About 1,000 of this
   repository's repeats are scripts dropping a tree they hold (`scripts/lib/finished-not-closed.mjs:151`
   among them), which the scripts could recover alone; the cross-corpus repeats they cannot.
3. **An adopter with one corpus gains nothing from removing repeats.** Its cost is micromark's speed;
   the only measured lever is parallel parsing, which changes `corpus()`'s signature.
4. **#260's timeout is finding 1**: its base corpus reparses text that has not changed.

## Decided, 2026-10-25, from the architect's and the enforcement review

Both reviews were run on the design above and wrote to the session's scratchpad; their decisions are
recorded here, since this record is what outlives them.

- **A, changed in one load-bearing respect: no tree is shared with a caller.** The memo is private to
  `packages/md/src/model/prose.ts`, process-wide, beside `parseMarkdown`. On a miss it parses (after
  the front-matter fallback, never the first pass), deep-freezes the result and keeps it as the
  **master**, which never leaves the module. The readers that only read (`proseText`, `unclosedFences`
  without a tree, and through them `findState`) read the master with no copy; `parseMarkdown` returns
  a `structuredClone` of it, so every `MdDocument` owns a mutable tree exactly as today. Sharing frozen
  trees was refused: twin-text documents would share node objects, so a node-keyed set or map would
  merge two documents and hide a finding; a write to a frozen node is silently dropped in sloppy-mode
  CommonJS; and it would be an unmarked break of the public `MdDocument.root`, which `check:release`
  cannot see. A frozen master is the memo's own guard: a reader that ever wrote to it throws in the
  suite instead of changing every later verdict for that text.
- **The key:** a sha1 of the text, then the stored text compared exactly, so a collision is a miss.
  Keying a `Map` on the text itself was measured at 3 ms a lookup for 2,000 long texts of one length
  (V8 hashes a long string by its length).
- **The bound:** total stored text length, default 2^24 characters (about 210 MB of master trees,
  twice this repository's corpus), least recently used evicted first. It must hold a corpus: LRU over
  a repeated scan larger than itself hits nothing. A text larger than the bound is parsed and not
  stored. A parse that throws stores nothing. The bound decides only whether a tree is kept, never
  whether a text is parsed, so it is no [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md) instrument and emits no finding. The memo registers
  its reset with the kernel's `registerCacheReset`. Unbounded is refused: a string cannot be a weak
  key, so nothing would free an entry in a watch session or a test worker.
- **What it costs and saves**, computed from the unit costs: `check:corpus` about 4.2 s of parsing
  instead of 7.4 s, `check:ledger` about 4.3 s instead of 12.0 s; an adopter with one corpus pays
  about 13% more (the copies) and gains nothing. Each non-vacuity row starts a fresh process, so its
  saving is the within-process repeats only. A patch for eess-md: nothing an adopter can observe
  changes. Built and measured by [bug 0547](../bugs/fixed/0547-eess-md-parses-a-text-more-than-once-per-process.md).
- **B: keep both runs per corpus row.** The terminal exit of `scripts/check-corpus.mjs` is computed from a
  hand-kept list, not from the receipt the JSON exit reads, so only the per-row terminal run proves
  each rule reaches the exit CI judges ([bug 0127](../bugs/fixed/0127-nonvacuity-proves-a-condition-not-a-wired-rule.md)).
  Halving the rows needs that exit derived from the receipt first:
  [bug 0548](../bugs/0548-check-corpus-exits-on-a-second-list.md).
- **C** stays a proposal's to raise, if an adopter's single corpus is too slow: a breaking change to
  `corpus()`.

## Not decided here

- Whether eess-md's model should be immutable (a deep-readonly, frozen `MdDocument.root`): a breaking
  change across every dialect's element model, so a proposal and an ADR. It would remove only the
  copies; the memo is unchanged.
- Whether the readers' optional tree should become required: a breaking change, and the memo makes
  leaving it out cheap.
- Whether the corpus checks' growth since [spike 0366](./0366-where-validate-spends-its-time.md) is
  the corpus's size or the gates added: measured on different machines, so not compared here.
