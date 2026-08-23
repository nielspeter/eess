import { describe, it, expect } from 'vitest'
import { parseExclusionComments } from '../src/exclusion-comments.js'

/**
 * Bug 0154 — a directive that is not a directive.
 *
 * `parseExclusionComments` scans raw source line by line with a bare regex, so
 * it has no notion of where a line sits in the syntax. Text that merely LOOKS
 * like `// eess-exclude …` — inside a string literal, a template literal, or
 * prose describing the grammar — is parsed as a real waiver and silently
 * suppresses a genuine finding on the following line.
 *
 * That is the severe direction: a suppression nobody wrote. The tests below fix
 * both directions, because a parser that stops seeing real directives is just as
 * broken as one that invents them.
 */
describe('a directive only counts where a comment can appear', () => {
  const at = (text: string) => parseExclusionComments(text, 'probe.ts').exclusions

  it('does not treat a directive inside a double-quoted string as a waiver', () => {
    const src = [
      'const doc = "// eess-exclude some/rule: not a real waiver"',
      'export const x = 1',
    ].join('\n')
    expect(at(src)).toHaveLength(0)
  })

  it('does not treat a directive inside a template literal as a waiver', () => {
    const src = [
      'const doc = `// eess-exclude some/rule: not a real waiver`',
      'export const x = 1',
    ].join('\n')
    expect(at(src)).toHaveLength(0)
  })

  it('does not treat a directive inside a single-quoted string as a waiver', () => {
    const src = [
      "const doc = '// eess-exclude some/rule: not a real waiver'",
      'export const x = 1',
    ].join('\n')
    expect(at(src)).toHaveLength(0)
  })

  // The other direction — a parser that stopped seeing real directives would
  // pass every test above.
  it('still reads a real line comment directive', () => {
    const src = ['// eess-exclude some/rule: a real waiver', 'export const x = 1'].join('\n')
    expect(at(src)).toHaveLength(1)
  })

  it('still reads a real directive trailing real code', () => {
    const src = ['export const x = 1 // eess-exclude some/rule: a real waiver'].join('\n')
    expect(at(src)).toHaveLength(1)
  })

  // The HTML forms exist for text dialects whose sources have no `//`. In a
  // code file `// <!-- eess-exclude … -->` is prose describing the grammar — and
  // reading it there accounted for the last two of `exclusion-comments.ts`'s own
  // false hits. So the form is live by file kind, not everywhere.
  it('still reads a real HTML-comment directive in a text file', () => {
    const src = ['<!-- eess-exclude some/rule: a real waiver -->', 'text'].join('\n')
    expect(parseExclusionComments(src, 'notes.md').exclusions).toHaveLength(1)
  })

  it('ignores an HTML-comment directive in a code file', () => {
    const src = [
      '// <!-- eess-exclude some/rule: prose about the grammar -->',
      'export const x = 1',
    ].join('\n')
    expect(parseExclusionComments(src, 'probe.ts').exclusions).toHaveLength(0)
  })

  // The parser's own documentation is the case that motivated bug 0154's second
  // half: it described the grammar 12 times and read every description as live.
  it('does not read its own grammar documentation as directives', () => {
    const src = [
      '// Single-line: // eess-exclude <rule-id>[, <rule-id>]: <reason>',
      '// Block start: // eess-exclude-start <rule-id>: <reason>',
      '// <!-- eess-exclude <rule-id>: <reason> -->',
      'export const x = 1',
    ].join('\n')
    expect(at(src)).toHaveLength(0)
  })
})
