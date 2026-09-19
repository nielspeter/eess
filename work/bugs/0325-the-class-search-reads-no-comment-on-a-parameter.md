# Bug 0325: the class search reads no comment on a parameter

## Status

- **State:** Draft — confirmed and pinned by a KNOWN-GAP test. The fix is not built.
- **Severity:** Medium — **false green for a comment rule on classes.** `m(g = /* TODO */ 1)` and a
  `// TODO` on its own line before a parameter pass `classes().should().notContain(comment(/TODO/))`,
  while the function rules report both on the same member. No shipped class rule reads comments with a
  `comment()` matcher, so the gap is in rules adopters write.
- **Origin:** self-found · split from
  [0314](./fixed/0314-the-function-rules-read-no-parameter-default.md), whose record asked the class and
  function searches to agree on a comment in a parameter's default.
- **Reported:** 2026-09-19

## Symptom

Measured on 0.6.0, one member per shape, `comment(/TODO/)`:

| Member                                      | class rules | function rules |
| ------------------------------------------- | ----------- | -------------- |
| `m() { const x = /* TODO */ 1; return x }`  | 1           | 1              |
| `m() {` / `// TODO` / `return 1` / `}`      | 1           | 1              |
| `m(g = /* TODO */ 1) { … }`                 | **0**       | 1              |
| `m(` / `// TODO` / `g = 1,` / `) { … }`     | **0**       | 1              |
| `m(` / `g =` / `// TODO` / `1,` / `) { … }` | 1           | 1              |

## Root cause

The class search reads a member's parameters as code: each default through `findMatchesInExpression`
(`packages/ts/src/helpers/body-traversal.ts:260`), and a destructured parameter's defaults and keys
through `bindingPatternMatches`. A comment matcher searches those same expressions, so it misses a comment
attached to the parameter itself, and one written inline on the same line between `=` and the default —
though one on its own line there is seen (the table's last row). Why the inline one escapes the
default's search is not measured. The function search starts a comment matcher at the declaration
instead, so it reads every comment in the parameter list.

## Fix

Not decided. The candidate that turned the pin red searches each parameter of a class member with the
comment matcher, beside its body. Two questions for the fix:

- **Identities.** A newly reported comment in a parameter sits between comments the class search reads
  now, so it would take an accepted one's ordinal in a baseline unless it is numbered after them, as the
  class search does for the code 0300 and 0309 made it read.
- **Duplicates.** A comment inside a default is found by the default's search already; a parameter
  search must not report it a second time.

## Related

- [0314](./fixed/0314-the-function-rules-read-no-parameter-default.md) — the function side, fixed.

## Verification

- [x] reproduced and pinned —
      `packages/ts/tests/conditions/class-search-reads-no-comment-on-a-parameter.test.ts` ·
      `it('KNOWN GAP — a comment on a parameter or inline in its default passes a class comment rule')`,
      with the function rules and a comment in a member's body as controls.
- [x] the pin goes red when the class search reads each parameter for comments (the sabotage run of
      0314's PR, row S7).
- [ ] the fix, numbered after the comments the class search reads today, with no comment reported twice
- [ ] the test asserting the fixed behaviour
- [ ] a changeset
- [ ] `npm run validate` green.

Deferred: none.
