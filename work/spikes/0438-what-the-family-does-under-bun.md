# Spike 0438: what the eess family does under Bun

Measured 2026-10-16, after an adopter monorepo running Bun 1.4.3 reported that
`import { corpus } from '@nielspeter/eess-md'` fails at link time from eess 0.5.1 on. The owner
asked for Bun support, scoped to what CI can test, starting with this spike, then a decision
record and a plan. Time-boxed to an hour; it took about an hour. Bun 1.4.3, Node 24.14.0, macOS,
`main` at 65b9ce44 (eess 0.7.0, eess-md 0.10.0, eess-mermaid 0.7.0, eess-ts 0.13.0, eess-gherkin
0.6.0, eess-crossvalidate 0.8.0).

## The questions

1. Which published entry points load under Bun, and what stops the rest?
2. With that fixed, do real calls give the same answers under Bun as under Node?
3. Does the eess-ts CLI work under Bun, including its `.js` → `.ts` resolve hook ([bug 0223](../bugs/fixed/0223-type-module-rule-files-cannot-import-a-sibling.md))?
4. Can each package's own test suite run on the Bun runtime, and what fails?

## Result

**1. One import stops 22 of the 28 published entry points.** Each entry in the six packages'
`exports` was imported in its own `bun` process, against `main`'s build (a shared process caches
the first failure). The first run of this spike probed only 18 of them; the 28 below were measured
after the method review.

- loads (6): `@nielspeter/eess`, `@nielspeter/eess-md/rules/adr`, `…/rules/ledger`,
  `@nielspeter/eess-md/internal`, `@nielspeter/eess-ts/rules/naming`, `@nielspeter/eess-gherkin`;
- fails (22) with `SyntaxError: Export named 'registerHooks' not found in module 'node:module'`:
  `@nielspeter/eess/internal`, `@nielspeter/eess-md`, `@nielspeter/eess-mermaid`, 12 of the 13
  eess-ts entries (all but `./rules/naming`) and all seven eess-crossvalidate entries.

The import is `packages/core/src/cli-config.ts:3`, `import { registerHooks } from 'node:module'`.
`@nielspeter/eess/internal` re-exports `cli-config.js`, and an entry that reaches the kernel's
internals through it links the CLI's hook, so a CLI concern sits on the load path of library
entries such as `corpus()`. Bun's `node:module` has no `registerHooks`. In a `.js` ES module a
missing named import fails the whole graph at link time, even if it is never called.

In a private copy of the built packages, replacing that one import with a namespace import
(`import * as nodeModule from 'node:module'`, then `nodeModule.registerHooks(...)` at the one call
site) made **all 28 entries load**. `@nielspeter/eess-ts/cli` runs the CLI when imported and exits
non-zero with "No command specified", the same under Node. Recorded as
[bug 0439](../bugs/fixed/0439-the-family-fails-to-load-under-bun-from-eess-0-5-1.md).

**2. Yes, by the counts compared.** One script, run under both runtimes against the patched copy,
from the repository root at 65b9ce44. It compares one summary per call (a count, or that a value
loaded), not the full violation lists:

| call                                                            | Node                                | Bun           |
| --------------------------------------------------------------- | ----------------------------------- | ------------- |
| `corpus({ roots: ['work/**', 'adr/**', 'docs/**'] })`           | 468 docs, 39 frozen, 1967 ms        | same, 1944 ms |
| `links(corpus(adr/**)).should().haveLiveTargets().violations()` | 1                                   | 1             |
| `honestyAtClose(corpus(work/plans/**))`                         | 0 findings                          | 0 findings    |
| `diagram('docs/architecture.mmd')`                              | loads                               | loads         |
| `parseCodeBlocks(manifesto, mermaidParser())`                   | 1 block parsed with mermaid 11.17.2 | same          |
| eess-ts `project(core)` + `classes().should().notExist()`       | 8 violations                        | 8 violations  |

Bun was as fast or slightly faster on each. The corpus counts are this tree's; they move with it.

**3. The CLI works, and the hook is not needed.** `eess-ts check` on a `.ts` rule file, run under
each runtime from the patched copy: red with 8 violations and exit 1, or green with exit 0, the
same under both. A rule file importing `./helper.js` where only `helper.ts` exists also loads under
Bun: the first import succeeds, so the retry that calls `enableTypeScriptSpecifierResolution`
(`packages/ts/src/cli/import-rule-module.ts:62`) is not needed. That it is never reached is inferred
from the first import succeeding; nothing instrumented it. If it were reached under the patch, it
would throw `nodeModule.registerHooks is not a function`. `eess-mermaid --help` starts under both.

**4. Every suite runs on Bun; 9 of the 4,881 tests differ once the import is fixed.**
`bun --bun vitest run` puts vitest's workers on Bun: a test asserting on the runtime received
`bun 1.4.3` with both the `forks` and `threads` pools, and `node v24.14.0` when vitest was run by
Node (see the correction below).

| package       | unpatched | import patched (worktree build) |
| ------------- | --------- | ------------------------------- |
| core          | 300/300   | not re-run                      |
| md            | 300/300   | not re-run                      |
| gherkin       | 11/11     | not re-run                      |
| mermaid       | 164/172   | 166/172                         |
| crossvalidate | 122/128   | 127/128                         |
| ts            | 3957/3970 | 3968/3970                       |

