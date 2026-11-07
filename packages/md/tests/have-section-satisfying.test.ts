/**
 * Plan 0582 (proposal 026, ask A): `haveSection(G, { satisfying: p })`, a document has at least one
 * section of the name that satisfies a section predicate. Driven through `docs()` as an adopter
 * writes the rule, in both phases, and through `predicateHaveSection` inside `satisfy()`.
 */
import { describe, expect, it } from 'vitest'
import {
  corpusFromText,
  docs,
  inDocuments,
  links,
  not,
  predicateHaveSection,
  sectionsWithCodePointer,
  sectionsWithLink,
  sectionsWithSubsection,
  type ArchViolation,
} from '../src/index.js'

const G = 'Relations'
const CITES = { satisfying: sectionsWithCodePointer() }
const UNREAD = 'see <a href=./a.md title=a/b>x</a>'

/** The records, by name: each a one-line description of what its `## Relations` sections hold. */
const RECORDS: Readonly<Record<string, string>> = {
  'work/cites.md': `# Cites\n\n## ${G}\n\nSee \`src/a.ts:3\`.\n`,
  'work/links-only.md': `# Links only\n\n## ${G}\n\nSee [cites](./cites.md).\n`,
  'work/two-qualifying.md': `# Two\n\n## ${G}\n\nSee \`src/a.ts:3\`.\n\n## ${G}\n\nSee \`src/b.ts:4\`.\n`,
  'work/one-of-two.md': `# Mixed\n\n## ${G}\n\nSee [cites](./cites.md).\n\n## ${G}\n\nSee \`src/a.ts:3\`.\n`,
  'work/none.md': '# None\n\n## Notes\n\nNothing related.\n',
  // The code is cited, but under another heading: the Relations section itself only links.
  'work/elsewhere.md': `# Elsewhere\n\n## ${G}\n\nSee [cites](./cites.md).\n\n## Notes\n\nSee \`src/a.ts:3\`.\n`,
}

const said = (vs: readonly ArchViolation[]): string[] =>
  vs.map((v) => `${v.element}: ${v.message.split('\n')[0] ?? ''}`)

const conditional = (files: Readonly<Record<string, string>>, name: string = G) =>
  docs(corpusFromText(files))
    .that()
    .resideInFolder('work/**')
    .and()
    .haveSection(name)
    .should()
    .haveSection(name, CITES)
    .rule({ id: 'records/relations-cite-code' })

const strict = (files: Readonly<Record<string, string>>, name: string = G) =>
  docs(corpusFromText(files))
    .that()
    .resideInFolder('work/**')
    .should()
    .haveSection(name, CITES)
    .rule({ id: 'records/relations-cite-code-strict' })

describe('without the option, haveSection is unchanged (plan 0582)', () => {
  it('the predicate and the condition keep their descriptions, byte for byte', () => {
    expect(predicateHaveSection(G).description).toBe('have section "Relations"')
    expect(predicateHaveSection(G, { depth: 2 }).description).toBe(
      'have section "Relations" at depth 2',
    )
    const v = docs(corpusFromText({ 'work/none.md': RECORDS['work/none.md'] ?? '' }))
      .should()
      .haveSection(G)
      .violations()
    expect(said(v)).toEqual(['work/none.md: missing section "Relations"'])
    expect(v[0]?.rule).toMatch(/should have section "Relations"$/)
  })

  it('with it, the description says "a section … satisfying"', () => {
    expect(predicateHaveSection(G, CITES).description).toBe(
      'have a section "Relations" satisfying "hold a code pointer"',
    )
    const v = strict({ 'work/none.md': RECORDS['work/none.md'] ?? '' }).violations()
    expect(v[0]?.rule).toMatch(
      /should have a section "Relations" satisfying "hold a code pointer"$/,
    )
  })
})

