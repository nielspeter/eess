# Bug 0383: `extendType`'s alias reading stops at one level

## Status

- **State:** Draft — measured by review of the 0376 fix; no red test yet.
- **Severity:** High — **a selector that silently matches less than it should.**
  `extendType('BaseConfig')` misses aliases that reach `BaseConfig` the way ADR-017 rule 1
  says the relation reaches: at any depth. Nothing reports it.
- **Origin:** enforcement and method review of
  [0376](./fixed/0376-extendtype-on-a-type-alias-reads-the-alias-name.md)'s fix, recorded
  rather than folded in.
- **Reported:** 2026-10-04

## Symptom

0376 reads an alias's type node as an intersection of members, each matched by name, by
resolved symbol, or through the member interface's `extends` chain. Measured with
`extendType('BaseConfig')`, these escape:

| alias                                                               | selected                                |
| ------------------------------------------------------------------- | --------------------------------------- |
| `type Derived = Inner & {c}`, where `type Inner = BaseConfig & {b}` | **no**                                  |
| `type M = Mid`, where `interface Mid extends BaseConfig`            | **no** (`Mid & {}` is selected)         |
| `Partial<BaseConfig> & {c}`, `Omit<BaseConfig,'a'> & {c}`           | **no** (`Partial<BaseConfig>` alone is) |
| `Partial<Mid>`                                                      | no                                      |
| `SubClass & {c}` by `extendType('BaseClass')`                       | **no** (`BaseClass & {c}` is)           |
| `typeof cfg & {c}`, a conditional type                              | no                                      |

The cause: `intersectionNames` (`packages/ts/src/predicates/type.ts`) only climbs a member
that resolves to an interface. A member that is itself an intersection alias has no symbol; a
bare type reference never reaches the intersection reader; a generic wrapper is not a plain
reference; a class member is not walked.

## Open question this record owns

Whether a generic wrapper — `Partial<BaseConfig>` — should count as extending `BaseConfig` at
all. It matches today only because the printed-type test sees the name in it
([0384](./0384-extendtype-printed-type-matches-by-module-path.md)). 0376 kept it so as not to
narrow a selection silently, and decided nothing.

## Fix

Not decided: resolve each member to its declaration and apply the same reading recursively
(alias → its type node, interface → its chain, class → its heritage), with a visited set.
Decide the wrapper question first. It shares its shape with
[0375](./0375-the-heritage-walk-cannot-climb-three-resolved-shapes.md) — splitting an intersection
into its members and following each — so the two are likely one fix.

## Verification

- [ ] red tests for the table's shapes, through `types(p).that().extendType(…)`
- [ ] the wrapper question decided and recorded in ADR-017
- [ ] the fix
- [ ] `npm run validate` green.

Deferred: none.
