/**
 * Plan 0495: `docs().should().agreeWithFolder()`, a value agrees with its folder (proposal 017,
 * block 5). Each finding in the directions it can and cannot appear in, its text word for word,
 * through the public `docs()`.
 */
import { describe, it, expect } from 'vitest'
import {
  corpus,
  docs,
  isArchConfigError,
  type AgreeWithFolderOptions,
  type ArchViolation,
  type Direction,
  type FolderGroup,
} from '../../src/index.js'
import { tree } from '../helpers/tree.js'

const record = (state: string | undefined, extra: readonly string[] = []): string =>
  ['# R', '', ...(state === undefined ? [] : [`**State:** ${state}`]), ...extra, ''].join('\n')

/** A bugs lane: live records in `work/bugs/`, closed ones in `fixed/` and `rejected/`. */
const lane = (files: Readonly<Record<string, string>>, frozen: readonly string[] = []) =>
  corpus({
    cwd: tree({
      'work/bugs/0001-live.md': record('Draft'),
      'work/bugs/fixed/0002-done.md': record('Fixed'),
      'work/bugs/rejected/0003-no.md': record('Rejected'),
      ...files,
    }),
    roots: ['**/*.md'],
    frozen: [...frozen],
  })

const REST: readonly FolderGroup[] = [
  { values: ['Draft', 'Ready', 'Parked'], folders: 'rest' },
  { values: ['Fixed'], folders: ['work/bugs/fixed/**'] },
  { values: ['Rejected'], folders: ['work/bugs/rejected/**'] },
]
/** No `'rest'`: the live folder bound by its own glob, so a record elsewhere is unbound. */
const BOUND: readonly FolderGroup[] = [
  { values: ['Draft', 'Ready', 'Parked'], folders: ['work/bugs/*.md'] },
  { values: ['Fixed'], folders: ['work/bugs/fixed/**'] },
  { values: ['Rejected'], folders: ['work/bugs/rejected/**'] },
]
const opts = (
  direction: Direction,
  groups: readonly FolderGroup[] = REST,
  extra: Partial<AgreeWithFolderOptions> = {},
): AgreeWithFolderOptions => ({
  field: { label: 'State', forms: ['bold'] },
  groups,
  direction,
  ...extra,
})
const DIRECTIONS: readonly Direction[] = ['left-to-right', 'right-to-left', 'both']

const run = (c: ReturnType<typeof corpus>, o: AgreeWithFolderOptions) =>
  docs(c).should().agreeWithFolder(o).violations()
const said = (found: readonly ArchViolation[]): string[] =>
  found.filter((v) => v.line > 0).map((v) => `${v.element}: ${v.message}`)
const declared = (found: readonly ArchViolation[]): string[] =>
  found.filter((v) => v.line === 0).map((v) => v.message)

describe('agreeWithFolder: a value in the wrong folder (F1, F2, F3)', () => {
  it('F1: a closed record outside every bound folder, value to folder only', () => {
    const c = lane({ 'work/other/0009-x.md': record('Fixed') })
    const want = [
      'work/other/0009-x.md:3: `Fixed` (State, line 3) belongs in work/bugs/fixed/**; work/other/0009-x.md is in none of its folders. Move it or change the value.',
    ]
    expect(said(run(c, opts('left-to-right', BOUND)))).toEqual(want)
    expect(said(run(c, opts('both', BOUND)))).toEqual(want)
    expect(said(run(c, opts('right-to-left', BOUND)))).toEqual([])
  })

  it('F2: a live value in a done folder belongs outside it, in every direction', () => {
    const c = lane({ 'work/bugs/fixed/0010-x.md': record('Draft') })
    for (const direction of DIRECTIONS) {
      expect(said(run(c, opts(direction)))).toEqual([
        "work/bugs/fixed/0010-x.md:3: wrong folder: `Draft` (State, line 3) belongs outside work/bugs/fixed/**, work/bugs/rejected/**; work/bugs/fixed/0010-x.md is in Fixed's folders. Move it or change the value.",
      ])
    }
  })

  it('F2: a closed value in a live folder belongs in its done folder, once even under both', () => {
    const c = lane({ 'work/bugs/0011-x.md': record('Fixed') })
    for (const direction of DIRECTIONS) {
      expect(said(run(c, opts(direction)))).toEqual([
        "work/bugs/0011-x.md:3: wrong folder: `Fixed` (State, line 3) belongs in work/bugs/fixed/**; work/bugs/0011-x.md is in Draft's folders ('rest'). Move it or change the value.",
      ])
    }
  })

  it('F3: a value in no group, in a bound folder, is an unknown spelling in every direction', () => {
    const c = lane({ 'work/bugs/fixed/0012-x.md': record('Shipped') })
    for (const direction of DIRECTIONS) {
      expect(said(run(c, opts(direction)))).toEqual([
        'work/bugs/fixed/0012-x.md:3: `Shipped` at line 3 is none of the declared values (Draft, Ready, Parked, Fixed, Rejected); fix the spelling, or add it to a group',
      ])
    }
  })

  it('F3: a value in no group outside every bound folder is not this rule', () => {
    const c = lane({ 'work/other/0013-x.md': record('Shipped') })
    for (const direction of DIRECTIONS) expect(said(run(c, opts(direction, BOUND)))).toEqual([])
  })
})