describe('the conditional rule: a record with a Relations section cites code in one', () => {
  it('reds the record whose only Relations section links, and the one citing code only elsewhere', () => {
    const v = conditional(RECORDS).violations()
    expect(said(v)).toEqual([
      'work/elsewhere.md: no section "Relations" satisfies "hold a code pointer" (the section at line 3)',
      'work/links-only.md: no section "Relations" satisfies "hold a code pointer" (the section at line 3)',
    ])
    expect(v.map((x) => x.line)).toEqual([3, 3])
    expect(v[0]?.suggestion).toMatch(/renaming or removing the heading only moves the document out/)
    // Every record with a Relations section is examined; none.md is out of scope.
    expect(v.examined).toBe(5)
  })

  it('one finding per record when every Relations section fails, naming each', () => {
    const three = `# T\n\n## ${G}\n\nx\n\n## ${G}\n\ny\n\n## ${G}\n\nz\n`
    expect(said(conditional({ 'work/t.md': three }).violations())).toEqual([
      'work/t.md: no section "Relations" satisfies "hold a code pointer" (the sections at lines 3, 7, 11)',
    ])
  })

  it('two qualifying sections, or one qualifying and one link-only, are green', () => {
    const v = conditional({
      'work/two-qualifying.md': RECORDS['work/two-qualifying.md'] ?? '',
      'work/one-of-two.md': RECORDS['work/one-of-two.md'] ?? '',
    }).violations()
    expect(said(v)).toEqual([])
    expect(v.examined).toBe(2)
  })

  it('a misspelt group name reds the rule with the zero-examined finding', () => {
    const v = conditional(RECORDS, 'Relatons').violations()
    expect(v).toHaveLength(1)
    expect(v[0]?.message).toMatch(/examined zero/)
    expect(v.examined).toBe(0)
  })

  it('the remedy, a pointer in the section, clears the finding', () => {
    const fixed = (RECORDS['work/links-only.md'] ?? '') + '\nAnd `src/c.ts:1`.\n'
    const v = conditional({ ...RECORDS, 'work/links-only.md': fixed }).violations()
    expect(v.map((x) => x.element)).toEqual(['work/elsewhere.md'])
  })
})

describe('the strict rule: every record in scope has a Relations section that cites code', () => {
  it('also reds a record with no Relations section, at line 1', () => {
    const v = strict(RECORDS).violations()
    expect(said(v)).toEqual([
      'work/elsewhere.md: no section "Relations" satisfies "hold a code pointer" (the section at line 3)',
      'work/links-only.md: no section "Relations" satisfies "hold a code pointer" (the section at line 3)',
      'work/none.md: missing section "Relations"',
    ])
    expect(v.examined).toBe(6)
  })

  it('a misspelt name reds every record; a case drift names the heading meant', () => {
    expect(strict(RECORDS, 'Relatons').violations()).toHaveLength(6)
    const drift = strict({ 'work/cites.md': RECORDS['work/cites.md'] ?? '' }, 'relations')
    expect(said(drift.violations())).toEqual([
      'work/cites.md: missing section "relations"; the heading "Relations" at line 3 differs from "relations" only by case or spacing',
    ])
  })

  it('the remedy, a Relations section that cites code, clears the record', () => {
    const fixed = `${RECORDS['work/none.md'] ?? ''}\n## ${G}\n\nSee \`src/a.ts:3\`.\n`
    const v = strict({ 'work/none.md': fixed }).violations()
    expect(v).toHaveLength(0)
  })

  it('with a depth, only a section of the name at that depth counts', () => {
    const mixed = `# D\n\n## ${G}\n\nSee \`src/a.ts:3\`.\n\n### ${G}\n\nSee [a](./a.md).\n`
    const v = docs(corpusFromText({ 'work/d.md': mixed }))
      .should()
      .haveSection(G, { depth: 3, ...CITES })
      .violations()
    expect(said(v)).toEqual([
      'work/d.md: no section "Relations" at depth 3 satisfies "hold a code pointer" (the section at line 7)',
    ])
  })

  it('over a dead scope, the rule reds with the zero-examined finding', () => {
    const v = docs(corpusFromText(RECORDS))
      .that()
      .resideInFolder('wrok/**')
      .should()
      .haveSection(G, CITES)
      .violations()
    expect(v.map((x) => x.message)).toEqual([expect.stringMatching(/examined zero/)])
  })
})

