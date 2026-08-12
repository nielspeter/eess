/**
 * The `it('…')` title grammar for this package — one definition, because both of
 * its presets read it. Not the family's only copy: `eess-md`'s `adr.ts` carries a
 * third, on the same ADR-citation contract, and cannot import this one (the
 * dependency runs crossvalidate → md, and `eess/md-isolated` forbids the
 * reverse). See bug 0111 for that, and 0114 for why the grammar arguably belongs
 * behind eess-ts's engine boundary rather than here at all.
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
 *
 * That has a cost worth knowing before you write a citation: a title's raw text
 * is **prettier's to change**. `it("say 'hi' to \"them\"")` is reformatted to
 * `it('say \'hi\' to "them"')` — same string, different source, different key —
 * while the ADR's citation sits in a markdown code span prettier will not touch.
 * A correct citation can go red after a routine `npm run format`. It fails loud
 * rather than silent, which is the right direction, but prefer a title that
 * needs no escaping at all.
 *
 * ## Two input classes, two grammars
 *
 * The anchored readers are handed an enriched call name built from ts-morph's
 * `getText()` — guaranteed-valid TypeScript, where a `\` is always an escape and
 * the delimiters always balance. `citedItTitles` reads **arbitrary prose** from
 * a table cell, where neither holds. Sharing one permissive grammar across both
 * cost a real regression, caught in review before this shipped: given a cell
 * holding a malformed citation followed by a good one,
 *
 *     `it('first` and `it('second')`
 *
 * the permissive body ran past the second citation's opening quote and closed
 * there — yielding one bogus key and **dropping a real citation from the check
 * entirely**. A citation nobody checks is the same false green this module was
 * written to remove. So the prose variant is tempered: it cannot cross a line,
 * and it cannot swallow the start of another citation.
 */

/** The opening of a citation: `it(`, `it.skip(`, … up to and including its quote. */
const IT_OPEN = `it(?:\\.\\w+)?\\(\\s*['"\`]`

/**
 * A quoted string whose closing delimiter must match its opening one — group `q`
 * is the delimiter, group `title` the payload. `body` is what may sit between
 * them; the two alternatives have disjoint first characters (`\\.` starts with a
 * backslash, the other excludes it), so the alternation is deterministic and the
 * `+` cannot fork — no backtracking blowup on a long unterminated title.
 */
const quoted = (body: string): string => `(?<q>['"\`])(?<title>(?:\\\\.|${body})+)\\k<q>`

/** Valid TypeScript source: anything but the delimiter that opened the string. */
const SOURCE_BODY = `(?!\\k<q>)[^\\\\]`

/**
 * Arbitrary prose: additionally refuses to cross a newline (a Mechanism cell is
 * one line) or to consume the start of another citation, so one malformed
 * citation cannot eat its neighbour. Tempering on the full opening — callee,
 * paren *and* quote — keeps a title that merely mentions `it(x)` intact.
 */
const PROSE_BODY = `(?!\\k<q>)(?!${IT_OPEN})[^\\\\\\n]`

/**
 * `<callee>(` with an optional modifier — `it(`, `it.skip(`, `test.concurrent(`.
 * The lookbehind is what keeps `submit('save')`, `emit('drift')` and `audit('x')`
 * from reading as citations; it is redundant under `^` and load-bearing in prose.
 */
const CALL = (callee: string): string => `(?<![\\w$.])(?:${callee})(?:\\.\\w+)?\\(\\s*`

// Anchored: the input is an enriched call name produced by eess-ts's
// `getName({ withArgument: 0 })`, e.g. `it('does a thing')`.
const IT_TITLE = new RegExp(`^${CALL('it')}${quoted(SOURCE_BODY)}`)
const IT_OR_TEST_TITLE = new RegExp(`^${CALL('it|test')}${quoted(SOURCE_BODY)}`)

// Unanchored + global: citations are embedded in prose (an ADR's Mechanism cell).
const IT_CITATION = new RegExp(`${CALL('it')}${quoted(PROSE_BODY)}`, 'g')

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
