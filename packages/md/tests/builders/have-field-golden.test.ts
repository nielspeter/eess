import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { corpusFromText } from '../../src/index.js'
import { goldenTable, FIELD_DOCS, FIELD_SPECS } from '../helpers/field-reading-fixture.js'

// Plan 0624, Phase 1a: `haveField`'s decisions captured from `main` before `predicateHaveField` was
// moved onto the shared projection (`fieldOutcome`). The table is data, so a change to the
// projection cannot pass by moving both sides of a comparison together: it must leave every row as
// it was, or change this file in the open.

const golden: unknown = JSON.parse(
  readFileSync(new URL('../fixtures/field-reading-golden.json', import.meta.url), 'utf8'),
)

describe("haveField's decisions are unchanged (plan 0624 golden table)", () => {
  it('the table covers every document under every spec', () => {
    const expected = Object.keys(FIELD_DOCS).length * Object.keys(FIELD_SPECS).length
    expect(expected).toBe(96)
    expect(golden).toMatchObject({ rows: expected })
  })

  it('every row is as captured: predicate test, undecided causes and condition messages', () => {
    expect(golden).toMatchObject({ table: goldenTable((files) => corpusFromText({ ...files })) })
  })
})
