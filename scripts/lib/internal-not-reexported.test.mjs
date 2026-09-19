import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * ADR-011's boundary, checked rather than asserted: what a package puts behind `/internal` is family
 * plumbing, and its public barrel must never re-export it.
 *
 * The kernel has said this in `packages/core/src/internal.ts` since ADR-011, and nothing checked it; bug
 * 0287 added a second `/internal`, in eess-md, repeating the sentence. A clause whose mechanism is a
 * comment is the shape ADR-009 rules out — "a check that cannot fail is worth less than no check" — so
 * this is the mechanism, for every package that ships the subpath rather than for the two that do today.
 */

const PACKAGES = readdirSync('packages', { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)

/** Packages whose `exports` map declares `./internal`, with the barrel they must keep clear of it. */
const withInternal = PACKAGES.map((pkg) => {
  const manifest = JSON.parse(readFileSync(join('packages', pkg, 'package.json'), 'utf8'))
  return { pkg, name: manifest.name, exports: manifest.exports ?? {} }
}).filter((p) => p.exports['./internal'] !== undefined && p.exports['.'] !== undefined)

for (const { pkg, name } of withInternal) {
  test(`${name}'s barrel re-exports nothing from its /internal`, async () => {
    const [root, internal] = await Promise.all([import(name), import(`${name}/internal`)])
    const leaked = Object.keys(internal).filter((symbol) => symbol in root)
    assert.deepEqual(
      leaked,
      [],
      `${name} exports ${leaked.join(', ')} from both its root and its /internal — a symbol on the ` +
        `barrel is public API and a versioned commitment, which is what /internal exists not to be ` +
        `(ADR-011). Move it out of internal.ts, or off the barrel.`,
    )
    // A type-only `/internal` would make the check above vacuous by construction.
    assert.ok(
      Object.keys(internal).length > 0,
      `${name}/internal exports no runtime symbol, so this check compared nothing`,
    )
  })
}

test('the packages that ship /internal are found — an empty list checks nothing', () => {
  assert.ok(
    withInternal.length >= 2,
    `expected at least the kernel and eess-md to ship /internal, found ${withInternal.length}`,
  )
  assert.ok(PACKAGES.length >= 6, `only ${PACKAGES.length} packages walked`)
})
