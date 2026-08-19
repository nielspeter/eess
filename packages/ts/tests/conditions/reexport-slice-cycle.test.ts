import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { Project } from 'ts-morph'
import type { ArchProject } from '../../src/core/project.js'
import { slices } from '../../src/index.js'

/**
 * A slice cycle formed ONLY by `export … from` re-exports.
 *
 * These two fixture files used to live inside `tests/fixtures/slices`, where no
 * test named them. That made them worse than absent: the property they were
 * written to prove — that `beFreeOfCycles` counts a re-export as a slice edge —
 * was enforced by nothing, while the extra cycle they injected silently broke
 * `held-builder-is-immutable`'s count of the `slices` fixture (plan 0165). A
 * fixture nothing asserts against is not coverage.
 *
 * So they now carry their own project, and this is the test that reads them.
 */
const fixture = path.resolve(import.meta.dirname, '../fixtures/slice-reexport-cycle/tsconfig.json')

function load(): ArchProject {
  const p = new Project({ tsConfigFilePath: fixture })
  return { tsConfigPath: fixture, _project: p, getSourceFiles: () => p.getSourceFiles() }
}

describe('re-export edges form slice cycles', () => {
  it('beFreeOfCycles reports a cycle built only from `export * from`', () => {
    const elements = slices(load())
      .matching('src/')
      .should()
      .beFreeOfCycles()
      .violations()
      .map((v) => v.element)
    expect(elements).toEqual(['reexport-x -> reexport-y', 'reexport-y -> reexport-x'])
  })

  it('CONTROL: the fixture really was loaded — both slices are subjects', () => {
    // Without this, an empty project would satisfy the assertion above by
    // reporting nothing at all, and `[] === []` is the vacuous green ADR-010
    // exists to refuse.
    expect(load().getSourceFiles().length).toBe(2)
  })
})
