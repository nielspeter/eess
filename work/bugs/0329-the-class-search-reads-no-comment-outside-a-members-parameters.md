# Bug 0329: the class search reads no comment outside a member's parameters

## Status

- **State:** Draft — measured while ruling [0325](./fixed/0325-the-class-search-reads-no-comment-on-a-parameter.md),
  and pinned by a KNOWN-GAP test. The fix is not decided.
- **Severity:** Medium — **false green for a comment rule on classes**, in the three places of a
  member's signature that belong to no parameter. `m(/* TODO: take the id */) { … }` is the ordinary
  way to mark a signature that is not finished, and it passes
  `classes().should().notContain(comment(/TODO/))` while the function rules report it on the same
  member. Narrower than 0325 — that one covered every shape attached to a parameter — and the same
  class of gap. No shipped class rule reads comments with a `comment()` matcher, so the gap is in
  rules adopters write.
- **Origin:** self-found · measured while ruling 0325, whose fix reads each `ParameterDeclaration`
  and so reaches nothing in a member with no parameters.
- **Reported:** 2026-09-20

## Symptom

Measured on PR #147's build — 0325 fixed — one member per shape, `comment(/TODO/)`:

| Member                                | class rules | function rules |
| ------------------------------------- | ----------- | -------------- |
| `m(/* TODO */) { return 1 }`          | **0**       | 1              |
| `m(): /* TODO */ number { return 1 }` | **0**       | 1              |
| `m() /* TODO */ { return 1 }`         | **0**       | 1              |
| `m(g = /* TODO */ 1) { return g }`    | 1           | 1              |
| `m() { return 1 } /* TODO */`         | 1           | 1              |

The last two rows are controls: a comment on a parameter is 0325's fix, and one after the member is
trailing trivia of the body, which the body search already reads.

## Root cause

0325's pass walks each `ParameterDeclaration` of each method, constructor and accessor
(`packages/ts/src/helpers/body-traversal.ts:319`). A comment in an EMPTY parameter list is attached
to no parameter — it is trivia of the closing parenthesis — and one in a return type or between `)`
and `{` lies outside every parameter's span. The function search has none of these gaps because a
trivia matcher there starts at the whole declaration
(`packages/ts/src/helpers/body-traversal.ts:506`), which is exactly what a class search must not do:
that walk reaches the member's own docstring, which [0307](./fixed/0307-class-body-rules-skip-class-code-outside-its-members.md)
ruled is not code.

## Fix

Not decided, and it is the same design question 0325 answered for parameters, one level out: which
parts of a member's signature a class comment rule reads, given that the member's leading trivia is
documentation and must stay unread. A candidate is to walk the member's declaration and subtract the
positions attached to the member itself — its leading and trailing ranges — rather than walking each
parameter; whether that also picks up a comment between the modifiers and the name is unmeasured.
The decorator carve-out 0325 made for must-contain reach applies here too, and a member's own
decorators would come into range for the first time.

## Related

- [0325](./fixed/0325-the-class-search-reads-no-comment-on-a-parameter.md) — the parameters, fixed;
  this record is what that fix leaves.
- [0307](./fixed/0307-class-body-rules-skip-class-code-outside-its-members.md) — the ruling that a
  docstring is not code, which is why the class search cannot simply start at the declaration.

## Verification

- [x] reproduced and pinned —
      `packages/ts/tests/conditions/class-search-reads-no-comment-outside-parameters.test.ts` ·
      `it('KNOWN GAP — a comment in an empty parameter list, a return type or before the body passes a class comment rule')`,
      which asserts the function rules report each shape and that 0325's shapes still do, so it
      cannot pass over a search that reports nothing.
- [ ] a ruling on how much of a member's signature a class comment rule reads
- [ ] the fix, with the KNOWN-GAP test inverted
- [ ] a changeset
- [ ] `npm run validate` green.

Deferred: none.
