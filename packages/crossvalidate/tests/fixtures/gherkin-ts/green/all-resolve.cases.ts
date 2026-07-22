// Fixture source for gherkin↔ts: parsed by ts-morph, never executed (named
// `.cases.ts` so vitest ignores it). `it` is declared, not imported, so the
// file typechecks on its own.
declare function it(name: string, fn?: () => void): void

// A string-literal citation that resolves to a real scenario.
it('checkout.feature › Apply a valid code', () => {})

// A no-substitution template-literal citation — must still be seen.
it(`checkout.feature › Reject an already-used code`, () => {})

// A plain, non-citing test — must be ignored.
it('adds two numbers', () => {})

export {}
