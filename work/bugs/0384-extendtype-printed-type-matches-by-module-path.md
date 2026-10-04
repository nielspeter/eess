# Bug 0384: `extendType`'s printed-type test matches a module path and some generic arguments

## Status

- **State:** Draft — measured by review of the 0376 fix; predates it; no red test yet.
- **Severity:** Medium — **a selector that matches more than it should.** That fails closed for
  a plain selector (more is checked), but under `not(extendType(…))` it narrows, and it makes
  the predicate's meaning depend on file names.
- **Origin:** enforcement review of
  [0376](./fixed/0376-extendtype-on-a-type-alias-reads-the-alias-name.md)'s fix, which kept
  this test beside its new reader so that nothing that matched would stop matching.
- **Reported:** 2026-10-04

## Symptom

For a type alias, `extendType` tests a word-boundary regex against the alias's printed type
(`element.getType().getText()` in `packages/ts/src/predicates/type.ts`). Measured with
`extendType('BaseConfig')`:

- `type A = Unrel`, where `Unrel` lives in `/src/BaseConfig.ts`, prints as
  `import("/src/BaseConfig").Unrel` and **is selected** — by its module path.
- `Map<string, BaseConfig>` is selected; `Promise<BaseConfig>`, `Array<BaseConfig>`,
  `BaseConfig[]`, `Record<string, BaseConfig>` and `() => BaseConfig` are not — they print as
  the alias's own name. Which holders match depends on how the checker prints them.

The code comment credits the word boundary with excluding `{ bar: BaseConfig }`; the real
reason is that such an alias prints as its own name.

## Fix

Not decided, and tied to [0383](./0383-extendtype-stops-at-one-alias-level.md)'s wrapper
question: once the type node is read fully, the printed-type test may be removable — which
would narrow selections, a marked break that needs the wrapper question answered first.

## Verification

- [ ] a red test: the module-path alias is not selected
- [ ] the fix, with any narrowing stated as a break
- [ ] `npm run validate` green.

Deferred: none.