describe('agreeWithFolder: no value, or one that cannot be read (F4, F5)', () => {
  it('F4: a done-folder record with no State, folder to value only, with the resolver message', () => {
    const c = lane({ 'work/bugs/fixed/0014-x.md': record(undefined, ['**Status:** Fixed']) })
    const want = [
      "work/bugs/fixed/0014-x.md: work/bugs/fixed/0014-x.md is in Fixed's folders and has no State field (read as bold); its labels: Status",
    ]
    expect(said(run(c, opts('right-to-left')))).toEqual(want)
    expect(said(run(c, opts('both')))).toEqual(want)
    expect(said(run(c, opts('left-to-right')))).toEqual([])
  })

  it('F4: a record with no value is judged, so a selection of only such records is not judged none', () => {
    const c = lane({ 'work/bugs/fixed/0014-x.md': record(undefined) })
    const v = docs(c)
      .that()
      .resideInFile('work/bugs/fixed/0014-x.md')
      .should()
      .agreeWithFolder(opts('right-to-left'))
      .violations()
    expect(said(v)).toEqual([
      "work/bugs/fixed/0014-x.md: work/bugs/fixed/0014-x.md is in Fixed's folders and has no State field (read as bold); it carries no wrapped label",
    ])
    expect(declared(v)).toEqual([])
  })

  it('F4: a plain State line carries the plain-line hint', () => {
    const c = lane({ 'work/bugs/fixed/0015-x.md': record(undefined, ['State: Fixed']) })
    expect(said(run(c, opts('right-to-left')))).toEqual([
      "work/bugs/fixed/0015-x.md: work/bugs/fixed/0015-x.md is in Fixed's folders and has no State field (read as bold); line 3 has `State: Fixed`, a plain line this rule does not read: add 'plain' to forms, or write it as `**State:** v`",
    ])
  })

  it('F4: an unbound record with no value is not reported', () => {
    const c = lane({ 'work/other/0016-x.md': record(undefined) })
    for (const direction of DIRECTIONS) expect(said(run(c, opts(direction, BOUND)))).toEqual([])
  })

  it('F5: a value given twice, empty, or in an unread form is withheld, never judged', () => {
    const c = lane({
      'work/bugs/fixed/0017-x.md': record('Fixed', ['', '**State:** Draft']),
      'work/bugs/fixed/0018-x.md': record(''),
      'work/bugs/fixed/0019-x.md': ['# R', '', '## State: Fixed', ''].join('\n'),
    })
    for (const direction of DIRECTIONS) {
      const v = run(c, opts(direction))
      expect(said(v)).toEqual([
        "work/bugs/fixed/0017-x.md:3,5: State is given twice (line 3 'Fixed', line 5 'Draft'); keep one",
        'work/bugs/fixed/0018-x.md:3: State at line 3 has no value this rule can read',
        "work/bugs/fixed/0019-x.md:3: found `## State: Fixed` at line 3, in a form this rule does not read (heading); add 'heading' to forms, or rewrite the line",
      ])
      expect(declared(v)).toEqual([])
    }
    // A selection of only withheld records gave no verdict: that is the agreement's own finding.
    const withheld = docs(c)
      .that()
      .resideInFile('work/bugs/fixed/001[789]-x.md')
      .should()
      .agreeWithFolder(opts('right-to-left'))
      .violations()
    expect(declared(withheld)).toEqual([
      'selected 3 documents, judged none: the field read no value (check its label, forms or region)',
    ])
  })

  it('F5: an unbound value that cannot be read is reported value to folder, not folder to value', () => {
    const c = lane({ 'work/other/0030-x.md': record('Fixed', ['', '**State:** Draft']) })
    const want = [
      "work/other/0030-x.md:3,5: State is given twice (line 3 'Fixed', line 5 'Draft'); keep one",
    ]
    expect(said(run(c, opts('left-to-right', BOUND)))).toEqual(want)
    expect(said(run(c, opts('both', BOUND)))).toEqual(want)
    expect(said(run(c, opts('right-to-left', BOUND)))).toEqual([])
  })

  it('a resolved value carries its side causes wherever the document is judged', () => {
    const c = lane({
      'work/bugs/fixed/0020-x.md': record('Fixed', ['', 'State: Draft']),
    })
    for (const direction of DIRECTIONS) {
      expect(
        said(
          run(c, opts(direction, REST, { field: { label: 'State', forms: ['bold', 'plain'] } })),
        ),
      ).toEqual([
        "work/bugs/fixed/0020-x.md:5: prose says State 'Draft', but the field at line 3 says 'Fixed'",
      ])
    }
  })
})

