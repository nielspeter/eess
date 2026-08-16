import path from 'node:path'
import { describe, it, expect, beforeEach } from 'vitest'
import { workspace, resetProjectCache } from '../../src/core/project.js'
import { importFrom, havePathMatching } from '../../src/predicates/module.js'

const fixture = path.resolve(import.meta.dirname, '../fixtures/workspace-roots')

/**
 * `importFrom` and `havePathMatching` accept a project-relative glob per
 * package — plan 0148 punch list. Both sites were wired (threading
 * `rootOf(sourceFile)`/a `relativeToRoot` fallback) but had no test that
 * would fail if the wiring were reverted.
 */
describe('module predicates resolve per package in a workspace (plan 0148)', () => {
  beforeEach(() => {
    resetProjectCache()
  })

  it("havePathMatching matches a file's own path in EVERY package, not just the tie-break winner", () => {
    const alpha = path.join(fixture, 'packages/alpha/tsconfig.json')
    const beta = path.join(fixture, 'packages/beta/tsconfig.json')
    const ws = workspace([alpha, beta])
    const pred = havePathMatching('src/api/handler.ts')

    const alphaHandler = ws
      .getSourceFiles()
      .find((f) => f.getFilePath().endsWith('/packages/alpha/src/api/handler.ts'))!
    const betaHandler = ws
      .getSourceFiles()
      .find((f) => f.getFilePath().endsWith('/packages/beta/src/api/handler.ts'))!

    expect(pred.test(alphaHandler)).toBe(true)
    expect(pred.test(betaHandler)).toBe(true)
  })

  it('importFrom matches an importer whose target resolves relative to ITS OWN package root', () => {
    const alpha = path.join(fixture, 'packages/alpha/tsconfig.json')
    const beta = path.join(fixture, 'packages/beta/tsconfig.json')
    const ws = workspace([alpha, beta])

    const alphaConsumer = ws._project.createSourceFile(
      path.join(fixture, 'packages/alpha/src/consumer.ts'),
      "import { alphaApi } from './api/handler.js'\nconsole.log(alphaApi)\n",
    )
    const betaConsumer = ws._project.createSourceFile(
      path.join(fixture, 'packages/beta/src/consumer.ts'),
      "import { betaApi } from './api/handler.js'\nconsole.log(betaApi)\n",
    )

    const pred = importFrom('src/api/**')
    expect(pred.test(alphaConsumer)).toBe(true)
    expect(pred.test(betaConsumer)).toBe(true)
  })

  it('CONTROL: havePathMatching does not match a folder no package has', () => {
    const alpha = path.join(fixture, 'packages/alpha/tsconfig.json')
    const beta = path.join(fixture, 'packages/beta/tsconfig.json')
    const ws = workspace([alpha, beta])
    const pred = havePathMatching('src/nonexistent/handler.ts')
    const alphaHandler = ws
      .getSourceFiles()
      .find((f) => f.getFilePath().endsWith('/packages/alpha/src/api/handler.ts'))!
    expect(pred.test(alphaHandler)).toBe(false)
  })
})
