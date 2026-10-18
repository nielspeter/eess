# Bug 0472: a gherkin root that matches no file is dropped silently

## Status

- **State:** Draft — recorded 2026-10-18 from PR #236's review (architect). Read from the source; no red test yet.
- **Severity:** Medium — a silent pass: one mistyped root of several removes its feature files from every rule.
- **Origin:** self-found · PR #236's review, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

eess-gherkin's loader (`packages/gherkin/src/load.ts:121-130`) matches all roots at once with
`picomatch([...options.roots])` over one walk, as eess-md's `corpus()` did before bug 0465. A mistyped
root beside a live one contributes nothing, and nothing says so.

## Fix

Move the check into the kernel, beside `walkFiles` in `@nielspeter/eess/internal`
(`packages/core/src/internal.ts`): "which of these root globs matches no walked, non-ignored file".
Then have eess-md's `corpus()` (bug 0465) and eess-gherkin's loader call it, with the refusal message
and the "only when another root loads" rule moving with it. Plan 0455's text corpus would be the third
caller. The helper should also treat a negated root (`'!drafts/**'`), which never matches a file, as
not a dead root (PR #236's review).

## Verification

- [ ] Red first: a two-root gherkin load with one mistyped root loads with no finding
- [ ] Green: it is refused, naming the root, through the shared kernel helper

Deferred: none
