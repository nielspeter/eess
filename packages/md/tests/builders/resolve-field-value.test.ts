import { describe, expect, it } from 'vitest'
import {
  corpus,
  corpusFromText,
  docs,
  isArchConfigError,
  predicateHaveField,
  resolveFieldValue,
  type FieldReading,
  type MdDocument,
} from '../../src/index.js'
import type { HaveFieldOptions } from '../../src/builders/have-field.js'
import { FIELD_DOCS, FIELD_SPECS } from '../helpers/field-reading-fixture.js'
import { tree } from '../helpers/tree.js'

// Plan 0624, Phase 1b: the public reader of one document's field, as `haveField` decides it. Each
// arm follows the predicate's rule; the agreement below holds it to `predicateHaveField` and to the
// `haveField` condition, document by document, over the fixture that holds every outcome class.

const c = corpusFromText({ ...FIELD_DOCS })
const byPath = new Map(c.documents().map((d) => [d.relPath, d]))
const at = (path: string): MdDocument => {
  const d = byPath.get(path)
  if (d === undefined) throw new Error(`no fixture document ${path}`)
  return d
}

/** Agreement is with `haveField` without `oneOf`: the reader reports the value as written. */
const AGREEING = Object.entries(FIELD_SPECS).filter(([, spec]) => spec.oneOf === undefined)

const said = (r: FieldReading): string[] =>
  r.kind === 'value'
    ? r.notes.map((n) => n.message)
    : r.kind === 'unreadable'
      ? r.causes.map((u) => u.message)
      : [r.message]

describe('resolveFieldValue agrees with haveField, document by document (plan 0624)', () => {
  it('the fixture holds 16 documents and 5 agreeing specs: 80 pairs, each judged', () => {
    let pairs = 0
    for (const [name, spec] of AGREEING) {
      const p = predicateHaveField(spec)
      const found = docs(c).should().haveField(spec).violations()
      for (const d of c.documents()) {
        const r = resolveFieldValue(d, spec)
        let test: boolean | 'refuses'
        try {
          test = p.test(d)
        } catch {
          test = 'refuses'
        }
        const undecided = (p.undecided?.(d) ?? []).map((u) => u.message)
        const condition = found.filter((v) => v.file === d.file).map((v) => v.message)
        const where = `${name} × ${d.relPath}`
        if (r.kind === 'value') expect([where, test, undecided]).toEqual([where, true, []])
        if (r.kind === 'absent') expect([where, test, undecided]).toEqual([where, false, []])
        if (r.kind === 'unreadable')
          expect([where, test, undecided]).toEqual([where, 'refuses', said(r)])
        expect([where, condition]).toEqual([where, said(r)])
        pairs += 1
      }
    }
    expect(pairs).toBe(80)
  })

  it('each outcome class occurs, under the header spec, with its count', () => {
    const header = FIELD_SPECS['header'] ?? { label: 'Status', forms: [] }
    const kinds = Object.fromEntries(
      c
        .documents()
        .map((d) => [d.relPath.replace(/^docs\/|\.md$/g, ''), resolveFieldValue(d, header).kind]),
    )
    expect(kinds).toEqual({
      value: 'value',
      'conflict-disagree': 'unreadable',
      'conflict-agree': 'unreadable',
      empty: 'unreadable',
      'unread-form': 'unreadable',
      'unclosed-fence': 'unreadable',
      indented: 'unreadable',
      'outside-header': 'unreadable',
      'absent-with-labels': 'absent',
      'absent-no-labels': 'absent',
      'value-prose-note': 'value',
      'value-unread-form-note': 'value',
      alias: 'absent',
      'section-present': 'unreadable',
      split: 'absent',
      disallowed: 'value',
    })
    const count = (k: string): number => Object.values(kinds).filter((v) => v === k).length
    expect([count('value'), count('absent'), count('unreadable')]).toEqual([4, 4, 8])
  })

  it('the value arm carries the resolved occurrence and its notes', () => {
    const header = FIELD_SPECS['header'] ?? { label: 'Status', forms: [] }
    expect(resolveFieldValue(at('docs/value-prose-note.md'), header)).toEqual({
      kind: 'value',
      values: ['open'],
      line: 3,
      label: 'Status',
      form: 'bold',
      notes: [
        expect.objectContaining({
          line: 4,
          message: "prose says Status 'closed', but the field at line 3 says 'open'",
        }),
      ],
    })
    expect(resolveFieldValue(at('docs/value-unread-form-note.md'), header)).toMatchObject({
      kind: 'value',
      notes: [expect.objectContaining({ line: 5 })],
    })
    const split = FIELD_SPECS['split'] ?? { label: 'Tags', forms: [] }
    expect(resolveFieldValue(at('docs/split.md'), split)).toMatchObject({
      kind: 'value',
      values: ['red', 'blue'],
    })
    const alias = FIELD_SPECS['header-aliases'] ?? { label: 'Status', forms: [] }
    expect(resolveFieldValue(at('docs/alias.md'), alias)).toMatchObject({
      kind: 'value',
      label: 'State',
      values: ['open'],
    })
  })

  it("a section the document lacks is absent, with haveField's message, not unreadable", () => {
    const section = FIELD_SPECS['section'] ?? { label: 'Status', forms: [] }
    expect(resolveFieldValue(at('docs/value.md'), section)).toEqual({
      kind: 'absent',
      line: 1,
      message: 'no section "Meta" to read Status from (region)',
    })
  })

  it('no arm but the value arm carries a value', () => {
    const header = FIELD_SPECS['header'] ?? { label: 'Status', forms: [] }
    for (const d of c.documents()) {
      const r = resolveFieldValue(d, header)
      if (r.kind !== 'value') expect([d.relPath, 'values' in r]).toEqual([d.relPath, false])
    }
  })

  it('a waiver comment does not apply: the reader is not a rule', () => {
    const disk = corpus({
      cwd: tree({
        'docs/w.md':
          '# W\n\n**Status:** open\n**Status:** closed\n\n<!-- eess-exclude md/x: why -->\n',
      }),
      roots: ['docs/**'],
    })
    const [d] = disk.documents()
    if (d === undefined) throw new Error('no document')
    const header = FIELD_SPECS['header'] ?? { label: 'Status', forms: [] }
    const r = resolveFieldValue(d, header)
    expect(r.kind === 'unreadable' ? r.causes.map((u) => u.message) : r.kind).toEqual([
      "Status is given twice (line 3 'open', line 4 'closed'); keep one",
    ])
  })
})

describe('resolveFieldValue refuses a misconfiguration (plan 0624)', () => {
  const d = at('docs/value.md')
  const refusal = (options: HaveFieldOptions): string => {
    try {
      resolveFieldValue(d, options)
    } catch (e) {
      return isArchConfigError(e) ? e.message : `not an ArchConfigError: ${String(e)}`
    }
    return 'no refusal'
  }
  it.each([
    ['an empty label', { label: '', forms: ['bold'] }, /label is empty/],
    ['a whitespace label', { label: '  ', forms: ['bold'] }, /label is empty/],
    ['no forms', { label: 'Status', forms: [] }, /forms is empty/],
    [
      'a malformed region',
      { label: 'Status', forms: ['bold'], region: { section: 'S', depth: Number.NaN } },
      /depth/,
    ],
    ['a oneOf', { label: 'Status', forms: ['bold'], oneOf: /^open$/ }, /oneOf is not read here/],
  ] satisfies readonly (readonly [string, HaveFieldOptions, RegExp])[])(
    '%s throws ArchConfigError',
    (_, options, says) => {
      expect(refusal(options)).toMatch(says)
    },
  )
})
