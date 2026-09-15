import { describe, it, expect, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { scanCardinalityAssertions } from './scan-cardinality-assertions.js'

/**
 * Bug 0313 — the scan read every `.test.ts` under `tests/`, and
 * `warn-survives-the-test-runner.test.ts` writes count-only probe files into
 * `tests/__generated__/` while it runs. A scan collected at that moment counted them, and both of the
 * scan's own tests failed with nothing changed.
 *
 * Measured on a throwaway tree, never on this repo's: a count-only probe written into the real
 * `tests/__generated__` would be read by a real scan collected before the fix — the race itself.
 *
 * The scan skips `tests/__generated__`, the directory the repo gitignores and `tsconfig.json`
 * excludes, without looking inside it. It still reads everything else: a nested directory, a
 * directory of that name deeper down, one whose name only starts with it, and a dot-directory. The
 * assertion is spelled in two pieces so this file is not itself a count-only block to the real scan.
 */
const COUNT_ONLY = `toHave${'Length'}(4)`

function block(): string {
  return [
    `import { describe, it, expect } from 'vitest'`,
    ``,
    `describe('probe', () => {`,
    `  it('reports it and passes', () => {`,
    `    const v = [1, 2, 3, 4]`,
    `    expect(v).${COUNT_ONLY}`,
    `  })`,
    `})`,
    ``,
  ].join('\n')
}

const roots: string[] = []

afterAll(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true })
})

describe('bug 0313: the cardinality scan skips generated probes', () => {
  it('the scan skips tests/__generated__ and reads every other test file', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0313-'))
    roots.push(root)
    const files = [
      'tests/plain.test.ts',
      'tests/nested/deep.test.ts',
      'tests/nested/__generated__/kept.test.ts',
      'tests/__generated__-archive/kept.test.ts',
      'tests/.dotted/dot.test.ts',
      'tests/__generated__/run-1/probe.test.ts',
      'tests/__generated__/stale.test.ts',
    ]
    for (const file of files) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
      fs.writeFileSync(path.join(root, file), block())
    }
    // A directory in tests/__generated__ that cannot be listed. A scan that walked into
    // tests/__generated__ and dropped its files afterwards would throw here, as a probe directory
    // deleted mid-walk does; one that skips it never looks.
    const locked = path.join(root, 'tests/__generated__/locked')
    fs.mkdirSync(locked)
    fs.chmodSync(locked, 0o000)
    try {
      expect(() => fs.readdirSync(locked), 'the locked directory must be unreadable').toThrow()

      const { population } = scanCardinalityAssertions(root)

      // `.gitignore` names `packages/*/tests/__generated__/` alone: a directory of that name deeper
      // down, or one whose name only starts with it, would be committed code, and is read.
      expect([...new Set(population.map((b) => b.file))].sort()).toEqual([
        'tests/.dotted/dot.test.ts',
        'tests/__generated__-archive/kept.test.ts',
        'tests/nested/__generated__/kept.test.ts',
        'tests/nested/deep.test.ts',
        'tests/plain.test.ts',
      ])
    } finally {
      fs.chmodSync(locked, 0o700)
    }
  })
})
