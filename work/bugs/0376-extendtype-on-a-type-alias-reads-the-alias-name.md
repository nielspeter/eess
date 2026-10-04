# Bug 0376: `extendType` on a type alias reads the alias's own name

## Status

- **State:** Draft — measured by a probe; no red test yet. Predates 0295.
- **Severity:** High — **a selector that matches almost nothing.** `extendType('BaseConfig')`
  does not select `type AliasDirect = BaseConfig & { b: 1 }`, and nothing says the branch
  could not see.
- **Origin:** self-found — testing review of the 0295 fix, recorded rather than folded in.
- **Reported:** 2026-10-04

## Symptom

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

## Fix

Not decided. Read the alias's type node rather than its printed type, and decide which
shapes count as "extends": an intersection member, yes; a wrapping object, no (the current
comment says so); a generic wrapper such as `Partial<…>`, to be decided.

ADR-017 rule 3 says the alias reading is "unchanged" by 0295. That is true, and this record
is why "unchanged" is not the same as "works".

## Verification

- [ ] a red test through `types(p).that().extendType(…)` on an intersection alias
- [ ] the fix
- [ ] `npm run validate` green.

Deferred: none.
