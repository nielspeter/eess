/**
 * The `it('…')` title grammar — one definition, because two presets read it.
 *
 * `md-ts` (ADR citations) and `gherkin-ts` (scenario citations) both have to
 * recover the title a test declares from source text, and both got it wrong the
 * same way: `['"`]([^'"`]+)['"`]` ends the capture at **any** quote character,
 * not at the one that opened the string. A character class cannot express "up to
 * the *matching* delimiter" — the opening quote is matched but never captured,
 * so the closing side has no way to require the same character.
 *
 * The cost is bug 0104, a false green: a single-quoted title containing a
 * backtick — the ordinary way to name a symbol in prose, and this repo's own
 * house style — truncated at that backtick, so
 *
 *     it('catches `HACK` inside a body')     ─┐
 *     it('catches `any` in a return position') ┴─→ both key on `catches `
 *
 * collapsed onto one key. Because the markdown side truncated identically, a
 * citation to a test that had been renamed away still resolved — against a
 * *different* test that happened to share the truncated prefix. The gate passed
 * over exactly the drift it exists to catch.
 *
 * Capturing the delimiter as `q` and back-referencing it fixes both halves at
 * once; the `\\.` alternative keeps an escaped delimiter inside the title.
 *
 * Titles are compared as **raw source text**, so `it('it\'s fine')` keys on
 * `it\'s fine`, backslash included. That is a deliberate consequence of reading
 * one grammar on both sides: an ADR cites what is written in the test file, not
 * what the string evaluates to, and both sides read it identically.
 */

/**
 * A quoted string whose closing delimiter must match its opening one.
 * Group `q` is the delimiter; group `title` is the payload.
 */
const QUOTED = `(?<q>['"\`])(?<title>(?:\\\\.|(?!\\k<q>)[^\\\\])+)\\k<q>`

/** `<callee>(` with an optional modifier — `it(`, `it.skip(`, `test.concurrent(`. */
const CALL = (callee: string): string => `(?:${callee})(?:\\.\\w+)?\\(\\s*`

// Anchored: the input is an enriched call name produced by eess-ts's
// `getName({ withArgument: 0 })`, e.g. `it('does a thing')`.
const IT_TITLE = new RegExp(`^${CALL('it')}${QUOTED}`)
const IT_OR_TEST_TITLE = new RegExp(`^${CALL('it|test')}${QUOTED}`)

// Unanchored + global: citations are embedded in prose (an ADR's Mechanism cell).
const IT_CITATION = new RegExp(`${CALL('it')}${QUOTED}`, 'g')

/**
 * The title in an enriched call name like `it('does a thing')`, or `undefined`
 * if the argument is not a literal string. Accepts modifier forms (`it.skip`,
 * `it.only`) — whether a *definition* in one of those forms counts is the
 * caller's call, made by the callee filter above this.
 */
export function itTitleOf(enriched: string): string | undefined {
  return IT_TITLE.exec(enriched)?.groups?.title
}

/** As {@link itTitleOf}, also accepting the `test` alias — gherkin↔ts's convention. */
export function itOrTestTitleOf(enriched: string): string | undefined {
  return IT_OR_TEST_TITLE.exec(enriched)?.groups?.title
}

/** Every `it('…')` title cited inside a fragment of prose, in order. */
export function citedItTitles(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(IT_CITATION)) {
    const title = m.groups?.title
    if (title !== undefined) out.push(title)
  }
  return out
}
