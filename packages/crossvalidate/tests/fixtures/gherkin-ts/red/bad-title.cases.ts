declare function it(name: string, fn?: () => void): void

// Resolves to checkout.feature, but no scenario has this title.
it('checkout.feature › No Such Scenario', () => {})

export {}
