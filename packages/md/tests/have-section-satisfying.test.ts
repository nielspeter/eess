/**
 * Plan 0582 (proposal 026, ask A): `haveSection(G, { satisfying: p })`, a document has at least one
 * section of the name that satisfies a section predicate. Driven through `docs()` as an adopter
 * writes the rule, in both phases, and through `predicateHaveSection` inside `satisfy()`.
 */
import { describe, expect, it } from 'vitest'
import {
  corpusFromText,
  docs,
  not,
  predicateHaveSection,
  sectionsWithCodePointer,
  sectionsWithLink,
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
  })

  it('with it, the description says "a section … satisfying"', () => {
    expect(predicateHaveSection(G, CITES).description).toBe(
      'have a section "Relations" satisfying "hold a code pointer"',
    )
  })
})

describe('the conditional rule: a record with a Relations section cites code in one', () => {
  it('reds the record whose only Relations section links but cites no code, at that section', () => {
    const v = conditional(RECORDS).violations()
    expect(said(v)).toEqual([
      'work/links-only.md:3: section "Relations" does not satisfy "hold a code pointer", and no section "Relations" in this document does',
    ])
    expect(v[0]?.line).toBe(3)
    // Every record with a Relations section is examined; none.md is out of scope.
    expect(v.examined).toBe(4)
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
    expect(conditional({ ...RECORDS, 'work/links-only.md': fixed }).violations()).toHaveLength(0)
  })
})

describe('the strict rule: every record in scope has a Relations section that cites code', () => {
  it('also reds a record with no Relations section, at line 1', () => {
    const v = strict(RECORDS).violations()
    expect(said(v)).toEqual([
      'work/links-only.md:3: section "Relations" does not satisfy "hold a code pointer", and no section "Relations" in this document does',
      'work/none.md: missing section "Relations"',
    ])
    expect(v.examined).toBe(5)
  })

  it('a misspelt name reds every record; a case drift names the heading meant', () => {
    expect(strict(RECORDS, 'Relatons').violations()).toHaveLength(5)
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
})
