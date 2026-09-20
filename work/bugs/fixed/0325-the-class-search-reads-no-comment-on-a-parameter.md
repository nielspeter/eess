# Bug 0325: the class search reads no comment on a parameter

## Status

- **State:** Fixed — the class search reads the comments in a member's parameter list as a final
  pass, deduplicated by comment position; a member's own docstring is still not read, and under
  must-contain reach a comment inside a parameter's decorator is not. Red test first.
- **Severity:** High — **false green for a comment rule on classes.** `m(g = /* TODO */ 1)` and a
  `// TODO` on its own line before a parameter pass `classes().should().notContain(comment(/TODO/))`,
  while the function rules report both on the same member. No shipped class rule reads comments with a
  `comment()` matcher, so the gap is in rules adopters write.
- **Origin:** self-found · split from
  [0314](./0314-the-function-rules-read-no-parameter-default.md), whose record asked the class and
  function searches to agree on a comment in a parameter's default.
- **Reported:** 2026-09-19 · **Fixed:** 2026-09-20 (PR #147)

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

The class search read a member's parameters as code: each default through `findMatchesInExpression`
(`packages/ts/src/helpers/body-traversal.ts:410`), and a destructured parameter's defaults and keys
through `bindingPatternMatches` (`:379`). A comment matcher searches those same expressions, so it misses a comment
attached to the parameter itself, and one written inline on the same line between `=` and the default —
though one on its own line there is seen (the table's last row). **Why the inline one escapes is
now measured:** TypeScript's leading comment ranges begin after a line break, so a comment written
between `=` and the default on one line is leading trivia of neither the parameter nor the default,
and only a walk that starts at the parameter reaches it — as a trailing range of the name. The function search starts a comment matcher at the declaration
instead, so it reads every comment in the parameter list.

## Fix

**Ruled: the class search reads the comments in a member's parameter list, and no docstring.**
0307 ruled that a comment attached to a member's declaration is documentation, not code, and that
stands — measured, before this fix and after, a `/** TODO */` above a method is 0 for the class
rules. A comment inside the parameter list is the other side of that line: the function search
reports it on the same member, a class rule that cannot see a TODO marker there is a false green,
and the parameter list is where a reader looks for one. So the reach is the SPAN between a member's
`(` and `)`: every comment positioned inside it, whatever node it hangs from — which is also why no
docstring comes with it, since a docstring lies before the `(`.

**The span, and not each parameter, because the first version of this fix was measured wrong.** It
walked each `ParameterDeclaration`, and the enforcement review of the PR found six placements still
silent: a comment on the same line as the `(` or a `,` is trivia of that TOKEN, since TypeScript
starts collecting leading trivia only after a line break. `m(/* TODO */ g = 1)`, `m(a, /* TODO */ b)`
and a constructor's `constructor(/* TODO */ private x: number)` all stayed 0 while the docs said the
parameter list was read. The span answers by position instead of by node, and it subsumed the first
row of 0329, an empty parameter list.

The record's two questions, both answered by construction and each with a test:

- **Identities.** The pass runs LAST, after the four passes bugs 0300, 0307 and 0309 established,
  so a comment inside a default keeps the ordinal a baseline accepted and a newly read one is
  numbered after it.
- **Duplicates.** Deduplicated by the comment's own position against everything the earlier passes
  found. Measured: a comment on its own line inside a default is found by both the default's search
  and this pass, and is reported once.

**One thing the walk would have widened, and does not.** A parameter's decorators are
descendants of the parameter, and under `'member-code'` reach — what a must-contain rule reads —
0307 ruled that decorator code is wiring that must not satisfy a rule. A comment inside a
parameter's decorator, or written above it, is therefore left out under that reach and read under
`'all-code'`, like the decorator's code itself.

Measured, one member per shape, `comment(/TODO/)`, before and after:

| Member                                            | class, before | class, after | function rules |
| ------------------------------------------------- | ------------- | ------------ | -------------- |
| `m(g = /* TODO */ 1) { … }`                       | **0**         | 1            | 1              |
| `m(` / `// TODO` / `g = 1,` / `) { … }`           | **0**         | 1            | 1              |
| `m({ a = /* TODO */ 1 }) { … }`                   | **0**         | 1            | 1              |
| `m(g: /* TODO */ number) { … }`                   | **0**         | 1            | 1              |
| `m(/* TODO */ g = 1) { … }`                       | **0**         | 1            | 1              |
| `m(a: number, /* TODO */ b: number) { … }`        | **0**         | 1            | 1              |
| `constructor(/* TODO */ private x: number) {}`    | **0**         | 1            | 1              |
| `m(/* TODO */) { … }` — an empty list             | **0**         | 1            | 1              |
| `m(` / `g: number,` / `// TODO` / `) { … }`       | **0**         | 1            | 1              |
| `m() { const x = /* TODO */ 1; … }`               | 1             | 1            | 1              |
| `m(` / `g =` / `// TODO` / `1,` / `) { … }`       | 1             | 1            | 1              |
| `m(g = 1 /* TODO */) { … }`                       | 1             | 1            | 1              |
| `/** TODO */` above the member                    | 0             | 0            | 1              |
| `m(): /* TODO */ number { … }` — outside the span | 0             | 0            | 1              |

The last four rows are the boundary: what a reader sees inside the parentheses is read, the
docstring stays bug 0307's, and the return type stays bug 0329's.

## Related

- [0314](./0314-the-function-rules-read-no-parameter-default.md) — the function side, fixed.
- [0329](../0329-the-class-search-reads-no-comment-outside-a-members-parameters.md) — what this fix
  leaves: a comment attached to no parameter, in an empty parameter list, in a return type, or
  between `)` and `{`, measured while ruling here.

## Verification

- [x] reproduced and pinned — the KNOWN-GAP test filed with this record: a comment on a parameter
      or inline in its default passing a class comment rule, with the function rules, a comment in a
      member's body and one on its own line inside a default as controls. That file is replaced by
      the one below, so it is named here rather than cited.
- [x] the pin goes red when the class search reads each parameter for comments (the sabotage run of
      0314's PR, row S7).
- [x] the fix, numbered after the comments the class search reads today, with no comment reported
      twice — `packages/ts/tests/conditions/class-search-reads-a-comment-on-a-parameter.test.ts` ·
      `it('reports every comment in a parameter list, as the function rules do')`,
      `it('reports a comment the class search already read exactly once')` and
      `it('numbers a comment in the parameter list after the ones read before it')`. The KNOWN-GAP
      file is replaced, as 0323's was.
- [x] the ruling's two limits pinned —
      `it('still reads no docstring on the member itself (bug 0307)')` and
      `it('does not let a comment in a parameter decorator satisfy a must-contain rule')`.
- [x] a changeset — `.changeset/searches-read-every-shape.md`, a breaking `minor` for
      `@nielspeter/eess-ts`: a green class comment rule may now report a comment in a parameter list.
- [x] `docs/body-analysis.md` and `docs/standard-rules.md` say what a class comment rule reads.
- [x] Sabotage matrix over the two test files this PR adds, sources restored by sha256 and verified,
      the tree unchanged. R0, as built: nothing red. R1, the parameter pass reading nothing —
      the behaviour before this fix: four tests red. R2, no dedup: two red, the duplicate test among them. R3, a
      parameter decorator counted as member code: the decorator test red. R4, the pass numbered
      first: the order test red.
- [x] `npm run validate` green.

Deferred: none.
