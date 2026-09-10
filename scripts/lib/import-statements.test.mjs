import { test } from 'node:test'
import assert from 'node:assert/strict'
import { importStatementsIn } from './import-statements.mjs'

// Every row a testing review measured against the first version, plus the shapes
// a migration actually uses. A dropped import turns its fence into a fragment,
// and a fragment is indistinguishable from a fence that claimed nothing — so
// "missed" and "there was nothing to check" look identical without these.

test('a single named import', () => {
  assert.deepEqual(importStatementsIn("import { a } from 'p'"), ["import { a } from 'p'"])
})

test('a named list spanning lines', () => {
  const code = "import {\n  a,\n  b,\n} from 'p'"
  assert.deepEqual(importStatementsIn(code), [code])
})

test('a type-only import', () => {
  assert.deepEqual(importStatementsIn("import type { A } from 'p'"), ["import type { A } from 'p'"])
})

test('a default import', () => {
  assert.deepEqual(importStatementsIn("import d from 'p'"), ["import d from 'p'"])
})

test('a namespace import', () => {
  assert.deepEqual(importStatementsIn("import * as ns from 'p'"), ["import * as ns from 'p'"])
})

test('a side-effect import', () => {
  assert.deepEqual(importStatementsIn("import 'p'"), ["import 'p'"])
})

test('several imports in one fence', () => {
  const code = "import { a } from 'p'\nconst x = 1\nimport { b } from 'q'"
  assert.deepEqual(importStatementsIn(code), ["import { a } from 'p'", "import { b } from 'q'"])
})

// The three the first version dropped, each measured leaving the gate green.

test('an import AFTER an import.meta line is not swallowed', () => {
  const code = "import.meta.url\nimport { a } from 'p'"
  assert.deepEqual(importStatementsIn(code), ["import { a } from 'p'"])
})

test('an import AFTER a dynamic import() line is not swallowed', () => {
  const code = "import('side')\nimport { a } from 'p'"
  assert.deepEqual(importStatementsIn(code), ["import { a } from 'p'"])
})

test('an unterminated import at end of fence does not discard earlier ones', () => {
  const code = "import { a } from 'p'\nimport {\n  b,"
  assert.deepEqual(importStatementsIn(code), ["import { a } from 'p'"])
})

// Shapes that must NOT be treated as import statements.

test('a commented-out import is ignored', () => {
  assert.deepEqual(importStatementsIn("// import { a } from 'p'"), [])
})

test('an identifier merely starting with "import" is ignored', () => {
  assert.deepEqual(importStatementsIn('importantThing()'), [])
})

// The known limits, pinned so they are a decision rather than a surprise. Both
// are fail-closed: an extra statement is compiled, never a real one skipped.

test('a line comment does not yield an import', () => {
  assert.deepEqual(importStatementsIn("// import { a } from 'p'"), [])
})

test('KNOWN LIMIT: a block comment does yield one, and that is fail-closed', () => {
  assert.deepEqual(importStatementsIn("/*\nimport { a } from 'p'\n*/"), ["import { a } from 'p'"])
})

test('a fence with no import yields nothing', () => {
  assert.deepEqual(importStatementsIn('finishPreset(violations)'), [])
})

test('the two forms do not double-count one statement', () => {
  assert.deepEqual(importStatementsIn("import 'p'\nimport { a } from 'q'"), [
    "import 'p'",
    "import { a } from 'q'",
  ])
})
