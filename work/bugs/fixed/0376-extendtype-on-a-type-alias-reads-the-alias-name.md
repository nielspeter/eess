# Bug 0376: `extendType` on a type alias reads the alias's own name

## Status

- **State:** Fixed — the alias's type node is read: an intersection member counts, as written,
  as resolved, or through its interface chain. What matched before still matches.
- **Severity:** High — **a selector that matches almost nothing.** `extendType('BaseConfig')`
  does not select `type AliasDirect = BaseConfig & { b: 1 }`, and nothing says the branch
  could not see.
- **Origin:** self-found — testing review of the 0295 fix, recorded rather than folded in.
- **Reported:** 2026-10-04

## Symptom

_The code pointer below is to main at filing, before the fix._

For a type alias, `extendType` tests a word-boundary regex against
`element.getType().getText()` (`packages/ts/src/predicates/type.ts:97`). Measured, that text
is the alias's own name for most aliases:

| alias                                      | `getType().getText()`              | matched       |
| ------------------------------------------ | ---------------------------------- | ------------- |
| `type AliasDirect = BaseConfig & { b: 1 }` | `import("/a").AliasDirect`         | **no**        |
| `type Plain = BaseConfig`                  | `import("/a").BaseConfig`          | yes           |
| `type Wrapped = { inner: BaseConfig }`     | `import("/a").Wrapped`             | no (intended) |
| `type Partial2 = Partial<BaseConfig>`      | `Partial<import("/a").BaseConfig>` | yes           |

The intersection, the alias shape most likely to mean "extends", is the one that misses.

## Fix — as filed

Not decided. Read the alias's type node rather than its printed type, and decide which
shapes count as "extends": an intersection member, yes; a wrapping object, no (the current
comment says so); a generic wrapper such as `Partial<…>`, to be decided.

ADR-017 rule 3 says the alias reading is "unchanged" by 0295. That is true, and this record
is why "unchanged" is not the same as "works".

## Decision

The record's three shapes, decided under ADR-017's rule that a heritage walk only adds:

- **an intersection member — yes**, read from the alias's type node, as written, as resolved
  (an aliased import), or through the member interface's own `extends` chain (ADR-017 rule
  1's relation). Parentheses and nested intersections are looked through.
- **a wrapping object (`{ inner: BaseConfig }`) — no**, as the code's comment always said.
- **a generic wrapper (`Partial<BaseConfig>`) — kept**, because the printed-type test already
  matched it and dropping it would narrow selections silently. Whether it _should_ count is
  not decided here — [0383](../0383-extendtype-stops-at-one-alias-level.md) owns the question.

`intersectionNames` in `packages/ts/src/predicates/type.ts` reads the node; the printed-type
test stays beside it, so the predicate only gains matches. A union member does not count.

## Verification

- [x] a red test through `types(p).that().extendType(…)` on an intersection alias —
      `packages/ts/tests/predicates/extendtype-reads-an-alias-type-node.test.ts` ·
      `it('selects an intersection alias that names the type, wherever it sits in the intersection')`
      and `it('selects an intersection member written through an aliased import or reaching the type by its chain')`,
      both red before the fix; `it('keeps what matched before, and does not select a type that only holds the named one')`
      pins the other direction and passes on both.
- [x] the fix — `intersectionNames`, beside the printed-type test; ADR-017 rule 3 and its C3
      row amended, and the 0.12 migration page moves this from "does not fix" to fixed.
- [x] `npm run validate` green on `afa63c3` (exit 0, 530 s). The review commit after it adds
      tests and changes records and docs; the eess-ts suite and fast gates pass on it.
- [x] after review: tests pin the alias reader's other branches —
      `it('reads a member by its written name when it cannot be resolved')` and
      `it('looks through parentheses and nested intersections, and does not read a union')`;
      removing the written arm, the parenthesis look-through, the nested recursion, or the
      union exclusion each reds one (measured). Before them, all four could be removed with
      every test green.

Review found shapes the alias reading still misses — an alias of an intersection alias, a plain
alias of a sub-interface, a wrapped member, a class member — and owns the open `Partial<…>`
question: deferred→[0383](../0383-extendtype-stops-at-one-alias-level.md). And the printed-type
test it kept can select by a module's file name: deferred→[0384](../0384-extendtype-printed-type-matches-by-module-path.md).

Deferred: [0383](../0383-extendtype-stops-at-one-alias-level.md),
[0384](../0384-extendtype-printed-type-matches-by-module-path.md).
