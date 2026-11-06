import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { ArchRuleError, correspondence, isArchConfigError, type Selection } from '../src/index.js'
import { applyFilters, registerSourceText } from '../src/internal.js'
import { sourceLookup } from '../src/source-roots.js'
import { resetStderrGuardForTests } from '../src/stderr.js'
import type { ArchViolation } from '../src/violation.js'

// ADR-024 (plan 0632, Phase 1): a dialect whose files are not on disk registers a claimed root's
// texts, and the kernel's waiver scan reads a claimed file's directives from them, never the disk.
// One test per registration rule and per step of clause 5's lookup, numbered as clause 5 numbers
// them (5.1 and 5.2 for every path, then claimed 1-5 for a path under a claimed root); each lookup
// test asserts its own step's cause, with the violation it leaves unwaived.

const KEY = Symbol.for('@nielspeter/eess/source-text')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0632-'))
let n = 0
/** A fresh absolute root that does not exist on disk. */
const freshRoot = (): string => path.join(tmp, `virtual-${String(++n)}`)

const WAIVED = ['<!-- eess-exclude demo/rule: a stated reason -->', 'the violation is here'].join(
  '\n',
)
const UNWAIVED = ['an ordinary line', 'the violation is here'].join('\n')
const UNDOCUMENTED = ['<!-- eess-exclude demo/rule -->', 'the violation is here'].join('\n')

const violation = (file: string, line = 2): ArchViolation => ({
  rule: 'demo rule',
  element: 'thing',
  file,
  line,
  message: 'a real finding',
})

/** Run the waiver scan as rule `demo/rule`, or as a rule with no id when `id` is null. */
const filter = (vs: ArchViolation[], id: string | null = 'demo/rule'): ArchViolation[] =>
  applyFilters(vs, id === null ? {} : { metadata: { id } })

/** The violations of `vs` that are not configuration findings. */
const real = (vs: readonly ArchViolation[]): ArchViolation[] =>
  vs.filter((v) => v.bypassFilters !== true)
const findings = (vs: readonly ArchViolation[]): ArchViolation[] =>
  vs.filter((v) => v.bypassFilters === true)

/** Registration's refusal message, or 'no refusal'. */
const refusal = (root: string, files: unknown): string => {
  try {
    Reflect.apply(registerSourceText, undefined, [root, files])
  } catch (e) {
    return isArchConfigError(e) ? e.message : `not an ArchConfigError: ${String(e)}`
  }
  return 'no refusal'
}

/** Write the shared object directly, past `registerSourceText`, as other code in the realm could. */
const forge = (value: unknown): void => {
  Reflect.set(globalThis, KEY, value)
}