describe('agreeWithFolder: the declaration (F6, F7, F8, refusals)', () => {
  it('F6: two groups binding one folder is one finding per pair, and not suppressible', () => {
    const c = lane({})
    const groups: readonly FolderGroup[] = [
      { values: ['Draft', 'Ready'], folders: ['work/bugs/**'] },
      { values: ['Fixed'], folders: ['work/bugs/fixed/**'] },
      { values: ['Rejected', 'Parked'], folders: ['work/bugs/rejected/**'] },
    ]
    const rule = docs(c).should().agreeWithFolder(opts('both', groups))
    const want = (found: readonly ArchViolation[]) =>
      found.filter((v) => v.message.includes('both bind')).map((v) => v.message)
    const expected = [
      "work/bugs/** (Draft, Ready) and work/bugs/fixed/** (Fixed) both bind 1 document(s), first work/bugs/fixed/0002-done.md; bind each folder to one group, or make one group 'rest'",
      "work/bugs/** (Draft, Ready) and work/bugs/rejected/** (Rejected, Parked) both bind 1 document(s), first work/bugs/rejected/0003-no.md; bind each folder to one group, or make one group 'rest'",
    ]
    expect(want(rule.violations())).toEqual(expected)
    expect(want(rule.excluding(/.*/).violations())).toEqual(expected)
  })

  it('F7: a dead folder glob is one finding naming it, and no F1 per record, in every direction', () => {
    // A record of the dead group's value in another group's folder is not told it belongs in the typo.
    const c = lane({ 'work/bugs/0031-x.md': record('Fixed') })
    const groups: readonly FolderGroup[] = [
      { values: ['Draft', 'Ready', 'Parked'], folders: ['work/bugs/*.md'] },
      { values: ['Fixed'], folders: ['work/bugs/fxed/**'] },
      { values: ['Rejected'], folders: ['work/bugs/rejected/**'] },
    ]
    for (const direction of DIRECTIONS) {
      const v = run(c, opts(direction, groups))
      expect(said(v)).toEqual([])
      expect(declared(v)).toEqual([
        "Fixed's folder work/bugs/fxed/** matches no path in the corpus; if it is a typo, correct it; if the folder has no record yet, file the first one there, or leave the group out",
      ])
      expect(v.every((x) => x.line > 0 || x.bypassFilters === true)).toBe(true)
    }
  })

  it('F7: a glob that can never match says why, by the selector diagnosis', () => {
    const groups: readonly FolderGroup[] = [
      { values: ['Draft'], folders: 'rest' },
      { values: ['Fixed'], folders: ['/work/bugs/fixed/**'] },
    ]
    expect(declared(run(lane({}), opts('both', groups)))).toEqual([
      "Fixed's folder /work/bugs/fixed/**: a leading `/` can never match a path relative to the corpus's `cwd`. Write the glob as `work/bugs/fixed/**`.",
    ])
  })

  it('F8: a group whose folders hold no document judges nothing, folder to value', () => {
    const c = corpus({
      cwd: tree({
        'work/bugs/0001-live.md': record('Draft'),
        'work/bugs/fixed/0002-done.md': record('Fixed'),
        'work/bugs/rejected/notes.txt': 'not markdown\n',
      }),
      roots: ['**/*.md'],
      frozen: [],
    })
    const want = ["Rejected's folders hold no document in the corpus; the group judges nothing"]
    expect(declared(run(c, opts('right-to-left')))).toEqual(want)
    expect(declared(run(c, opts('both')))).toEqual(want)
    expect(declared(run(c, opts('left-to-right')))).toEqual([])
  })

  it('F8: computed over the corpus, so a narrowed selection still declares every group', () => {
    const c = lane({})
    const v = docs(c)
      .that()
      .resideInFolder('work/bugs/fixed/**')
      .should()
      .agreeWithFolder(opts('right-to-left'))
      .violations()
    expect(v).toHaveLength(0)
    expect(v.examined).toBe(1)
  })

  it("'rest' binds a nested lane's live side with no overlap, and two are refused", () => {
    const c = lane({ 'work/bugs/fixed/0021-x.md': record('Ready') })
    expect(said(run(c, opts('both')))).toEqual([
      "work/bugs/fixed/0021-x.md:3: wrong folder: `Ready` (State, line 3) belongs outside work/bugs/fixed/**, work/bugs/rejected/**; work/bugs/fixed/0021-x.md is in Fixed's folders. Move it or change the value.",
    ])
    const twice: readonly FolderGroup[] = [
      { values: ['Draft'], folders: 'rest' },
      { values: ['Fixed'], folders: 'rest' },
    ]
    expect(() => run(c, opts('both', twice))).toThrow(/groups\[1\]\.folders is 'rest'/)
  })

  it.each([
    ['no groups', [], /groups is empty/],
    ['a group with no values', [{ values: [], folders: ['a/**'] }], /groups\[0\]\.values is empty/],
    ['an empty folder list', [{ values: ['A'], folders: [] }], /groups\[0\]\.folders is empty/],
    [
      'an empty value',
      [{ values: [' '], folders: ['a/**'] }],
      /groups\[0\]\.values holds an empty/,
    ],
    [
      'a value in two groups',
      [
        { values: ['A'], folders: ['a/**'] },
        { values: ['A'], folders: ['b/**'] },
      ],
      /groups\[1\]\.values: 'A' is also in groups\[0\]/,
    ],
    [
      'one glob in two groups',
      [
        { values: ['A'], folders: ['a/**'] },
        { values: ['B'], folders: ['a/**'] },
      ],
      /groups\[1\]\.folders: 'a\/\*\*' is also groups\[0\]'s/,
    ],
  ] satisfies readonly [string, readonly FolderGroup[], RegExp][])(
    'refuses %s when the rule runs',
    (_name, groups, message) => {
      const rule = docs(lane({})).should().agreeWithFolder(opts('both', groups))
      let thrown: unknown
      try {
        rule.violations()
      } catch (e) {
        thrown = e
      }
      expect(isArchConfigError(thrown)).toBe(true)
      expect(thrown instanceof Error ? thrown.message : '').toMatch(message)
    },
  )

  it('refuses an unknown direction when the rule runs, as a JavaScript caller can write one', () => {
    const o: AgreeWithFolderOptions = {
      ...opts('both'),
      // @ts-expect-error a misspelt direction, which the type refuses and the rule must too
      direction: 'left-to-rigth',
    }
    expect(() => run(lane({}), o)).toThrow(/agreeWithFolder: direction must be one of/)
  })

  it('a value in two groups after normalize is refused', () => {
    const groups: readonly FolderGroup[] = [
      { values: ['fixed'], folders: ['a/**'] },
      { values: ['Fixed'], folders: ['b/**'] },
    ]
    const rule = docs(lane({}))
      .should()
      .agreeWithFolder(opts('both', groups, { normalize: (v) => v.toLowerCase() }))
    expect(() => rule.violations()).toThrow(/'Fixed' is also in groups\[0\] after normalize/)
  })
})

