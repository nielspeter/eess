# Bug 0334: classes() cannot select a class expression

## Status

- **State:** Draft — measured on PR #148's build and pinned by an assertion in that PR's test. The
  fix is a typing change with its own design question.
- **Severity:** Low — **no false green for the shipped rules.** A class expression's MEMBERS are
  read by the function rules since [0321](./fixed/0321-function-positions-no-function-rule-reads.md),
  so `eval` in one is reported. What is missing is the ability to write a CLASS rule about it:
  `classes().that().haveNameMatching(/Service$/)` can never select `const Service = class {…}`, and
  a rule about what a class must contain silently does not apply to it.
- **Origin:** self-found · 0321 fixed the function side and left the class side, whose element type
  is `ClassDeclaration` from the builder's predicates through to `searchClassBody`.
- **Reported:** 2026-09-20

## Symptom

Measured on PR #148's build, `classes().should().satisfy(noEval())` over a file holding both:

| declaration                                       | selected   |
| ------------------------------------------------- | ---------- |
| `export class S { static { eval('1') } }`         | yes        |
| `export namespace N { export class Inner {…} }`   | yes (0321) |
| `export const Expr = class { m() { eval('1') } }` | **no**     |

## Root cause

`ClassRuleBuilder` is `RuleBuilder<ClassDeclaration>`
(`packages/ts/src/builders/class-rule-builder.ts:78`), and every predicate, condition and the body
search below it take a `ClassDeclaration`. A `ClassExpression` is a different ts-morph type with the
same members, so admitting one means widening that type through the builder rather than changing
what the collection returns.

## Fix

Not decided, and the typing is the smaller half. The design question is **what a class expression is
called** when an identity predicate asks: `haveNameMatching`, `excluding()`, a baseline identity and
a violation's `element` all key on a name. An anonymous class assigned to a `const` can borrow the
binding's name — that is what the function rules do for its members since 0321 (`Expr.m`) — but one
passed straight to a call has no name to borrow, and a rule that selects it could not be excluded or
baselined by name.

## Related

- [0321](./fixed/0321-function-positions-no-function-rule-reads.md) — the function side, fixed; its
  test asserts this record's gap from the other direction.

## Verification

- [x] reproduced and pinned —
      `packages/ts/tests/rules/function-positions-the-builder-collects.test.ts` ·
      `it('reads a namespace class with the class rules too')`, which asserts that `Inner` is
      selected and `Expr` is not, beside the function rules reading `Expr.m`.
- [ ] a ruling on what names a class expression by, for predicates, exclusions and baselines
- [ ] the fix, with the pinned assertion inverted
- [ ] a changeset
- [ ] `npm run validate` green.

Deferred: none.
