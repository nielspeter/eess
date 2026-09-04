import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TERMINAL_FOLDER_NAMES,
  frozenFolderName,
  nonTerminalFreezes,
  frozenScopeRefusal,
} from './frozen-scope.mjs'

// The list the production gate actually passes. Duplicated here on purpose:
// a test importing the real value would go green when someone widens it, which
// is the one mutation this whole module exists to catch.
const SHIPPED = [
  '**/completed/**',
  '**/wont-do/**',
  '**/fixed/**',
  '**/archived/**',
  'work/spikes/**',
]

test('the shipped frozen list passes — the guard does not red the tree it ships on', () => {
  assert.deepEqual(nonTerminalFreezes(SHIPPED), [])
})

test("frozen: 'work/**' is refused — the measured 463-to-18 mutation", () => {
  // Named, not counted: a guard that returned every glob would satisfy a length
  // check while calling the four legitimate freezes offenders too.
  assert.deepEqual(nonTerminalFreezes([...SHIPPED, 'work/**']), ['work/**'])
})

test('each lane freeze is refused on its own, not just the whole-work one', () => {
  // Bug 0131's lesson applied here: the interesting corruption is narrow. A
  // guard checked only against `work/**` would pass every one of these.
  for (const lane of ['work/bugs/**', 'work/plans/**', 'work/proposals/**', 'adr/**', 'docs/**']) {
    assert.deepEqual(nonTerminalFreezes([...SHIPPED, lane]), [lane], `${lane} must be refused`)
  }
})

test('a freeze by shape rather than by name is refused', () => {
  // `work/*/**` freezes every lane without naming one — the way to get the
  // effect of `work/**` past a check that only compared strings.
  assert.deepEqual(nonTerminalFreezes(['work/*/**']), ['work/*/**'])
  assert.deepEqual(nonTerminalFreezes(['**']), ['**'])
  assert.deepEqual(nonTerminalFreezes(['**/*']), ['**/*'])
})

test('a terminal folder is recognised wherever it sits in the path', () => {
  // The shipped list mixes both spellings — `**/fixed/**` and `work/spikes/**`
  // — so the name must be read from the tail, not from a fixed position.
  assert.equal(frozenFolderName('**/fixed/**'), 'fixed')
  assert.equal(frozenFolderName('work/spikes/**'), 'spikes')
  assert.equal(frozenFolderName('a/b/c/archived/**'), 'archived')
  assert.equal(frozenFolderName('completed'), 'completed')
})

test('a lane named after a terminal folder is still frozen — the known limitation, asserted', () => {
  // This guard checks NAMES, so renaming a live lane to `work/fixed/` would let
  // it through. That is deliberate: the escape hatch is a rename nobody does by
  // accident, where the glob edit was invisible. Asserted so the limitation is a
  // recorded decision rather than a gap someone discovers later.
  assert.deepEqual(nonTerminalFreezes(['work/fixed/**']), [])
})

test('the refusal names the offender and the way out', () => {
  // A refusal that says only "invalid" sends the reader to the wrong fix —
  // ADR-009: the failure surface is the instruction.
  const text = frozenScopeRefusal(['work/**'])
  assert.match(text, /work\/\*\*/)
  assert.match(text, /TERMINAL_FOLDER_NAMES/)
  assert.match(text, /scripts\/lib\/frozen-scope\.mjs/)
  for (const name of TERMINAL_FOLDER_NAMES) assert.match(text, new RegExp(name))
})
