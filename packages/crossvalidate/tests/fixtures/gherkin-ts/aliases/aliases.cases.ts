// Modifier + alias forms must be seen too — the old `getName() === 'it'` filter
// dropped these. Parsed by ts-morph, never executed.
declare const it: {
  (name: string, fn?: () => void): void
  only(name: string, fn?: () => void): void
}
declare function test(name: string, fn?: () => void): void

it.only('checkout.feature › Apply a valid code', () => {})
test('checkout.feature › Reject an already-used code', () => {})

export {}
