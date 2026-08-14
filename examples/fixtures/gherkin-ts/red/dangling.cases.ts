declare function it(name: string, fn?: () => void): void

// Cites a feature file that is not in the set — a dangling path.
it('ghost.feature › Some scenario', () => {})

export {}
