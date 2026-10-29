/**
 * Plan 0556: `docs().should().agreeWithPath()`, a value agrees with the document's own path (proposal
 * 017, block 16). Each finding, its text word for word, through the public `docs()`; the evidence
 * rows are plan 0495's, built on a selection only the agreement's own finding can turn red.
 */
import { describe, it, expect } from 'vitest'
import {
  corpus,
  docs,
  isArchConfigError,
  type AgreeWithPathOptions,
  type ArchViolation,
} from '../../src/index.js'
import { tree } from '../helpers/tree.js'

const notes = (files: Readonly<Record<string, string>>, frozen: readonly string[] = []) =>
  corpus({ cwd: tree(files), roots: ['**/*.md'], frozen: [...frozen] })

const PATH = /(?:^|\/)(?<value>\d{4})-[^/]*\.md$/
const TITLE = /^Note (?<value>\d{4}):/
const OPTS: AgreeWithPathOptions = { path: PATH, title: TITLE }

const run = (c: ReturnType<typeof corpus>, o: AgreeWithPathOptions = OPTS) =>
  docs(c).should().agreeWithPath(o).violations()
/** Per-document findings, as `path:line: message`. */
const said = (found: readonly ArchViolation[]): string[] =>
  found.filter((v) => v.bypassFilters !== true).map((v) => `${v.element}: ${v.message}`)
/** Every finding's message: an array of findings also carries `examined`, which `toEqual([])` reads. */
const messages = (found: readonly ArchViolation[]): string[] => found.map((v) => v.message)
/** The agreement's own findings (P5). */
const own = (found: readonly ArchViolation[]): string[] =>
  found.filter((v) => v.bypassFilters === true).map((v) => v.message)

describe('agreeWithPath: P4, the two sides differ', () => {
  it('a title naming another number is red, with both values as written', () => {
    const v = run(notes({ 'n/0001-a.md': '# Note 0002: a\n' }))
    expect(said(v)).toEqual([
      'n/0001-a.md:1: the path says 0001 and the title says 0002: correct the one that is wrong, by renaming the file or editing the title',
    ])
    expect(own(v)).toEqual([])
  })

  it('agreeing sides are green', () => {
    expect(messages(run(notes({ 'n/0001-a.md': '# Note 0001: a\n' })))).toEqual([])
  })

  it('normalize applies to both sides, and a difference after it says so', () => {
    const c = notes({ 'n/0042-a.md': '# Note 42: a\n', 'n/0043-b.md': '# Note 44: b\n' })
    const o: AgreeWithPathOptions = {
      path: PATH,
      title: /^Note (?<value>\d+):/,
      normalize: (v) => String(Number(v)),
    }
    expect(said(run(c, o))).toEqual([
      'n/0043-b.md:1: the path says 0043 and the title says 44 (after normalize): correct the one that is wrong, by renaming the file or editing the title',
    ])
  })
})

describe('agreeWithPath: a side that cannot be read', () => {
  const good = { 'n/0001-a.md': '# Note 0001: a\n' }

  it('P1: a path the pattern does not read is red, naming the path and the pattern', () => {
    expect(said(run(notes({ ...good, 'n/notes.md': '# Note 0002: x\n' })))).toEqual([
      `n/notes.md:1: n/notes.md holds no value the path pattern reads (${String(PATH)}): name the file as the pattern expects, or widen the pattern`,
    ])
  })

  it("P2: no title is titleFault's own message, verbatim, for each of its causes", () => {
    const c = notes({
      ...good,
      'n/0002-b.md': 'No heading at all.\n',
      'n/0003-c.md': '## Note 0003: deep\n',
      'n/0004-d.md': '> # Note 0004: quoted\n\n## Body\n',
    })
    expect(said(run(c))).toEqual([
      'n/0002-b.md:1: no title: the document has no heading',
      'n/0003-c.md:1: no title: the first heading, "Note 0003: deep" at line 1, is at depth 2',
      'n/0004-d.md:3: no title: the first heading, "Body" at line 3, is at depth 2; the heading "Note 0004: quoted" at line 1 is inside a blockquote, which does not start a section',
    ])
  })

  it('P3: a title the pattern does not read is red, quoting the title and the pattern', () => {
    expect(said(run(notes({ ...good, 'n/0002-b.md': '# 0002 — another form\n' })))).toEqual([
      `n/0002-b.md:1: its title "0002 — another form" holds no value the title pattern reads (${String(TITLE)})`,
    ])
  })

  it('a document failing on both sides reports both', () => {
    expect(said(run(notes({ ...good, 'n/b.md': '# Elsewhere\n' })))).toEqual([
      `n/b.md:1: n/b.md holds no value the path pattern reads (${String(PATH)}): name the file as the pattern expects, or widen the pattern`,
      `n/b.md:1: its title "Elsewhere" holds no value the title pattern reads (${String(TITLE)})`,
    ])
  })

  it('an empty capture is no value: two empty sides never agree', () => {
    const o: AgreeWithPathOptions = { path: /(?<value>\d*)-x\.md$/, title: /^Note (?<value>\d*)/ }
    const c = notes({ 'n/0001-x.md': '# Note 0001\n', 'n/-x.md': '# Note \n' })
    expect(said(run(c, o))).toEqual([
      `n/-x.md:1: n/-x.md holds no value the path pattern reads (${String(o.path)}): name the file as the pattern expects, or widen the pattern`,
      `n/-x.md:1: its title "Note" holds no value the title pattern reads (${String(o.title)})`,
    ])
  })

  it('an empty capture is no value even when normalize would make one of it', () => {
    // Number('') is 0, so without the check an empty path capture would agree with a title's 0.
    const o: AgreeWithPathOptions = {
      path: /(?<value>\d*)-x\.md$/,
      title: /^Note (?<value>\d+)/,
      normalize: (v) => String(Number(v)),
    }
    const c = notes({ 'n/0001-x.md': '# Note 1\n', 'n/-x.md': '# Note 0\n' })
    expect(said(run(c, o))).toEqual([
      `n/-x.md:1: n/-x.md holds no value the path pattern reads (${String(o.path)}): name the file as the pattern expects, or widen the pattern`,
    ])
  })

  it('a value normalize makes empty is no value', () => {
    const o: AgreeWithPathOptions = { ...OPTS, normalize: (v) => (v === '0002' ? '' : v) }
    const c = notes({ ...good, 'n/0002-b.md': '# Note 0002: b\n' })
    expect(said(run(c, o))).toEqual([
      `n/0002-b.md:1: n/0002-b.md holds no value the path pattern reads (${String(PATH)}): name the file as the pattern expects, or widen the pattern`,
      `n/0002-b.md:1: its title "Note 0002: b" holds no value the title pattern reads (${String(TITLE)})`,
    ])
  })
})

