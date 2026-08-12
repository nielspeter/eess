// Fixture source for md↔ts: parsed by ts-morph, never executed (named
// `.cases.ts` so vitest ignores it). `it` is declared, not imported, so the file
// typechecks on its own.
//
// Bug 0104: the first two titles are identical up to their first backtick. The
// old grammar keyed both on `catches `, so a citation naming one of them matched
// two tests and the gate reported an ambiguity — over a citation that names
// exactly one test.
declare function it(name: string, fn?: () => void): void

it('catches `HACK` in a comment', () => {})
it('catches `any` in a return position', () => {})

// The other two delimiters, each holding a quote of a different kind.
it("keeps a 'single quote' inside a double-quoted title", () => {})
it(`keeps a 'single quote' inside a template title`, () => {})

// An escaped delimiter inside the title. Written with both quote kinds present
// so prettier cannot restyle it — the raw source text is the correspondence key.
it('it\'s a "quoted" phrase', () => {})

export {}
