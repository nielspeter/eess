# Bug 0387: a basename exclusion waives every file with that name

## Status

- **State:** Draft — measured; no red test yet. _Filed 2026-10-05 as "a basename exclusion
  never matches" from a probe on the wrong condition (`notExist()`, whose `element` is
  `'SourceFile'`); adversarial review of spike 0386 measured the opposite on the condition the
  docs actually pair it with, and this record was rewritten the same day._
- **Severity:** High — **a waiver that reaches further than written.** `.excluding('index.ts')`
  meant for one entry point also waives every other `index.ts` in the project, now and in
  future, and nothing says so. Each extra file it reaches is a false green.
- **Origin:** spike 0386's research, corrected by its adversarial review.
- **Reported:** 2026-10-05

## Symptom

`docs/recipes.md:202` teaches `.excluding('index.ts', 'main.ts', 'config.ts', /\.d\.ts$/)`, and
the JSDoc example on `noDeadModules` (`packages/ts/src/rules/hygiene.ts:21`) teaches
`.excluding('index.ts', 'main.ts')`. `noDeadModules` reports a module's **basename** as its
`element` (`packages/ts/src/conditions/reverse-dependency.ts`), and a string exclusion matches
by equality against `element`, `file` or `message`.

Measured, four unimported files — `src/index.ts`, `src/main.ts`, `src/feature/index.ts`,
`src/orphan.ts` — under `modules(p).that().resideInFolder('**/src/**').should().satisfy(noDeadModules())`:
four violations; after `.excluding('index.ts', 'main.ts')`, only `src/orphan.ts` remains.
`src/feature/index.ts`, which nobody named, was waived too.

## Fix

Depends on the exclusions ruling spike 0386 prepares. A file waiver should identify a file —
a path resolved against the project — or a violation, not a name many files share. Until
then, the docs should teach the anchored form (`/\/src\/index\.ts$/`) or scoping in `.that()`.

## Verification

- [ ] a red test: the documented `.excluding('index.ts')` waives an unnamed `feature/index.ts`
- [ ] the docs and the JSDoc teach a form that waives only what it names
- [ ] `npm run validate` green.

Deferred: none.