describe('a section the predicate cannot judge (ADR-021)', () => {
  const LINKS = { satisfying: sectionsWithLink() }

  it('is reported at its own line, unsuppressably, and nothing else is said of the record', () => {
    const c = corpusFromText({
      'work/r.md': `# R\n\n## ${G}\n\n${UNREAD}\n`,
      'work/a.md': '# A\n',
    })
    const v = docs(c).that().resideInFile('work/r.md').should().haveSection(G, LINKS).violations()
    expect(v.map((x) => [x.line, x.bypassFilters])).toEqual([[5, true]])
    expect(v[0]?.message).toMatch(/whether its section holds a link cannot be judged/)
  })

  it('its remedy, quoting the attributes, clears it', () => {
    const c = corpusFromText({
      'work/r.md': `# R\n\n## ${G}\n\nsee <a href="./a.md" title="a/b">x</a>\n`,
      'work/a.md': '# A\n',
    })
    expect(
      docs(c).that().resideInFile('work/r.md').should().haveSection(G, LINKS).violations(),
    ).toHaveLength(0)
  })

  it('is not reported where another section of the name decides the record', () => {
    const c = corpusFromText({
      'work/r.md': `# R\n\n## ${G}\n\n${UNREAD}\n\n## ${G}\n\n[a](./a.md)\n`,
      'work/a.md': '# A\n',
    })
    expect(
      docs(c).that().resideInFile('work/r.md').should().haveSection(G, LINKS).violations(),
    ).toHaveLength(0)
  })

  it('in the predicate form, the record is neither selected nor dropped, and test() refuses it', () => {
    const c = corpusFromText({
      'work/r.md': `# R\n\n## ${G}\n\n${UNREAD}\n`,
      'work/a.md': '# A\n',
    })
    const v = docs(c)
      .that()
      .resideInFile('work/r.md')
      .and()
      .satisfy(not(predicateHaveSection(G, LINKS)))
      .should()
      .notExist()
      .violations()
    expect(v.map((x) => [x.line, x.bypassFilters])).toEqual([[5, true]])
    const [doc] = c.documents().filter((d) => d.relPath === 'work/r.md')
    if (doc === undefined) throw new Error('no document')
    expect(() => predicateHaveSection(G, LINKS).test(doc)).toThrow(/cannot answer/)
  })
})

describe('the predicate form records the name it reads (plan 0582)', () => {
  it('a heading that drifted from the name is reported, not silently skipped', () => {
    const c = corpusFromText({ 'work/r.md': '# R\n\n## relations\n\nSee `src/a.ts:3`.\n' })
    const v = docs(c).that().haveSection(G, CITES).should().notExist().violations()
    expect(v.map((x) => x.element)).toEqual(['work/r.md → section "relations" (near miss)'])
  })

  it('selects the records with a section that satisfies, inside satisfy()', () => {
    const v = docs(corpusFromText(RECORDS))
      .that()
      .satisfy(predicateHaveSection(G, CITES))
      .should()
      .notExist()
      .violations()
    expect(v.map((x) => x.element).sort()).toEqual([
      'work/cites.md',
      'work/one-of-two.md',
      'work/two-qualifying.md',
    ])
  })

  it('records the section names the predicate reads, so a drifted subsection is named', () => {
    const c = corpusFromText({ 'work/r.md': `# R\n\n## ${G}\n\n### code\n\nx\n` })
    const v = docs(c)
      .should()
      .haveSection(G, { satisfying: sectionsWithSubsection('Code') })
      .violations()
    expect(v.map((x) => x.element)).toContain('work/r.md → section "code" (near miss)')
  })

  it('lifts through inDocuments onto the links of the records that satisfy it', () => {
    const v = links(corpusFromText(RECORDS))
      .that()
      .satisfy(inDocuments(predicateHaveSection(G, CITES)))
      .should()
      .notExist()
      .violations()
    expect([...new Set(v.map((x) => x.element.split(':')[0]))]).toEqual(['work/one-of-two.md'])
  })
})
