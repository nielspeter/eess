# Bug 0155: A rule with subjects and no condition passes in total silence

## Status

- **State:** Draft — reproduced directly against the built dist; no red test yet.
- **Severity:** High — false green. Subjects are selected, nothing is asserted
  about them, and `.check()` returns normally. This is the defect the product
  exists to prevent, in the library's own engine.
- **Origin:** self-found · fold audit of ts-archunit's fixed-bug corpus
  (upstream bug 0019), prompted by [bug 0154](./0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md)
- **Shipped in:** the published `@nielspeter/eess` (`0.2.2`) / `eess-ts`
  (`0.2.1`). The guard is at `rule-builder.ts:337` in `810808b` (the `v0.2.3`
  release commit), so this is live for adopters today — not gated behind plan 0100.
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

Three shapes measured, because they differ and the title's claim ("total
silence") belongs to the last two, not the first:

| shape                                                | violations | stderr        |
| ---------------------------------------------------- | ---------- | ------------- |
| `.that().<pred>.check()`                             | 0          | warning fires |
| `.that().<pred>.should().violations()`               | 0          | **nothing**   |
| `.that().<pred>.should().areExported().violations()` | 0          | **nothing**   |

Row 3 is the sharpest red test available: the guard's own message asks _"Did
you use a predicate-only method after `.should()`?"_ — and provably cannot fire
for exactly that case.

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

## A kernel contract test is green because of this defect

Found in PR #70's review, and it constrains the fix.

`packages/core/tests/contract/extension-surface.test.ts:207` —
`it('named-selection reuse across two branches does not leak conditions (bug
0016, RuleBuilder side)')` — ends with a branch that calls `.should()` and
adds no condition, asserting `not.toThrow()`. Its comment claims that branch
_"hits the 'predicates but no conditions' assertion-less path and passes."_

**It does not.** Measured: that shape emits **zero** stderr lines. `should()`
sets `_phase = 'condition'`, so the guard at `rule-builder.ts:333` cannot
fire — which is precisely this bug. The test passes in total silence, and its
stated mechanism is fiction.

Two consequences:

- **Fixing part 1 below changes what that test asserts** (the branch starts
  warning); **fixing part 2 breaks it** (the branch starts throwing). The test
  and its comment must be rewritten as part of this fix, not after.
- **Plan 0150 cites this test title** as its evidence that plan 0088's
  review-finding 4 is closed
  (`work/plans/0150-close-0088s-disclosed-review-findings.md`). That evidence
  is weaker than the citation implies: the test does exercise the copy-on-write
  contract, but its final assertion currently proves nothing.

See [bug 0156](./0156-should-twice-silently-drops-the-first-assertion.md).
An intermediate draft claimed the two fixes were _entangled_ — that 0156 could
not be fixed without first settling `fork()` semantics. **That is not so:**
0156's fix is measured, one line, and leaves this contract test passing 9/9.
What the two genuinely share is only this test's **comment**, which
misdescribes why its final branch passes. Correcting that comment belongs to
whichever of the two is picked up first; neither blocks the other.

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

- [ ] Red test first, on the **`.should()` shape** — not the predicate-only
      one. `functions(p).that().<pred>.should().check()` and
      `…​.should().areExported().check()` must throw (or emit a finding).
      **Why the shape matters:** changing `writeStderr` → `throw` at
      `rule-builder.ts:335` while leaving the `_phase === 'predicate'` term
      intact satisfies a predicate-only test, satisfies the control, satisfies
      the vacuity control — and leaves every documented rule shape silent. A
      checklist that tests only `.that().<pred>.check()` is a false floor.
- [ ] Control: a rule _with_ a condition is unaffected.
- [ ] Vacuity control: the fixture really selects a non-zero number of
      subjects, asserted by identity.
- [ ] The warning-vs-finding decision is recorded in this file.
- [ ] `npm run validate` green.

Deferred: none.
