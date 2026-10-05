# Bug 0387: a basename exclusion the docs teach never matches

## Status

- **State:** Draft — measured; no red test yet.
- **Severity:** Medium — **an exclusion that does nothing, taught as one that works.** It
  fails closed: the excluded findings still report, with a stderr "Unused exclusion" warning.
  But it leaves an adopter, or an agent, reaching for a looser pattern — `/index/`, `/.*/` —
  which is the path from a free-text exclusion to a switched-off rule.
- **Origin:** measured during [spike 0386](../spikes/0386-strings-that-name-code.md)'s research
  for the exclusions ruling.
- **Reported:** 2026-10-05

## Symptom

`docs/recipes.md:202` teaches `.excluding('index.ts', 'main.ts', 'config.ts', /\.d\.ts$/)`, and
the JSDoc example on `noDeadModules` (`packages/ts/src/rules/hygiene.ts:21`) teaches
`.excluding('index.ts', 'main.ts')`. A string exclusion matches by **equality** against a
violation's `element`, `file` or `message`. Measured on a module rule over `/proj/src/index.ts`
and `/proj/src/other.ts`: `file` is the absolute path and `element` is the generic
`'SourceFile'`, so `.excluding('index.ts')` matches neither, and both violations remain.

## Fix

Depends on the exclusions ruling spike 0386 prepares: a file exclusion should be a path resolved
against the project, refused when it names no file. Until then, the docs should not teach a form
that cannot work — the anchored regex `/\/index\.ts$/`, or scoping in `.that()`, which
`docs/recipes.md:150` already recommends.

## Verification

- [ ] a red test: the documented `.excluding('index.ts', 'main.ts')` over a module rule excludes
      nothing today
- [ ] the docs and the JSDoc teach a form that works, or the ruling's structured form
- [ ] `npm run validate` green.

Deferred: none.