describe('agreeWithFolder: values, frozen records and evidence', () => {
  it('normalize applies to the value read and to every declared value', () => {
    const c = lane({ 'work/bugs/fixed/0022-x.md': record('fixed') })
    expect(said(run(c, opts('both', REST, { normalize: (v) => v.toLowerCase() })))).toEqual([])
    expect(said(run(c, opts('both')))).toEqual([
      'work/bugs/fixed/0022-x.md:3: `fixed` at line 3 is none of the declared values (Draft, Ready, Parked, Fixed, Rejected); fix the spelling, or add it to a group',
    ])
  })

  it('a frozen record in a bound folder is judged', () => {
    const c = lane({ 'work/bugs/fixed/0023-x.md': record('Draft') }, ['work/bugs/fixed/**'])
    expect(said(run(c, opts('right-to-left')))).toEqual([
      "work/bugs/fixed/0023-x.md:3: wrong folder: `Draft` (State, line 3) belongs outside work/bugs/fixed/**, work/bugs/rejected/**; work/bugs/fixed/0023-x.md is in Fixed's folders. Move it or change the value.",
    ])
  })

  it('a selection whose values no group names, outside every bound folder, is judged none', () => {
    const c = corpus({
      cwd: tree({
        'work/other/a.md': record('Fixd'),
        'work/other/b.md': record('Fixd'),
        'work/bugs/fixed/c.md': record('Fixed'),
      }),
      roots: ['**/*.md'],
      frozen: [],
    })
    const v = docs(c)
      .that()
      .resideInFolder('work/other/**')
      .should()
      .agreeWithFolder(
        opts('left-to-right', [{ values: ['Fixed'], folders: ['work/bugs/fixed/**'] }]),
      )
      .violations()
    expect(v.examined).toBe(2)
    expect(declared(v)).toEqual([
      'selected 2 documents, judged none: the field read no value (check its label, forms or region)',
    ])
  })

  it('the description names the field and the direction', () => {
    const c = lane({ 'work/bugs/fixed/0025-x.md': record('Draft') })
    const [ltr] = run(c, opts('left-to-right'))
    const [rtl] = run(c, opts('right-to-left'))
    const [both] = run(c, opts('both'))
    expect(ltr?.rule).toBe('should agree with their folder (State, value → folder)')
    expect(rtl?.rule).toBe('should agree with their folder (State, folder → value)')
    expect(both?.rule).toBe(
      'should agree with their folder (State, value → folder and folder → value)',
    )
  })
})

