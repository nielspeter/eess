import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { Project, type SourceFile } from 'ts-morph'
import { modules, slices, crossLayer } from '../../src/index.js'
import { resideInFile, resideInFolder } from '../../src/predicates/identity.js'
import { resolveByDefinition } from '../../src/models/slice.js'
import { diagnose } from '../../src/core/diagnose.js'
import { importFrom, havePathMatching } from '../../src/predicates/module.js'
import { candidatesFor } from '../../src/core/import-candidates.js'
import { haveMatchingCounterpart } from '../../src/conditions/cross-layer.js'
import type { ArchProject } from '../../src/core/project.js'

const tsconfigPath = path.resolve(import.meta.dirname, '../fixtures/modules/tsconfig.json')

function loadProject(): ArchProject {
  const tsMorphProject = new Project({ tsConfigFilePath: tsconfigPath })
  return {
    tsConfigPath: tsconfigPath,
    _project: tsMorphProject,
    getSourceFiles: () => tsMorphProject.getSourceFiles(),
  }
}

const p = loadProject()

/** Count of a project's own source files matching a predicate — this repo has no `.subjects()`. */
function selectCount(predicate: { test: (f: SourceFile) => boolean }): number {
  return p.getSourceFiles().filter((f) => predicate.test(f)).length
}

/**
 * Every surface that takes a path glob accepts the same two spellings —
 * ported from ts-archunit's own `relative-globs-are-uniform.test.ts` (plan
 * 0148 punch list, item 6). Single-project, not multi-root — this is the
 * cross-surface consistency suite the "needs a missing preset" scope-cut
 * in plan 0148's Status section overstated: only the `atPath` preset row
 * needs something eess doesn't have. Everything else here is portable.
 *
 * Deliberately NOT ported: the "means the ROOT folder, not any folder of
 * that name" discriminator, which needs a nested second `src/domain` copy
 * — adding one to the shared `modules` fixture risks changing counts every
 * OTHER test in this repo that reads it. A dedicated nested fixture is a
 * small, separate follow-on, not worth the blast radius here.
 */
