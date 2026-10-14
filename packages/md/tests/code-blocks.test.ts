import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { corpus } from '../src/index.js'

// Bug 0290: `codeBlocks` read the root's direct children only, so a block in a list item or a
// blockquote was never reached by anything that reads it (the md↔mermaid bindings).
const root = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/code-blocks')

describe('codeBlocks (bug 0290)', () => {
  it('holds every code block at any depth, in document order, at its fence line', () => {
    const doc = corpus({ roots: ['nested.md'], cwd: root }).documents()[0]
    expect(doc?.codeBlocks.map((b) => [b.lang, b.line, b.value])).toEqual([
      ['ts', 3, 'const top = 1'],
      ['mermaid', 9, 'classDiagram\nclass InList'],
      ['sh', 14, 'echo quoted'],
      ['json', 21, '{ "deep": true }'],
    ])
  })
})
