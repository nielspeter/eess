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
3. Does the eess-ts CLI work under Bun, including its `.js` → `.ts` resolve hook (bug 0223)?
4. Can each package's own test suite run on the Bun runtime, and what fails?

## Result

**1. One import stops 16 of 18 entry points.** Each entry was imported in its own `bun` process
(a shared process caches the first failure):

- loads: `@nielspeter/eess`, `@nielspeter/eess-md/rules/adr`, `…/rules/ledger`,
  `@nielspeter/eess-md/internal`, `@nielspeter/eess-gherkin`;
- fails with `SyntaxError: Export named 'registerHooks' not found in module 'node:module'`:
  `@nielspeter/eess/internal`, `@nielspeter/eess-md`, `@nielspeter/eess-mermaid`, every eess-ts
  entry tried (`.`, `./presets`, `./graphql`) and all seven eess-crossvalidate entries.

The import is `packages/core/src/cli-config.ts:3`, `import { registerHooks } from 'node:module'`.
`@nielspeter/eess/internal` re-exports `cli-config.js`, and every dialect reaches the kernel's
internals through it, so a CLI concern sits on the load path of every library entry. Bun's
`node:module` has no `registerHooks`. In a `.js` ES module a missing named import fails the whole
graph at link time, even if it is never called; a `.ts` file under Bun does not fail, which is
why the kernel's own suite (run from source) passes.

In a private copy of the built packages, replacing that one import with a namespace import
(`import * as nodeModule from 'node:module'`, then `nodeModule.registerHooks(...)` at the one call
site) made **all 18 entries load**. Nothing else in any load path fails.

**2. Yes: every real call measured answers the same.** One script, run under both runtimes against
the patched copy, from the repository root:

| call                                                            | Node                                | Bun           |
| --------------------------------------------------------------- | ----------------------------------- | ------------- |
| `corpus({ roots: ['work/**', 'adr/**', 'docs/**'] })`           | 468 docs, 39 frozen, 1967 ms        | same, 1944 ms |
| `links(corpus(adr/**)).should().haveLiveTargets().violations()` | 1                                   | 1             |
| `honestyAtClose(corpus(work/plans/**))`                         | 0 findings                          | 0 findings    |
| `diagram('docs/architecture.mmd')`                              | loads                               | loads         |
| `parseCodeBlocks(manifesto, mermaidParser())`                   | 1 block parsed with mermaid 11.17.2 | same          |
| eess-ts `project(core)` + `classes().should().notExist()`       | 8 violations                        | 8 violations  |

Bun was as fast or slightly faster on each.

**3. The CLI works, and the hook is not needed.** `eess-ts check` on a `.ts` rule file, run under
each runtime from the patched copy: red with 8 violations and exit 1, or green with exit 0, the
same under both. A rule file importing `./helper.js` where only `helper.ts` exists also loads under
Bun. Bun substitutes `.js` → `.ts` itself, so `importRuleModule`'s retry
(`packages/ts/src/cli/import-rule-module.ts:62`) never calls `enableTypeScriptSpecifierResolution`
under Bun. `eess-mermaid --help` starts under both.

**4. Every suite runs on Bun; 9 tests out of about 4,270 differ once the import is fixed.**
`bun --bun vitest run` puts vitest's workers on Bun: a test asserting on the runtime received
`bun 1.4.3` with both the `forks` and `threads` pools, and `node v24.14.0` without `--bun`.

| package       | unpatched | import patched (worktree build) |
| ------------- | --------- | ------------------------------- |
| core          | 300/300   | not re-run                      |
| md            | 300/300   | not re-run                      |
| gherkin       | 11/11     | not re-run                      |
| mermaid       | 164/172   | 166/172                         |
| crossvalidate | 122/128   | 127/128                         |
| ts            | 3957/3970 | 3968/3970                       |

The 9 that remain:

- **eess-ts watch mode reads a stale sibling.** `tests/cli/esm-sibling-import.test.ts`, "a second
  fresh load sees the edited sibling": `{ first: 'v1', second: 'v1' }` where Node gives `'v2'`.
  The fresh-import trick does not bust Bun's module cache. A real defect for `--watch` under Bun.
- **eess-mermaid's missing-peer path rejects instead of resolving.** `tests/mermaid-parser.test.ts`,
  the two "the worker failing" tests about a missing `mermaid`, `jsdom` or one of their
  dependencies: the parse rejects with `MermaidParserFailure` where the test expects it to
  resolve. The remedy is right ("Install both peers", "`eess-absent-dependency`, … is missing"),
  and a rejection is still a finding to eess-md, so it fails closed. Not yet explained.
- **Four eess-mermaid CLI tests fail inside vitest only.** "check passes for a clean rule file",
  "explain dumps rules as JSON", "explain --markdown" and the bug 0269 CONTROL test: `exitCode` is
  1 where the test expects falsy. The same command run directly under Bun (`bun dist/cli/bin.js
check tests/fixtures/rules/passing.rules.ts`) is green with exit 0. The tests drive `run()` in
  process and reset `process.exitCode = undefined`; the suspect is that reset or state between
  tests under Bun. Not yet explained.
- **Three tests assert a Node mechanism.** eess-crossvalidate's "reports the version a resolve hook
  loads" runs a Node `--import` resolve hook. eess-ts's "resolves the sibling with Node, not by
  falling back to a transpiler" expects Node's strip-only TypeScript to refuse an `enum`, which
  Bun compiles. Both are Node behaviours, not eess defects. The third is the watch-mode test above,
  counted once.

## Recommendation for the decision record and the plan

- **The fix is placement, then the import.** The CLI loader hook does not belong on the load path
  of a library entry. Move `cli-config.js`'s exports out of `@nielspeter/eess/internal` into an
  entry only the CLIs import, so `corpus()` never links it. The namespace import is still worth
  having in the CLI path, so the CLIs themselves load under Bun. Only the namespace import was
  measured, and it alone made every entry load; the move was not built, so whether it alone
  suffices is the plan's to measure.
- **What can honestly be in, from this spike:** the kernel, eess-md and eess-gherkin pass their
  suites on Bun unpatched or patched. eess-ts passes all but watch mode and one Node-mechanism test.
  eess-crossvalidate passes all but one Node-mechanism test. eess-mermaid has two unexplained
  differences, and its CLI tests need a look before it is claimed.
- **What "supported" means is the decision record's to rule**: a package supports Bun where CI runs
  its suite on Bun and fails when it breaks, and tests that assert a Node mechanism are marked as
  such rather than skipped silently.

## Not measured

- Bun on Linux, which is where CI runs, and any Bun version but 1.4.3.
- `bun test` (Bun's own runner); only vitest on the Bun runtime.
- The eess-mermaid CLI's `check` on a real diagram under Bun beyond `--help`, and `eess-ts check
--watch` end to end.
- The 9 tests' root causes beyond what is stated.
- core, md and gherkin suites against the patched build (they passed unpatched).

## Harness

In the scratchpad of the session that ran it, not committed: `bun/probe.sh` (one process per
entry), `bun/func.mjs` (the calls in Q2, run under `node` and `bun`), `bun/demo*.rules.ts` and
`bun/helper.ts` (Q3), `bun/vt/rt.test.ts` (which runtime vitest's workers use), and a worktree at
`main` with the import patched and the family built (Q4).
