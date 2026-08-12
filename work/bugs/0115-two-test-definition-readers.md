# Bug 0115: `md-ts` and `gherkin-ts` carry the same four-step test-definition reader, differing on two axes

## Status

- **State:** Draft — the duplication is enumerated against both files; no red
  test, because the remedy is a refactor rather than a behaviour change.
- **Severity:** Low — no defect today. It is the shape that produced
  [0104](./fixed/0104-it-title-capture-stops-at-any-quote.md) and
  [0105](./fixed/0105-md-ts-drops-modifier-forms.md), both of which were one
  copy of a duplicated reader getting something wrong.
- **Origin:** self-found · architect review of 0105's fix
- **Reported:** 2026-08-12

## Symptom

`extractTestDefs` (`packages/crossvalidate/src/md-ts.ts`) and `itTitles`
(`packages/crossvalidate/src/gherkin-ts.ts`) are the same procedure:

1. `calls(project).select({ label: 'call', identify })` — identical
2. root-callee guard — identical shape, different callee set
3. `getName({ withArgument: 0 }) ?? ''`
4. title function — `itTitleOf` vs `itOrTestTitleOf`

They differ on exactly two axes: **the callee set**, and whether **`line`** is
carried on the returned record.

## Root cause

The two presets were written months apart against the same model, and 0104
centralised the _grammar_ they share without centralising the _reader_ around it.
Note the framing that matters: the repeated thing is not the two-line callee
guard — focusing there produces the wrong refactor. It is all four steps.

## Why it matters

Twice now, a defect has been filed against one copy and found in the other during
review rather than by a gate: 0104 (title truncation, in both) and 0105 (modifier
forms, in `md-ts` only because `gherkin-ts` had already fixed it). The next one
will follow the same route.

## Fix

One `testDefs(project, { callees })` inside the bridge package, returning
`{ title, file, line, root, modifier }`. Roughly 15 lines; both presets select
from it.

**Where it must not go.** Not behind eess-ts's engine boundary, and not in the
kernel. "Which callees define a test" is **vitest/jest framework vocabulary** —
`ArchCall.isTestCall()` would smuggle a test runner's vocabulary into a language
dialect that has no business knowing what a test runner is (ADR-006). That is the
distinction from [0114](./0114-string-literal-lexis-lives-outside-the-engine.md),
which moves _lexis_ — how TypeScript delimits a string — and genuinely does belong
to the engine. Two follow-ups, two homes; only 0114 touches the boundary. Until an
`eess-vitest` exists, beside the grammar in `it-title.ts` (or a sibling
`test-calls.ts`) is the least-wrong home.

Carrying `modifier` on the record is what [0116](./0116-gated-row-resolves-against-a-skipped-test.md)
needs, so sequence this first.

## Verification

- [ ] Both presets read from one function; the callee set is its only per-caller
      argument.
- [ ] The existing suites pass unchanged — this is a refactor, not a behaviour
      change, and any diff in what resolves is a bug in the refactor.
- [ ] `npm run validate` green.

Deferred: none.
