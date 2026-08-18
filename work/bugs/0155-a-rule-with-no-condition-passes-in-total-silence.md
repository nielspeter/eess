# Bug 0155: A rule with subjects and no condition passes in total silence

## Status

- **State:** Draft — reproduced directly against the built dist; no red test yet.
- **Severity:** High — false green. Subjects are selected, nothing is asserted
  about them, and `.check()` returns normally. This is the defect the product
  exists to prevent, in the library's own engine.
- **Origin:** self-found · fold audit of ts-archunit's fixed-bug corpus
  (upstream bug 0019), prompted by [bug 0154](./0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md)
- **Reported:** 2026-08-19

## Symptom

A rule that selects subjects but chains no condition passes silently. The
guard that is supposed to catch it is unreachable for every rule written with
`.should()` — which is every rule the DSL documents.

## Reproduction

Verified against `packages/ts/dist` over `packages/ts/tests/fixtures/poc`:

```js
functions(p)
  .that()
  .haveNameMatching(/^parse/)
  .check()
// → does NOT throw. Exit 0.
// stderr only: "[eess] Rule '…' has predicates but no conditions."
```

Four subjects are selected. Nothing is asserted. The build is green.

## Root cause

`packages/core/src/rule-builder.ts:333`:

```ts
if (this._conditions.length === 0 && this._phase === 'predicate') {
```

`should()` (`rule-builder.ts:110-114`) sets `fork._phase = 'condition'`, so the
`_phase === 'predicate'` term is false for any rule spelled with `.should()`.
The guard can only fire for the predicate-only shape. And even when it fires it
is a `writeStderr` warning (`:335`), never a finding.

**This predates plan 0088's fold** — `git show 810808b:packages/core/src/rule-builder.ts`
carries the identical line at `:337`. eess forked from ts-archunit at ~0.17 and
froze; upstream fixed this afterward and the fix was not carried across.

Upstream's fix was two-part: an instrument (`assertsSomething` /
`collectWithAssertionGuard`) and a gate that turns the warning into an
unsuppressable finding. `grep -rn "assertsSomething\|collectWithAssertionGuard"
packages/` returns **zero hits** in eess.

Note the deliberate decision recorded at `rule-builder.ts:330-332` — that an
assertion-less rule "stays a stderr warning, not the unsuppressable ADR-010
finding." That decision is defensible; what is not is that the warning it
routes to cannot fire for the documented rule shape.

## Fix

Two independent parts, in order:

1. **Make the existing guard reachable** — drop the `_phase === 'predicate'`
   term, or test the condition list alone. This alone converts total silence
   into a warning for the `.should()` shape.
2. **Decide whether it should be a finding rather than a warning.** ADR-009
   rule 1 ("a warning is something you hope is read") argues for a finding;
   the comment at `:330-332` argues for a warning on the grounds that
   `examined` is non-zero. That tension is a real design call and should be
   recorded here, not settled silently in code.

## Verification

- [ ] Red test first: `functions(p).that().<pred>.check()` with no condition
      throws (or emits a finding), and the test fails on today's code.
- [ ] Control: a rule _with_ a condition is unaffected.
- [ ] Vacuity control: the fixture really selects a non-zero number of
      subjects, asserted by identity.
- [ ] The warning-vs-finding decision is recorded in this file.
- [ ] `npm run validate` green.

Deferred: none.
