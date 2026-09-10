import { test } from 'node:test'
import assert from 'node:assert/strict'
import { moduleClaimsIn } from './import-statements.mjs'

// Every shape a migration uses, plus the ones a hand-rolled scanner got wrong
// before this was parsed with ts-morph. A missed claim turns its fence into a
// fragment, and a fragment is indistinguishable from a fence that claimed
// nothing — so "missed" and "nothing to check" look identical without these.

test('a single named import', () => {
  assert.deepEqual(moduleClaimsIn("import { a } from 'p'"), ["import { a } from 'p'"])
})

test('a named list spanning lines', () => {
  const code = "import {\n  a,\n  b,\n} from 'p'"
  assert.deepEqual(moduleClaimsIn(code), [code])
})

test('a type-only import', () => {
  assert.deepEqual(moduleClaimsIn("import type { A } from 'p'"), ["import type { A } from 'p'"])
})

test('a default import', () => {
  assert.deepEqual(moduleClaimsIn("import d from 'p'"), ["import d from 'p'"])
})

test('a namespace import', () => {
  assert.deepEqual(moduleClaimsIn("import * as ns from 'p'"), ["import * as ns from 'p'"])
})

test('a side-effect import', () => {
  assert.deepEqual(moduleClaimsIn("import 'p'"), ["import 'p'"])
})

test('several claims in one fence, in source order', () => {
  const code = "import { a } from 'p'\nconst x = 1\nimport { b } from 'q'"
  assert.deepEqual(moduleClaimsIn(code), ["import { a } from 'p'", "import { b } from 'q'"])
})

// `export … from` is the same claim in the other direction, and the regex
// version missed it entirely — an architecture review measured the fence going
// unchecked as a result. `scripts/lib/family-re-exports.mjs` records this exact
// lesson about this exact node type.

test('a re-export names where a symbol lives and counts as a claim', () => {
  assert.deepEqual(moduleClaimsIn("export { a } from 'p'"), ["export { a } from 'p'"])
})

test('a star re-export counts too', () => {
  assert.deepEqual(moduleClaimsIn("export * from 'p'"), ["export * from 'p'"])
})

test('a bare export names no module and claims nothing', () => {
  assert.deepEqual(moduleClaimsIn('export { a }'), [])
})

test('imports and re-exports come back together, in order', () => {
  const code = "import { a } from 'p'\nexport { b } from 'q'"
  assert.deepEqual(moduleClaimsIn(code), ["import { a } from 'p'", "export { b } from 'q'"])
})

// Shapes that must NOT be read as claims. The regex version got the first three
// wrong in one direction or the other; the parser has no opinion to get wrong.

test('a line comment is not a claim', () => {
  assert.deepEqual(moduleClaimsIn("// import { a } from 'p'"), [])
})

test('a block comment is not a claim', () => {
  assert.deepEqual(moduleClaimsIn("/*\nimport { a } from 'p'\n*/"), [])
})

test('an import inside a template literal is not a claim', () => {
  assert.deepEqual(moduleClaimsIn("const t = `\nimport { a } from 'p'\n`"), [])
})

test('import.meta does not open a statement', () => {
  const code = "import.meta.url\nimport { a } from 'p'"
  assert.deepEqual(moduleClaimsIn(code), ["import { a } from 'p'"])
})

test('a dynamic import() does not open a statement', () => {
  const code = "import('side')\nimport { a } from 'p'"
  assert.deepEqual(moduleClaimsIn(code), ["import { a } from 'p'"])
})

test('an identifier merely starting with "import" is not a claim', () => {
  assert.deepEqual(moduleClaimsIn('importantThing()'), [])
})

test('a fence with no claim yields nothing', () => {
  assert.deepEqual(moduleClaimsIn('finishPreset(violations)'), [])
})

test('an unterminated import is surfaced, not swallowed and not dropped', () => {
  // Three behaviours are possible and only one is right. The regex version ran
  // past the open brace to any later `from '…'` — including one inside a string
  // — and emitted the lot as one statement. A later draft dropped it silently,
  // which turns a typo into a fence that quietly claims nothing.
  //
  // ts-morph recovers from the parse error and hands back the partial
  // declaration, so it reaches `tsc` and reds as the syntax error it is,
  // attributed to the fence. That is the behaviour worth pinning: an author who
  // mistypes an import is told, rather than silently un-checked.
  const code = "import { a } from 'p'\nimport {\n  b,"
  assert.deepEqual(moduleClaimsIn(code), ["import { a } from 'p'", 'import {\n  b,'])
})
