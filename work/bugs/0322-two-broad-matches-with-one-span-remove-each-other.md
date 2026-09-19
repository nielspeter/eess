# Bug 0322: two broad matches with one span remove each other

## Status

- **State:** Draft — confirmed in the source, reproduced, and pinned by KNOWN-GAP
  tests. The fix direction is measured, not built.
- **Severity:** High — **false green.** A prohibition written with `expression()`
  passes a function that breaks it, and nothing says so. In a codebase written
  without semicolons that covers every call or assignment written as a statement;
  in any codebase it covers a shorthand property, a destructured binding, a
  variable declared without a value and a type annotation. No shipped rule or
  preset uses `expression()`, so the gap is in rules adopters write — as it was for
  [0300](./fixed/0300-class-body-search-reads-methods-constructors-and-accessors-only.md).
- **Origin:** inbound — an agent in an adopter project reported it against
  `eess-ts` 0.5.1, with a diagnosis naming this function. Verified here against
  `6e077ed` and re-sourced: every shape, name and test below is ours.
- **Reported:** 2026-09-19

## Symptom

`expression()` declares no syntax kinds (`packages/ts/src/helpers/matchers.ts:187`),
so a body search takes the broad path (`packages/ts/src/helpers/body-traversal.ts:137`).
That path tests every descendant, then keeps only the deepest matches:

```ts
return matches
  .filter(
    (m) =>
      !matches.some(
        (other) => other !== m && other.getStart() >= m.getStart() && other.getEnd() <= m.getEnd(),
      ),
  )
  .map((n) => ({ node: n }))
```

`packages/ts/src/helpers/body-traversal.ts:108-116`, in `findMatchesBroad` (`:98`).
A match is dropped when another match lies inside it — and a node with the same
span lies inside it. When two or more matches cover exactly the same text, each
drops the others, and none is reported.

Measured through `functions(p).should().notContain(expression(pattern))`, one
function per shape, each read by its own pattern:

| Body                          | Pattern         | Reported? |
| ----------------------------- | --------------- | --------- |
| `legacy(1)`                   | `/legacy\(1\)/` | **no**    |
| `legacy(2);`                  | `/legacy\(2\)/` | yes       |
| `legacy(3).done()`            | `/legacy\(3\)/` | yes       |
| `return legacy(4)`            | `/legacy\(4\)/` | yes       |
| `state = 5`                   | `/state = 5/`   | **no**    |
| `return { alpha }`            | `/\balpha\b/`   | **no**    |
| `return { key: beta }`        | `/\bbeta\b/`    | yes       |
| `const { gamma } = source`    | `/\bgamma\b/`   | **no**    |
| `let delta`                   | `/\bdelta\b/`   | **no**    |
| `let x: Epsilon \| undefined` | `/\bEpsilon\b/` | **no**    |
| `use(Zeta.one)`               | `/\bZeta\b/`    | yes       |

The class and module rules miss the same statement without a semicolon, and report
it with one. A requirement fails the other way: `contain(expression(/legacy\(10\)/))`
reports a function whose body is `legacy(10)` as missing the call.

## Root cause

A parent's text includes its child's, so a regex over `getText()` matches at every
level from the match up to the body, and the filter exists to keep the innermost.
It assumed the innermost match is strictly smaller than the one around it. A tie
breaks that:

- a statement without a semicolon has the span of its expression — and when it is
  the block's only statement, the block's `SyntaxList` has it too. Three nodes, one
  span;
- a shorthand property, a binding element without an initializer and a variable
  declaration without a value have the span of their name;
- a type reference has the span of its type name.

The comment path met the same trap and skips the filter, saying so:
_"nodes with identical spans each remove the other — measured at zero findings"_
(`packages/ts/src/helpers/body-traversal.ts:146`). That arrived with the port from
`ts-archunit`, and the broad path kept the filter.

The `broad matcher` notice `expression()` prints recommends `call()`, `access()` or
`newExpr()` for precision. It does not warn about this, and no other test has a
tie: with the fix below applied, every eess-ts test but this record's three passes.

**What inherits it.** Every caller of `findMatchesInNode` with an `expression()`
matcher: the function, class and module body conditions (`notContain`, `contain`,
`useInsteadOf`), the call-argument search in `packages/ts/src/conditions/call.ts`,
and the sibling smells. Measured: `notContain` on all three builders, and
`contain` on functions. Not measured: `useInsteadOf`, the argument search and the
smells. `comment()` takes the trivia path, and every other public matcher declares
its syntax kinds, so neither is affected. No dogfood rule in this repo uses
`expression()`.

## Fix

Measured, not built: **on an exact span tie, keep one node — the deepest.**
`allDescendants` returns ts-morph's `getDescendants()`
(`packages/ts/src/core/descendant-cache.ts:211`), which is pre-order, so the deepest
of a tie is the last in walk order:

```ts
.filter(
  (m, i) =>
    !matches.some((other, j) => {
      if (other === m) return false
      if (other.getStart() < m.getStart() || other.getEnd() > m.getEnd()) return false
      const sameSpan = other.getStart() === m.getStart() && other.getEnd() === m.getEnd()
      return !sameSpan || j > i
    }),
)
```

Applied to a copy and restored by hash: each of the six shapes is reported exactly
once, the class and module statements once each, and `contain()` passes the function
it failed. Of the eess-ts suite's 3,755 tests in 301 files, 3,752 pass under it; the
three that fail are this record's pins.

**A tie-break that looks right and is not.** Keeping the node whose ancestors
include the other reports each tie **twice**: `getAncestors()` follows
`getParent()`, which skips the `SyntaxList` that `getDescendants()` yields, so the
list survives beside the call. The fix's tests must pin _exactly once_.

**It is a behaviour change.** The fix reports findings that 0.5.1 drops, so an
adopter's gate can go red on code that passed. The changeset has to say so.

## Related

- [0300](./fixed/0300-class-body-search-reads-methods-constructors-and-accessors-only.md)
  — the class body search. Its `findMatchesInExpression`
  (`packages/ts/src/helpers/body-traversal.ts:315`) counts an initializer's root only
  when nothing inside it matched, which assumes this filter keeps the deepest match.
  Not measured with a tie.

## Verification

- [x] reproduced and pinned —
      `packages/ts/tests/helpers/a-broad-match-sharing-its-span-is-dropped.test.ts` ·
      `it('KNOWN GAP — notContain(expression()) reports none of six shapes whose match shares its span')`,
      `it('KNOWN GAP — the class and module rules miss a statement without a semicolon')`
      and `it('KNOWN GAP — contain(expression()) fails a function whose only match has no semicolon')`.
- [x] each pin goes red under the fix above: three of three, with the source
      restored by sha256 and the working tree unchanged afterwards.
- [ ] the fix: one node kept from an exact span tie, the deepest
- [ ] the three tests assert the fixed behaviour, each shape reported exactly once
- [ ] `useInsteadOf` and the call-argument search measured with a tie
- [ ] the changeset says the fix reports findings 0.5.1 drops
- [ ] `npm run validate` green.

Deferred: none.
