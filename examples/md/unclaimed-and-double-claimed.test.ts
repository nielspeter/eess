/**
 * A folder's pages, each claimed by exactly one selection (proposal 017, block 6): no page is
 * outside every selection, and no page is in two. Two `notExist()` rules over the caller's own
 * selections, composed with `or` and `and`, with nothing built by hand.
 *
 * The folder is the corpus's only root, so a mistyped root loads nothing and is reported as an
 * empty source rather than passing.
 */
import { and, corpus, docs, haveNameMatching, not, or, resideInFolder } from '@nielspeter/eess-md'
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture.js'

const NAME = 'unclaimed-and-double-claimed'

const howTo = resideInFolder('guides/how-to/**')
const reference = resideInFolder('guides/reference/**')
const tutorial = haveNameMatching(/^tutorial-/)

const pages = (cwd: string): ReturnType<typeof corpus> => corpus({ cwd, roots: ['guides/**'] })

const unclaimed = (cwd: string): ReturnType<typeof docs> =>
  docs(pages(cwd))
    .that()
    .satisfy(not(or(howTo, reference, tutorial)))
    .should()
    .notExist()
    .because('every page belongs to one kind')

const claimedTwice = (cwd: string): ReturnType<typeof docs> =>
  docs(pages(cwd))
    .that()
    .satisfy(or(and(howTo, reference), and(howTo, tutorial), and(reference, tutorial)))
    .should()
    .notExist()
    .because('a page belongs to one kind only')

describe('every page is claimed once', () => {
  it('clean: every page is claimed by exactly one selection', () => {
    const cwd = fixture(NAME, 'clean')
    expect([...unclaimed(cwd).violations()]).toEqual([])
    expect([...claimedTwice(cwd).violations()]).toEqual([])
    // An absence rule examines nothing when it holds, so the population is proven through the
    // same corpus without the selection: three pages were there to be judged.
    const all = docs(pages(cwd)).select({ label: 'page', identify: (d) => ({ name: d.relPath }) })
    expect(all.elements).toHaveLength(3)
  })

  it('violating-unclaimed: a page outside every selection is reported', () => {
    const v = unclaimed(fixture(NAME, 'violating-unclaimed')).violations()
    expect(v).toHaveLength(1)
    const [finding] = v
    expect(finding?.element).toBe('guides/notes.md')
    expect(finding?.file).toContain('violating-unclaimed')
    expect(finding?.message).toBe('guides/notes.md should not exist')
    expect(finding?.bypassFilters).toBeUndefined()
  })

  it('violating-double: a page in two selections is reported', () => {
    const v = claimedTwice(fixture(NAME, 'violating-double')).violations()
    expect(v).toHaveLength(1)
    const [finding] = v
    expect(finding?.element).toBe('guides/how-to/tutorial-deploy.md')
    expect(finding?.file).toContain('violating-double')
    expect(finding?.message).toBe('guides/how-to/tutorial-deploy.md should not exist')
    expect(finding?.bypassFilters).toBeUndefined()
  })
})
