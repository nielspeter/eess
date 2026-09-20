# Bug 0329: the class search reads no comment outside a member's parameters

## Status

- **State:** Draft — measured while ruling [0325](./fixed/0325-the-class-search-reads-no-comment-on-a-parameter.md),
  **rescoped** by the enforcement review of that fix, and pinned by two KNOWN-GAP tests. The fix is
  not decided.
- **Severity:** Low — **false green for a comment rule on classes**, in the two places of a
  member's signature that lie outside its parentheses, plus an overload's parameter list. Narrower
  than when this record was filed: it then claimed an empty parameter list too, and 0325's fix —
  rewritten after the enforcement review to read the parameter LIST's span rather than each
  parameter — reads that and every comment beside a `(` or a `,`. What is left is a comment in a
  return type or between `)` and `{`. No shipped class rule reads comments with a `comment()`
  matcher, so the gap is in rules adopters write.
- **Origin:** self-found · measured while ruling 0325; rescoped 2026-09-20 after the enforcement
  review of PR #147 measured that the first version of that fix missed six placements inside the
  parameter list itself, and the remedy — reading the list's span — subsumed this record's first
  row.
- **Reported:** 2026-09-20

## Symptom

Measured on PR #147's build — 0325 fixed — one member per shape, `comment(/TODO/)`:

| Member                                     | class rules | function rules |
| ------------------------------------------ | ----------- | -------------- |
| `m(): /* TODO */ number { return 1 }`      | **0**       | 1              |
| `m() /* TODO */ { return 1 }`              | **0**       | 1              |
| `m(a: /* TODO */ number): void` (overload) | **0**       | **0**          |
| `m(/* TODO */ g = 1) { return g }`         | 1           | 1              |
| `m(/* TODO */) { return 1 }`               | 1           | 1              |
| `m() { return 1 } /* TODO */`              | 1           | 1              |

The last three rows are controls: everything inside the parentheses is 0325's fix, and a comment
after the member is trailing trivia of the body, which the body search already reads. The overload
row is the one that is not a disagreement — the function rules do not read it either.

## Root cause

0325's pass reads the comments POSITIONED between a member's `(` and `)`
(`packages/ts/src/helpers/body-traversal.ts:331`). A comment in the return type or between `)` and
`{` is outside that span; it is in the member's signature but not in its parameter list.

The overload row has a different cause: ts-morph's `getClasses().getMethods()` yields only the
implementation (measured), so an overload signature reaches neither search — which is why the
function rules, whose trivia matcher starts at the whole declaration
(`packages/ts/src/helpers/body-traversal.ts:523`), miss it as well.

The function search has no signature gap otherwise, because that walk starts at the declaration —
which is exactly what a class search must not do: it reaches the member's own docstring, which
[0307](./fixed/0307-class-body-rules-skip-class-code-outside-its-members.md) ruled is not code.

## Fix

Not decided, and it is the same design question 0325 answered for the parameter list, one span out:
how much of a member's signature a class comment rule reads, given that the member's leading trivia
is documentation and must stay unread. A candidate is to widen the span from `(`–`)` to
`(`–`{` (the body's opening brace, or the member's end for an overload), which covers both
disagreeing rows and still excludes the docstring by position. The decorator carve-out 0325 made for
must-contain reach would apply to the widened span unchanged.

The overload row is a separate decision: reading it means collecting `getOverloads()` in both
searches, so that the two keep agreeing.

## Related

- [0325](./fixed/0325-the-class-search-reads-no-comment-on-a-parameter.md) — the parameters, fixed;
  this record is what that fix leaves.
- [0307](./fixed/0307-class-body-rules-skip-class-code-outside-its-members.md) — the ruling that a
  docstring is not code, which is why the class search cannot simply start at the declaration.

## Verification

- [x] reproduced and pinned —
      `packages/ts/tests/conditions/class-search-reads-no-comment-outside-parameters.test.ts` ·
      `it('KNOWN GAP — a comment in a return type or before the body passes a class comment rule')`
      and `it('KNOWN GAP — an overload signature parameter list is read by neither search')`. Each
      asserts the shapes that DO work beside the ones that do not, so a fix that reported nothing
      anywhere could not pass.
- [ ] a ruling on how much of a member's signature a class comment rule reads
- [ ] the fix, with the KNOWN-GAP tests inverted
- [ ] a changeset
- [ ] `npm run validate` green.

Deferred: none.
