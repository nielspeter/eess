import path from 'node:path'
import { describe, it, expect, beforeEach } from 'vitest'
import { Project } from 'ts-morph'
import type { SourceFile } from 'ts-morph'
import { project, workspace, resetProjectCache } from '../../src/core/project.js'
import { resideInFolder } from '../../src/predicates/identity.js'
import {
  isProjectRelative,
  rootFromTsConfigPath,
  relativeToRoot,
  rootOf,
} from '../../src/core/project-relative.js'

const fixture = path.resolve(import.meta.dirname, '../fixtures/workspace-roots')

/**
 * `rootOf`/`relativeToRoot`/`rootFromTsConfigPath` in isolation — plan 0148
 * Phase 1. Deliberately does NOT exercise `resideInFolder`/`resideInFile` or
 * `resolveByDefinition` (Phase 3's call-site wiring, not yet done); every
 * assertion here calls the root-registry functions directly.
 */
describe('project-relative root registry (plan 0148 Phase 1)', () => {
  beforeEach(() => {
    resetProjectCache()
  })

  it('a tsconfig at the filesystem root gives "/" — not "", which meant two things', () => {
    // `''` was read as "the root is /" by one derivation and "no root known"
    // by another. Reachable in a container that mounts the repo at `/`.
    expect(rootFromTsConfigPath('/tsconfig.json')).toBe('/')
    expect(rootFromTsConfigPath('')).toBeUndefined()
  })

  it('a ".." segment is a fault, not a project-relative glob', () => {
    // `relativeToRoot` returns undefined for anything above the root,
    // deliberately — so a `../` glob would normalize to nothing and be
    // reported with causes that are not true.
    expect(isProjectRelative('../x/**')).toBe(false)
    expect(isProjectRelative('./x/**')).toBe(false)
    expect(isProjectRelative('src/x/**')).toBe(true)
  })

  it('a file outside the project root is never matched relatively', () => {
    // `relativeToRoot` must return undefined for a path that does not sit
    // under the root — trimming the prefix wherever it happens to occur
    // would relativise a file the root does not contain.
    const root = '/repo/pkg'
    const inside = '/repo/pkg/src/domain/a.ts'
    const outside = '/repo/other/src/domain/a.ts'
    const stub = (configFilePath: string | undefined, filePath: string) =>
      ({
        getFilePath: () => filePath,
        getProject: () => ({ getCompilerOptions: () => ({ configFilePath }) }),
      }) as unknown as Parameters<typeof relativeToRoot>[0]

    expect(relativeToRoot(stub(`${root}/tsconfig.json`, inside), inside)).toBe('src/domain/a.ts')
    expect(relativeToRoot(stub(`${root}/tsconfig.json`, outside), outside)).toBeUndefined()
    expect(relativeToRoot(stub(undefined, inside), inside)).toBeUndefined()
  })

  it('skips normalization when the project has no tsconfig to be relative to', () => {
    // `configFilePath` is undefined for an in-memory project. That is a
    // genuine "no root known", and inventing one would relativize against
    // something the author never named.
    const inMemory = new Project({ useInMemoryFileSystem: true })
    const sf = inMemory.createSourceFile('/src/domain/a.ts', 'export const a = 1')
    expect(rootOf(sf)).toBeUndefined()
    expect(relativeToRoot(sf, '/src/domain/a.ts')).toBeUndefined()
  })

  it('a NESTED package resolves against its own root, not the outer one', () => {
    // The containing-root pick sorts longest-first. Without it the outer
    // root wins for a file inside an inner package, and the inner tsconfig
    // never applies. `zpkg`, deliberately: roots sort alphabetically and
    // `<fixture>/tsconfig.json` sorts BEFORE `<fixture>/zpkg/tsconfig.json`,
    // so without the longest-first pick the OUTER root would win.
    const outer = path.join(fixture, 'tsconfig.json')
    const zpkg = path.join(fixture, 'zpkg/tsconfig.json')
    const ws = workspace([outer, zpkg])

    const outerFile = ws
      .getSourceFiles()
      .find((f) => f.getFilePath().endsWith('/src/api/outer.ts'))!
    const nestedFile = ws
      .getSourceFiles()
      .find((f) => f.getFilePath().endsWith('/zpkg/src/api/handler.ts'))!

    expect(rootOf(outerFile)).toBe(fixture)
    expect(rootOf(nestedFile)).toBe(path.join(fixture, 'zpkg'))
    expect(relativeToRoot(nestedFile, nestedFile.getFilePath())).toBe('src/api/handler.ts')
  })

  it("a plain project() (not workspace()) resolves a project-relative glob via ts-morph's own configFilePath", () => {
    // Plan 0148 Phase 1's own stated verification step, never actually done:
    // the existing "outside the root"/"no tsconfig" tests above use an
    // in-memory project (no `configFilePath` at all) or hand-built stubs —
    // neither exercises `rootOf`'s THIRD fallback branch
    // (`sourceFile.getProject().getCompilerOptions().configFilePath`) via
    // the real, public `project()` entry point that never calls
    // `registerProjectRoots`. This is the one that must keep working, since
    // it's the common case every non-workspace consumer hits.
    const alpha = path.join(fixture, 'packages/alpha/tsconfig.json')
    const p = project(alpha)
    const predicate = resideInFolder<SourceFile>('src/api/**')
    const matched = p
      .getSourceFiles()
      .filter((f) => predicate.test(f))
      .map((f) => f.getFilePath())
    expect(matched).toEqual([path.join(fixture, 'packages/alpha/src/api/handler.ts')])
  })

  it('CONTROL: a single-tsconfig project registers exactly one root', () => {
    const alpha = path.join(fixture, 'packages/alpha/tsconfig.json')
    const ws = workspace([alpha])
    const file = ws.getSourceFiles()[0]!
    expect(rootOf(file)).toBe(path.join(fixture, 'packages/alpha'))
  })

  it('a file outside every registered root of a real workspace() is unresolved, not silently the tie-break winner', () => {
    // Bug found in code review (plan 0148 punch list): once `registered` is
    // defined for this project (a real `workspace()` ran), falling through
    // to `sourceFile.getProject().getCompilerOptions().configFilePath` on a
    // miss resolves to the PRIMARY (tie-break-winner) tsconfig — a specific,
    // plausible-looking, WRONG root for a file that belongs to no registered
    // package at all (a shared root-level file, reached via a broad
    // `include`/`references` outside every package's own directory). Fail
    // closed instead: `undefined`, not a guess.
    const alpha = path.join(fixture, 'packages/alpha/tsconfig.json')
    const beta = path.join(fixture, 'packages/beta/tsconfig.json')
    const ws = workspace([alpha, beta])
    const orphan = ws._project.createSourceFile(
      path.join(fixture, 'shared-types/global.d.ts'),
      'export {}',
    )
    expect(rootOf(orphan)).toBeUndefined()
    expect(relativeToRoot(orphan, orphan.getFilePath())).toBeUndefined()
  })
})
