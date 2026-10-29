/**
 * A decision record's number agrees in its file name and its title (proposal 017, block 16): a
 * record is named `0003-use-a-message-queue.md` and titled `3. Use a message queue`, and a renamed
 * file or a copied title makes the two disagree. One `agreeWithPath()` rule: the file name's number
 * and the title's, each the pattern's named group `value`, compared after the caller's `normalize`,
 * since the file pads the number and the title does not. The title pattern reads both forms in use,
 * `3. …` and `ADR-0003: …`, as one alternation with `value` in each branch.
 */
import { corpus, docs } from '@nielspeter/eess-md'
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture.js'

const NAME = 'a-record-number-agrees-with-its-file'

const PATH = /(?:^|\/)(?<value>\d{4})-[^/]*\.md$/
const TITLE = /^(?:(?<value>\d+)\. |ADR-(?<value>\d+): )/

const rule = (cwd: string): ReturnType<typeof docs> =>
  docs(corpus({ cwd, roots: ['docs/decisions/**'] }))
    .should()
    .agreeWithPath({ path: PATH, title: TITLE, normalize: (v) => String(Number(v)) })
    .because('a record is cited by its number, and its file and its title must name the same one')

describe("a decision record's number agrees in its file name and its title", () => {
  it('clean: each record names its own number, in either title form', () => {
    const v = rule(fixture(NAME, 'clean')).violations()
    expect(v).toHaveLength(0)
    expect(v.examined).toBe(3)
  })

  it('violating-title-differs: a title naming another number is reported with both', () => {
    const v = rule(fixture(NAME, 'violating-title-differs')).violations()
    expect(v.map((f) => f.message)).toEqual([
      'the path says 0003 and the title says 4 (after normalize): correct the one that is wrong, by renaming the file or editing the title',
    ])
    expect(v[0]?.bypassFilters).toBeUndefined()
  })

  it('violating-name-without-number: a file named without its number is reported, not skipped', () => {
    const v = rule(fixture(NAME, 'violating-name-without-number')).violations()
    expect(v.map((f) => f.message)).toEqual([
      `docs/decisions/use-a-message-queue.md holds no value the path pattern reads (${String(PATH)}): name the file as the pattern expects, or widen the pattern`,
    ])
  })

  it('violating-title-without-number: a title that does not carry the number is reported', () => {
    const v = rule(fixture(NAME, 'violating-title-without-number')).violations()
    expect(v.map((f) => f.message)).toEqual([
      `its title "Use a message queue" holds no value the title pattern reads (${String(TITLE)})`,
    ])
  })
})
