# Bug 0595: `generateBaseline` drops a configuration finding without a word

## Status

- **State:** Draft — measured 2026-11-01 on `main` at bd78b962; no red test yet.
- **Severity:** High — a false green: a run whose rule's instrument is broken writes an empty
  baseline and reports success, and the next `check --baseline` has nothing to say it was broken.
- **Origin:** self-found · [proposal 011](../proposals/promoted/011-core-name-the-evidence-gate.md)'s
  review, 2026-11-01, which found this is the real silent drop behind its ask C.
- **Reported:** 2026-11-01
- **Implements:** [proposal 011](../proposals/promoted/011-core-name-the-evidence-gate.md)

## Symptom

`generateBaseline` (`packages/core/src/baseline.ts:198`) leaves out every finding that carries
`bypassFilters` (`:208`). The comment says why: a configuration finding "can never legitimately
become known, pre-existing debt". Leaving it out of the file is right. Saying nothing is not: the
run writes a baseline as if the rules had passed.

## Reproduction

`generateBaseline` over one `emitter/pass-without-evidence` finding with `bypassFilters: true`,
against `packages/core/dist`, 0.04 s:

```text
{ threw: false, stderrWrites: 0, entries: 0, count: 0 }
```

## Root cause

The filter that keeps configuration findings out of the baseline has no other branch: what it
removes is neither reported nor refused.

## Fix

`generateBaseline` refuses, throwing, when the violations it is given hold a `bypassFilters`
finding, naming each one, so a broken instrument stops the baseline from being written. Built with
[bug 0586](./0586-the-kernels-collect-violations-swallows-a-configuration-error.md), the other
half of the same path: `collectViolations` swallows the configuration error before
`generateBaseline` sees it.

## Verification

- [ ] Red test written first: the reproduction throws, naming the finding, and writes no file.
- [ ] A baseline over ordinary findings is written as today.
- [ ] A changeset naming `@nielspeter/eess`, marked breaking if a caller can observe the refusal.
- [ ] `npm run validate` green.

Deferred: none
