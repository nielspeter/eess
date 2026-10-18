# Bug 0403: the vacuity matrix probes one dialect of five

## Status

- **State:** Fixed — 2026-10-18, in the batch-2 pull request.
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
(`adr/010-a-pass-is-constructed-from-evidence.md:295`) names `scripts/vacuity-matrix.mjs` and is
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

## Resolution

The matrix probes the sibling dialects too (`scripts/vacuity-matrix.mjs`, "Sibling dialects"):

- every check-constructor of eess-md, eess-mermaid, eess-gherkin and eess-crossvalidate, called
  bare over that dialect's own empty input (an empty corpus, an empty diagram, an empty feature
  set), each subpath of the exports map included;
- every other exported function is either a kernel re-export, recognised by identity, or listed
  in `SIBLING_NOT_CONSTRUCTORS` with a reason. An export that is neither is a finding, so a new
  constructor cannot be added unprobed. This is the mechanical enumeration the Fix asked for.
- ADR-010's row now says what the matrix checks.

Its first run found two real fail-opens, `diagramMatchesCode()` and `adrCitationsResolve()`, from one
cause. They are recorded as [bug 0477](../0477-a-correspondence-of-two-empty-sides-passes-so-two-crossvalidate-presets-pass-on-nothing.md),
with dated `KNOWN_FAIL_OPEN` entries. `codeBlocks()` is listed rather than probed: it needs a parser
to construct, and its zero-blocks case is `check:nonvacuity`'s `corpus/code-block-parse/zero-blocks`.

## Verification

- [x] done-otherwise: the red proof is a non-vacuity row, not a unit test. `vacuity-matrix/sibling-fail-open` replaces eess-md's `docs` probe with one that passes silently, and the matrix fails naming it.
- [x] The matrix's own non-vacuity proof covers a sibling row, and an unaccounted export (`vacuity-matrix/unaccounted-export`).
- [x] `npm run validate` green.
- [ ] deferred→bug 0477 — the two crossvalidate presets that pass over two empty inputs

Deferred: bug 0477
