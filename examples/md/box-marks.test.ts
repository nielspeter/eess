/**
 * Box marks beyond GFM's `[ ]` and `[x]` are the caller's to declare (proposal 017, block 17): here
 * `[~]` is work half done, so it is open, and `[→]` is work moved elsewhere, so it is unjudged:
 * it neither blocks a close nor is verified done (the state bug 0525 added; a move is not a verification). In a
 * folder of closed records, no box is open. A mark no one declared is reported, never skipped.
 */
import { corpus, taskItems } from '@nielspeter/eess-md'
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture.js'

const NAME = 'box-marks'
const marks = { '~': 'open', '→': 'unjudged' } as const

const boxes = (cwd: string): ReturnType<typeof taskItems> =>
  taskItems(corpus({ cwd, roots: ['**/*.md'] }), { marks })

const rule = (cwd: string): ReturnType<typeof taskItems> =>
  boxes(cwd).that().areOpen().should().notExist().because('a closed record owes nothing')

describe("box marks are the caller's", () => {
  it('clean: no box in a closed record is open, a declared [→] unjudged', () => {
    const cwd = fixture(NAME, 'clean')
    expect([...rule(cwd).violations()]).toEqual([])
    // An absence rule examines nothing when it holds, so the population is proven through the same
    // boxes without the selection: four boxes were there to be judged, `[→]` read as unjudged.
    const all = boxes(cwd).select({
      label: 'box',
      identify: (t) => ({ name: `${t.mark}:${t.state}` }),
    })
    expect(all.elements.map((t) => `${t.mark}:${t.state}`).sort()).toEqual([
      'x:done',
      'x:done',
      'x:done',
      '→:unjudged',
    ])
  })

  it('violating-declared-open: a declared [~] counts as open', () => {
    const v = rule(fixture(NAME, 'violating-declared-open')).violations()
    expect(v).toHaveLength(1)
    const [finding] = v
    expect(finding?.element).toBe('closed/release-1.0.md:4')
    expect(finding?.file).toContain('violating-declared-open')
    expect(finding?.message).toBe('closed/release-1.0.md:4 should not exist')
    expect(finding?.bypassFilters).toBeUndefined()
  })
})
