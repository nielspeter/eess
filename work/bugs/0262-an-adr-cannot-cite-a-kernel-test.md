# Bug 0262: an ADR cannot cite a kernel test

## Status

- **State:** Draft — reproduced while writing ADR-014's Enforcement rows.
- **Severity:** Medium — not a false green in a rule, but a **weakened
  enforcement tier**: a kernel clause can be backed only by a file path, where a
  dialect clause gets an AST-grounded `it()` citation. The gate silently offers
  less proof for the package it most needs it from.
- **Created:** 2026-09-06
- **Found by:** self-found · moving ADR-014's rows to `gated` under plan 0235

## Symptom

`check:crossval`'s ADR↔test gate resolves cited `it('…')` titles against a real
TypeScript project. It loads exactly one:

```js
adrCitationsResolve(adrs, project('packages/ts/tsconfig.json'), { dir: 'adr/**', ...opts })
```

That project is `eess-ts`. Its `include` does not reach `packages/core/tests`, so
**every citation into a kernel test fails to resolve**. Measured: ten citations
added to ADR-014's Enforcement table, all naming real, passing tests in
`packages/core/tests/emitter-refuses-without-evidence.test.ts`, all reported as
`clause … cites missing test`.

The failure is honest — the resolver genuinely cannot see the file — but its
message reads as "this test does not exist", which sends an author to rewrite a
citation that was correct.

## Root cause

The gate's own comment records the last version of this lesson:

> The DEV tsconfig (includes tests/) — the build tsconfig excludes tests, so
> cited `it()` titles would never resolve against it (this gate caught exactly
> that misconfiguration on first run with real citations).

The scope was fixed from build→dev and not from one-package→family.
`adrCitationsResolve` takes a single project, so widening it is not a config
change: two calls would each report the other project's citations as missing.

## Why it matters more than it looks

ADRs 011, 012, 013 and 014 are all **kernel** decisions. Their clauses are proven
by kernel tests. So the four most recent binding decisions are exactly the ones
whose enforcement rows cannot reach the strongest available tier — and the
convention in CLAUDE.md presents the `it()` citation as the normal way to write
a row, with no note that half the repo cannot use it.

ADR-014's rows are currently written with the file path plus the test's subject
in prose. The file-existence half is still gated; the AST half is not.

## Fix

Not decided. Two shapes:

1. **A project that spans the family's tests.** A dedicated tsconfig whose
   `include` covers every package's `tests/`, passed to `adrCitationsResolve`.
   Cheapest, and the same "scope the project" move the gate already made once.
   Risk: a wider project pulls in fixture files whose `it()` titles are
   citation-shaped by design — the exact pollution the scenario↔test gate
   scoped a dedicated tsconfig to avoid.
2. **Let the preset take several projects**, resolving a citation if any of them
   holds it. A change to `eess-crossvalidate`'s public surface, and the honest
   shape if ADRs are expected to cite anywhere.

## Verification

- [ ] a red test: an ADR citing a real `packages/core/tests` title resolves
- [ ] the reverse still fires: an ADR citing a title that exists nowhere reds
- [ ] fixture-shaped `it()` titles in test fixtures do not pollute the resolver
- [ ] ADR-014's rows upgraded from file-path to `it()` citations once it lands
