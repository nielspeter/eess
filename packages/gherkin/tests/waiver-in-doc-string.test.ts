import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { features, scenarios } from '../src/index.js'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

// Bug 0419: the kernel read a `.feature` file's exclusion comments as JavaScript, so a
// `// eess-exclude-start … // eess-exclude-end` pair written inside two doc strings, which are
// data, suppressed a real duplicate-title violation.
describe('a waiver inside a Gherkin doc string (bug 0419)', () => {
  it('does not suppress a real finding', () => {
    const set = features({ cwd: FIXTURES, roots: ['waiver-in-doc-string.feature'] })
    const violations = scenarios(set)
      .should()
      .haveUniqueTitles()
      .rule({ id: 'gherkin/unique-titles' })
      .violations()
    expect(violations).toHaveLength(1)
    expect(violations[0]?.message).toContain('duplicate scenario title "Same title"')
    expect(violations[0]?.line).toBe(7)
  })
})
