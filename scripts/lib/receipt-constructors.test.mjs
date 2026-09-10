import { test } from 'node:test'
import assert from 'node:assert/strict'

/**
 * Bug 0276. ADR-014 makes the receipt the thing every emitter takes, and
 * `collectResult` / `mergeCollectResults` the two ways to build or combine one.
 * Plan 0089's standalone-sufficiency promise is that installing ONE dialect is
 * enough — a consumer never needs a second, direct `@nielspeter/eess` install.
 *
 * Those two commitments meet here: a dialect whose adopter can be handed a
 * receipt must let them construct one.
 *
 * **Why `check:family` cannot see this.** That gate is import-driven — a dialect
 * owes a re-export for every kernel symbol its OWN source imports. `eess-gherkin`
 * imports neither constructor, so it owes neither, and the gate is right to stay
 * green. This is the demand side: nothing asked whether a dialect publishes what
 * an ADR says an adopter needs. Measured before the fix — eess-ts had both,
 * eess-mermaid one, eess-md the other, eess-gherkin neither — while a changeset
 * pending in the same release said all of them had both.
 */
const REQUIRED = ['collectResult', 'mergeCollectResults']

// The dialects with a barrel. `eess-crossvalidate` ships flat entry files and no
// index, so it is deliberately not in this list rather than silently absent.
const DIALECTS = ['ts', 'mermaid', 'md', 'gherkin']

for (const dialect of DIALECTS) {
  const pkg = `@nielspeter/eess-${dialect}`
  test(`${pkg} publishes the receipt constructors ADR-014 requires`, async () => {
    const mod = await import(pkg)
    const missing = REQUIRED.filter((name) => typeof mod[name] !== 'function')
    assert.deepEqual(
      missing,
      [],
      `${pkg} does not publish ${missing.join(', ')} — a standalone consumer would ` +
        `need a second, direct @nielspeter/eess install to build or merge a receipt`,
    )
  })
}

test('the required set is real — every name is on the kernel root', async () => {
  // Guards the list above from rotting into a check of nothing: if a constructor
  // is renamed in the kernel, this fails rather than the four tests above quietly
  // asserting a symbol nobody exports any more.
  const kernel = await import('@nielspeter/eess')
  const absent = REQUIRED.filter((name) => typeof kernel[name] !== 'function')
  assert.deepEqual(absent, [], `not on the kernel root: ${absent.join(', ')}`)
})
