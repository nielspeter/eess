/**
 * Plan 0647: `mentions(corpus, { pattern, keepBackticks: true })` reads inline code with its
 * backticks kept, and each mention says which of the pattern's groups lie wholly inside one code
 * span (`codeGroups`). Every row drives the public entry point over `corpusFromText`.
 */
import { describe, it, expect } from 'vitest'
import { collectMentions, corpusFromText, mentions, type MdMention } from '../../src/index.js'
import { fromMarkdown } from 'mdast-util-from-markdown'

/** The stock pattern, frozen by value in plan 0647. A fresh copy per use. */
const named = (): RegExp =>
  /`(?<name>[A-Za-z_$][\w$.]*)(?:\([^`)]*\))?`(?<gap>[^`\n]{0,12})`(?<path>[\w./@-]+\.[A-Za-z]+):(?<line>\d+)(?:-(?<end>\d+))?`/g

const read = (text: string, keepBackticks: boolean | undefined, pattern = named()): MdMention[] =>
  mentions(corpusFromText({ 'a.md': text }), {
    pattern,
    ...(keepBackticks === undefined ? {} : { keepBackticks }),
  })
    .select({ label: 'm', identify: (m) => ({ name: m.text }) })
    .elements.slice()

const REFERENCE = '# A\n\nSee `pathSuffixIndex` (`packages/core/src/path-suffix.ts:48`) here.\n'

