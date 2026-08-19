/**
 * A `eess-exclude` directive counts only where it really is a directive —
 * [bug 0043](../../bugs/fixed/0043-an-exclusion-directive-inside-a-string-literal-suppresses.md).
 *
 * The parser split the source on newlines and regexed each line, with no idea
 * what was code, what was a string, and what was a comment. So the characters
 * were enough: a directive inside a string literal created a **live exclusion**
 * that silenced a real finding — silently, because a directive carrying a reason
 * never triggers the undocumented-exclusion warning.
 *
 * Two distinct faults, and the second was found only by fixing the first:
 *
 * 1. **Not a comment at all.** `"…"`, `'…'`, `` `…` ``, a regex literal, JSX
 *    text. All produced exclusions. Fixed by parsing and blanking literals.
 * 2. **A comment about the syntax is not the syntax.** Once comments were read
 *    correctly, any comment *mentioning* a directive became one — including this
 *    parser's own grammar documentation, which declared a reason-less exclusion
 *    against whatever rule was running. Fixed by requiring a directive to begin
 *    its comment, and by excluding block comments, which never supported the
 *    grammar anyway.
 *
 * The table below is the whole contract, and every row was measured before the
 * fix as well as after.
 */
import { describe, expect, it } from 'vitest'
import { parseExclusionComments } from '@nielspeter/eess'

/** `[name, source, expected exclusions]` */
const CASES: readonly (readonly [string, string, number])[] = [
  // Counts — genuinely a directive.
  ['a line comment', '// eess-exclude probe/x: real\nconst a = 1\n', 1],
  ['a trailing comment', 'const a = 1 // eess-exclude probe/x: real\nconst b = 2\n', 1],
  ['indented', '  // eess-exclude probe/x: real\nconst a = 1\n', 1],
  [
    'the block form',
    '// eess-exclude-start probe/x: real\nconst a = 1\n// eess-exclude-end\n',
    1,
  ],
  ['after a string on the same line', 'const s = "x" // eess-exclude probe/x: real\n', 1],

  // Does not count — not a directive, whatever the characters say.
  ['inside a double-quoted string', 'const s = "// eess-exclude probe/x: fake"\n', 0],
  ['inside a single-quoted string', "const s = '// eess-exclude probe/x: fake'\n", 0],
  ['inside a template literal', 'const s = `// eess-exclude probe/x: fake`\n', 0],
  [
    'inside a template with a substitution',
    'const x = 1\nconst s = `${x} // eess-exclude probe/x: fake`\n',
    0,
  ],
  ['inside a regex literal', 'const r = /\\/\\/ eess-exclude probe\\/x: fake/\n', 0],
  ['inside JSX text', 'const el = <div>// eess-exclude probe/x: fake</div>\n', 0],
  ['mid-comment prose', '// see the docs for // eess-exclude probe/x: fake\n', 0],
  ['inside a block comment', '/* eess-exclude probe/x: fake */\nconst a = 1\n', 0],
  [
    'inside a JSDoc block',
    '/**\n * Explains `// eess-exclude probe/x: fake` for the reader.\n */\nconst a = 1\n',
    0,
  ],
]

describe('a directive must actually be a comment, and must begin it (bug 0043)', () => {
  it.each(CASES)('%s → %i exclusion(s)', (_name, source, expected) => {
    expect(parseExclusionComments(source, '/probe/file.tsx').exclusions).toHaveLength(expected)
  })

  it('VACUITY: the table tests both directions', () => {
    // A table that is all-zero passes if the parser returns nothing ever; a table
    // that is all-nonzero passes if it returns something always. Neither would
    // catch this bug, and the second is what the pre-fix parser did.
    expect(CASES.filter(([, , n]) => n > 0).length).toBeGreaterThan(3)
    expect(CASES.filter(([, , n]) => n === 0).length).toBeGreaterThan(5)
  })

  it('newlines survive blanking, so reported lines stay right', () => {
    // The masked-out regions keep their newlines, because the scan is line-based
    // and reports `line`. A mask that dropped one would pass every row above and
    // misreport every directive after it.
    //
    // Note what this does NOT pin: replacing the masked characters with spaces
    // rather than deleting them. Nothing downstream reads a column, so
    // collapsing them leaves the suite green — measured. The spaces are defence
    // in depth, not a guarded property.
    const source = [
      'const s = "// eess-exclude probe/x: fake"',
      '/* a block\n   comment */',
      '// eess-exclude probe/x: real',
      'const a = 1',
    ].join('\n')
    const [only] = parseExclusionComments(source, '/probe/file.ts').exclusions
    expect(only?.line).toBe(4)
  })
})
