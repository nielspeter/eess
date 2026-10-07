# Bug 0403: the vacuity matrix probes one dialect of five

## Status

- **State:** Draft — measured 2026-10-07 by reading `scripts/vacuity-matrix.mjs` at `7596e30`. No
  red test yet.
- **Severity:** Medium — **an enforcement row claims more than its mechanism checks.** ADR-010's
  row "Every published check-constructor fails over a zero-file project (the vacuity matrix)" is
  `gated`, and the matrix enumerates only `@nielspeter/eess-ts`. A sibling dialect's constructor
  that started passing over an empty input would keep that row green. Not a false green measured
  in shipped code today: the eess-md constructors seen in this session refuse zero examined units
  (bug 0396's reproduction printed "this rule examined zero units").
- **Origin:** self-found 2026-10-07, checking how proposal 013's new eess-md condition would be
  proven non-vacuous.
- **Reported:** 2026-10-07

## Symptom

ADR-010 binds "every current eess rule family (`eess-ts`'s builders, `eess-md`'s corpus rules,
`eess-mermaid`'s diagram rules, `eess-gherkin`'s feature rules) and every future one"
(`adr/010-a-pass-is-constructed-from-evidence.md`, Decision). Its Enforcement row for that clause
(`adr/010-a-pass-is-constructed-from-evidence.md:293`) names `scripts/vacuity-matrix.mjs` and is
`gated`.

The matrix imports `@nielspeter/eess-ts`, its `presets` and `graphql` subpaths, and the kernel
(`scripts/vacuity-matrix.mjs:50-54`), and its own header says it enumerates "every
check-constructor from @nielspeter/eess-ts's own published exports map"
(`scripts/vacuity-matrix.mjs:10`). It never imports:

- `@nielspeter/eess-md`: `docs`, `links`, `pointers`, `rows`, `taskItems`, `vocabulary`/`terms`
  (`packages/md/src/index.ts:73-86`);
- `@nielspeter/eess-mermaid`: `diagram` (`packages/mermaid/src/index.ts:37`) and its builders;
- `@nielspeter/eess-gherkin`: `scenarios` (`packages/gherkin/src/index.ts:14`);
- `@nielspeter/eess-crossvalidate`'s subpaths (`./mermaid-ts`, `./md-ts`, and the rest of its
  exports map).

## Reproduction

`grep -n "@nielspeter/" scripts/vacuity-matrix.mjs` lists only `eess-ts` and the kernel.

## Root cause

The matrix was ported from ts-archunit, which had one dialect (plan 0088 Phase 4a). The family
grew four siblings; the enumeration did not follow, and the ADR row's wording ("every published
check-constructor") was not narrowed to match.

`check:nonvacuity` covers some sibling rules through fixtures (for example `corpus/links/*`), but
that is a different guarantee: it proves particular rules fire on bad input, not that every
published constructor refuses an empty one.

## Fix

Not designed. Either the matrix enumerates every family package's exports map, each probed over
its own empty input (an empty corpus, an empty diagram, an empty feature set), or ADR-010's row is
narrowed to what it checks and a row is added for each sibling.

## Verification

- [ ] Red test written first: a sibling-dialect constructor made to pass over empty input turns
      `check:vacuity` red
- [ ] the matrix's own non-vacuity proof covers a sibling row
- [ ] `npm run validate` green.

Deferred: none.
