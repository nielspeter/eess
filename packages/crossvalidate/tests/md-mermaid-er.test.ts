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

  it('flags an attribute in a diagram nested in a list item (bug 0290)', () => {
    const violations = violationsOf(() => tableErAgree(c(['bad-nested-extra-attribute.md']), OPTS))
    expect(violations).toHaveLength(1)
    expect(violations[0]?.message).toContain("'ghostColumn' of 'JobSchedule' is not a row")
    expect(violations[0]?.line).toBe(14)
  })

  it('flags an attribute in a diagram nested in a blockquote (bug 0290)', () => {
    const violations = violationsOf(() => tableErAgree(c(['bad-quoted-extra-attribute.md']), OPTS))
    expect(violations).toHaveLength(1)
    expect(violations[0]?.message).toContain("'quotedGhost' of 'JobSchedule' is not a row")
    expect(violations[0]?.line).toBe(12)
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
    // `expectEmpty` — this corpus legitimately has no ER diagram, and without the
    // declaration the emitter is right to report a pass over zero examined units
    // (ADR-014). The declaration EXPIRES: add a diagram to this fixture and this
    // reddens with `emitter/expired-declaration`, which is what makes it an
    // assertion rather than a mute button.
    expect(() => tableErAgree(c(['no-diagram.md']), { ...OPTS, expectEmpty: true })).not.toThrow()
    expect(tableErStats(c(['no-diagram.md']), OPTS).docs).toBe(0)
  })
})

