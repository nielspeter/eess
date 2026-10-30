import { describe, expect, it } from 'vitest'
import { corpusFromText, links } from '../src/index.js'

// Bug 0558 (b): a reference-style link whose definition was deleted or renamed is not a reference
// to the parser at all: `[text][gone]` stays text, GitHub shows the brackets, and no rule saw it.

const resolveOf = (text: string) =>
  links(corpusFromText({ 'docs/a.md': text }))
    .that()
    .areInternal()
    .should()
    .resolve()
    .violations()

const NO_DEFINITION = (label: string): string =>
  `the reference [${label}] has no definition, so it is not a link: add its definition ([${label}]: url), write it as a link ([text](url)), or put it in a code span if it is not one`

describe('a reference-style link with no definition is reported (bug 0558)', () => {
  it('a dangling full reference and a dangling collapsed one, each at its line', () => {
    const v = resolveOf('# A\n\nA [full][gone] link.\n\nA [collapsed][] link.\n')
    expect(v.map((x) => `${String(x.line)} ${x.message}`)).toEqual([
      `3 ${NO_DEFINITION('gone')}`,
      `5 ${NO_DEFINITION('collapsed')}`,
    ])
    expect(v.examined).toBe(2)
  })

  it('in a heading, a table cell and a list item too, with emphasis in the text', () => {
    const v = resolveOf(
      '# A [h][gone-h]\n\n| a |\n| --- |\n| [c][gone-c] |\n\n- an [*item*][gone-i]\n',
    )
    expect(v.map((x) => `${String(x.line)} ${x.message}`)).toEqual([
      `1 ${NO_DEFINITION('gone-h')}`,
      `5 ${NO_DEFINITION('gone-c')}`,
      `7 ${NO_DEFINITION('gone-i')}`,
    ])
  })

  it('a dangling shortcut, a task box, an alert, code, an escape and a link are not reported', () => {
    const v = resolveOf(
      [
        '# A',
        '',
        '- [ ] a [WIP] task',
        '',
        '> [!NOTE]',
        '> an alert',
        '',
        'Code `[a][b]`, an escape \\[a\\]\\[b\\], a [real](./a.md) link and an image ![x][gone].',
        '',
        '```',
        '[a][b]',
        '```',
        '',
      ].join('\n'),
    )
    expect(v.map((x) => x.message)).toEqual([])
    expect(v.examined).toBe(1)
  })

  it('text that has the shape, such as matrix[i][j], is reported with the code-span remedy', () => {
    const v = resolveOf('# A\n\nThe value matrix[i][j] is read.\n')
    expect(v.map((x) => x.message)).toEqual([NO_DEFINITION('j')])
  })

  it('a dangling reference beside defined ones: only it is reported', () => {
    const v = resolveOf('# A\n\nSee [a][ok] and [b][gone].\n\n[ok]: ./a.md\n')
    expect(v.map((x) => x.message)).toEqual([NO_DEFINITION('gone')])
    expect(v.examined).toBe(2)
  })
})

describe('beLinkedBack() reports a dangling reference for what it is (bug 0558)', () => {
  it('a declaration holding a dangling reference names the missing definition', () => {
    const c = corpusFromText({ 'docs/a.md': '# A\n\n**Related to:** [b][gone]\n' })
    const v = links(c).that().areLabelled('Related to').should().beLinkedBack().violations()
    expect(v.map((x) => `${String(x.line)} ${x.message}`)).toEqual([`3 ${NO_DEFINITION('gone')}`])
  })
})

describe('a finding names the label as the source writes it (bug 0558)', () => {
  it('an escaped label is named with its escape', () => {
    const v = resolveOf('# A\n\nSee [x][a\\*b].\n\n[a\\*b]: ./gone.md\n')
    expect(v.map((x) => x.message)).toEqual([
      'broken link: "./gone.md" does not resolve to a file in the repo (the definition of [a\\*b])',
    ])
  })
})
