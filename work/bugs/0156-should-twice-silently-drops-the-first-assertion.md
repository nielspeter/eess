# Bug 0156: `should()` twice silently drops the first assertion

## Status

- **State:** Draft — reproduced directly against the built dist; no red test yet.
- **Severity:** High — false green. Two assertions are written, one is
  enforced, real findings are discarded, and the build passes with no output.
- **Origin:** self-found · fold audit of ts-archunit's fixed-bug corpus
  (upstream bug 0020), prompted by [bug 0154](./0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md)
- **Reported:** 2026-08-19

## Symptom

Calling `.should()` a second time in a chain silently discards every condition
accumulated before it. The rule still runs, still reports, still passes or
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

Remove `fork._conditions = []` from `fork()` so a second `.should()`
accumulates rather than replaces.

`andShould()` already behaves correctly (row D), so the two spellings converge
rather than one changing meaning. Check whether any existing rule in this repo
or the presets relies on the current clearing behaviour before landing — a
rule that silently enforced only its last assertion will start enforcing all
of them, which may surface real violations that were previously hidden. That
is the fix working, but it should be expected rather than discovered in CI.

## Verification

- [ ] Red test first: case C above reports the same violations as case A+B
      combined, asserted by **message identity**, not count. Fails today.
- [ ] Red test: `satisfy(cond).should().beExported()` retains `cond`.
- [ ] Control: `andShould()` behaviour is unchanged.
- [ ] Vacuity control: case A really reports 4, so the comparison is real.
- [ ] Re-run `npm run validate` and account for any newly-surfaced violations
      in this repo's own rules as expected consequences, not regressions.
- [ ] `npm run validate` green.

Deferred: none.
