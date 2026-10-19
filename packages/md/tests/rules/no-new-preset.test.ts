import { describe, it, expect } from 'vitest'
import { dirname, join } from 'node:path'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * ADR-022 clause 4 — eess-md adds no preset. The two that ship (`honestyAtClose`, `adrEnforcement`)
 * stay; a new document shape ships as an example under `examples/` (clause 2). A preset reaches an
 * adopter through a module under `src/rules/` or a subpath in `exports`, so both are pinned. Adding
 * one means changing this test, which a reviewer reads against ADR-022: a change detector, not a
 * gate a reviewed preset cannot pass. The whole `exports` map is pinned, so a non-preset subpath is
 * added the same way, by an edit a reviewer reads.
 *
 * What it cannot see (ADR-016 rule 7): a preset written anywhere else and exported from the root.
 * That is clause 1's (the root fixes no shape), held by review.
 */
const pkg = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

describe('ADR-022: eess-md adds no preset', () => {
  it('src/rules holds the two shipped presets and nothing else', () => {
    const modules = readdirSync(join(pkg, 'src', 'rules')).sort()
    expect(modules).toEqual(['adr.ts', 'ledger.ts'])
  })

  it('the exports map names the root, the two presets and the internal entry only', () => {
    const manifest: unknown = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8'))
    const exportsMap =
      typeof manifest === 'object' && manifest !== null && 'exports' in manifest
        ? manifest.exports
        : undefined
    expect(typeof exportsMap).toBe('object')
    expect(Object.keys(exportsMap ?? {}).sort()).toEqual([
      '.',
      './internal',
      './rules/adr',
      './rules/ledger',
    ])
  })
})
