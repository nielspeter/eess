# Bug 0322: two broad matches with one span remove each other

## Status

- **State:** Fixed — of a set of matches that share one span, the broad filter keeps one, the
  deepest, instead of dropping all of them; red test first, and the fix measured before it was
  written.
- **Severity:** High — **false green.** A prohibition written with `expression()` passed a
  function that broke it, and nothing said so. Semicolons do not protect against it: a name or a
  call that is a call's **only argument** or an array's **only element** was dropped too, so
  `use(legacy(12));` passed `notContain(expression(/legacy\(12\)/))`. No shipped rule or preset
  uses `expression()`, so the gap was in rules adopters write — as it was for
  [0300](./0300-class-body-search-reads-methods-constructors-and-accessors-only.md).
- **Origin:** inbound — an agent in an adopter project reported it against `eess-ts` 0.5.1, with a
  diagnosis naming this function and three shapes. Verified here against `6e077ed` and re-sourced:
  every shape, name and test below is ours. The list shapes were found here, while measuring the
  fix.
- **Reported:** 2026-09-19

## Symptom

`expression()` declares no syntax kinds (`packages/ts/src/helpers/matchers.ts:187`), so a body
search takes the broad path (`packages/ts/src/helpers/body-traversal.ts:147`). That path tests every
descendant and keeps only the deepest matches. The filter dropped a match whenever another match lay
inside it, and a node with the same span lies inside it — so when several matches covered exactly
the same text, each dropped the others, and nothing was reported.

Measured through `functions(p).should().notContain(expression(pattern))`, one function per shape,
each read by its own pattern, with 0.5.1's filter. With the fix, every row is reported once:

| Body                          | Pattern          | Reported? |
| ----------------------------- | ---------------- | --------- |
| `legacy(1)`                   | `/legacy\(1\)/`  | **no**    |
| `legacy(2);`                  | `/legacy\(2\)/`  | yes       |
| `legacy(3).done()`            | `/legacy\(3\)/`  | yes       |
| `return legacy(4)`            | `/legacy\(4\)/`  | yes       |
| `state = 5`                   | `/state = 5/`    | **no**    |
| `return { alpha }`            | `/\balpha\b/`    | **no**    |
| `return { key: beta }`        | `/\bbeta\b/`     | yes       |
| `const { gamma } = source`    | `/\bgamma\b/`    | **no**    |
| `let delta`                   | `/\bdelta\b/`    | **no**    |
| `let x: Epsilon \| undefined` | `/\bEpsilon\b/`  | **no**    |
| `use(Zeta.one)`               | `/\bZeta\b/`     | yes       |
| `use(eta);`                   | `/\beta\b/`      | **no**    |
| `use(eta, 1);`                | `/\beta\b/`      | yes       |
| `use(Theta.two);`             | `/Theta\.two/`   | **no**    |
| `return [iota];`              | `/\biota\b/`     | **no**    |
| `return [iota, 1];`           | `/\biota\b/`     | yes       |
| `use(legacy(12));`            | `/legacy\(12\)/` | **no**    |

The class and module rules missed the same statement without a semicolon. `useInsteadOf` did not
report the bad match, only the missing good one. `notHaveArgumentContaining` missed a shorthand
property in an argument, and a name that was the only argument of a call inside a callback, with a
semicolon or without. A requirement failed the other way: `contain(expression(/legacy\(10\)/))`
reported a function whose body is `legacy(10)` as missing the call.

## Root cause

A parent's text includes its child's, so a regex over `getText()` matches at every level from the
match up to the body, and the filter exists to keep the innermost. It assumed the innermost match is
strictly smaller than the one around it. A tie breaks that:

- a statement without a semicolon has the span of its expression;
- a shorthand property, a binding element without an initializer and a variable declaration without
  a value have the span of their name;
- a type reference has the span of its type name;
- **the only item of a list has the span of the list.** ts-morph's `getDescendants()` — the walk,
  `packages/ts/src/core/descendant-cache.ts:211` — yields the `SyntaxList` that holds a call's
  arguments, an array's elements or a block's statements, and with one item it covers exactly that
  item. Three nodes can share one span: `legacy(1)` as a block's only statement is the list, the
  statement and the call.

A dropped match still counted as "inside" for the matches around it, so they were dropped too, and
the whole chain up to the body reported nothing.

The comment path met the same trap and skips the filter, saying so: _"nodes with identical spans each
remove the other — measured at zero findings"_ (`packages/ts/src/helpers/body-traversal.ts:156`).
That arrived with the port from `ts-archunit`, and the broad path kept the filter. No test had a
tie: with the fix applied, every earlier eess-ts test passes.

## Fix

Of a tie, the filter keeps the last node in walk order, which is the deepest because the walk is
pre-order (`packages/ts/src/helpers/body-traversal.ts:116-126`). The fix is in the one filter, so
every caller of `findMatchesInNode` with an `expression()` matcher inherits it: the function, class
and module body conditions, the call-argument and callback search, and the sibling smells.

**A tie-break that looks right and is not.** Keeping the node whose ancestors include the other
reports a tie **twice**: `getAncestors()` follows `getParent()`, which skips the `SyntaxList`, so the
list survives beside the call. The source comment names this, and the tests pin _exactly once_.

**Which node of a tie is kept is not observable.** Every node of a tie starts on the same line and
sits in the same declaration, so the finding's line, its message and its baseline identity
(`packages/ts/src/conditions/match-identity.ts:44`) are the same whichever is kept. Keeping the
shallowest passes every test (row R3 below). "The deepest" is chosen because it names the smallest
node; no test can pin it.

**It is a behaviour change.** The fix reports findings 0.5.1 dropped, so a green gate can go red.
The changeset marks it breaking.

## Related

- [0323](../0323-the-call-conditions-search-below-the-root.md) — found while measuring this fix. The
  call conditions never test an argument, or a concise callback's body, that is itself the match, with
  `call()` as with `expression()`. A different cause, filed with KNOWN-GAP tests.

## Verification

- [x] Red test first — filed first in this PR as three KNOWN-GAP tests asserting 0.5.1's
      behaviour, each red under the fix, then replaced by the file below, as
      [0297](./0297-no-process-env-reads-one-spelling-of-an-environment-read.md)'s were.
- [x] The fix turns them green —
      `packages/ts/tests/helpers/a-broad-match-sharing-its-span-is-reported-once.test.ts` ·
      `it('notContain(expression()) reports each shape once, whether or not its match shares a span')`,
      `it('the class and module rules report a statement without a semicolon once')`,
      `it('contain(expression()) passes a function whose only match has no semicolon')`,
      `it('useInsteadOf reports a bad match that shares its span, once')`,
      `it('notHaveArgumentContaining reports a match that shares its span inside an argument, once')`
      and
      `it('notHaveCallbackContaining reports a match that shares its span inside a callback, once')`.
- [x] `useInsteadOf` and the call-argument search measured with a tie — both were affected, both
      are fixed by the same filter, and both are pinned above, with the callback search.
- [x] Sabotage matrix in the worktree, sources restored by sha256 and the tree unchanged: R0 as
      built, all six green; R1 the fix reverted, all six red; R2 the tie broken by
      `getAncestors()`, five red (`contain()` needs only one match, so it passes); R3 the tie keeps
      the shallowest, all green — not observable, as above.
- [x] The changeset says the fix reports findings 0.5.1 drops —
      `.changeset/broad-match-span-tie-is-reported.md`, `minor`, marked breaking.
- [x] `npm run validate` green.

Deferred: none.
