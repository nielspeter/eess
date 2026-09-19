# Bug 0323: the call conditions search below the root

## Status

- **State:** Fixed — the call conditions test an argument, and a concise callback's body, itself
  too, and so does a module-scope search under `scopeToModule` for a top-level initializer; a root's
  match is numbered after the matches below it, so a baseline keeps its identities. Red test first.
- **Severity:** High — **false green, with `call()`**, the matcher eess recommends for precision.
  `notHaveCallbackContaining(call('legacy'))` passed `use(() => legacy(1))`, and a concise arrow is
  the ordinary way to write a one-line callback. `notHaveArgumentContaining(call('legacy'))` passed
  `use(legacy(1))`, and `notContain(access('process.env'), { scopeToModule: true })` passed
  `const e = process.env`. No shipped rule, preset or dogfood rule uses the four call conditions or
  `scopeToModule`, so the gap was in rules adopters write.
- **Origin:** self-found · measuring the fix for
  [0322](./0322-two-broad-matches-with-one-span-remove-each-other.md); the `scopeToModule` site was
  found by the enforcement review of this fix.
- **Reported:** 2026-09-19 · **Fixed:** 2026-09-19 (PR #142)

## Symptom

The call conditions searched each argument, or each callback's body, with `findMatchesInNode`. That
function tests a node's descendants and never the node itself
(`packages/ts/src/helpers/body-traversal.ts:136`). An argument that is the match was never tested,
and neither was a concise callback's body, which `getFunctionBody` returns as the expression itself
(`packages/ts/src/helpers/body-traversal.ts:463`).

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

The same search had one more caller: under `{ scopeToModule: true }`, a module's `notContain` and
`contain` search each top-level initializer with it (`collectVariableStatementMatches`,
`packages/ts/src/helpers/body-traversal.ts:489`). `const x = legacy(1);` gave **0** findings under
`call('legacy')` and `const e = process.env;` **0** under `access('process.env')`;
`const x = 0 + legacy(1);` gave 1.

Two published claims were false: `docs/calls.md:235` said `haveArgumentContaining` "searches all
arguments recursively at any depth", and `docs/calls.md:253` said `notHaveArgumentContaining`
reports every match "found at any depth". Depth zero, the argument itself, was not searched.

## Root cause

`findMatchesInNode` was written for a body, and a body is a block: no shipped matcher names a block,
so its root never needed testing. [0300](./0300-class-body-search-reads-methods-constructors-and-accessors-only.md)
met the same limit for an initializer and a parameter default, which can be the match, and added
`findMatchesInExpression`, which tests the root too
(`packages/ts/src/helpers/body-traversal.ts:325`). The call conditions, and the module search under
`scopeToModule`, searched what can be an expression and still used `findMatchesInNode`. The other
callers search a block, a source file, a statement or a trivia root, or test a concise body
themselves (`searchFunctionBody`, `packages/ts/src/helpers/body-traversal.ts:399`, the path
[0224](./0224-recommended-floor-misses-two-function-shapes.md) fixed).

## Fix

`findMatchesInCode` (`packages/ts/src/helpers/body-traversal.ts:346`) searches a node that is not a
block with `findMatchesInExpression`, root included, and a block with `findMatchesInNode`, below its
root. `findMatchesInEach` (`:361`) runs it over several roots and numbers every match below a root
before the roots that match themselves. The prohibitions use `findMatchesInEach`
(`packages/ts/src/conditions/call.ts:132` and `:350`, and the module search at
`packages/ts/src/helpers/body-traversal.ts:500`); the requirements, which only ask whether anything
matched, use `findMatchesInCode` (`packages/ts/src/conditions/call.ts:163` and `:307`).
`findMatchesInNode` is now private to `body-traversal.ts`, so every search below a root is in one
file.

**Why a callback's block keeps its root untested.** A broad pattern tested against a block matches
the whole body, the over-match `searchFunctionBody` avoids for a function's own body. The fix
direction measured while filing this record tested block roots too; it passed the suite, but reports
`use(() => {})` under `expression(/\{\s*\}/)`. The fix follows the function-body rule instead. This
applies where the node searched IS the block — the two callback conditions. The argument conditions
search the callback argument, whose block is a descendant, and read it whole, as they did before:
`use(() => {})` under `notHaveArgumentContaining(expression(/\{\s*\}/))` is one finding at `e90c13b`
and after.

**One match, once.** `findMatchesInExpression` counts the root under a broad matcher only when
nothing inside it matched, so `use(legacy(legacy(1)))` is one finding under
`expression(/legacy\(1\)/)` and two under `call('legacy')` — two calls. A `call()` or `access()` given
a regex can match an argument and a call inside it, as it already did one level down:
`call(/legacy/)` in `use(legacy(1).then())` was one finding and is two.

**A baseline keeps its identities.** A finding's identity is an ordinal among the matches in its
declaration. Numbered where it stands, a new root match would take the ordinal of a match a baseline
already accepted, and the new finding would be the one hidden — the outcome
`packages/ts/src/conditions/match-identity.ts:20` calls worse than a miss. `findMatchesInEach`
numbers the root matches last, as `searchClassBody` numbers the code 0300 made it read. Found by the
enforcement review of this fix; a trivia match was found on a root before, so it keeps its place.

**It is a behaviour change.** It reports findings 0.5.1 missed. The changeset marks it breaking.
`docs/calls.md` is true again, says a concise callback's body is tested itself, and says a callback
inside an object literal is not searched yet.

## Related

- [0322](./0322-two-broad-matches-with-one-span-remove-each-other.md) — the same searches, a
  different cause: a match that shares its span with another.
- [0324](../0324-the-callback-conditions-read-a-direct-callback-only.md) — found by the enforcement
  review of this fix: the callback conditions take only a direct callback, not one in an object
  literal or behind parentheses. A different cause, filed with KNOWN-GAP tests.

## Verification

- [x] Red test first — the four KNOWN-GAP tests filed with this record asserted the gap, one per
      call-condition site. The new tests were red before the fix, four of the first five; the
      block-body test pins what must not change, so it is green before and after.
- [x] The fix turns them green —
      `packages/ts/tests/conditions/call-conditions-search-the-root.test.ts` ·
      `it('notHaveArgumentContaining reports an argument that is the match')`,
      `it('notHaveCallbackContaining reports a concise callback whose body is the match')`,
      `it('haveArgumentContaining passes an argument that is the match')`,
      `it('haveCallbackContaining passes a concise callback whose body is the match')` and
      `it("a callback's block body is searched below its root, as a function's is")`. The
      KNOWN-GAP file is replaced, as
      [0297](./0297-no-process-env-reads-one-spelling-of-an-environment-read.md)'s was.
- [x] The review's findings pinned —
      `it('a match at the root is numbered after the matches below it, so a baseline keeps its identities')`,
      `it('a module-scope initializer that is the match is found under scopeToModule')`, and the
      block-body test's two assertions at the `haveCallbackContaining` site.
- [x] Sabotage matrix in the worktree over the two test files this PR adds, sources restored by
      sha256 and the tree unchanged:
  - R0, as built: all green.
  - R1 to R4, each call site reverted alone: its own test red. R1 and R4 also turn the order test
    red, and R1 the 0324 control, a direct concise callback.
  - R5, a block root tested in the shared helper; R7, the `haveCallbackContaining` site searching
    the whole callback; R8, that site testing the block root inline: the block-body test red.
  - R6, the root added beside a broad match inside it: both `notHave…` tests red on the double.
  - R9, root matches numbered in place: the order test red.
  - R10, the `scopeToModule` site reverted: its test red.
- [x] `docs/calls.md:158`, `:173`, `:235` and `:253` true — the first three reworded, the fourth
      true as it stands.
- [x] The changeset marks it breaking — `.changeset/call-conditions-test-the-root.md` — and the
      pending 0322 changeset no longer says 0323 is open.
- [x] `npm run validate` green on the pushed head.

Deferred: none.
