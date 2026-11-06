import { describe, expect, it } from 'vitest'
import {
  corpus,
  corpusFromText,
  docs,
  isArchConfigError,
  predicateHaveField,
  resolveFieldValue,
  type FieldReading,
  type FieldReadingOptions,
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

/** Agreement is with `haveField` without `oneOf`: the reader returns the value before any `oneOf`. */
const AGREEING = Object.entries(FIELD_SPECS).filter(([, spec]) => spec.oneOf === undefined)

/** A `haveField` spec as the reader takes it: its `oneOf`, when it has one, dropped. */
const reading = (spec: HaveFieldOptions): FieldReadingOptions => {
  const { oneOf, ...rest } = spec
  void oneOf
  return rest
}
const spec = (name: string): FieldReadingOptions => {
  const s = FIELD_SPECS[name]
  if (s === undefined) throw new Error(`no fixture spec ${name}`)
  return reading(s)
}

const said = (r: FieldReading): string[] =>
  r.kind === 'value'
    ? r.notes.map((n) => n.message)
    : r.kind === 'unreadable'
      ? r.causes.map((u) => u.message)
      : [r.message]

describe('resolveFieldValue agrees with haveField, document by document (plan 0624)', () => {
  it('the fixture holds 21 documents and 5 agreeing specs: 105 pairs, each judged', () => {
    let pairs = 0
    for (const [name, spec] of AGREEING) {
      const p = predicateHaveField(spec)
      const found = docs(c).should().haveField(spec).violations()
      for (const d of c.documents()) {
        const r = resolveFieldValue(d, reading(spec))
        let test: boolean | 'refuses'
        try {
          test = p.test(d)
        } catch (e) {
          if (!isArchConfigError(e)) throw e
          test = 'refuses'
        }
        // The whole cause, not its message only: file, line, element and message.
        const undecided = p.undecided?.(d) ?? []
        const condition = found
          .filter((v) => v.file === d.file)
          .map((v) => `${String(v.line)}: ${v.message}`)
        const where = `${name} × ${d.relPath}`
        if (r.kind === 'value') expect([where, test, undecided]).toEqual([where, true, []])
        if (r.kind === 'absent') expect([where, test, undecided]).toEqual([where, false, []])
        if (r.kind === 'unreadable')
          expect([where, test, undecided]).toEqual([where, 'refuses', r.causes])
        const lines =
          r.kind === 'value'
            ? r.notes.map((n) => `${String(n.line)}: ${n.message}`)
            : r.kind === 'unreadable'
              ? r.causes.map((u) => `${String(u.line)}: ${u.message}`)
              : condition.length === 1 && condition[0]?.endsWith(`: ${r.message}`) === true
                ? condition
                : [`?: ${r.message}`]
        expect([where, condition]).toEqual([where, lines])
        pairs += 1
      }
    }
    expect(pairs).toBe(105)
  })

  it('each outcome class occurs, by its cause, with its count', () => {
    // [spec, document, kind, what its cause (or note) says]: one row per class the plan names.
    const classes: readonly (readonly [
      string,
      string,
      FieldReading['kind'],
      RegExp | undefined,
    ])[] = [
      ['header', 'value', 'value', undefined],
      [
        'header',
        'conflict-disagree',
        'unreadable',
        /given twice \(line 3 'open', line 4 'closed'\)/,
      ],
      ['header', 'conflict-agree', 'unreadable', /given twice \(line 3 'open', line 4 'open'\)/],
      ['header', 'empty', 'unreadable', /has no value this rule can read/],
      ['header', 'unread-form', 'unreadable', /in a form this rule does not read \(heading\)/],
      ['header', 'unclosed-fence', 'unreadable', /follows a code fence that never closes/],
      ['header', 'indented', 'unreadable', /sits in an indented code block/],
      ['header', 'outside-header', 'unreadable', /is outside the header/],
      ['section', 'outside-section', 'unreadable', /outside/],
      ['section', 'value', 'absent', /^no section "Meta" to read Status from \(region\)$/],
      ['header', 'absent-with-labels', 'absent', /its labels: Owner/],
      ['header', 'absent-no-labels', 'absent', /^no Status field/],
      ['header', 'value-prose-note', 'value', /^prose says Status 'closed'/],
      ['header', 'value-unread-form-note', 'value', /in a form this rule does not read/],
      ['header', 'unread-form-twice', 'unreadable', /line 3.*\| .*line 5/],
      ['header', 'value-two-notes', 'value', /^prose says .* \| found `## Status: shut`/],
      ['header', 'measured-indented-example', 'value', undefined],
      ['header', 'measured-indented-heading', 'value', undefined],
    ]
    const got = classes.map(([name, path, , says]) => {
      const r = resolveFieldValue(at(`docs/${path}.md`), spec(name))
      const text = said(r).join(' | ')
      return [name, path, r.kind, says === undefined ? text === '' : says.test(text)]
    })
    expect(got).toEqual(classes.map(([name, path, kind]) => [name, path, kind, true]))
    const count = (k: string): number => classes.filter((c) => c[2] === k).length
    expect([classes.length, count('value'), count('absent'), count('unreadable')]).toEqual([
      18, 6, 3, 9,
    ])
  })

  it('the value arm carries the resolved occurrence and its notes', () => {
    const header = spec('header')
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
    const split = spec('split')
    expect(resolveFieldValue(at('docs/split.md'), split)).toMatchObject({
      kind: 'value',
      values: ['red', 'blue'],
    })
    const alias = spec('header-aliases')
    expect(resolveFieldValue(at('docs/alias.md'), alias)).toMatchObject({
      kind: 'value',
      label: 'State',
      values: ['open'],
    })
  })

  it('the value arm carries the values after the value option, as haveField reads them', () => {
    expect(resolveFieldValue(at('docs/value.md'), spec('value'))).toMatchObject({
      kind: 'value',
      // The value option sees the raw text after the label, as fields() hands it over.
      values: [' OPEN'],
    })
  })

  it("a haveField spec carrying oneOf does not type-check as the reader's options", () => {
    const gate: HaveFieldOptions = { label: 'Status', forms: ['bold'], oneOf: /^open$/ }
    // @ts-expect-error the reader takes no oneOf: drop it (`const { oneOf: _, ...spec } = gate`)
    expect(() => resolveFieldValue(at('docs/value.md'), gate)).toThrow(/oneOf is not read here/)
    expect(resolveFieldValue(at('docs/value.md'), reading(gate)).kind).toBe('value')
  })

  it("a section the document lacks is absent, with haveField's message, not unreadable", () => {
    const section = spec('section')
    expect(resolveFieldValue(at('docs/value.md'), section)).toEqual({
      kind: 'absent',
      message: 'no section "Meta" to read Status from (region)',
    })
  })

  it('no arm but the value arm carries a value', () => {
    const header = spec('header')
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
    const header = spec('header')
    const r = resolveFieldValue(d, header)
    expect(r.kind === 'unreadable' ? r.causes.map((u) => u.message) : r.kind).toEqual([
      "Status is given twice (line 3 'open', line 4 'closed'); keep one",
    ])
  })
})

describe('resolveFieldValue refuses a misconfiguration (plan 0624)', () => {
  const d = at('docs/value.md')
  // Called as a plain-JavaScript caller would, past the type: the refusals are the runtime guard.
  const refusal = (options: HaveFieldOptions): string => {
    try {
      Reflect.apply(resolveFieldValue, undefined, [d, options])
    } catch (e) {
      return isArchConfigError(e) ? e.message : `not an ArchConfigError: ${String(e)}`
    }
    return 'no refusal'
  }
  it.each([
    ['an empty label', { label: '', forms: ['bold'] }, /label or alias is empty/],
    ['a whitespace label', { label: '  ', forms: ['bold'] }, /label or alias is empty/],
    [
      'an empty alias',
      { label: 'Status', forms: ['bold'], aliases: [' '] },
      /label or alias is empty/,
    ],
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
