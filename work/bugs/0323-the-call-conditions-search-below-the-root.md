# Bug 0323: the call conditions search below the root

## Status

- **State:** Draft — confirmed and pinned by KNOWN-GAP tests. The fix direction is measured, not
  built.
- **Severity:** High — **false green, with `call()`**, the matcher eess recommends for precision.
  `notHaveCallbackContaining(call('legacy'))` passes `use(() => legacy(1))`, and a concise arrow is
  the ordinary way to write a one-line callback. `notHaveArgumentContaining(call('legacy'))` passes
  `use(legacy(1))`.
- **Origin:** self-found · measuring the fix for
  [0322](./fixed/0322-two-broad-matches-with-one-span-remove-each-other.md).
- **Reported:** 2026-09-19

## Symptom

The call conditions search each argument, or each callback's body, with `findMatchesInNode`
(`packages/ts/src/conditions/call.ts:125`, `:157`, `:300` and `:342`). That function tests a node's
descendants and never the node itself (`packages/ts/src/helpers/body-traversal.ts:136`). An argument
that is the match is never tested, and neither is a concise callback's body, which
`getFunctionBody` returns as the expression itself (`packages/ts/src/helpers/body-traversal.ts:421`).

Measured, the same with either matcher, `call('legacy')` or `expression(/legacy\(1\)/)`:

| Statement                          | Condition                   | Findings |
| ---------------------------------- | --------------------------- | -------- |
| `use(legacy(1));`                  | `notHaveArgumentContaining` | **0**    |
| `use(0 + legacy(1));`              | `notHaveArgumentContaining` | 1        |
| `use(() => legacy(1));`            | `notHaveCallbackContaining` | **0**    |
| `use(() => { return legacy(1) });` | `notHaveCallbackContaining` | 1        |

A requirement fails the other way: `haveArgumentContaining(call('legacy'))` reports `use(legacy(1))`
as missing the call it passes.

## Root cause

`findMatchesInNode` was written for a body, and a body is a block: no shipped matcher names a block,
so its root never needed testing. [0300](./fixed/0300-class-body-search-reads-methods-constructors-and-accessors-only.md)
met the same limit for an initializer and a parameter default, which can be the match, and added
`findMatchesInExpression`, which tests the root too
(`packages/ts/src/helpers/body-traversal.ts:325`). The call conditions search what can be an
expression and still use `findMatchesInNode`.

A function's own concise body is not affected: `functions().should().notContain(...)` reports
`const f = () => legacy(1)` with both matchers — the path
[0224](./fixed/0224-recommended-floor-misses-two-function-shapes.md) fixed.

## Fix

Measured, not built: the call conditions search with `findMatchesInExpression` instead of
`findMatchesInNode`, at all four sites. Applied to a copy and restored by sha256: the three pins go
red, and 3,777 of the eess-ts suite's 3,780 tests pass; the three that fail are the pins.

**It is a behaviour change.** It reports findings that 0.5.1 misses, and the call conditions'
baseline identities are ordinals per declaration, so a newly reported match above an accepted one
takes its ordinal. The changeset must say so.

## Related

- [0322](./fixed/0322-two-broad-matches-with-one-span-remove-each-other.md) — the same searches, a
  different cause: a match that shares its span with another.

## Verification

- [x] reproduced and pinned —
      `packages/ts/tests/conditions/call-conditions-search-below-the-root.test.ts` ·
      `it('KNOWN GAP — notHaveArgumentContaining misses an argument that is the match')`,
      `it('KNOWN GAP — notHaveCallbackContaining misses a concise callback whose body is the match')`
      and `it('KNOWN GAP — haveArgumentContaining reports an argument that is the match as missing')`.
- [x] each pin goes red under the fix direction above, and no other eess-ts test does.
- [ ] the fix: the four call-condition sites search the root too
- [ ] `haveCallbackContaining` measured with a concise callback
- [ ] the three tests assert the fixed behaviour
- [ ] the changeset marks it breaking and names the baseline effect
- [ ] `npm run validate` green.

Deferred: none.