describe('a project-relative path glob means the same thing everywhere', () => {
  const surfaces: readonly { name: string; count: (glob: string) => number }[] = [
    { name: 'resideInFolder', count: (g) => selectCount(resideInFolder(g)) },
    { name: 'resideInFile', count: (g) => selectCount(resideInFile(g)) },
    { name: 'havePathMatching', count: (g) => selectCount(havePathMatching(g)) },
    {
      name: 'slices().assignedFrom',
      count: (g) => resolveByDefinition(p, { s: g })[0]?.files.length ?? 0,
    },
  ]

  it.each(surfaces)('$name selects the root folder from a relative glob', ({ count }) => {
    expect(count('src/domain/**')).toBeGreaterThan(0)
  })

  it.each(surfaces)('$name agrees with the absolute spelling of the same folder', ({ count }) => {
    // Not merely "both non-empty": the same COUNT. A surface that normalized to
    // "anywhere" instead of "at the root" would pass the test above and be
    // wrong on any project with a nested `src/`.
    expect(count('src/domain/**')).toBe(count(`${path.dirname(tsconfigPath)}/src/domain/**`))
  })

  it.each(surfaces)('$name still selects nothing for a genuinely absent folder', ({ count }) => {
    // The control. Normalizing everything into a match would satisfy the row above.
    expect(count('src/no-such-folder/**')).toBe(0)
  })

  it('an IMPORT glob accepts the relative spelling too (bug-0037-shaped)', () => {
    // `onlyImportFrom` is matched against the ABSOLUTE resolved path, so a
    // relative glob could never match and a correct architecture reported
    // a false violation.
    const relative = modules(p)
      .that()
      .resideInFolder('**/domain/**')
      .should()
      .onlyImportFrom('src/**')
      .violations().length
    const anchored = modules(p)
      .that()
      .resideInFolder('**/domain/**')
      .should()
      .onlyImportFrom('**/src/**')
      .violations().length
    expect(relative).toBe(anchored)
  })

  it('CONTROL: a BARE specifier glob still matches, with no resolved path at all', () => {
    // Bug 0014's case, and the one the fix must not break: `'fastify'` names a
    // package, resolves to nothing inside the project, and has no root to be
    // relative to. The early return for `resolvedPath === undefined` is what
    // preserves it.
    const candidates = candidatesFor('fastify', undefined, '/some/root')
    expect(candidates).toEqual(['fastify'])
  })

  it('CONTROL: the PRIMARY candidate is unchanged, so baselined findings do not move', () => {
    // The relative form is appended, never prepended.
    const withRoot = candidatesFor('@scope/pkg', '/root/src/lib/a.ts', '/root')
    expect(withRoot[0]).toBe('/root/src/lib/a.ts')
    expect(withRoot).toContain('src/lib/a.ts')
    const withoutRoot = candidatesFor('@scope/pkg', '/root/src/lib/a.ts', undefined)
    expect(withoutRoot[0]).toBe(withRoot[0])
  })

  it('CONTROL: a target outside the root gets no relative candidate', () => {
    expect(candidatesFor('@scope/pkg', '/elsewhere/a.ts', '/root')).toEqual([
      '/elsewhere/a.ts',
      '@scope/pkg',
    ])
  })

  it('runtime and diagnosis agree for a relative glob', () => {
    // The glob RESOLVES but `diagnose()` must not still call it dead — a
    // working rule reported red by the doctor would fail the build for no
    // reason.
    const relative = [
      modules(p).that().resideInFolder('src/domain/**').should().notImportFrom('**/x/**'),
      slices(p).assignedFrom({ domain: 'src/domain/**' }).should().beFreeOfCycles(),
    ]
    for (const rule of relative) {
      expect(diagnose([rule])).toEqual([])
      expect(rule.violations()).toEqual([])
    }
  })

  it('importFrom accepts the relative spelling (module predicate)', () => {
    // Measured before the fix: 0 modules selected where the anchored
    // spelling selected several — `predicates/module.ts` called
    // `candidatesFor` without a root.
    const rel = selectCount(importFrom('src/**'))
    const anchored = selectCount(importFrom('**/src/**'))
    expect(rel).toBeGreaterThan(0)
    expect(rel).toBe(anchored)
  })

  it('crossLayer().layer does not falsely report a relative glob as dead', () => {
    // Only the DIAGNOSIS is assertable here: a `crossLayer` pair rule
    // produces zero violations whether its layer resolves files or none, so
    // the runtime half of this fix is unobservable through the public API
    // on any fixture.
    //
    // NOT ported: ts-archunit's own CONTROL half of this test (a genuinely
    // dead layer glob IS still reported) — `CrossLayerBuilder`'s
    // `PairFinalBuilder` extends `TerminalBuilder` directly, bypassing
    // `RuleBuilder<T,P>`'s `globs()`/`deadGlobDiagnosis()` hooks (a
    // deliberate plan-0147 Phase 4 scope exclusion, unrelated to this
    // plan), so `diagnose()` does not walk cross-layer rules at all yet —
    // confirmed here: `diagnose()` returns `[]` for EITHER glob, not just
    // the relative one. Asserting only the negative (not a false positive)
    // stays honest about what this repo's `diagnose()` can see today.
    const rule = (g: string) =>
      crossLayer(p)
        .layer('a', g)
        .layer('b', '**/services/**')
        .mapping(() => false)
        .forEachPair()
        .should(haveMatchingCounterpart([]))
    expect(diagnose([rule('src/domain/**')]).map((f) => f.glob)).not.toContain('src/domain/**')
  })

  it('onlyBeImportedVia accepts the relative spelling — it was a false red', () => {
    // Measured before this plan's fix: `'src/**'` produced violations where
    // `'**/src/**'` produced none. The glob is matched against the
    // IMPORTER's absolute path, so a relative one rejected every importer.
    const count = (g: string) =>
      modules(p).that().resideInFolder('**/domain/**').should().onlyBeImportedVia(g).violations()
        .length
    expect(count('src/**')).toBe(count('**/src/**'))
  })

  it('CONTROL: an anchored glob keeps meaning "anywhere" on every surface', () => {
    for (const { name, count } of surfaces) {
      expect(count('**/domain/**'), name).toBeGreaterThan(0)
    }
  })
})
