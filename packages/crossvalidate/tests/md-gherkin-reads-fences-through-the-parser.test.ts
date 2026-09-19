import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { corpus } from '@nielspeter/eess-md'
import { features } from '@nielspeter/eess-gherkin'
import { scenarioCitationsResolve } from '../src/md-gherkin.js'

/**
 * Bug 0287 — the scenario-citation preset set fenced examples aside with a hand-rolled regex that read a
 * triple-backtick run inside a longer fence as a closer. It blanked the real citations below such an
 * example, and read the citations inside one. It now reads prose through eess-md's parser, setting aside
 * a fence that closes; a fence that never closes is read past, since this preset does not report one.
 */
function unresolved(text: string): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'citations-fences-'))
  mkdirSync(join(dir, 'features'))
  writeFileSync(join(dir, 'features/ok.feature'), 'Feature: ok\n  Scenario: fine\n    Given x\n')
  // A second document with a resolving citation, so the preset examines something whatever this one yields.
  writeFileSync(join(dir, 'anchor.md'), 'See `features/ok.feature`.\n')
  writeFileSync(join(dir, 'a.md'), text)
  return scenarioCitationsResolve(
    corpus({ cwd: dir, roots: ['*.md'] }),
    features({ cwd: dir, roots: ['features/**'] }),
    { report: 'return' },
  ).map((v) => /`([^`]+)`/.exec(v.message)?.[1] ?? v.message)
}

describe('bug 0287: scenario citations pair fences with the markdown parser', () => {
  it('a citation below a longer fence holding a lone shorter run is read', () => {
    const below = (open: string, run: string, close: string): string =>
      [
        '# x',
        '',
        open,
        run,
        close,
        '',
        'See `features/real.feature`.',
        '',
        close.slice(1) + 'text',
        'later',
        close.slice(1),
        '',
      ].join('\n')

    expect(unresolved(below('````md', '```', '````'))).toEqual(['features/real.feature'])
    expect(unresolved(below('~~~~md', '~~~', '~~~~'))).toEqual(['features/real.feature'])
  })

  it('a citation inside a closed fence of any length is an example and is not read', () => {
    const inside = (lines: readonly string[]): string =>
      ['# x', '', ...lines, '', 'See `features/ok.feature`.', ''].join('\n')
    const example = 'See `features/example.feature`.'

    expect(unresolved(inside(['````md', '```', example, '```', '````']))).toEqual([])
    expect(unresolved(inside(['~~~~md', '~~~', example, '~~~', '~~~~']))).toEqual([])
    // A fence its list item closes is closed too.
    expect(unresolved(inside(['- note:', '  ```md', `  ${example}`, '- another note']))).toEqual([])
  })

  it('a citation after a fence that never closes is still read', () => {
    expect(
      unresolved(
        ['# x', '', '```md', 'an example', '', 'See `features/real.feature`.', ''].join('\n'),
      ),
    ).toEqual(['features/real.feature'])
  })
})
