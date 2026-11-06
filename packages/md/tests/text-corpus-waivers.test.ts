import { describe, expect, it, vi } from 'vitest'
import { isArchConfigError } from '@nielspeter/eess'
import { corpus, corpusFromText, pointers, resolveFieldValue, type Corpus } from '../src/index.js'
import { tree } from './helpers/tree.js'

// Plan 0632, Phase 2 (ADR-024): `corpusFromText` registers its texts with the kernel and stops
// refusing waivers, so a directive in a text corpus behaves as it does on disk. Each case runs over
// a text corpus and over `corpus()` with the same files on disk, under a different root, and the two
// are compared by `relPath` (the text corpus's root is never on disk).

const RULE = 'demo/pointers'

/** A document whose line 4 points at a file the corpus does not hold, after `above` on line 3. */
const doc = (above: string): string => `# A\n\n${above}\nSee \`src/missing.ts:1\`.\n`

/** What the pointer rule reports, by relPath and line, and what it wrote to stderr, roots stripped. */
function run(c: Corpus, root: string): { found: string[]; stderr: string; examined: number } {
  const lines: string[] = []
  const spy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    lines.push(String(chunk))
    return true
  })
  try {
    const v = pointers(c).that().areLive().should().resolve().rule({ id: RULE }).violations()
    const relOf = (file: string): string => {
      const d = c.documents().find((x) => x.file === file)
      return d === undefined ? file : d.relPath
    }
    return {
      found: v.map((x) => `${relOf(x.file)}:${String(x.line)} ${x.message.split('\n')[0] ?? ''}`),
      // Each corpus's own root, stripped, so the two sides compare whatever the temp directory is.
      stderr: lines.join('').split(root).join('<root>'),
      examined: v.examined,
    }
  } finally {
    spy.mockRestore()
  }
}

/** The same files as a text corpus and as `corpus()` on disk, under a different root. */
function both(files: Readonly<Record<string, string>>) {
  const text = corpusFromText(files)
  const fromText = run(text, text.root)
  const cwd = tree(files)
  const onDisk = run(corpus({ cwd, roots: ['docs/**'] }), cwd)
  return { fromText, onDisk }
}

describe('a waiver in a text corpus applies as on disk (ADR-024)', () => {
  it('CONTROL: without a directive, the pointer is reported, the same on both', () => {
    const { fromText, onDisk } = both({ 'docs/a.md': doc('Plain text.') })
    expect(fromText.found).toEqual([expect.stringMatching(/^docs\/a\.md:4 /)])
    expect(fromText.found).toEqual(onDisk.found)
    expect(fromText.examined).toBeGreaterThan(0)
  })

  it('a waiver directive above the line waives it, the same on both', () => {
    const { fromText, onDisk } = both({
      'docs/a.md': doc(`<!-- eess-exclude ${RULE}: the target moves in a later step -->`),
    })
    expect(fromText.found).toEqual([])
    expect(onDisk.found).toEqual([])
    expect(fromText.examined).toBeGreaterThan(0)
  })

  it('an undocumented waiver is the promoted finding, the same on both', () => {
    const { fromText, onDisk } = both({ 'docs/a.md': doc(`<!-- eess-exclude ${RULE} -->`) })
    expect(fromText.found).toEqual([expect.stringMatching(/states no reason/)])
    expect(fromText.found).toEqual(onDisk.found)
  })

  it('an unused waiver warns on stderr, the same on both', () => {
    const text = `# A\n\n<!-- eess-exclude ${RULE}: covers a line with nothing on it -->\nPlain text.\n\nSee \`src/missing.ts:1\`.\n`
    const { fromText, onDisk } = both({ 'docs/a.md': text })
    expect(fromText.found).toEqual([expect.stringMatching(/^docs\/a\.md:6 /)])
    expect(fromText.stderr).toMatch(/suppressed nothing/)
    expect(fromText.stderr).toEqual(onDisk.stderr)
  })

  it('a malformed directive reaches stderr only on a document with a violation, the same on both', () => {
    const open = `<!-- eess-exclude-start ${RULE}: never ended -->`
    const withViolation = both({ 'docs/a.md': doc(open) })
    expect(withViolation.fromText.found).toEqual([expect.stringMatching(/^docs\/a\.md:4 /)])
    expect(withViolation.fromText.stderr).not.toEqual('')
    expect(withViolation.fromText.stderr).toEqual(withViolation.onDisk.stderr)
    const without = both({ 'docs/a.md': `# A\n\n${open}\nPlain text.\n` })
    expect(without.fromText.stderr).toEqual('')
    expect(without.onDisk.stderr).toEqual('')
  })

  it('a directive in a fenced block applies on neither side', () => {
    // A region opened inside the fence and closed after the pointer: read as prose, it would cover
    // the pointer's line and waive it. The fence masks the opening, so it waives nothing, on either
    // side. (A single-line directive inside the fence could only cover the fence's own closing line,
    // so it would pass whether the fence were masked or not.)
    const fenced = `# A\n\n\`\`\`md\n<!-- eess-exclude-start ${RULE}: shown, not applied -->\n\`\`\`\nSee \`src/missing.ts:1\`.\n<!-- eess-exclude-end -->\n`
    const { fromText, onDisk } = both({ 'docs/a.md': fenced })
    expect(fromText.found).toEqual([expect.stringMatching(/^docs\/a\.md:6 /)])
    expect(fromText.found).toEqual(onDisk.found)
  })
})

