# Bug 0439: from eess 0.5.1 on, most of the family fails to load under Bun

## Status

- **State:** Fixed — 2026-10-17, by [plan 0448](../../plans/completed/0448-a-bun-load-guard-and-bug-0439s-fix.md)
  (PR #232): a namespace import, and a Bun load guard in CI that keeps it fixed. Recorded 2026-10-16
  from [spike 0438](../../spikes/0438-what-the-family-does-under-bun.md).
- **Severity:** Medium — no false green: an import that fails is loud. But it is a shipped defect
  for every adopter on Bun, and eess-md, which has nothing to do with the CLI, is among them.
- **Origin:** reported · an adopter monorepo on Bun 1.4.3, 2026-10-16; reproduced in spike 0438.
- **Reported:** 2026-10-16

## Symptom

`import { corpus } from '@nielspeter/eess-md'` under Bun 1.4.3 throws
`SyntaxError: Export named 'registerHooks' not found in module 'node:module'`. Measured against
`main`'s build, one `bun` process per published entry: 22 of the 28 entries in the six packages'
`exports` fail this way, and 6 load (`@nielspeter/eess`, `@nielspeter/eess-md/rules/adr`,
`…/rules/ledger`, `@nielspeter/eess-md/internal`, `@nielspeter/eess-ts/rules/naming`,
`@nielspeter/eess-gherkin`). The adopter measured that eess-md 0.5.0 with eess 0.4.0 loads, and that
every published eess from 0.5.1 on carries the import.

## Root cause

`packages/core/src/cli-config.ts:3` imports `registerHooks` by name from `node:module`, for the
CLI's `.js` → `.ts` resolve hook (bug 0223). `@nielspeter/eess/internal` re-exports
`cli-config.js`, and the dialects reach the kernel's internals through it, so the CLI's hook is on
the load path of library entries such as `corpus()`. Bun's `node:module` has no `registerHooks`, and
in a `.js` ES module a missing named import fails the whole graph at link time even if the function
is never called.

**Why no test saw it:** no test imports a published entry under plain `bun`, and a green suite on
Bun does not prove the package loads there. eess-md's suite takes the kernel from the built
`dist/internal.js`, the failing build, and still passed: spike 0438 measured eess-md's suite at 300 of 300 under `bun --bun vitest` on
the same build whose entry fails to import under plain `bun`: vitest's module runner links what Bun
itself refuses.

## Fix

The spike measured one fix: a namespace import (`import * as nodeModule from 'node:module'`, then
`nodeModule.registerHooks(...)` at the call site) made all 28 entries load, counting
`@nielspeter/eess-ts/cli` as loaded: it runs the CLI when imported and exits non-zero with "No
command specified", the same under Node. It also recommends taking
the CLI's loader exports off `@nielspeter/eess/internal`, so a library entry never links CLI code;
that was not built. The plan decides which, and its red test must import each published entry under plain `bun`, not run a suite. _Decided 2026-10-17 by plan 0448: the namespace import alone, a patch; the move off `/internal` is plan 0449._

## Verification

- [x] Red first: a plain-`bun` import of each published entry fails on the current build — the
      guard on `main`'s build, macOS, Bun 1.4.3: 21 entries with this message, `eess-ts/cli` with the
      same link error, and both bins (22 of 28 entries)
- [x] Green: every published entry loads under plain `bun`, the list derived from each package's
      `exports`; an entry that runs a command when imported (`eess-ts/cli`) counts as loaded when
      its error is the command's own, not a link error — 28 entries and 2 bins, locally and in CI on
      Linux (plan 0448)
- [x] Published, and the adopter told the version numbers: tag `v0.14.0` (PR #233) at 880483c1,
      whose CI, `bun-load` included, was green before the tag push; eess 0.7.1 published with
      provenance 2026-10-17. Installed from npm into a scratch folder by this release's
      author, `bun probe.mjs` under Bun 1.4.3 imported eess-md 0.10.0 and then 0.11.0, each
      resolving `@nielspeter/eess` to that folder's kernel 0.7.1. The adopter was told the versions and reported eess 0.7.1 with
      eess-md 0.11.0 loads under Bun 1.4.3. The adopter also reported it loads under Bun
      1.3.12, the version their CI runs, on macOS only (not their CI's Linux). eess itself checks
      only the version in `.bun-version`, and ADR-020 makes no claim for any Bun

Deferred: none
