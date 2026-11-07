import { describe, expect, it, vi } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { isArchRuleError } from '@nielspeter/eess'
import { corpus } from '@nielspeter/eess-md'
import { project } from '@nielspeter/eess-ts'
import { adrCitationsResolve } from '../src/md-ts.js'

// Bug 0577: a preset under `report: 'warn'` printed an unsuppressable configuration finding and
// returned, so the run exited 0. Driven through a real preset, as an adopter wires it.
const root = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/citations')
const run = (report: 'warn' | 'return') =>
  adrCitationsResolve(
    corpus({ roots: ['docs/adr/0001-good.md'], cwd: root }),
    project(join(root, 'tsconfig.json')),
    {
      dir: 'docs/none/**',
      expectNonEmpty: true,
      report,
    },
  )

describe("a preset's report: 'warn' fails on a configuration finding (bug 0577)", () => {
  it('CONTROL: under return, the configuration finding is handed back', () => {
    const v = run('return')
    expect(v.map((x) => [x.bypassFilters, x.message])).toEqual([
      [true, expect.stringMatching(/\.expectNonEmpty\(\)/)],
    ])
  })

  it('under warn, it is printed and thrown, so the run fails', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    let thrown: unknown
    try {
      run('warn')
    } catch (e) {
      thrown = e
    } finally {
      spy.mockRestore()
    }
    expect(isArchRuleError(thrown)).toBe(true)
    if (!isArchRuleError(thrown)) return
    expect(thrown.violations.map((x) => x.message)).toEqual([
      expect.stringMatching(/\.expectNonEmpty\(\)/),
    ])
  })
})