describe('plan 0647: a mention reading that keeps backticks', () => {
  it('reads a name and its pointer, each in its own code span, with every group in code', () => {
    const found = read(REFERENCE, true)
    expect(found).toHaveLength(1)
    const [m] = found
    expect(m?.groups).toMatchObject({
      name: 'pathSuffixIndex',
      path: 'packages/core/src/path-suffix.ts',
      line: '48',
    })
    expect([...(m?.codeGroups ?? [])].sort()).toEqual(['line', 'name', 'path'])
    expect(m?.text).toBe('`pathSuffixIndex` (`packages/core/src/path-suffix.ts:48`')
    expect(m?.line).toBe(3)
  })

  it('without the opt-in, the stock pattern finds nothing and no mention carries codeGroups', () => {
    expect(read(REFERENCE, undefined)).toEqual([])
    expect(read(REFERENCE, false)).toEqual([])
    const plain = read(REFERENCE, undefined, /pathSuffixIndex/g)
    expect(plain).toHaveLength(1)
    expect(plain[0]?.inCode).toBe(true)
    expect(plain[0]).not.toHaveProperty('codeGroups')
  })

  it('a name forged from escaped backticks is matched but is not code', () => {
    const found = read('# A\n\nA literal \\`alpha\\` (`a.ts:1`) stands here.\n', true)
    expect(found).toHaveLength(1)
    expect(found[0]?.groups.name).toBe('alpha')
    expect([...(found[0]?.codeGroups ?? [])].sort()).toEqual(['line', 'path'])
  })

  it('a code span holding a backtick is one span, judged by its interior', () => {
    const found = read('# A\n\n``a`b`` then `x` (`a.ts:2`).\n', true, /`(?<code>[^`]*`[^`]*)`/g)
    // The first match is the double-backtick span's interior; the second straddles `x` and prose.
    expect(found.map((m) => [m.groups.code, m.codeGroups])).toEqual([
      ['a`b', ['code']],
      ['x` (', []],
    ])
  })

  it('a group that did not capture is not in codeGroups', () => {
    const found = read(REFERENCE, true)
    expect(found[0]?.groups).not.toHaveProperty('end')
    expect(found[0]?.codeGroups).not.toContain('end')
  })

  it('a group that spans two code spans, or code and prose, is not in codeGroups', () => {
    const found = read('# A\n\nSee `one` and `two` here.\n', true, /(?<both>`one` and `two`)/g)
    expect(found).toHaveLength(1)
    expect(found[0]?.groups.both).toBe('`one` and `two`')
    expect(found[0]?.codeGroups).toEqual([])
  })

  it('a match across a soft break keeps its line and its code groups', () => {
    const found = read(
      '# A\n\nSee `pathSuffixIndex`\n(`packages/core/src/path-suffix.ts:48`).\n',
      true,
      /`(?<name>\w+)`\s*\(`(?<path>[\w./-]+):(?<line>\d+)`/g,
    )
    expect(found).toHaveLength(1)
    expect(found[0]?.line).toBe(3)
    expect([...(found[0]?.codeGroups ?? [])].sort()).toEqual(['line', 'name', 'path'])
  })

  it('a match inside a link keeps its place in the link text, backticks counted', () => {
    const found = read('# A\n\n[see `alpha` (`a.ts:1`)](./b.md)\n', true)
    expect(found).toHaveLength(1)
    const link = found[0]?.link
    expect(link?.text).toBe('see `alpha` (`a.ts:1`)')
    expect(link?.offset).toBe(4)
    expect([...(found[0]?.codeGroups ?? [])].sort()).toEqual(['line', 'name', 'path'])
  })

  it("a match that opens on a link's first backtick is placed in that link", () => {
    const found = read('# A\n\nSee [`alpha` (`a.ts:1`)](./b.md) here.\n', true)
    expect(found).toHaveLength(1)
    expect(found[0]?.link?.text).toBe('`alpha` (`a.ts:1`)')
    expect(found[0]?.link?.offset).toBe(0)
  })

  it('a match that runs from prose onto code has no source span; one in prose keeps it', () => {
    const doc = '# A\n\nsee `foo` and a lone \\` tick here.\n'
    const onto = read(doc, true, /see `foo`/g)
    expect(onto).toHaveLength(1)
    expect(onto[0]).not.toHaveProperty('span')
    const prose = read(doc, true, /a lone/g)
    expect(prose[0]?.span).toBeDefined()
  })

  it('the shape of bug 0608: a backslash inside a code span shifts the spans; the name is not code', () => {
    // bug 0608, lines 23-26, by value. The code span `suggestion: \` ends at its backslash, so the
    // backticks after it pair differently, and the stock pattern matches across the shifted spans.
    const paragraph =
      'Every `emitter/*` finding is built by `emitterFinding` with `suggestion: \\`${message} ${UNSUPPRESSABLE}\\``\n(`packages/core/src/emitter-findings.ts:142`). The formatters skip a `Fix:` line only when the\nsuggestion equals the message (`remedyRepeatsMessage`, `packages/core/src/violation.ts:189-191`).\nA suggestion that starts with the message is not caught. The docstring above it\n'
    const found = read(`# A\n\n${paragraph}`, true)
    expect(found.length).toBeGreaterThan(0)
    for (const m of found) expect(m.codeGroups).not.toContain('name')
  })

  it('a group whose capture includes its own backticks is not in codeGroups', () => {
    const found = read(REFERENCE, true, /(?<ticked>`pathSuffixIndex`)/g)
    expect(found).toHaveLength(1)
    expect(found[0]?.codeGroups).toEqual([])
  })

  it('a match that opens on the backtick of a code span holding a line break keeps its line', () => {
    const found = read('# A\n\nSee `one\ntwo` (`a.ts:1`).\n', true, /`one[\s\S]*?`/g)
    expect(found).toHaveLength(1)
    expect(found[0]?.line).toBe(3)
  })

  it("a caller's pattern that already carries the d flag reads under the opt-in", () => {
    const found = read(REFERENCE, true, new RegExp(named().source, 'gd'))
    expect(found).toHaveLength(1)
    expect([...(found[0]?.codeGroups ?? [])].sort()).toEqual(['line', 'name', 'path'])
  })

  it('one RegExp object read first without the opt-in, then with it, gives the right codeGroups', () => {
    const shared = named()
    expect(read(REFERENCE, false, shared)).toEqual([])
    const found = read(REFERENCE, true, shared)
    expect([...(found[0]?.codeGroups ?? [])].sort()).toEqual(['line', 'name', 'path'])
  })

  it('text the reading cannot see is still searched with backticks kept, and reported unread', () => {
    const c = corpusFromText({
      'a.md':
        '# A\n\nSee [`alpha` (`a.ts:1`)][r] and <a href="x">`beta` (`b.ts:2`) here.\n\n[r]: ./r.md\n',
    })
    const rule = mentions(c, { pattern: named(), keepBackticks: true })
    const said = rule.violations().map((v) => v.message)
    expect(said.some((m) => m.includes('`alpha`') && m.includes('reference-style link'))).toBe(true)
    expect(said.some((m) => m.includes('`beta`') && m.includes('HTML'))).toBe(true)
  })

  it('an <a> that holds another link is searched with backticks kept, and reported unread', () => {
    const c = corpusFromText({
      'a.md': '# A\n\nSee <a href="x">`gamma` (`c.ts:3`) and [y](./y.md)</a> here.\n',
    })
    const said = mentions(c, { pattern: named(), keepBackticks: true })
      .violations()
      .map((v) => v.message)
    expect(said.some((m) => m.includes('`gamma`') && m.includes('HTML'))).toBe(true)
  })

  it('collectMentions takes the same opt-in', () => {
    const root = fromMarkdown(REFERENCE)
    expect(collectMentions(root, named()).mentions).toEqual([])
    expect(collectMentions(root, /pathSuffixIndex/g).mentions[0]).not.toHaveProperty('codeGroups')
    const { mentions: found } = collectMentions(root, named(), { keepBackticks: true })
    expect(found).toHaveLength(1)
    expect([...(found[0]?.codeGroups ?? [])].sort()).toEqual(['line', 'name', 'path'])
  })
})
