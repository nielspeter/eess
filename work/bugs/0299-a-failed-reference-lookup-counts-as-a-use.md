# Bug 0299: a reference lookup that throws counts as a use

## Status

- **State:** Draft — confirmed in the source. **The stated trigger does not
  reproduce**; the evidence for that is a committed green test, not a probe.
- **Severity:** Medium — an **honesty gap between a stated claim and its
  mechanism.** The fallback is fail-open by construction, and the comment that
  justifies it names a trigger no measured shape produces. Either the branch is
  unreachable and its comment is wrong, or it is reachable by a shape nobody has
  found and every export behind it reads as used.
- **Origin:** self-found · probing `eess-ts` against the findings of an external
  code-quality audit of an adopter monorepo. Noted in passing, not filed, in
  [proposal 010](../proposals/010-ts-performance-at-scale.md)'s review — "the
  existing `try/catch` … already fails open" (`work/proposals/010-ts-performance-at-scale.md:238`),
  and its held ask C names this exact change (`:272`).
- **Reported:** 2026-09-14

## Symptom

`haveNoUnusedExports()` asks, per named export, whether another file references it
(`packages/ts/src/conditions/reverse-dependency.ts:299`). When that question
throws, the answer is "yes":

```ts
} catch (err) {
  void err // deliberate: fall through to the safe answer below
  // Some nodes (e.g., shorthand property assignments in re-exports) may fail
  // Treat as "referenced" to avoid false positives
  return true
}
```

`packages/ts/src/conditions/reverse-dependency.ts:346-351`, inside
`hasExternalReference` (`:335`).

## Reproduction — attempted, not achieved

`packages/ts/tests/conditions/reference-lookup-shapes.test.ts` calls
`findReferencesAsNodes` directly — no mocking — on the first declaration of every
export, and on every shorthand property assignment, across eighteen TypeScript
files and two CommonJS files under `allowJs`. The CommonJS files
(`module.exports = { a, b }`, and a `require` destructure re-exported the same way)
are what actually produce `ShorthandPropertyAssignment` nodes, which the comment's
named trigger needs and the first probe for this record did not build. **None
threw**, on TypeScript 5.9 and ts-morph 27.

Not measured: references that land in files outside the project, such as a library
or a `node_modules` file — ts-morph adds a source file for each referencing file,
and an in-memory project never references one.

## Root cause

A fallback chose the answer that cannot produce a finding. That is
[ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md)'s Context: _"a
verifier whose instrument failure is indistinguishable from architectural
cleanliness."_ The file still counts as examined, so the evidence seam cannot see
it. And the dogfood `no-silent-catch` rule passed this `catch` because it carries a
stated reason — the rule checks that a reason exists, not that it is true.

## Fix

Not decided. Ranked:

1. **A finding per export that could not be resolved, excludable by identity**
   (file plus export name), whose message names a remedy the author can apply:
   exclude that export by name, or narrow the selector — and report the shape
   upstream. It fails closed on the one unit, not on the rule.
2. **An unsuppressable configuration finding** — the ADR-010 shape for an instrument
   failure, but its only remedy is one the author cannot perform: they cannot stop
   TypeScript's language service throwing. ADR-009 rule 2 calls that worse than no
   message, and the reachable escape is `overrides: { … : 'off' }`, which deletes the
   rule for every export. The ruling must weigh option 1 against this tension, not
   default to it.
3. **Delete the `try/catch`** — fail-closed, but as a crash that names no rule, file
   or export and stops every later rule in the file.

The seam that makes the fix testable without mocking ts-morph: put the lookup behind
a function eess owns, so a test can pass one that throws.

**Not recorded, on purpose:** `export { gone } from './does-not-exist'` has no
declaration and is skipped at `packages/ts/src/conditions/reverse-dependency.ts:298`
before any lookup. `tsc` reports the missing module itself, so the gap cannot
survive a typecheck.

## Related

- [0243](./0243-a-barrel-re-export-counts-as-a-use.md) and
  [0265](./fixed/0265-a-barrel-reports-a-re-export-at-another-files-line.md) — the
  same condition.

## Verification

- [x] the reproduction attempt is committed and green —
      `packages/ts/tests/conditions/reference-lookup-shapes.test.ts` ·
      `it('no probed export shape makes findReferencesAsNodes throw')`. It turns red
      the day a shape does throw, which is the trigger this record could not find.
- [ ] a ruling on the finding's shape, against the ranking above
- [ ] the lookup behind a seam eess owns, and a red test that passes a throwing lookup
- [ ] the comment's unreproduced trigger removed
- [ ] `npm run validate` green.

Deferred: none.
