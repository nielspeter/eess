# Bug 0432: nothing checks that a crossvalidate entry point loads only its own peers

## Status

- **State:** Draft — recorded 2026-10-15 while fixing bug 0426. No red test yet.
- **Severity:** Low — no false green: the failure is loud (an entry point that does not load). The
  defect is that it would reach an adopter first, because no check here can see it.
- **Origin:** self-found · fixing bug 0426, 2026-10-15.
- **Reported:** 2026-10-15

## Symptom

eess-crossvalidate declares all four dialects as **optional** peers
(`packages/crossvalidate/package.json`, `peerDependenciesMeta`), so an adopter who uses only
`./mermaid-ts` installs eess-ts and eess-mermaid and nothing else. Five of the seven entry points
import `packages/crossvalidate/src/shared.ts` (`./md-ts` and `./files` do not). A runtime import of
another dialect added there makes those five need that dialect, and nothing in this repository goes
red: the workspace has every dialect installed, so the tests, `check:integrity`'s phantom-dependency check and the build all pass.

Measured while fixing bug 0426: its first draft put `import { tagIsLanguage } from
'@nielspeter/eess-md/internal'` in `shared.ts`. `npm run build` and the md and crossvalidate tests
passed with it. Only tracing the built import graph by hand showed that `dist/mermaid-ts.js` and
`dist/gherkin-ts.js` would then load eess-md. The fix put the import in a module of its own
(`packages/crossvalidate/src/mermaid-tag.ts`) that only the two Markdown bindings load.

A second shape of the same gap, from PR #222's review: a binding that imports a symbol its peer's
floor version does not have. `./md-mermaid` imports `tagIsLanguage`, which eess-md 0.11.0 adds; the
floor can only rise to `>=0.11.0` in the release commit, so until then, and if that step is
forgotten, the declared floor admits an eess-md the entry cannot load against. Nothing checks it.

## Root cause

`check:integrity` (`scripts/check-workspace-integrity.mjs`) asks whether a package declares what its
`src/` imports. It does not ask which declared peer each entry point needs, and the optional peers
make that the question that matters.

## Fix

Not designed. One shape: for each entry in crossvalidate's `exports`, walk the built runtime import
graph (type-only imports are erased), and fail when it reaches an `@nielspeter/eess-*` dialect the
entry's binding does not name. The map from entry to peers would be written down once, beside
`exports`.

## Verification

- [ ] Red test first: an import of an unneeded dialect added to `shared.ts` reds the check
- [ ] The check runs in CI

Deferred: none
