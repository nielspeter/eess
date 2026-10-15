import { describe, expect, it } from 'vitest'
import { parseExclusionComments } from '../src/exclusion-comments.js'

/**
 * Bug 0419, against ADR-012's second property: "when it cannot prove a span is a comment, it does
 * not treat it as one. A directive is dropped rather than a violation silently suppressed."
 *
 * The kernel lexes code (JavaScript and TypeScript, Vue, Svelte) and Markdown. For any other file
 * it cannot prove a span is a comment, so it reads no directive at all. It used to read such a
 * file as JavaScript, which turned `//` text inside a Gherkin doc string or a YAML block scalar
 * into a waiver.
 */
describe('a file type the kernel cannot lex yields no directives (bug 0419)', () => {
  const text = [
    'Feature: x',
    '  Scenario: y',
    '    Given a doc string',
    '      """',
    '      // eess-exclude-start some/rule: prose inside a doc string',
    '      """',
    '    Then z',
    '      """',
    '      // eess-exclude-end',
    '      """',
    '// eess-exclude some/rule: even a line that looks like a JavaScript comment',
    '      """',
    '      <!-- eess-exclude-start some/rule: the HTML form, inside a doc string -->',
    '      """',
    '<!-- eess-exclude some/rule: even a line that looks like an HTML comment -->',
  ].join('\n')

  for (const file of [
    'features/a.feature',
    'config/a.yml',
    'config/a.yaml',
    'app/a.py',
    'docs/a.mmd',
    'schema/a.graphql',
    'notes.txt',
  ]) {
    it(`reads none in ${file}`, () => {
      expect(parseExclusionComments(text, file).exclusions).toEqual([])
    })
  }

  // eess-ts injects its own masker for every file, so the default has to hold over an injected one
  // (ADR-012's third property). The identity masker blanks nothing; the other blanks only `//`
  // lines, the review's probe for a default that forgot the HTML form.
  const identity = (text: string): string => text
  const blankSlashes = (text: string): string =>
    text
      .split('\n')
      .map((line) => (line.trimStart().startsWith('//') ? ' '.repeat(line.length) : line))
      .join('\n')
  for (const [name, mask] of [
    ['an identity masker', identity],
    ['a masker that blanks only //', blankSlashes],
  ] as const) {
    it(`reads none in a .feature file with ${name} injected`, () => {
      expect(parseExclusionComments(text, 'features/a.feature', { mask }).exclusions).toEqual([])
    })
  }

  it('still reads a directive in a JavaScript file and in a Markdown file', () => {
    const js = '// eess-exclude some/rule: a real comment\nexport const x = 1\n'
    expect(parseExclusionComments(js, 'src/a.ts').exclusions).toHaveLength(1)
    const md = '<!-- eess-exclude some/rule: a real comment -->\ntext\n'
    expect(parseExclusionComments(md, 'docs/a.md').exclusions).toHaveLength(1)
  })
})
