// Fixture source for md↔ts: parsed by ts-morph, never executed. Its own project
// (`orphan/tsconfig.json`) so it holds exactly ONE test — that is the point.
//
// Bug 0104's false green: an ADR citing `it('catches `GONE` in a deleted test')`
// names a test that exists nowhere. Under the old grammar both sides truncated
// at the first backtick, so the citation keyed on `catches ` and resolved
// against this survivor. Rename the cited test and the gate stayed green.
declare function it(name: string, fn?: () => void): void

it('catches `TODO` in a comment', () => {})

export {}
