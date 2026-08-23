# Bug 0156: `should()` twice silently drops the first assertion

## Status

- **State:** Draft — reproduced against the built dist, and the fix
  **measured** in an isolated worktree against a green baseline (see Fix). No
  red test committed yet.
- **Severity:** High — false green. Two assertions are written, one is
  enforced, real findings are discarded, and the build passes with no output.
- **Origin:** self-found · fold audit of ts-archunit's fixed-bug corpus
  (upstream bug 0020), prompted by [bug 0154](./fixed/0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md)
- **Shipped in:** the published `@nielspeter/eess` (`0.2.2`) / `eess-ts`
  (`0.2.1`). `fork._conditions = []` is at `rule-builder.ts:294` in `810808b`
  (the `v0.2.3` release commit), so this is live for adopters today.
- **Reported:** 2026-08-19

## Symptom

Calling `.should()` a second time in a chain silently **substitutes** for every
condition accumulated before it — the last assertion wins and the earlier ones
are discarded. The rule still runs, still reports, still passes or
fails — it just enforces less than it says.

## Reproduction

Verified against `packages/ts/dist` over `packages/ts/tests/fixtures/poc`.
Discriminated by violation **message**, not by count, so a "different four
findings" outcome could not masquerade as correct:

```
A. should().notExist()                          → 4 violations
B. should().beExported()                        → 0 violations
C. should().notExist().should().beExported()    → 0 violations   ← both written
D. should().notExist().andShould().beExported() → 4 violations
```

And what a consumer's CI actually runs:

```
C .check()  →  does NOT throw. Exit 0.
```

Four real findings written by the author, silently gone.

The same drop applies to a condition passed to `satisfy()` before `.should()`:
`satisfy(cond)` alone reports 4; `satisfy(cond).should().beExported()` reports 0.

## Root cause

`packages/core/src/rule-builder.ts:276-281`:

```ts
protected fork(): this {
  const fork = this.copy()
  fork._conditions = []          // ← discards everything asserted so far
  fork._reason = fork._metadata?.because ?? this._reason
  return fork
}
```

Upstream's fix was to delete that one line so conditions accumulate.

**This predates plan 0088's fold** — `git show 810808b:packages/core/src/rule-builder.ts`
carries the identical line at `:294`. eess forked from ts-archunit at ~0.17 and
froze; upstream fixed this afterward and the fix was not carried across.

Worth noting what eess _does_ have: bug-0016 copy-on-write works, so the held
builder is no longer mutated (`held.violations()` still reports 4 after
deriving). eess has the copy and still has the clear — precisely the state
upstream was in between its bugs 0016 and 0020.

## Fix

**Delete `fork._conditions = []` from `fork()`** (`packages/core/src/rule-builder.ts:278`).
Measured, in an isolated worktree against a green baseline:

| check                                                  | before    | after                                                              |
| ------------------------------------------------------ | --------- | ------------------------------------------------------------------ |
| `should().notExist().should().beAsync()`               | 4         | **8** ✓                                                            |
| `should().notExist().that().<pred>.should().beAsync()` | 4         | **8** ✓                                                            |
| `should().notExist().andShould().beAsync()` (control)  | 8         | 8                                                                  |
| bug-0016 contract test                                 | 9/9       | **9/9** ✓                                                          |
| kernel suite                                           | 145/145   | **145/145** ✓                                                      |
| eess-ts suite                                          | 2215/2216 | **2215/2216** (same pre-existing environmental failure both sides) |

**Why the clear was never load-bearing.** It looks like bug 0016's no-leak
mechanism — `should()` calls `fork()`, and the contract test at
`packages/core/tests/contract/extension-surface.test.ts:207` reuses a held
selection across two branches. But that selection is `.that().named('a')`:
its `_conditions` is **already empty**, so the clear is a no-op there.
Isolation is delivered by `copy()` (`rule-builder.ts:265`), which rebuilds
`_predicates` and `_conditions` as fresh arrays on every derivation.

So the clear is a no-op in the one case that needs isolation, and destructive
in every case that doesn't. It only ever discarded assertions an author wrote.

> **Correction, recorded rather than quietly fixed.** An intermediate draft of
> this record — written after PR #70's architect review raised it as a
> Critical — said _"do not simply delete the line"_, claimed the deletion
> would turn the 0016 contract test red, and offered three design sketches
> under the heading "a kernel design decision, not a one-line edit."
> **That was wrong.** The reasoning about the mechanism was correct
> (`should()` → `fork()` → clear; the contract test does rely on branch
> isolation) and the conclusion did not follow, because nobody checked whether
> the held selection has any conditions to clear. It does not. The claim was
> accepted and propagated into this record without being run. Measured above.

**A second defect this closes, not in the original report.** `that()` resets
`_phase` to `'predicate'` (`rule-builder.ts:93`), so
`.should().notExist().that().<pred>.should().beAsync()` also silently dropped
`notExist()` — row 2 above. Any fix keyed on `_phase` would have fixed the
reported shape and left this one open. The deletion closes both, because it
removes the discard rather than trying to decide when the discard is correct.

**Consequences worth stating.** `should()` and `andShould()` become
behaviourally identical — both accumulate — leaving `andShould()` a pure
readability alias. That is acceptable (it already is one: its body is
`return this`), but if one spelling per meaning is preferred, making a second
`.should()` an _error_ is the alternative, and it is a separate decision from
this fix.

And expect fallout: a rule that silently enforced only its last assertion
starts enforcing all of them, which may surface real violations previously
hidden. That is the fix working, but it should be expected rather than
discovered in CI.

`extension-surface.test.ts:207-220`'s **comment** still needs correcting — see
[bug 0155](./fixed/0155-a-rule-with-no-condition-passes-in-total-silence.md); its
stated mechanism is wrong independently of this fix. The test itself passes
either way.

## Verification

- [ ] Red test first, using a condition pair where **both sides fire** — the
      table above uses `beExported()`, which reports 0, so "A+B combined" is
      just A and three different fixes satisfy it (accumulate; keep-first-
      drop-second; second `.should()` a no-op). Measured discriminating pair on
      the same fixture:

      ```
      A should().notExist()                        → 4
      B should().beAsync()                         → 4
      C should().notExist().should().beAsync()     → 4   ← today: keeps the LAST
      D should().notExist().andShould().beAsync()  → 8
      ```

      Under a correct fix **C = 8**; every wrong variant gives 4. Assert by
      **message identity**, not count.

- [ ] Red test: `satisfy(cond).should().beExported()` retains `cond`.
- [ ] Red test: the `that()`-reset path
      `.should().notExist().that().<pred>.should().beAsync()` also reports 8.
      Keyed-on-`_phase` fixes pass the first red test and fail this one.
- [ ] Control: the bug-0016 contract test
      (`packages/core/tests/contract/extension-surface.test.ts:207`) still
      passes — measured 9/9 with the fix applied, so this is a regression
      guard, not an open question.
- [ ] Control: `andShould()` behaviour is unchanged.
- [ ] Vacuity control: case A really reports 4, so the comparison is real.
- [ ] Re-run `npm run validate` and account for any newly-surfaced violations
      in this repo's own rules as expected consequences, not regressions.
- [ ] `npm run validate` green.

Deferred: none.