afterEach(() => {
  // The registry has no release (ADR-024 clause 6); a test drops the key itself.
  Reflect.deleteProperty(globalThis, KEY)
  resetStderrGuardForTests()
})

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe('registerSourceText: what it refuses (ADR-024 clauses 2-4)', () => {
  it('refuses a relative root', () => {
    expect(refusal('virtual/a', { 'a.md': WAIVED })).toMatch(/root 'virtual\/a' is relative/)
  })

  it('refuses a root that exists on disk, naming it', () => {
    expect(refusal(tmp, { 'a.md': WAIVED })).toContain(`root '${tmp}' exists on disk`)
  })

  it('refuses a root on disk by either spelling: as written, or once normalised', () => {
    // As written only: a directory named `a\b` exists; its normalised spelling `a/b` does not.
    const parent = freshRoot()
    fs.mkdirSync(path.join(parent, 'a\\b'), { recursive: true })
    expect(refusal(path.join(parent, 'a\\b'), { 'f.md': WAIVED })).toMatch(/exists on disk/)
    // Normalised only: `<tmp>/missing/..` cannot be resolved as written, and normalises to `<tmp>`.
    expect(refusal(`${tmp}/missing/..`, { 'f.md': WAIVED })).toContain(
      `root '${tmp}' exists on disk`,
    )
  })

  it('refuses a non-canonical key and a non-string value', () => {
    const root = freshRoot()
    expect(refusal(root, { '../a.md': WAIVED })).toMatch(/contains '\.\.'/)
    expect(refusal(root, { 'a\\b.md': WAIVED })).toMatch(/backslash/)
    expect(refusal(root, { '/a.md': WAIVED })).toMatch(/is absolute/)
    expect(refusal(root, { 'a//b.md': WAIVED })).toMatch(/not normalised/)
    expect(refusal(root, JSON.parse('{"a.md": 1}'))).toMatch(/not a string/)
  })

  it('keeps a __proto__ key as a key', () => {
    const root = freshRoot()
    const files: unknown = JSON.parse(`{"__proto__": ${JSON.stringify(WAIVED)}}`)
    expect(refusal(root, files)).toBe('no refusal')
    expect(sourceLookup()(path.join(root, '__proto__'))).toEqual({ kind: 'text', text: WAIVED })
  })

  it('refuses an equal, a containing and a contained root, naming the one it overlaps', () => {
    // Every root here is under a fresh directory that is not on disk, so the on-disk refusal
    // cannot answer first.
    const base = freshRoot()
    const root = path.join(base, 'a', 'b')
    registerSourceText(root, { 'a.md': WAIVED })
    expect(refusal(root, { 'a.md': UNWAIVED })).toMatch(/already claimed with other texts/)
    expect(refusal(path.join(root, 'sub'), { 'a.md': WAIVED })).toContain(
      `overlaps the claimed root '${root}'`,
    )
    expect(refusal(path.join(base, 'a'), { 'x.md': WAIVED })).toContain(
      `overlaps the claimed root '${root}'`,
    )
  })

  it('compares roots by whole segments: /t/1 beside /t/10 is accepted', () => {
    const base = freshRoot()
    registerSourceText(path.join(base, '1'), { 'a.md': WAIVED })
    expect(refusal(path.join(base, '10'), { 'a.md': UNWAIVED })).toBe('no refusal')
  })

  it('accepts an exactly equal map again, and refuses a subset and a superset', () => {
    const root = freshRoot()
    registerSourceText(root, { 'a.md': WAIVED, 'b.md': UNWAIVED })
    expect(refusal(root, { 'b.md': UNWAIVED, 'a.md': WAIVED })).toBe('no refusal')
    expect(refusal(root, { 'a.md': WAIVED })).toMatch(/other texts/)
    expect(refusal(root, { 'a.md': WAIVED, 'b.md': UNWAIVED, 'c.md': UNWAIVED })).toMatch(
      /other texts/,
    )
  })

  it('normalises a root one way: two spellings of one root are refused as one', () => {
    const root = freshRoot()
    registerSourceText(`${root}/`, { 'a.md': WAIVED })
    for (const spelling of [`${root}//`, `${root}/./`, `${root}/x/..`, root.replace(/\//g, '\\')]) {
      expect([spelling, refusal(spelling, { 'a.md': UNWAIVED })]).toEqual([
        spelling,
        expect.stringMatching(/already claimed with other texts/),
      ])
    }
  })

  it('copies the map: changing it after registering changes nothing', () => {
    const root = freshRoot()
    const files: Record<string, string> = { 'a.md': WAIVED }
    registerSourceText(root, files)
    files['a.md'] = UNWAIVED
    expect(sourceLookup()(path.join(root, 'a.md'))).toEqual({ kind: 'text', text: WAIVED })
  })

  it('refuses to register into a registry of another shape, naming both shapes', () => {
    forge({ version: 99, roots: new Map() })
    const message = refusal(freshRoot(), { 'a.md': WAIVED })
    expect(message).toMatch(/holds shape 99, and this kernel reads shape 1/)
    expect(message).toMatch(/upgrade the package that brings the older kernel/)
  })

  it('refuses when the registry cannot be written to globalThis', () => {
    Object.defineProperty(globalThis, KEY, {
      value: undefined,
      writable: false,
      configurable: true,
    })
    expect(refusal(freshRoot(), { 'a.md': WAIVED })).toMatch(/could not be written/)
  })
})

describe('the lookup, in ADR-024 clause 5 order', () => {
  it('5.2: an unclaimed path is read from disk, as before', () => {
    const file = path.join(tmp, 'on-disk.md')
    fs.writeFileSync(file, WAIVED)
    registerSourceText(freshRoot(), { 'a.md': UNWAIVED })
    expect(filter([violation(file)])).toEqual([])
  })

  it('5.1: a registry of another shape makes a claimed, an unclaimed and a relative path each a finding, naming both shapes', () => {
    const onDisk = path.join(tmp, 'unread.md')
    fs.writeFileSync(onDisk, WAIVED)
    forge({ version: 99, roots: new Map() })
    for (const file of [onDisk, path.join(freshRoot(), 'a.md'), 'relative/a.md']) {
      const out = filter([violation(file)])
      expect([file, real(out).length, findings(out).map((f) => f.message)]).toEqual([
        file,
        1,
        [expect.stringMatching(/holds shape 99, and this kernel reads shape 1/)],
      ])
      expect(findings(out)[0]?.suggestion).toMatch(
        /upgrade the package that brings the older kernel/,
      )
    }
  })

  it('5.1: a malformed registry of this shape is named as malformed, with its own remedy', () => {
    forge({ version: 1, roots: new Map([[freshRoot(), { 'a.md': WAIVED }]]) })
    const out = filter([violation(path.join(tmp, 'anything.md'))])
    expect(findings(out).map((f) => [f.message, f.suggestion])).toEqual([
      [
        expect.stringMatching(/is shape 1, malformed: written past `registerSourceText`/),
        expect.stringMatching(/register through `registerSourceText`/),
      ],
    ])
  })

  it('5.1: a value no kernel writes is named as written past the call, never as another shape', () => {
    const cases: ReadonlyArray<readonly [unknown, RegExp]> = [
      [null, /is null, not a registry: written past/],
      ['x', /is a string, not a registry: written past/],
      [{}, /is an object with no shape version: written past/],
      [{ version: '1', roots: new Map() }, /is an object with no shape version: written past/],
    ]
    for (const [value, found] of cases) {
      forge(value)
      const out = filter([violation(path.join(tmp, 'anything.md'))])
      expect(findings(out).map((f) => [f.message, f.suggestion])).toEqual([
        [
          expect.stringMatching(found),
          expect.stringMatching(/register through `registerSourceText`/),
        ],
      ])
      expect(findings(out)[0]?.message).not.toMatch(/two kernel copies/)
    }
  })

  it('5.1, cleared: one shape in the install, and the waiver applies', () => {
    const root = freshRoot()
    forge({ version: 99, roots: new Map() })
    expect(findings(filter([violation(path.join(root, 'a.md'))]))).toHaveLength(1)
    Reflect.deleteProperty(globalThis, KEY)
    registerSourceText(root, { 'a.md': WAIVED })
    expect(filter([violation(path.join(root, 'a.md'))])).toEqual([])
  })

  it('claimed 1: a path under two roots, written past the refusals, is a finding, never a pick', () => {
    const root = freshRoot()
    forge({
      version: 1,
      roots: new Map([
        [root, new Map([['sub/a.md', WAIVED]])],
        [path.join(root, 'sub'), new Map([['a.md', WAIVED]])],
      ]),
    })
    const out = filter([violation(path.join(root, 'sub', 'a.md'))])
    expect(real(out)).toHaveLength(1)
    expect(findings(out).map((f) => f.message)).toEqual([
      expect.stringMatching(/lies under 2 claimed roots/),
    ])
  })

  it('claimed 2: a root created on disk after it was claimed is a finding, and no waiver from either source applies', () => {
    const root = freshRoot()
    registerSourceText(root, { 'a.md': WAIVED })
    fs.mkdirSync(root)
    fs.writeFileSync(path.join(root, 'a.md'), WAIVED.replace('a stated reason', 'the disk file'))
    const out = filter([violation(path.join(root, 'a.md'))])
    expect(real(out)).toHaveLength(1)
    expect(findings(out).map((f) => f.message)).toEqual([
      expect.stringMatching(/claimed root '.*' exists on disk/),
    ])
    expect(findings(out)[0]?.suggestion).toMatch(/remove what was created/)
    // The remedy clears it, and the registered waiver applies.
    fs.rmSync(root, { recursive: true })
    expect(filter([violation(path.join(root, 'a.md'))])).toEqual([])
  })

  it('claimed 3: a real file whose spelling folds under the root is a finding, by its own cause', () => {
    // A directory named `a\b` exists; the root `<parent>/a/b` and its parent `<parent>/a` do not.
    const parent = freshRoot()
    fs.mkdirSync(path.join(parent, 'a\\b'), { recursive: true })
    const reported = path.join(parent, 'a\\b', 'f.md')
    fs.writeFileSync(reported, WAIVED)
    registerSourceText(path.join(parent, 'a', 'b'), { 'f.md': WAIVED })
    const out = filter([violation(reported)])
    expect(real(out)).toHaveLength(1)
    expect(findings(out).map((f) => f.message)).toEqual([
      expect.stringMatching(/exists on disk, and its spelling folds under the claimed root/),
    ])
  })

  it('claimed 3, cleared: the texts registered under another root', () => {
    const parent = freshRoot()
    fs.mkdirSync(path.join(parent, 'a\\b'), { recursive: true })
    const reported = path.join(parent, 'a\\b', 'f.md')
    fs.writeFileSync(reported, WAIVED)
    registerSourceText(path.join(freshRoot(), 'elsewhere'), { 'f.md': WAIVED })
    expect(filter([violation(reported)])).toEqual([])
  })

  it('claimed 4: the texts are read, parsed under the reported file, for each spelling of its path', () => {
    const root = freshRoot()
    registerSourceText(root, { 'docs/a.md': WAIVED })
    for (const reported of [
      path.join(root, 'docs', 'a.md'),
      `${root}//docs/a.md`,
      `${root}/docs\\a.md`,
      `${root}/./docs/a.md`,
      `${root}/x/../docs/a.md`,
    ]) {
      expect([reported, filter([violation(reported)])]).toEqual([reported, []])
    }
  })

  it("claimed 4: an undocumented waiver's promoted finding lands on the reported file", () => {
    const root = freshRoot()
    registerSourceText(root, { 'a.md': UNDOCUMENTED })
    const reported = `${root}//a.md`
    const out = filter([violation(reported)])
    expect(out.map((v) => [v.file, v.message])).toEqual([
      [reported, expect.stringMatching(/states no reason/)],
    ])
  })

  it('claimed 5: a miss is a finding, with the violation still reported; its remedy clears it', () => {
    const root = freshRoot()
    registerSourceText(root, { 'other.md': WAIVED })
    const out = filter([violation(path.join(root, 'a.md'))])
    expect(real(out)).toHaveLength(1)
    expect(findings(out).map((f) => [f.severity, f.ruleId, f.message])).toEqual([
      ['error', 'demo/rule', expect.stringMatching(/do not hold/)],
    ])
    expect(findings(out)[0]?.suggestion).toMatch(/add the file to the map/)
    const fixed = freshRoot()
    registerSourceText(fixed, { 'a.md': WAIVED })
    expect(filter([violation(path.join(fixed, 'a.md'))])).toEqual([])
  })

  it('one finding per rule and file; an id-less rule is named by its description, else unnamed', () => {
    const root = freshRoot()
    registerSourceText(root, { 'other.md': WAIVED })
    const file = path.join(root, 'a.md')
    expect(
      findings(filter([violation(file, 2), violation(file, 5)])).map((f) => f.message),
    ).toEqual([expect.stringMatching(/do not hold/)])
    const anon = findings(filter([violation(file)], null))
    expect(anon.map((f) => [f.rule, f.ruleId])).toEqual([['unnamed', undefined]])
    const described = findings(applyFilters([violation(file)], { describe: () => 'the demo rule' }))
    expect(described.map((f) => f.rule)).toEqual(['the demo rule'])
  })

  it('a second kernel copy in the realm reads what the first registered', async () => {
    vi.resetModules()
    const copy = await import('../src/source-roots.js')
    expect(copy.registerSourceText).not.toBe(registerSourceText)
    const root = freshRoot()
    copy.registerSourceText(root, { 'a.md': WAIVED })
    expect(filter([violation(path.join(root, 'a.md'))])).toEqual([])
  })
})

describe('a kernel correspondence over registered text (ADR-024 clauses 1, 5)', () => {
  type Doc = { name: string; file: string }
  const sel = (docs: Doc[]): Selection<Doc> => ({
    elements: docs,
    label: 'document',
    identify: (d) => ({ name: d.name, file: d.file, line: 2 }),
  })
  const rule = (text: string, key = 'a.md') => {
    const root = freshRoot()
    registerSourceText(root, { [key]: text })
    const doc = { name: 'a', file: path.join(root, 'a.md') }
    return correspondence({ left: sel([doc]), right: sel([]) })
      .should()
      .beComplete({ direction: 'left-to-right' })
      .rule({ id: 'demo/rule' })
  }

  it('CONTROL: without the directive, the finding is reported, and the rule examined something', () => {
    const v = rule(UNWAIVED).violations()
    expect(v.map((x) => x.element)).toEqual(['a'])
    expect(v.examined).toBeGreaterThan(0)
  })

  it('the waiver in the registered text waives a kernel correspondence finding', () => {
    const v = rule(WAIVED).violations()
    expect(v.map((x) => x.element)).toEqual([])
    expect(v.examined).toBeGreaterThan(0)
  })

  it('a miss is an error even under .warn(): the rule throws', () => {
    const r = rule(WAIVED, 'other.md')
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    let thrown: unknown
    try {
      r.warn()
    } catch (e) {
      thrown = e
    } finally {
      spy.mockRestore()
    }
    expect(thrown).toBeInstanceOf(ArchRuleError)
    expect(thrown instanceof ArchRuleError ? thrown.violations.map((v) => v.message) : []).toEqual([
      expect.stringMatching(/do not hold/),
    ])
  })
})