describe('agreeWithPath: the value group', () => {
  it('an alternation reads `value` from whichever branch matched, on each side', () => {
    const o: AgreeWithPathOptions = {
      path: /(?:^|\/)(?:(?<value>\d{4})-[^/]*\.md|(?<value>\d{4})-[^/]*\/README\.md)$/,
      title: /^(?:Note (?<value>\d{4}):|(?<value>\d{4}) —)/,
    }
    const c = notes({
      'n/0001-a.md': '# Note 0001: a\n',
      'n/0002-b.md': '# 0002 — b\n',
      'n/0003-c/README.md': '# 0003 — c\n',
    })
    expect(messages(run(c, o))).toEqual([])
  })

  it('the leftmost match is read: an unanchored pattern reads the record a title names first', () => {
    const c = notes({ 'n/0001-a.md': '# Note 0001: follows Note 0002: x\n' })
    expect(said(run(c, { ...OPTS, title: /Note (?<value>\d{4}):/ }))).toEqual([])
    // A second note the anchored pattern reads, so a miss is that note's own P3, not one P5.
    const first = notes({
      'n/0001-a.md': '# About Note 0002: then Note 0001: x\n',
      'n/0003-c.md': '# Note 0003: c\n',
    })
    expect(said(run(first, { ...OPTS, title: /Note (?<value>\d{4}):/ }))).toEqual([
      'n/0001-a.md:1: the path says 0001 and the title says 0002: correct the one that is wrong, by renaming the file or editing the title',
    ])
    expect(said(run(first, OPTS))).toEqual([
      `n/0001-a.md:1: its title "About Note 0002: then Note 0001: x" holds no value the title pattern reads (${String(TITLE)})`,
    ])
  })

  it('a pattern without a `value` group is refused at the call, naming the option', () => {
    for (const o of [
      { path: /(\d{4})-/, title: TITLE },
      { path: PATH, title: /^Note (\d{4})/ },
    ]) {
      const refused = (): unknown =>
        docs(notes({ 'n/0001-a.md': '# Note 0001: a\n' }))
          .should()
          .agreeWithPath(o)
      expect(refused).toThrow(/has no named group `value`/)
      try {
        refused()
      } catch (e) {
        expect(isArchConfigError(e)).toBe(true)
        expect(String(e)).toMatch(o.path === PATH ? /title \/\^Note/ : /path \//)
      }
    }
  })

  it("a caller's g or y flag shares no lastIndex: two runs read alike", () => {
    const c = notes({ 'n/0001-a.md': '# Note 0001: a\n', 'n/0002-b.md': '# Note 0002: b\n' })
    const o: AgreeWithPathOptions = { path: /(?<value>\d{4})-/gy, title: /^Note (?<value>\d{4})/g }
    expect(messages(run(c, { ...o, path: /(?:^|\/)(?<value>\d{4})-/g }))).toEqual([])
    expect(messages(run(c, { ...o, path: /(?:^|\/)(?<value>\d{4})-/g }))).toEqual([])
  })
})

describe('agreeWithPath: one mistake, one finding (P5)', () => {
  const c = notes({
    'n/0001-a.md': '# Note 0001: a\n',
    'n/0002-b.md': '# Note 0002: b\n',
    'n/0003-c.md': '# Note 0003: c\n',
  })

  it('a title pattern that reads no title is one unsuppressable finding, and no P3 per document', () => {
    const typo = { ...OPTS, title: /^Nte (?<value>\d{4}):/ }
    const v = run(c, typo)
    expect(said(v)).toEqual([])
    expect(own(v)).toEqual([
      `selected 3 documents, judged none: the title pattern ${String(typo.title)} read none of 3 titles`,
    ])
    expect(v.filter((x) => x.bypassFilters === true)[0]?.file).toMatch(/0001-a\.md$/)
  })

  it('the same for the path pattern', () => {
    const typo = { ...OPTS, path: /(?:^|\/)(?<value>\d{5})-/ }
    const v = run(c, typo)
    expect(said(v)).toEqual([])
    expect(own(v)).toEqual([
      `selected 3 documents, judged none: the path pattern ${String(typo.path)} read none of 3 paths`,
    ])
  })

  it('a selection where no document has a title: a P2 each, and no title-pattern cause', () => {
    const untitled = notes({ 'n/0001-a.md': 'text\n', 'n/0002-b.md': 'text\n' })
    const v = run(untitled)
    expect(said(v)).toEqual([
      'n/0001-a.md:1: no title: the document has no heading',
      'n/0002-b.md:1: no title: the document has no heading',
    ])
    expect(own(v)).toEqual([
      'selected 2 documents, judged none: none of the 2 documents has a title',
    ])
  })
})

/**
 * A mixed selection: one note reads only its path, one only its title, so nothing is judged and no
 * single pattern read nothing. Only the agreement's own finding stands once the documents' findings
 * are suppressed, so these rows are red through it or not at all.
 */
describe('agreeWithPath: a selection that judged none', () => {
  const MIXED = notes({
    'n/0001-a.md': '# Elsewhere\n',
    'n/b.md': '# Note 0002: b\n',
  })
  const NONE =
    'selected 2 documents, judged none: the path pattern read 1 and the title pattern 1, but none on the same document'

  it('is one finding naming both counts, and no suppression removes it', () => {
    const rule = docs(MIXED).should().agreeWithPath(OPTS)
    expect(own(rule.violations())).toEqual([NONE])
    expect(rule.violations().find((v) => v.message === NONE)?.bypassFilters).toBe(true)
    const suppressed = rule.excluding(/.*/).violations()
    expect(suppressed.map((v) => v.message)).toEqual([NONE])
  })

  it('beside another condition, red, and examined is the selection', () => {
    const v = docs(MIXED)
      .should()
      .agreeWithPath(OPTS)
      .andShould()
      .beUniqueBy((d) => d.relPath, 'path')
      .excluding(/.*/)
      .violations()
    expect(v.examined).toBe(2)
    expect(v.map((x) => x.message)).toEqual([NONE])
  })

  it('on a rule declared empty, the kernel says the declaration expired', () => {
    const v = docs(MIXED).should().agreeWithPath(OPTS).expectEmpty().excluding(/.*/).violations()
    expect(v.some((x) => /declared \.expectEmpty\(\) but examined 2/.test(x.message))).toBe(true)
    expect(v.map((x) => x.message)).toContain(NONE)
  })

  it('beside a second agreement that judges its documents, still reported', () => {
    const v = docs(MIXED)
      .should()
      .agreeWithPath({ path: /(?<value>[ab])[^/]*\.md$/, title: /(?<value>[ab])$/ })
      .andShould()
      .agreeWithPath(OPTS)
      .excluding(/.*/)
      .violations()
    expect(v.map((x) => x.message)).toEqual([NONE])
  })
})

describe('agreeWithPath: run state', () => {
  it('two forks of one chain, run alternately, each read their own run', () => {
    const c = notes({
      'n/0001-a.md': '# Elsewhere\n',
      'n/b.md': '# Note 0002: b\n',
      'm/0003-c.md': '# Note 0003: c\n',
    })
    const chain = docs(c).should().agreeWithPath(OPTS)
    const mixed = chain.fork().that().resideInFolder('n/**')
    const good = chain.fork().that().resideInFolder('m/**')
    for (let i = 0; i < 2; i++) {
      expect(own(mixed.violations())).toHaveLength(1)
      expect(messages(good.violations())).toEqual([])
    }
  })

  it('a fork that selects nothing gets the kernel finding, not the agreement one', () => {
    const c = notes({ 'n/0001-a.md': '# Note 0001: a\n' })
    const v = docs(c).that().resideInFolder('none/**').should().agreeWithPath(OPTS).violations()
    expect(own(v).some((m) => m.startsWith('selected'))).toBe(false)
  })

  it('a frozen document is judged', () => {
    const c = notes({ 'done/0001-a.md': '# Note 0002: a\n' }, ['done/**'])
    expect(said(run(c))).toHaveLength(1)
  })
})
