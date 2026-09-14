import { describe, it, expect, vi, afterEach } from 'vitest'
import { Project } from 'ts-morph'
import { classes } from '../../src/builders/class-rule-builder.js'
import { call } from '../../src/helpers/matchers.js'
import type { ArchProject } from '../../src/core/project.js'

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * Bug 0298 — the eess-ts `applyFilters` accumulates the subjects a pattern matched
 * only for `cycle-edge::` identities, so a loose `.excluding()` pattern in any other
 * family absorbs every subject it happens to match and writes nothing.
 *
 * **What this pins, and what it cannot see.** It asserts that nothing reaches stderr
 * while `.violations()` filters. A fix that writes there — any message, naming the
 * pattern or not — turns it red. A fix that discloses through the receipt or at the
 * run boundary (the way `comment-suppression.ts` reports, from `checkAll` and the
 * CLI) does not touch this channel, stays green here, and must bring its own red
 * test at that level. The kernel copy has its own pin in
 * `packages/core/tests/an-exclusion-matching-many-subjects-is-silent.test.ts`.
 *
 * The unit-level CONTROL in `excluding-matching.test.ts` pins the same silence as
 * design; the ruling that fixes this re-decides that test too.
 */
function repositoryProject(): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  for (const name of ['Direct', 'Audit', 'AuditTrail']) {
    tsm.createSourceFile(
      `/src/${name}.ts`,
      `export class ${name}Repository {\n  db(table: string): string {\n    return table\n  }\n  load(): string {\n    return this.db('${name}')\n  }\n}\n`,
    )
  }
  return {
    tsConfigPath: '/tsconfig.json',
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

function rule(p: ArchProject) {
  return classes(p)
    .that()
    .haveNameEndingWith('Repository')
    .should()
    .notContain(call('this.db'))
    .rule({ id: 'test/0298-no-raw-db' })
}

describe('bug 0298: an exclusion that absorbs several subjects says nothing', () => {
  it('KNOWN GAP — one loose exclusion removes two violating subjects and writes nothing', () => {
    const p = repositoryProject()

    // All three violate, by the same rule with no exclusion.
    expect(
      new Set(
        rule(p)
          .violations()
          .map((v) => v.element),
      ),
    ).toEqual(new Set(['DirectRepository', 'AuditRepository', 'AuditTrailRepository']))

    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const result = rule(p).excluding(/Audit/).violations()

    // The unexcluded subject is still reported, so this is not a rule reporting nothing.
    expect(new Set(result.map((v) => v.element))).toEqual(new Set(['DirectRepository']))
    // Two subjects removed by one pattern, and nothing written at all.
    expect(stderr).not.toHaveBeenCalled()
  })
})
