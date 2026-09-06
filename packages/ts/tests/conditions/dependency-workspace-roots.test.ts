import path from 'node:path'
import { describe, it, expect, beforeEach } from 'vitest'
import { workspace, resetProjectCache } from '../../src/core/project.js'
import { modules } from '../../src/builders/module-rule-builder.js'
import { dependOn } from '../../src/conditions/dependency.js'

const fixture = path.resolve(import.meta.dirname, '../fixtures/workspace-roots')

/**
 * `onlyImportFrom`/`notImportFrom`/`dependOn` (the `edgeCandidates`-backed
 * conditions) accept a project-relative glob per package — plan 0148 punch
 * list. These sites were wired (`edgeCandidates(edge, sourceFile)` threads
 * `rootOf(sourceFile)`) but had no test that would fail if the wiring were
 * reverted; this file is that test.
 */
describe('dependency conditions resolve per package in a workspace (plan 0148)', () => {
  beforeEach(() => {
    resetProjectCache()
  })

  function loadWithConsumers() {
    const alpha = path.join(fixture, 'packages/alpha/tsconfig.json')
    const beta = path.join(fixture, 'packages/beta/tsconfig.json')
    const ws = workspace([alpha, beta])
    // Injected rather than baked into the shared fixture tree — other tests
    // read these same files and must not see new ones.
    ws._project.createSourceFile(
      path.join(fixture, 'packages/alpha/src/consumer.ts'),
      "import { alphaApi } from './api/handler.js'\nconsole.log(alphaApi)\n",
    )
    ws._project.createSourceFile(
      path.join(fixture, 'packages/beta/src/consumer.ts'),
      "import { betaApi } from './api/handler.js'\nconsole.log(betaApi)\n",
    )
    return ws
  }

  it('onlyImportFrom accepts a project-relative glob for the importer in EVERY package', () => {
    const ws = loadWithConsumers()
    expect(() => {
      modules(ws)
        .that()
        .resideInFile('**/consumer.ts')
        .should()
        .onlyImportFrom('src/api/**')
        .check()
    }).not.toThrow()
  })

  it('notImportFrom correctly flags a project-relative glob match in EVERY package, not just the tie-break winner', () => {
    const ws = loadWithConsumers()
    const rule = modules(ws)
      .that()
      .resideInFile('**/consumer.ts')
      .should()
      .notImportFrom('src/api/**')
    // Both alpha's and beta's consumer.ts import their own package's src/api/handler.ts —
    // if the relative candidate were only threaded for one package (the pre-fix
    // tie-break-winner bug), only one violation would be reported here.
    expect(rule.violations()).toHaveLength(2)
  })

  it('dependOn (satisfy form) accepts a project-relative glob for the importer in EVERY package', () => {
    const ws = loadWithConsumers()
    const rule = modules(ws)
      .that()
      .resideInFile('**/consumer.ts')
      .should()
      .satisfy(dependOn('src/api/**'))
    expect(rule.violations()).toHaveLength(0)
  })

  it('CONTROL: a target genuinely outside the allowlist still violates onlyImportFrom', () => {
    const ws = loadWithConsumers()
    const rule = modules(ws)
      .that()
      .resideInFile('**/consumer.ts')
      .should()
      .onlyImportFrom('src/nonexistent/**')
    expect(rule.violations()).toHaveLength(2)
  })
})
