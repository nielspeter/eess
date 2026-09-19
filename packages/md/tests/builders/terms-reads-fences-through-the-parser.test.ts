import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { corpus, terms, vocabulary } from '../../src/index.js'

/**
 * Bug 0287 — `terms()` set fenced examples aside with a hand-rolled regex that read a triple-backtick
 * run inside a longer fence as a closer. It blanked the real references below such an example, and read
 * the references inside one. It now reads prose through the dialect's parser, setting aside a fence that
 * closes; a fence that never closes is read past, since a builder cannot report it.
 */
function unresolved(text: string): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'terms-fences-'))
  // A second document with a known reference, so the rule examines something whatever this one yields.
  writeFileSync(join(dir, 'anchor.md'), '**Context:** Known\n')
  writeFileSync(join(dir, 'a.md'), text)
  const c = corpus({ cwd: dir, roots: ['*.md'] })
  return terms(c, { label: /\*\*Context:\*\*/ })
    .should()
    .resolveAgainst(vocabulary(c, { terms: ['Known'] }))
    .violations()
    .map((v) => /'([^']+)'/.exec(v.message)?.[1] ?? v.message)
}

describe('bug 0287: terms() pairs fences with the markdown parser', () => {
  it('a reference below a longer fence holding a lone shorter run is read', () => {
    const below = (open: string, run: string, close: string): string =>
      [
        '# x',
        '',
        open,
        run,
        close,
        '',
        '**Context:** Real',
        '',
        close.slice(1) + 'text',
        'later',
        close.slice(1),
        '',
      ].join('\n')

    expect(unresolved(below('````md', '```', '````'))).toEqual(['Real'])
    expect(unresolved(below('~~~~md', '~~~', '~~~~'))).toEqual(['Real'])
  })

  it('a reference inside a closed fence of any length is an example and is not read', () => {
    const inside = (lines: readonly string[]): string =>
      ['# x', '', ...lines, '', '**Context:** Known', ''].join('\n')

    expect(unresolved(inside(['````md', '```', '**Context:** Example', '```', '````']))).toEqual([])
    expect(unresolved(inside(['~~~~md', '~~~', '**Context:** Example', '~~~', '~~~~']))).toEqual([])
    // A fence its list item closes is closed too.
    expect(
      unresolved(inside(['- note:', '  ```md', '  **Context:** Example', '- another note'])),
    ).toEqual([])
  })

  it('a reference after a fence that never closes is still read', () => {
    expect(
      unresolved(['# x', '', '```md', 'an example', '', '**Context:** Real', ''].join('\n')),
    ).toEqual(['Real'])
  })
})
