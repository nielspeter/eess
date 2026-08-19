# Bug 0156: `should()` twice silently drops the first assertion

## Status

- **State:** Draft — reproduced directly against the built dist; no red test yet.
- **Severity:** High — false green. Two assertions are written, one is
  enforced, real findings are discarded, and the build passes with no output.
- **Origin:** self-found · fold audit of ts-archunit's fixed-bug corpus
  (upstream bug 0020), prompted by [bug 0154](./0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md)
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

> **Do not simply delete the line.** An earlier draft of this record
> prescribed _"remove `fork._conditions = []` from `fork()`"_. That is wrong,
> and PR #70's review caught it. **`should()` calls `fork()`**
> (`packages/core/src/rule-builder.ts:110-114`), so that clearing **is** the
> bug-0016 no-leak mechanism, pinned by name at
> `packages/core/tests/contract/extension-surface.test.ts:207` —
> `it('named-selection reuse across two branches does not leak conditions
(bug 0016, RuleBuilder side)')`. Deleting the line makes a fresh `.should()`
> off a held selection inherit the previous branch's condition, and that
> contract test goes red.

The two spellings travel the **same code path**:

- `sel.should().notExist().should().beExported()` — one chain, both
  assertions intended to hold (this bug); and
- `sel.should()…` then `sel.should()…` — two independent branches off one held
  selection, which must **not** share conditions (bug 0016).

`fork()` cannot tell them apart today, so no change to `fork()` alone can be
right. The fix must first **distinguish the two**, and that is a kernel design
decision, not a one-line edit. Sketches, none ruled:

1. Clear on a fork taken from a **held** selection, accumulate on a fork taken
   from a builder already in the condition phase (`_phase === 'condition'`
   distinguishes them — a second `.should()` on a chain is the only way to
   reach `fork()` already in that phase).
2. Make the second `.should()` on one chain an **error** rather than an
   accumulation, converging on `andShould()` as the sole spelling for "and
   also". This is the smaller change and arguably the clearer API; it makes
   the bug loud instead of correct.
3. Separate the copy from the clear so `should()` and a held-selection fork
   call different things.

**Whichever is chosen, `extension-surface.test.ts:207-220` and its comment must
be rewritten as part of this fix** — see the note in
[bug 0155](./0155-a-rule-with-no-condition-passes-in-total-silence.md), because
that test's stated mechanism is also wrong today.

Expect fallout either way: a rule that silently enforced only its last
assertion starts enforcing all of them, which may surface real violations
previously hidden. That is the fix working, but it should be expected rather
than discovered in CI.

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
- [ ] Control: `andShould()` behaviour is unchanged.
- [ ] Vacuity control: case A really reports 4, so the comparison is real.
- [ ] Re-run `npm run validate` and account for any newly-surfaced violations
      in this repo's own rules as expected consequences, not regressions.
- [ ] `npm run validate` green.

Deferred: none.
