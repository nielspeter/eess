# Bug 0322: two broad matches with one span remove each other

## Status

- **State:** Fixed — of a set of matches that share one span, the broad filter keeps one, the
  deepest, instead of dropping all of them, and a concise arrow's body is no longer reported beside a
  broad match inside it; red test first, and the fix measured before it was written.
- **Severity:** High — **false green.** A prohibition written with `expression()` passed a
  function that broke it, and nothing said so. Semicolons do not protect against it: a name or a
  call that is a call's **only argument** or an array's **only element** was dropped too, so
  `use(legacy(12));` passed `notContain(expression(/legacy\(12\)/))`. No shipped rule or preset
  uses `expression()`, so the gap was in rules adopters write — as it was for
  [0300](./0300-class-body-search-reads-methods-constructors-and-accessors-only.md).
- **Origin:** inbound — an agent in an adopter project reported it against `eess-ts` 0.5.1, with a
  diagnosis naming this function and three shapes. Verified here against `6e077ed` and re-sourced:
  every shape, name and test below is ours. The branch was then rebased onto `1c76505`, where the
  table, the sabotage matrix and the final `validate` ran. The list shapes were found here, while
  measuring the fix.
- **Reported:** 2026-09-19 · **Fixed:** 2026-09-19 (PR #141)

## Symptom

`expression()` declares no syntax kinds (`packages/ts/src/helpers/matchers.ts:187`), so a body
search takes the broad path (`packages/ts/src/helpers/body-traversal.ts:152`). That path tests every
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

A statement without a semicolon is dropped only when the match is the whole statement: `legacy(3).done()`
and `return legacy(4)` hold the match strictly inside and were reported. The class and module rules
missed `legacy(7)` written as a method's or a module's statement without a semicolon — the one shape
measured there. `useInsteadOf` did not report the bad match, only the missing good one.
`notHaveArgumentContaining` and `notHaveCallbackContaining` missed a shorthand property, and a name
that was the only argument of a call inside a callback, with a semicolon or without. The requirements
failed the other way: `contain`, `useInsteadOf`'s good side, `haveArgumentContaining` and
`haveCallbackContaining` reported a body that holds the match as missing it.

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
remove the other — measured at zero findings"_ (`packages/ts/src/helpers/body-traversal.ts:161`).
That arrived with the port from `ts-archunit`, and the broad path kept the filter. Ties are common,
but a deeper match usually hides them; no earlier test depended on a tie at the deepest level, and
with the fix applied every earlier eess-ts test passes.

## Fix

Of a tie, the filter keeps the last node in walk order, which is the deepest because the walk is
pre-order (`packages/ts/src/helpers/body-traversal.ts:120-130`). The fix is in the one filter, so
every search a broad matcher takes inherits it — `expression()`, and any `ExpressionMatcher` that
names no syntax kind: the function, class and module body conditions, the call-argument and callback
searches, and the `inconsistentSiblings` smell, which reads `searchFunctionBody`.

**A tie-break that looks right and is not.** Keeping the node whose ancestors include the other
reports a tie **twice**: `getAncestors()` follows `getParent()`, which skips the `SyntaxList`, so the
list survives beside the call. The source comment names this, and the tests pin _exactly once_.

**A concise arrow's body, reported beside the match inside it.** `searchFunctionBody` adds a concise
arrow's body when it matches, because both traversals test only descendants and `() => eval(x)`'s body
is the call itself (bug 0224). For a broad matcher that found something inside the body, the body is
an ancestor of that match, and adding it reported one match twice. In 0.5.1 a tie inside the body
emptied the inner search, so the body was reported alone, once; keeping the tie made it twice, as it
already was for a match strictly inside — `() => legacy(1)` under `expression(/legacy/)` was two
findings in 0.5.1. The body is now skipped when a broad matcher matched inside it
(`packages/ts/src/helpers/body-traversal.ts:532`), and each of those is one finding. A by-kind matcher
never tests the root it searches, so for it the body is a different node and still counts:
`() => legacy(legacy(1))` under `call('legacy')` is two findings, as it should be. Found by the
enforcement review of this PR.

**Which node of a tie is kept is observable, in the identity.** Every node of a tie starts on the same
line, so the line and the message cannot tell them apart. The baseline identity can: it names the
node's enclosing declaration, or the node itself when it is a property or variable declaration, and
the node's kind when nothing named encloses it (`packages/ts/src/conditions/match-identity.ts:52`,
`packages/ts/src/core/violation.ts:80`). `export class C { delta }` under `modules()` is `C.delta`
when the name is kept, and `C` when the class's member list is. The deepest is kept, and a test pins
it by identity (row R3). A first draft of this record called the choice unobservable; the enforcement
review measured otherwise.

**Where a finding's line moves.** `findMatchesInExpression`
(`packages/ts/src/helpers/body-traversal.ts:410`) counts an initializer's root only when nothing inside
it matched. A class field or parameter default whose only match was a tie used to be reported at the
initializer's first line, and is now reported at the match's own: `field = {` / `alpha` / `}` under
`expression(/\balpha\b/)` said "at line 3" and now says "at line 4". The identity, `K.field::…#1`,
does not change.

**It is a behaviour change.** The fix reports findings 0.5.1 dropped, so a green gate can go red.
The changeset marks it breaking and names every search that changes.

## Related

- [0323](./0323-the-call-conditions-search-below-the-root.md) — found while measuring this fix. The
  call conditions never tested an argument, or a concise callback's body, that was itself the match,
  with `call()` as with `expression()`. A different cause, filed here with KNOWN-GAP tests and fixed
  in PR #142.

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
- [x] The requirement halves and the review's two findings pinned —
      `it('the requirement conditions pass a body whose only match shares its span')` (for
      `haveArgumentContaining`, `haveCallbackContaining` and `useInsteadOf`'s good side),
      `it('a concise arrow whose body holds a broad match reports it once')` and
      `it('of a tie, the deepest node is kept, which a finding names in its identity')`.
- [x] Sabotage matrix in the worktree over the two new test files, thirteen tests, sources restored
      by sha256 and the tree unchanged:
  - R0, as built: all green.
  - R1, the tie fix reverted: eight of the nine 0322 tests red. The concise-arrow test is the other
    fix's, and R5 covers it.
  - R2, the tie broken by `getAncestors()`: seven red. `contain()` and the requirement test need only
    one match, so they pass.
  - R3, the tie keeps the shallowest: the identity test red.
  - R5, the concise-body fix reverted: the concise-arrow test red.
- [x] The changeset says the fix reports findings 0.5.1 drops —
      `.changeset/broad-match-span-tie-is-reported.md`, `minor`, marked breaking, naming every search
      that changes, the concise arrow, the baseline effect and the line that moves.
- [x] `npm run validate` green.

Deferred: none.
