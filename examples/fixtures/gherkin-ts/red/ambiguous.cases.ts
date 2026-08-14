declare function it(name: string, fn?: () => void): void

// `dup.feature` matches both features/dup.feature and features/nested/dup.feature.
it('dup.feature › A dup scenario', () => {})

export {}
