// Fixture source for gherkin↔ts: parsed by ts-morph, never executed.
//
// Bug 0104: the cited scenario title names a symbol in backticks inside a
// single-quoted `it()`. The old grammar ended the title at that backtick, so the
// citation became `discount.feature › Reject a ` — a scenario that does not
// exist — and the gate reported the citation dangling while the scenario it
// names sits right there in the feature file.
declare function it(name: string, fn?: () => void): void

it('discount.feature › Reject a `SAVE10` code that was already used', () => {})

export {}