**A green suite on Bun does not prove the package loads under Bun.** eess-md's suite passed 300 of
300 under `bun --bun vitest` on `main`'s build, the same build whose `@nielspeter/eess-md` entry
fails to import under plain `bun`. The method review measured why: a one-test file importing the
unpatched `dist/internal.js` passes under `bun --bun vitest`, asserting `Bun.version`, so vitest's
module runner links what Bun itself refuses. The unpatched suite failures above presumably came
through subprocesses that run the built bins under Bun; that was not traced.

The 9 that remain:

- **eess-ts watch mode reads a stale sibling.** `tests/cli/esm-sibling-import.test.ts`, "a second
  fresh load sees the edited sibling": `{ first: 'v1', second: 'v1' }` where Node gives `'v2'`.
  A real defect for `--watch` under Bun, recorded as
  [bug 0440](../bugs/0440-eess-ts-watch-mode-reads-a-stale-sibling-under-bun.md).
- **eess-mermaid's missing-peer path rejects instead of resolving.** `tests/mermaid-parser.test.ts`,
  the two "the worker failing" tests about a missing `mermaid`, `jsdom` or one of their
  dependencies: the parse rejects with `MermaidParserFailure` where the test expects it to
  resolve. The remedy is right ("Install both peers", "`eess-absent-dependency`, … is missing"),
  and a rejection should still be a finding to eess-md: `parseCodeBlocks` turns a thrown parser into
  "the parser threw" (`packages/md/src/model/code-block-parse.ts:320`). That is read from the code,
  not run under Bun. Not yet explained.
- **Four eess-mermaid CLI tests fail inside vitest only.** "check passes for a clean rule file",
  "explain dumps rules as JSON", "explain --markdown" and the [bug 0269](../bugs/fixed/0269-eess-mermaids-check-door-greenlights-a-builder-that-enforces-nothing.md) CONTROL test: `exitCode` is
  1 where the test expects falsy. The same command run directly under Bun (`bun dist/cli/bin.js
check tests/fixtures/rules/passing.rules.ts`) is green with exit 0. The tests drive `run()` in
  process and reset `process.exitCode = undefined`; the suspect is that reset or state between
  tests under Bun. Not yet explained.
- **Two tests assert a Node mechanism.** eess-crossvalidate's "reports the version a resolve hook
  loads" runs a Node `--import` resolve hook. eess-ts's "resolves the sibling with Node, not by
  falling back to a transpiler" expects Node's strip-only TypeScript to refuse an `enum`, which
  Bun compiles. Both are Node behaviours, not eess defects.

So the 9 are 1 + 2 + 4 + 2: eess-mermaid 6, eess-crossvalidate 1, eess-ts 2.

## Recommendation for the decision record and the plan

- **The fix is placement, then the import.** The CLI loader hook does not belong on the load path
  of a library entry. Move `cli-config.js`'s exports out of `@nielspeter/eess/internal` into an
  entry only the CLIs import, so `corpus()` never links it. The namespace import is still worth
  having in the CLI path, so the CLIs themselves load under Bun. Only the namespace import was
  measured, and it alone made every entry load; the move was not built, so whether it alone
  suffices is the plan's to measure.
- **What can honestly be in, from this spike:** the kernel, eess-md and eess-gherkin pass their
  suites on Bun (run unpatched only, which by the finding above proves less than it reads). eess-ts
  passes all but watch mode and one Node-mechanism test. eess-crossvalidate passes all but one
  Node-mechanism test. eess-mermaid has two unexplained differences, and its CLI tests need a look
  before it is claimed.
- **What "supported" means is the decision record's to rule.** This spike's measurement constrains
  it: a suite run on Bun alone passed eess-md on `main`'s build, which fails to load under Bun, and by
  the same mechanism would pass every such release. So any claim pairs the suite with a plain-`bun`
  import of every published entry, the list derived from each package's `exports` rather than typed
  in (the first probe here typed 18 and missed 10), and tests that assert a Node mechanism are marked as such rather
  than skipped silently.

## Correction (2026-10-16, [ADR-020](../../adr/020-a-package-supports-a-runtime-only-where-ci-checks-it-there.md)'s review)

Q4 first said vitest ran on Node "without `--bun`". The run that gave `node v24.14.0` was vitest
started by Node, not by Bun without the flag. Measured since: `bun node_modules/.bin/vitest run`,
without `--bun`, ran its workers on Bun 1.4.3 under both pools; `bunx vitest run` followed vitest's
`#!/usr/bin/env node` shebang and ran on Node. The trap is the shebang, and the published bins carry
the same one. Harness: `bun/vt/rt.test.ts`, run as `bun node_modules/.bin/vitest run --root bun/vt
--pool <forks|threads>` and as `bunx vitest run` from `bun/vt`.

## Not measured

- Bun on Linux, which is where CI runs, and any Bun version but 1.4.3.
- `bun test` (Bun's own runner); only vitest on the Bun runtime.
- The eess-mermaid CLI's `check` on a real diagram under Bun beyond `--help`, and `eess-ts check
--watch` end to end.
- The 9 tests' root causes beyond what is stated.
- core, md and gherkin suites against the patched build (they passed unpatched).

## Harness

In the scratchpad of the session that ran it, not committed: `bun/probe.sh` (the first probe, one
process per entry over a typed list of 18), the 28-entry re-run, which read its list from each
package's `exports` (`entries.txt`, and the method review's `rev438/p28.sh`), the method review's
one-test vitest file behind Q4's masking finding (`rev438/`), `bun/func.mjs` (the calls in Q2, run under `node` and `bun`), `bun/demo*.rules.ts` and
`bun/helper.ts` (Q3), `bun/vt/rt.test.ts` (which runtime vitest's workers use), and a worktree at
`main` with the import patched and the family built (Q4).
