import path from 'node:path'
import { describe, it, expect, beforeEach } from 'vitest'
import { workspace, resetProjectCache } from '../../src/core/project.js'
import { modules } from '../../src/builders/module-rule-builder.js'
import { ArchRuleError } from '@nielspeter/eess'

const fixture = path.resolve(import.meta.dirname, '../fixtures/workspace-roots')

/**
 * `onlyBeImportedVia` accepts a project-relative glob per package — plan
 * 0148 punch list. Confirmed live before this fix: `onlyBeImportedVia('src/**')`
 * produced a false violation for every importer, because the glob was
 * matched only against the importer's ABSOLUTE path — the exact bug-0037
 * shape this plan's other four sites already closed, just one file over.
 */
describe('onlyBeImportedVia resolves per package in a workspace (plan 0148)', () => {
  beforeEach(() => {
    resetProjectCache()
  })

  it('a project-relative allowlist accepts an importer in EVERY package, not just the tie-break winner', () => {
    const alpha = path.join(fixture, 'packages/alpha/tsconfig.json')
    const beta = path.join(fixture, 'packages/beta/tsconfig.json')
    const ws = workspace([alpha, beta])

    // Injected rather than baked into the shared fixture — other tests read
    // this same fixture tree and must not see new files.
    ws._project.createSourceFile(
      path.join(fixture, 'packages/alpha/src/api/consumer.ts'),
      "import { alphaApi } from './handler.js'\nconsole.log(alphaApi)\n",
    )
    ws._project.createSourceFile(
      path.join(fixture, 'packages/beta/src/api/consumer.ts'),
      "import { betaApi } from './handler.js'\nconsole.log(betaApi)\n",
    )

    expect(() => {
      modules(ws)
        .that()
        .resideInFile('src/api/handler.ts')
        .should()
        .onlyBeImportedVia('src/api/**')
        .check()
    }).not.toThrow()
  })

  it('CONTROL: an importer genuinely outside the allowlist still violates', () => {
    const alpha = path.join(fixture, 'packages/alpha/tsconfig.json')
    const beta = path.join(fixture, 'packages/beta/tsconfig.json')
    const ws = workspace([alpha, beta])

    ws._project.createSourceFile(
      path.join(fixture, 'packages/alpha/src/other/consumer.ts'),
      "import { alphaApi } from '../api/handler.js'\nconsole.log(alphaApi)\n",
    )

    expect(() => {
      modules(ws)
        .that()
        .resideInFile('src/api/handler.ts')
        .should()
        .onlyBeImportedVia('src/api/**')
        .check()
    }).toThrow(ArchRuleError)
  })
})
