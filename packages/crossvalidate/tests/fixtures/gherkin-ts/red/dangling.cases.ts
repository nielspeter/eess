declare function it(name: string, fn?: () => void): void

// Cites a feature file that is not in the set → dangling reference.
it('ghost.feature › Some scenario', () => {})

export {}