describe('tableErAgree() — non-standard syntax', () => {
  it('flags an unparseable erDiagram as a violation instead of crashing', () => {
    const violations = violationsOf(() => tableErAgree(c(['bad-unparseable.md']), OPTS))
    expect(violations).toHaveLength(1)
    // Bug 0409: rewritten on purpose. Mermaid's own parser accepts this fixture's `o{--o{`, so the
    // finding no longer claims what "standard Mermaid ER syntax" accepts.
    expect(
      violations[0]?.message.startsWith(
        "erDiagram does not parse with eess-mermaid's ER grammar: ",
      ),
    ).toBe(true)
    expect(violations[0]?.message).not.toMatch(/standard Mermaid/)
    expect(violations[0]?.message).toContain(
      "This is either a syntax error in the document or valid Mermaid that eess-mermaid does not model yet; eess cannot tell which without Mermaid's own parser.",
    )
    // The remedy is the finding's fix line, not its reason (PR #213's review), and removes nothing.
    expect(violations[0]?.because).toBe(
      'A diagram eess-mermaid cannot read cannot be compared with its property table.',
    )
    expect(violations[0]?.suggestion).toBe(
      'Check this fence in the Mermaid Live Editor (https://mermaid.live); in Node, mermaid.parse ' +
        'needs a DOM such as jsdom and fails without one. If Mermaid reports a parse error, fix the ' +
        'syntax. If Mermaid accepts it, keep the fence and report the construct at ' +
        'https://github.com/nielspeter/eess/issues; this finding stays until eess-mermaid models it, and ' +
        'no eess-exclude comment silences it yet. To be green meanwhile, move only this fence into a ' +
        `document of its own and leave that document out (with tableErAgree's \`docs\` glob), so the document's other ` +
        'diagrams are still checked; put it back once the construct is modelled.',
    )
    expect(violations[0]?.suggestion).not.toMatch(/remove|delete/i)
  })

  // Bug 0210 / plan 0214: the selector tested the raw fence body, so a diagram whose first line is a
  // `%%{init}%%` directive or `---` frontmatter was never selected and its drift passed in silence.
  it('selects an erDiagram behind a %%{init}%% directive and compares it (bug 0210)', () => {
    const violations = violationsOf(() => tableErAgree(c(['bad-themed-extra-attribute.md']), OPTS))
    expect(violations).toHaveLength(1)
    expect(violations[0]?.message).toContain("'themedGhost' of 'JobSchedule' is not a row")
    expect(tableErStats(c(['bad-themed-extra-attribute.md']), OPTS).docs).toBe(1)
  })

  // Selected, which is bug 0210's fix: before, this fence was skipped in silence. eess-mermaid's ER
  // parser does not accept frontmatter, so it is reported as unparseable rather than compared. That
  // grammar gap, and the message blaming the author for it, are bug 0409's.
  it('selects an erDiagram behind --- frontmatter, so it is no longer skipped (bug 0210)', () => {
    const violations = violationsOf(() =>
      tableErAgree(c(['bad-frontmatter-extra-attribute.md']), OPTS),
    )
    expect(violations).toHaveLength(1)
    expect(violations[0]?.message).toContain('erDiagram does not parse')
    expect(violations[0]?.line).toBe(9)
  })

  // Same as frontmatter: selected now, but eess-mermaid's ER parser rejects a multi-line init
  // block, so it is reported as not parsing. Bug 0409 owns the gap; this pins today's behaviour.
  it('selects an erDiagram behind a multi-line %%{init}%% block, so it is no longer skipped', () => {
    const violations = violationsOf(() =>
      tableErAgree(c(['bad-multiline-init-extra-attribute.md']), OPTS),
    )
    expect(violations).toHaveLength(1)
    expect(violations[0]?.message).toContain('erDiagram does not parse')
    expect(violations[0]?.line).toBe(9)
  })

  it('skips a non-ER fence without skipping the document it sits in', () => {
    const violations = violationsOf(() => tableErAgree(c(['bad-beside-a-sequence.md']), OPTS))
    expect(violations).toHaveLength(1)
    expect(violations[0]?.message).toContain("'besideGhost' of 'JobSchedule' is not a row")
  })

  it('does not select an untagged fence whose kind is not erDiagram', () => {
    expect(tableErStats(c(['untagged-sequence-only.md']), OPTS).docs).toBe(0)
  })

  // Bug 0424: the ER selector compared the tag exactly, as md-mermaid did before bug 0423, so a
  // ```Mermaid erDiagram that drifted from its table was neither compared nor counted.
  it('reads a ```Mermaid erDiagram like a ```mermaid one (bug 0424)', () => {
    const docs = c(['bad-capitalised-extra-attribute.md'])
    const violations = violationsOf(() => tableErAgree(docs, OPTS))
    expect(violations).toHaveLength(1)
    expect(violations[0]?.message).toContain("'capitalisedGhost' of 'JobSchedule' is not a row")
    expect(tableErStats(docs, OPTS).docs).toBe(1)
  })

  // PR #215's review: the selector's other two branches were unpinned. An untagged erDiagram is read
  // (dropping that case would bring back a silent skip), and a fence tagged as another language is not.
  it('still reads an untagged erDiagram', () => {
    const violations = violationsOf(() =>
      tableErAgree(c(['bad-untagged-extra-attribute.md']), OPTS),
    )
    expect(violations[0]?.message).toContain("'untaggedGhost' of 'JobSchedule' is not a row")
  })

  it('does not read an erDiagram in a fence tagged as another language', () => {
    expect(tableErStats(c(['sql-tagged-er.md']), OPTS).docs).toBe(0)
  })

  // ADR-019: the tag is compared in any letter case and nothing else, so an alias is not read.
  it('does not read an erDiagram in a fence tagged mmd', () => {
    expect(tableErStats(c(['mmd-tagged-er.md']), OPTS).docs).toBe(0)
  })

  // Bug 0429: a directive line that ends in a comment left the directive open to the end of the
  // block, so no kind was found and the diagram was never selected or compared.
  it('selects an erDiagram behind a directive closed mid-line and compares it (bug 0429)', () => {
    const docs = c(['bad-init-mid-line-extra-attribute.md'])
    const violations = violationsOf(() => tableErAgree(docs, OPTS))
    expect(violations).toHaveLength(1)
    expect(violations[0]?.message).toContain("'midLineGhost' of 'JobSchedule' is not a row")
    expect(tableErStats(docs, OPTS).docs).toBe(1)
  })
})
