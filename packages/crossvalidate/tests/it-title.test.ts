import { describe, it, expect } from 'vitest'
import { citedItTitles, itOrTestTitleOf, itTitleOf } from '../src/it-title.js'

// Bug 0104. The old grammar — `['"`]([^'"`]+)['"`]` — ended the capture at any
// quote character rather than the one that opened the string, so every case
// below whose title *contains* a quote of another kind was truncated at it.
// Titles are keys: two titles truncating to the same prefix become one key, and
// a citation to a deleted test resolves against whichever test survives.
describe('itTitleOf() — the title ends at the delimiter that opened it', () => {
  it('captures a backticked symbol inside a single-quoted title whole', () => {
    expect(itTitleOf("it('catches `HACK` inside a body')")).toBe('catches `HACK` inside a body')
  })

  it('keeps two titles that share a prefix up to their first backtick distinct', () => {
    const a = itTitleOf("it('catches `HACK` inside a body')")
    const b = itTitleOf("it('catches `any` in a return position')")
    expect(a).not.toBe(b)
  })

  it('captures a single-quoted phrase inside a double-quoted title', () => {
    expect(itTitleOf(`it("keeps a 'single quote' inside")`)).toBe("keeps a 'single quote' inside")
  })

  it('captures a single-quoted phrase inside a template-literal title', () => {
    expect(itTitleOf("it(`keeps a 'single quote' inside`)")).toBe("keeps a 'single quote' inside")
  })

  it('captures an escaped delimiter inside the title, as written', () => {
    // Raw source text is the key on both sides of the correspondence — the ADR
    // cites what the test file says, not what the string evaluates to.
    expect(itTitleOf("it('it\\'s fine')")).toBe("it\\'s fine")
  })

  it('captures a plain single-quoted title unchanged', () => {
    expect(itTitleOf("it('adds two numbers')")).toBe('adds two numbers')
  })

  it('reads modifier forms — it.skip and it.only', () => {
    expect(itTitleOf('it.skip("a pending guarantee")')).toBe('a pending guarantee')
    expect(itTitleOf("it.only('a focused one')")).toBe('a focused one')
  })

  it('returns undefined for a non-literal argument and for a foreign callee', () => {
    expect(itTitleOf('it(titleVariable)')).toBeUndefined()
    expect(itTitleOf("describe('a suite')")).toBeUndefined()
    expect(itTitleOf("test('the alias, which md↔ts does not accept')")).toBeUndefined()
  })

  it('does not run away past an unterminated string', () => {
    expect(itTitleOf("it('unterminated")).toBeUndefined()
  })
})

describe('itOrTestTitleOf() — the gherkin↔ts variant also accepts test()', () => {
  it('reads the test alias and its modifier forms', () => {
    expect(itOrTestTitleOf("test('checkout.feature › Apply a code')")).toBe(
      'checkout.feature › Apply a code',
    )
    expect(itOrTestTitleOf("test.concurrent('checkout.feature › Reject a code')")).toBe(
      'checkout.feature › Reject a code',
    )
  })

  it('captures a backticked scenario title whole', () => {
    expect(itOrTestTitleOf("it('discount.feature › Reject a `SAVE10` code')")).toBe(
      'discount.feature › Reject a `SAVE10` code',
    )
  })
})

describe('citedItTitles() — citations embedded in an ADR mechanism cell', () => {
  it('finds every citation in one cell', () => {
    expect(citedItTitles("Vitest · `it('first')` and `it.skip('second')`")).toEqual([
      'first',
      'second',
    ])
  })

  it('finds a backticked title written inside a double-backtick code span', () => {
    // The only way to write such a citation in markdown, and the case the ADR
    // side truncated identically to the AST side — which is what made the
    // collision resolve green instead of merely reporting an ambiguity.
    expect(citedItTitles("Vitest · ``it('catches `HACK` inside a body')``")).toEqual([
      'catches `HACK` inside a body',
    ])
  })

  it('finds nothing in a cell that cites no test', () => {
    expect(citedItTitles('`scripts/check-corpus.mjs` · manual review')).toEqual([])
  })
})
