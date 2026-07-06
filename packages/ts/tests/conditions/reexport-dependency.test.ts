import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import path from 'node:path'
import { notImportFrom, dependOn } from '../../src/conditions/dependency.js'
import { notImportFrom as notImportFromPredicate } from '../../src/predicates/module.js'
import type { ConditionContext } from '@nielspeter/eess'

// `export … from` re-exports are real dependency edges — the re-exporting module
// depends on the target exactly as an `import` would. ts-morph's
// getImportDeclarations() misses them, so before the getDependencyDecls() fix a
// forbidden edge could hide behind a re-export and pass a rule that should fail.
const fixturesDir = path.resolve(import.meta.dirname, '../fixtures/modules')
const project = new Project({ tsConfigFilePath: path.join(fixturesDir, 'tsconfig.json') })
const ctx: ConditionContext = { rule: 'test rule' }

function sf(relativePath: string) {
  const fullPath = path.join(fixturesDir, relativePath)
  const found = project.getSourceFile(fullPath)
  if (!found) throw new Error(`Fixture not found: ${fullPath}`)
  return found
}

describe('re-export dependency edges (export … from)', () => {
  it('notImportFrom catches a forbidden target reached via `export { x } from`', () => {
    const violations = notImportFrom('**/infra/**').evaluate([sf('src/bad/reexport-infra.ts')], ctx)
    expect(violations).toHaveLength(1)
    expect(violations[0]?.message).toContain('infra')
  })

  it('notImportFrom catches `export * from` re-exports too', () => {
    const violations = notImportFrom('**/infra/**').evaluate(
      [sf('src/bad/reexport-star-infra.ts')],
      ctx,
    )
    expect(violations.length).toBeGreaterThan(0)
  })

  it('dependOn is satisfied by a re-export edge', () => {
    const violations = dependOn('**/infra/**').evaluate([sf('src/bad/reexport-infra.ts')], ctx)
    expect(violations).toHaveLength(0)
  })

  it('the notImportFrom predicate also sees re-export edges', () => {
    // The predicate is true when the module does NOT import from the target; a
    // re-export to infra means it DOES, so the predicate must be false.
    const predicate = notImportFromPredicate('**/infra/**')
    expect(predicate.test(sf('src/bad/reexport-infra.ts'))).toBe(false)
  })

  it('a type re-export counts by default but is skipped with ignoreTypeImports', () => {
    const file = sf('src/bad/reexport-type-domain.ts')
    expect(notImportFrom('**/domain/**').evaluate([file], ctx)).toHaveLength(1)
    expect(
      notImportFrom(['**/domain/**'], { ignoreTypeImports: true }).evaluate([file], ctx),
    ).toHaveLength(0)
  })
})
