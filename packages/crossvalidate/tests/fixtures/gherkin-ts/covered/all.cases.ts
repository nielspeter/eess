// Cites every scenario in the set — the dup scenarios need their full path
// (a bare `dup.feature` suffix is ambiguous). Parsed, never executed.
declare function it(name: string, fn?: () => void): void

it('checkout.feature › Apply a valid code', () => {})
it('checkout.feature › Reject an already-used code', () => {})
it('features/dup.feature › A dup scenario', () => {})
it('features/nested/dup.feature › Another dup scenario', () => {})

export {}
