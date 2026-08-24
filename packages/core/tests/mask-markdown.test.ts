import { describe, it, expect } from 'vitest'
import { parseExclusionComments } from '../src/exclusion-comments.js'
import { maskMarkdownCodeSpans } from '../src/mask-non-comment.js'

/**
 * A JS/TS lexer was running on markdown.
 *
 * `parseExclusionComments` masked every file the same way, so a backtick in a
 * `.md` opened a "template literal" that swallowed everything after it — and
 * eess-md's corpus is backtick-dense. One unbalanced backtick in prose silenced
 * a real waiver further down the file. Fail-closed (the suppressed violation
 * comes back), but wrong, and invisible to the author.
 *
 * Markdown needs the markdown answer to the same question bug 0154 asked of
 * code: a directive inside a code span is an EXAMPLE of the grammar, not an
 * instance of it. So fenced blocks and inline spans are masked; prose is not.
 */
describe('markdown is masked as markdown, not as JavaScript', () => {
  it('an unbalanced inline backtick does not swallow a later directive', () => {
    const md = [
      'Use `npm run build to compile.', // note: no closing backtick
      '',
      '<!-- eess-exclude some/rule: a real waiver -->',
      'text',
    ].join('\n')
    const { exclusions } = parseExclusionComments(md, 'notes.md')
    expect(exclusions.map((e) => e.ruleId)).toEqual(['some/rule'])
  })

  it('a directive inside a fenced block is an example, not a waiver', () => {
    const md = ['```ts', '// eess-exclude some/rule: teaching the syntax', '```', 'prose'].join(
      '\n',
    )
    const { exclusions } = parseExclusionComments(md, 'docs.md')
    expect(exclusions).toEqual([])
  })

  it('a directive inside an inline span is an example too', () => {
    const md = 'Write `<!-- eess-exclude some/rule: why -->` to waive it.'
    const { exclusions } = parseExclusionComments(md, 'docs.md')
    expect(exclusions).toEqual([])
  })

  it('the mask preserves length and line count', () => {
    const md = ['a `b` c', '```', 'inside', '```', 'd'].join('\n')
    const masked = maskMarkdownCodeSpans(md)
    expect(masked.length).toBe(md.length)
    expect(masked.split('\n').length).toBe(md.split('\n').length)
  })
})
