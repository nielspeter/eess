import { describe, it, expect } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Project } from 'ts-morph'
import { modules } from '../../src/builders/module-rule-builder.js'
import { noDeadModules } from '../../src/rules/hygiene.js'
import { generateBaseline, withBaseline } from '../../src/helpers/baseline.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0159, the half that is still open. Within one run, `disambiguateIdentities` separates
 * two orphan `index.ts` files by position (`#1`). Across runs it cannot: `beImported` gives an
 * orphan no `identity`, a basename `element` and a basename `message`, so every orphan
 * `index.ts` in the project has one identity. Fix the orphan you baselined, add a different
 * one, and the baseline forgives the new one.
 *
 * KNOWN GAP — this pins today's behaviour. When the identity carries the path (plan 0346),
 * the assertion flips: the new orphan must be reported.
 */
function project(files: Record<string, string>): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  for (const [f, t] of Object.entries(files)) tsm.createSourceFile(f, t)
  return {
    tsConfigPath: '/proj/tsconfig.json',
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

const orphans = (p: ArchProject) =>
  modules(p)
    .that()
    .resideInFolder('**/src/**')
    .should()
    .satisfy(noDeadModules())
    .rule({ id: 'test/0159-cross-run' })
    .violations()

describe('bug 0159: a baselined orphan forgives the next orphan of the same name', () => {
  it('KNOWN GAP — fixing the baselined orphan and adding another leaves the build green', () => {
    // Run 1: src/a/index.ts is the only orphan (c.ts and b/index.ts import each other).
    const run1 = project({
      '/proj/src/a/index.ts': 'export const a = 1\n',
      '/proj/src/b/index.ts': "import { c } from '../c'\nexport const b = c\n",
      '/proj/src/c.ts': "import { b } from './b/index'\nexport const c = typeof b\n",
    })
    const before = orphans(run1)
    expect(before.map((v) => v.file)).toEqual(['/proj/src/a/index.ts'])
    const baseline = path.join(mkdtempSync(path.join(tmpdir(), 'eess-0159-')), 'baseline.json')
    generateBaseline([...before], baseline, { root: '/proj' })

    // Run 2: a/index.ts is now imported; b/index.ts is the new orphan.
    const run2 = project({
      '/proj/src/a/index.ts': "import { c } from '../c'\nexport const a = c\n",
      '/proj/src/b/index.ts': 'export const b = 1\n',
      '/proj/src/c.ts': "import { a } from './a/index'\nexport const c = typeof a\n",
    })
    const after = orphans(run2)
    expect(after.map((v) => v.file)).toEqual(['/proj/src/b/index.ts'])

    // The correct answer is ['/proj/src/b/index.ts']: a finding nobody reviewed. Today the
    // baseline entry written for a/index.ts accepts it.
    expect(withBaseline(baseline, { root: '/proj' }).filterNew([...after])).toEqual([])
  })
})
