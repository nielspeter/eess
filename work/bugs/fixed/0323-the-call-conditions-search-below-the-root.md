# Bug 0323: the call conditions search below the root

## Status

- **State:** Fixed — the call conditions test an argument, and a concise callback's body, itself
  too; a block body is still searched below its root, as a function's is. Red test first.
- **Severity:** High — **false green, with `call()`**, the matcher eess recommends for precision.
  `notHaveCallbackContaining(call('legacy'))` passed `use(() => legacy(1))`, and a concise arrow is
  the ordinary way to write a one-line callback. `notHaveArgumentContaining(call('legacy'))` passed
  `use(legacy(1))`. No shipped rule, preset or dogfood rule uses the four call conditions, so the gap
  was in rules adopters write.
- **Origin:** self-found · measuring the fix for
  [0322](./0322-two-broad-matches-with-one-span-remove-each-other.md).
- **Reported:** 2026-09-19 · **Fixed:** 2026-09-19

## Symptom

The call conditions searched each argument, or each callback's body, with `findMatchesInNode`. That
function tests a node's descendants and never the node itself
(`packages/ts/src/helpers/body-traversal.ts:136`). An argument that is the match was never tested,
and neither was a concise callback's body, which `getFunctionBody` returns as the expression itself
(`packages/ts/src/helpers/body-traversal.ts:444`).

Measured on `e90c13b`, the same with either matcher, `call('legacy')` or `expression(/legacy\(1\)/)`:

| Statement                          | Condition                   | Findings |
| ---------------------------------- | --------------------------- | -------- |
| `use(legacy(1));`                  | `notHaveArgumentContaining` | **0**    |
| `use(0 + legacy(1));`              | `notHaveArgumentContaining` | 1        |
| `use(() => legacy(1));`            | `notHaveCallbackContaining` | **0**    |
| `use(() => { return legacy(1) });` | `notHaveCallbackContaining` | 1        |

The requirements failed the other way: `haveArgumentContaining(call('legacy'))` reported
`use(legacy(1))` as missing the call it passes, and `haveCallbackContaining(call('legacy'))` reported
`use(() => legacy(1))` the same way.

Two published claims were false: `docs/calls.md:235` said `haveArgumentContaining` "searches all
arguments recursively at any depth", and `docs/calls.md:253` said `notHaveArgumentContaining`
reports every match "found at any depth". Depth zero, the argument itself, was not searched.

## Root cause

`findMatchesInNode` was written for a body, and a body is a block: no shipped matcher names a block,
so its root never needed testing. [0300](./0300-class-body-search-reads-methods-constructors-and-accessors-only.md)
met the same limit for an initializer and a parameter default, which can be the match, and added
`findMatchesInExpression`, which tests the root too
(`packages/ts/src/helpers/body-traversal.ts:325`). The call conditions searched what can be an
expression and still used `findMatchesInNode`.

A function's own concise body was not affected: `searchFunctionBody` tests it itself
(`packages/ts/src/helpers/body-traversal.ts:380`), the path
[0224](./0224-recommended-floor-misses-two-function-shapes.md) fixed.

## Fix

`findMatchesInCode` (`packages/ts/src/helpers/body-traversal.ts:346`) searches a node that is not a
block with `findMatchesInExpression`, root included, and a block with `findMatchesInNode`, below its
root. The four call-condition sites use it (`packages/ts/src/conditions/call.ts:125`, `:157`,
`:301` and `:344`).

**Why a block keeps its root untested.** A broad pattern tested against a block matches the whole
body, the over-match `searchFunctionBody` avoids for a function's own body. The fix direction
measured while filing this record tested block roots too; it passed the suite, but reports
`use(() => {})` under `expression(/\{\s*\}/)`. The fix follows the function-body rule instead, and a
test pins it (row R5).

**One match, once.** `findMatchesInExpression` counts the root under a broad matcher only when
nothing inside it matched, so `use(legacy(legacy(1)))` is one finding under
`expression(/legacy\(1\)/)` and two under `call('legacy')` — two calls. A test pins both (row R6).

**It is a behaviour change.** It reports findings 0.5.1 missed, and the call conditions' baseline
identities are ordinals per declaration, so a newly reported match above an accepted one takes its
ordinal. The changeset marks it breaking and says so. `docs/calls.md` is true again, and says a
concise callback's body is tested itself.

## Related

- [0322](./0322-two-broad-matches-with-one-span-remove-each-other.md) — the same searches, a
  different cause: a match that shares its span with another.

## Verification

- [x] Red test first — the four KNOWN-GAP tests filed with this record asserted the gap, one per
      call-condition site. The new tests below were red before the fix, four of five: the block-body
      test pins what must not change, so it is green before and after.
- [x] The fix turns them green —
      `packages/ts/tests/conditions/call-conditions-search-the-root.test.ts` ·
      `it('notHaveArgumentContaining reports an argument that is the match')`,
      `it('notHaveCallbackContaining reports a concise callback whose body is the match')`,
      `it('haveArgumentContaining passes an argument that is the match')`,
      `it('haveCallbackContaining passes a concise callback whose body is the match')` and
      `it("a callback's block body is searched below its root, as a function's is")`. The
      KNOWN-GAP file is replaced, as
      [0297](./0297-no-process-env-reads-one-spelling-of-an-environment-read.md)'s was.
- [x] The eess-ts suite passes with the fix: 3,785 of 3,785 tests in 305 files.
- [x] Sabotage matrix in the worktree over the new test file, sources restored by sha256 and the tree
      unchanged. Each of the four sites reverted alone turns exactly its own test red (R1 to R4); a
      block root tested too turns the block-body test red (R5); the root added beside a broad match
      inside it turns both `notHave…` tests red on the double (R6); as built, all green (R0).
- [x] `docs/calls.md:158`, `:235` and `:253` true — the first two reworded, the third true as it
      stands.
- [x] The changeset marks it breaking and names the baseline effect —
      `.changeset/call-conditions-test-the-root.md`.
- [x] `npm run validate` green.

Deferred: none.