describe("a text corpus's root (ADR-024, plan 0632 D2)", () => {
  it('maps that differ in one text get different roots, and each waiver applies to its own finding', () => {
    const waived = corpusFromText({ 'docs/a.md': doc(`<!-- eess-exclude ${RULE}: a reason -->`) })
    const plain = corpusFromText({ 'docs/a.md': doc('Plain text.') })
    expect(waived.root).not.toEqual(plain.root)
    expect(run(waived, waived.root).found).toEqual([])
    expect(run(plain, plain.root).found).toHaveLength(1)
  })

  it('maps with the same texts under other keys get different roots, each waiver its own finding', () => {
    const text = doc(`<!-- eess-exclude ${RULE}: a reason -->`)
    const one = corpusFromText({ 'docs/a.md': text, 'docs/b.md': doc('Plain text.') })
    const other = corpusFromText({ 'docs/a.md': doc('Plain text.'), 'docs/b.md': text })
    expect(one.root).not.toEqual(other.root)
    expect(run(one, one.root).found).toEqual([expect.stringMatching(/^docs\/b\.md:4 /)])
    expect(run(other, other.root).found).toEqual([expect.stringMatching(/^docs\/a\.md:4 /)])
  })

  it('equal maps share one root', () => {
    const files = { 'docs/a.md': '# A\n', 'docs/b.md': '# B\n' }
    expect(corpusFromText({ ...files }).root).toEqual(corpusFromText({ ...files }).root)
  })

  const refusal = (files: Readonly<Record<string, string>>, root: string): string => {
    try {
      corpusFromText(files, { root })
    } catch (e) {
      return isArchConfigError(e) ? e.message : `not an ArchConfigError: ${String(e)}`
    }
    return 'no refusal'
  }

  it('a caller-set root reused with other text is refused, with eess-md remedy', () => {
    const root = '/eess-0632-test-root'
    expect(refusal({ 'docs/a.md': '# A\n' }, root)).toBe('no refusal')
    const second = refusal({ 'docs/a.md': '# B\n' }, root)
    expect(second).toMatch(/already claimed with other texts/)
    expect(second).toMatch(/If the cause is the root you set: leave `root` unset/)
  })

  it('a root under or above the default roots is refused with its own message', () => {
    expect(refusal({ 'docs/a.md': '# A\n' }, '/__eess_text_corpus__')).toMatch(
      /lies under or above '\/__eess_text_corpus__'/,
    )
    expect(refusal({ 'docs/a.md': '# A\n' }, '/__eess_text_corpus__/mine')).toMatch(
      /lies under or above/,
    )
  })

  it('with root unset, a kernel refusal the root cannot cause carries no root remedy', () => {
    const key = Symbol.for('@nielspeter/eess/source-text')
    const before: unknown = Reflect.get(globalThis, key)
    Reflect.set(globalThis, key, { version: 99, roots: new Map() })
    try {
      let message = 'no refusal'
      try {
        corpusFromText({ 'docs/a.md': '# A, forged registry\n' })
      } catch (e) {
        message = isArchConfigError(e) ? e.message : String(e)
      }
      expect(message).toMatch(/holds shape 99/)
      expect(message).not.toMatch(/leave `root` unset/i)
    } finally {
      Reflect.set(globalThis, key, before)
    }
  })

  it('a relative root is refused', () => {
    expect(refusal({ 'docs/a.md': '# A\n' }, 'relative/root')).toMatch(/is relative/)
  })
})

describe('ask 2: one record read from text (proposal 028, plan 0632 Phase 3)', () => {
  it('a record holding a waiver directive reads its field', () => {
    const text = `# Plan 9\n\n**Status:** Ready\n\n<!-- eess-exclude ${RULE}: an example the record keeps -->\n`
    const [d] = corpusFromText({ 'work/plans/0009-x.md': text }).documents()
    if (d === undefined) throw new Error('no document')
    expect(
      resolveFieldValue(d, { label: 'Status', forms: ['bold'], region: 'header' }),
    ).toMatchObject({ kind: 'value', values: ['Ready'] })
  })
})