/**
 * Plan 0495, decision D1 as rebuilt after the batch review: `examined` is the kernel's, and an
 * agreement that selected documents and judged none is its own unsuppressable finding, whatever
 * sits beside it. The four shapes the enforcement review measured green before.
 */
describe('agreeWithFolder: an agreement that judged none', () => {
  const TYPO = opts('left-to-right', REST, { field: { label: 'Sate', forms: ['bold'] } })
  const NONE =
    'selected 3 documents, judged none: the field read no value (check its label, forms or region)'
  const judgedNone = (found: readonly ArchViolation[]): ArchViolation[] =>
    found.filter((v) => v.message === NONE)

  it('a misspelt label alone is red, and no suppression removes it', () => {
    const rule = docs(lane({})).should().agreeWithFolder(TYPO)
    const v = rule.violations()
    expect(v.examined).toBe(3)
    expect(judgedNone(v)).toHaveLength(1)
    expect(judgedNone(v)[0]?.bypassFilters).toBe(true)
    expect(judgedNone(rule.excluding(/.*/).violations())).toHaveLength(1)
  })

  it('a misspelt label on a rule declared empty: the declaration expires, and the finding stands', () => {
    const v = docs(lane({})).should().agreeWithFolder(TYPO).expectEmpty().violations()
    expect(v.some((x) => /declared \.expectEmpty\(\) but examined 3/.test(x.message))).toBe(true)
    expect(judgedNone(v)).toHaveLength(1)
  })

  it('a misspelt label beside another condition is red, and examined is the selection', () => {
    const v = docs(lane({}))
      .should()
      .agreeWithFolder(TYPO)
      .andShould()
      .beUniqueBy((d) => d.relPath, 'path')
      .violations()
    expect(v.examined).toBe(3)
    expect(judgedNone(v)).toHaveLength(1)
  })

  it('a misspelt label beside a good agreement is red on its own', () => {
    const v = docs(lane({}))
      .should()
      .agreeWithFolder(opts('left-to-right'))
      .andShould()
      .agreeWithFolder(TYPO)
      .violations()
    expect(judgedNone(v)).toHaveLength(1)
    expect(judgedNone(v)[0]?.element).toBe('agreeWithFolder → Sate')
  })
})
