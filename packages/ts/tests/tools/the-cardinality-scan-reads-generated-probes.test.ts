import { describe, it, expect, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { scanCardinalityAssertions } from './scan-cardinality-assertions.js'

/**
 * Bug 0313 — the scan reads every `.test.ts` under `tests/`, and
 * `warn-survives-the-test-runner.test.ts` writes count-only probe files into
 * `tests/__generated__/` while it runs. A scan collected at that moment counts them.
 *
 * Measured on a throwaway tree, never on this repo's: a count-only probe written into the real
 * `tests/__generated__` would be read by the real scan — the race this record is about.
 *
 * The KNOWN GAP test asserts today's behaviour; fixing 0313 turns it red. A count-only file outside
 * `__generated__` is in the same list as its control. The assertion is spelled in two pieces so this
 * file is not itself a count-only block to the real scan.
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

describe('bug 0313: the cardinality scan reads generated probes', () => {
  it('KNOWN GAP — a count-only probe under tests/__generated__ joins the scanned population', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0313-'))
    roots.push(root)
    fs.mkdirSync(path.join(root, 'tests/__generated__/run-1'), { recursive: true })
    fs.writeFileSync(path.join(root, 'tests/plain.test.ts'), block())
    fs.writeFileSync(path.join(root, 'tests/__generated__/run-1/probe.test.ts'), block())

    const { population } = scanCardinalityAssertions(root)

    expect([...new Set(population.map((b) => b.file))].sort()).toEqual([
      'tests/__generated__/run-1/probe.test.ts',
      'tests/plain.test.ts',
    ])
  })
})
