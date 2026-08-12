// Fixture source for md↔ts: parsed by ts-morph, never executed.
//
// Bug 0105: `extractTestDefs` filtered on the FULL callee text (`getName() !==
// 'it'`), and eess-ts names a modifier call by its whole member expression — so
// `it.skip(…)` is `'it.skip'` and was dropped one line before its title was ever
// read. The three modifier forms below must resolve; the two shapes after them
// must not, and must keep not resolving.
declare const it: {
  (name: string, fn?: () => void): void
  skip(name: string, fn?: () => void): void
  only(name: string, fn?: () => void): void
  concurrent(name: string, fn?: () => void): void
  each(table: readonly unknown[]): (name: string, fn?: () => void) => void
}
declare function describe(name: string, fn?: () => void): void

// A skipped test is documentation of a known gap — an ADR citing one is a
// project being honest about what is not yet enforced. That is the case this
// bug broke hardest.
it.skip('a documented pending guarantee', () => {})
it.only('a focused guarantee', () => {})
it.concurrent('a concurrent guarantee', () => {})

// Not tests, and not citable. `it.each(…)(…)` has a templated title with no
// static text to cite; `describe` names a suite, not a guarantee.
it.each([1, 2])('a templated guarantee %s', () => {})
describe('a suite that is not a test', () => {})

export {}
