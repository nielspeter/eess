# Bug 0638: eess-ts's `generateBaseline` drops a configuration finding without a word

## Status

- **State:** Draft — measured 2026-11-07 by the enforcement review of [bug 0595](./fixed/0595-generate-baseline-drops-a-configuration-finding-without-a-word.md)'s fix; no red test yet.
- **Severity:** High — a false green: the same defect as [bug 0595](./fixed/0595-generate-baseline-drops-a-configuration-finding-without-a-word.md), on eess-ts's own copy, which is
  the route the docs teach.
- **Origin:** self-found · the build review of [bug 0577](./fixed/0577-a-preset-under-report-warn-exits-0-on-a-configuration-finding.md), [bug 0586](./fixed/0586-the-kernels-collect-violations-swallows-a-configuration-error.md) and [bug 0595](./fixed/0595-generate-baseline-drops-a-configuration-finding-without-a-word.md), 2026-11-07.
- **Reported:** 2026-11-07

## Symptom

eess-ts's `generateBaseline` (`packages/ts/src/helpers/baseline.ts:417`, on the root at
`packages/ts/src/index.ts:301`) filters out every finding that carries `bypassFilters` and returns a
`BaselineDelta` with no count of what it left out. Measured: one such finding in,
`{"after":0,"added":0,"removed":0,"priorUnreadable":false}` out, nothing printed, exit 0.

`eess-ts baseline` is not affected: the command prints what it refused and exits 1
(`packages/ts/src/cli/commands/baseline.ts`). A library caller is: `docs/core-concepts.md:330-336`
teaches `collectViolations` + `generateBaseline` as the programmatic route, and
`docs/api-reference.md:467` lists it. The kernel's copy now prints each refused finding and throws
([bug 0595](./fixed/0595-generate-baseline-drops-a-configuration-finding-without-a-word.md)), so the family's two `generateBaseline`s disagree.

## Fix

Not designed. The kernel's fix is the precedent: write what can be accepted, print each refused
finding, throw. The CLI calls this function and prints the refused findings itself, so the fix must
keep the command from printing them twice, or move the printing here. [Plan 0188](../plans/0188-unify-the-duplicated-engine-modules.md) (one engine copy)
may make this moot by removing the copy.

## Verification

- [ ] Red test first: eess-ts's `generateBaseline` over a `bypassFilters` finding throws, naming it.
- [ ] `eess-ts baseline` prints each refused finding once.
