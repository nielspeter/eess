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
  todo(name: string): void
  each(table: readonly unknown[]): (name: string, fn?: () => void) => void
  skipIf(condition: boolean): (name: string, fn?: () => void) => void
}
declare function describe(name: string, fn?: () => void): void
declare function test(name: string, fn?: () => void): void

// A skipped test is documentation of a known gap — an ADR citing one is a
// project being honest about what is not yet enforced. That is the case this
// bug broke hardest.
it.skip('a documented pending guarantee', () => {})
it.only('a focused guarantee', () => {})
it.concurrent('a concurrent guarantee', () => {})

// `it.todo` has no body at all, and is citable — a wider widening than the
// skip/only/concurrent the record enumerates, so it is pinned rather than left
// to be discovered.
it.todo('a todo guarantee')

// Not citable, each for a different reason — and the reasons are not
// interchangeable, which is why they are separate rows in `0008-not-tests.md`:
//
//  - `describe` names a suite, not a guarantee. Excluded by root.
//  - `it.each(…)(…)` has a templated title with no static text to cite.
//  - `it.skipIf(cond)(…)` DOES have a static title and is still excluded — the
//    callee is a call, so the root is the whole `it.skipIf(true)` text. That is
//    0105's symptom surviving in a narrower form; scope, not oversight (0117).
//  - `test(…)` is the alias `gherkin-ts` accepts and md↔ts deliberately does
//    not. Nothing pinned that choice until this line, so widening the guard to
//    match its sibling was a silently-green change.
it.each([1, 2])('a templated guarantee %s', () => {})
it.skipIf(true)('a conditionally skipped guarantee', () => {})
describe('a suite that is not a test', () => {})
test('an alias-defined guarantee', () => {})

export {}
