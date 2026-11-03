import { describe, expect, it } from 'vitest'
import { ArchConfigError } from '@nielspeter/eess'
import { corpusFromText, mentions } from '../../src/index.js'

// Bug 0600: `mentions().select()` dropped a mention it cannot read (inside a raw HTML block, an HTML
// link, an image's alt text …) without a word, so a selection fed to `correspondence()` was short.
// It now refuses, naming each cause, as `links().select()` does (plan 0580, R7).

const identify = (m: { line: number; text: string }) => ({ name: `${String(m.line)} ${m.text}` })
const pattern = /\bbug (?<id>\d{4})\b/g

describe('mentions().select() refuses when it reaches an unread mention (bug 0600)', () => {
  it('refuses, naming the unread mention’s line and cause', () => {
    const c = corpusFromText({ 'docs/a.md': '# A\n\n<div>\nbug 0001\n</div>\n\nbug 0002.\n' })
    let thrown: unknown
    try {
      mentions(c, { pattern }).select({ label: 'mentions', identify })
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(ArchConfigError)
    expect(String(thrown)).toMatch(/docs\/a\.md:4/)
    expect(String(thrown)).toMatch(/raw HTML/)
  })

  it('a document with no unread mention selects as before', () => {
    const c = corpusFromText({ 'docs/a.md': '# A\n\nbug 0001 and bug 0002.\n' })
    expect(
      mentions(c, { pattern })
        .select({ label: 'mentions', identify })
        .elements.map((m) => m.text),
    ).toEqual(['bug 0001', 'bug 0002'])
  })

  it('an unread mention a predicate leaves out does not refuse', () => {
    const c = corpusFromText({
      'docs/a.md': '# A\n\nbug 0002.\n',
      'docs/b.md': '# B\n\n<div>\nbug 0001\n</div>\n',
    })
    expect(
      mentions(c, { pattern })
        .that()
        .resideInFile('docs/a.md')
        .select({ label: 'mentions', identify })
        .elements.map((m) => m.text),
    ).toEqual(['bug 0002'])
  })
})
