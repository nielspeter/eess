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
    // A fence its list item ends has no closing line, so it is not certainly an example: its reference
    // is read, as the regex this replaced read it.
    expect(
      unresolved(inside(['- note:', '  ```md', '  **Context:** Example', '- another note'])),
    ).toEqual(['Example'])
  })

  it('a reference inside a fence written in an HTML block is an example', () => {
    // CommonMark reads the fence as raw HTML, so the parser has no code node for it. The author fenced
    // it as an example, and the copy this replaced set it aside (bug 0287's review).
    const inHtml = (open: string, close: string): string =>
      [
        '# x',
        '',
        open,
        '<summary>example</summary>',
        '```md',
        '**Context:** Example',
        '```',
        close,
        '',
        '**Context:** Known',
        '',
      ].join('\n')

    expect(unresolved(inHtml('<details>', '</details>'))).toEqual([])
    expect(unresolved(inHtml('<div>', '</div>'))).toEqual([])

    // However far the block's body is indented: inside an HTML block, indentation means nothing.
    for (const indent of ['  ', '    ', '\t']) {
      const indented = [
        '# x',
        '',
        '<details>',
        '<summary>example</summary>',
        `${indent}\`\`\`md`,
        `${indent}**Context:** Example`,
        `${indent}\`\`\``,
        '</details>',
        '',
        '**Context:** Known',
        '',
      ].join('\n')

      expect(unresolved(indented)).toEqual([])
    }

    // Paired by run length there too: the lone inner run is content, not the closer.
    const longer = [
      '# x',
      '',
      '<details>',
      '<summary>example</summary>',
      '````md',
      '```',
      '**Context:** Example',
      '````',
      '</details>',
      '',
      '**Context:** Known',
      '',
    ].join('\n')

    expect(unresolved(longer)).toEqual([])
  })

  it('a reference after a fence its list item leaves unclosed is still read', () => {
    // The list item ends the fence, but nothing closed it, so it is not certainly an example.
    const text = [
      '# x',
      '',
      '- note:',
      '  ```md',
      '  an example',
      '',
      '  **Context:** Real',
      '',
      'After the list.',
      '',
    ].join('\n')

    expect(unresolved(text)).toEqual(['Real'])
  })

  it('a reference after a fence that never closes is still read', () => {
    expect(
      unresolved(['# x', '', '```md', 'an example', '', '**Context:** Real', ''].join('\n')),
    ).toEqual(['Real'])
  })
})
