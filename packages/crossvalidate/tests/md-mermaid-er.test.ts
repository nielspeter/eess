import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ArchRuleError } from '@nielspeter/eess'
import { corpus, type MdDocument } from '@nielspeter/eess-md'
import { tableErAgree, tableErStats, type TableErAgreeOptions } from '../src/md-mermaid-er.js'

const root = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/table-er')
const c = (roots: string[]) => corpus({ roots, cwd: root })

// The consumer's shape — section/columns/entity derivation live in ITS rules,
// exactly what the parameterization exists for.
const entityFromH1 = (doc: MdDocument): string | undefined => {
  const m = /^# Entity: (.+)$/m.exec(doc.text)
  return m?.[1] === undefined ? undefined : m[1].replace(/\s+/g, '')
}
const OPTS: TableErAgreeOptions = {
  table: { section: /Properties/, name: /^Property$/, type: /^Type$/ },
  entity: entityFromH1,
}

const violationsOf = (fn: () => void) => {
  try {
    fn()
  } catch (e) {
    if (e instanceof ArchRuleError) return e.violations
    throw e
  }
  return []
}

describe('tableErAgree() — md↔mermaid-er', () => {
  it('passes when the diagram attributes ⊆ the property table (green)', () => {
    expect(() => tableErAgree(c(['good-entity.md']), OPTS)).not.toThrow()
  })

  it('is non-vacuous — stats see the compared doc/entities/attributes', () => {
    const stats = tableErStats(c(['good-entity.md']), OPTS)
    expect(stats).toEqual({ docs: 1, entities: 2, attributes: 2 })
  })

  it('flags a diagram attribute the table does not carry (red)', () => {
    const violations = violationsOf(() => tableErAgree(c(['bad-extra-attribute.md']), OPTS))
    expect(violations).toHaveLength(1)
    expect(violations[0]?.message).toContain("'phantomField' of 'JobSchedule' is not a row")
  })

  it('flags a diagram that does not declare the document entity (red)', () => {
    const violations = violationsOf(() => tableErAgree(c(['bad-missing-entity.md']), OPTS))
    expect(violations).toHaveLength(1)
    expect(violations[0]?.message).toContain("does not declare entity 'JobSchedule'")
  })

  it('flags a type disagreement when a type column is mapped (red)', () => {
    const violations = violationsOf(() => tableErAgree(c(['bad-type-mismatch.md']), OPTS))
    expect(violations).toHaveLength(1)
    expect(violations[0]?.message).toContain("table says 'String', erDiagram says 'UUID'")
  })

  it('ignores type agreement when no type column is mapped', () => {
    const noType: TableErAgreeOptions = {
      table: { section: /Properties/, name: /^Property$/ },
      entity: entityFromH1,
    }
    expect(() => tableErAgree(c(['bad-type-mismatch.md']), noType)).not.toThrow()
  })

  it('skips documents without an erDiagram block', () => {
    expect(() => tableErAgree(c(['no-diagram.md']), OPTS)).not.toThrow()
    expect(tableErStats(c(['no-diagram.md']), OPTS).docs).toBe(0)
  })
})
