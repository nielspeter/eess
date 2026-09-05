import { test } from 'node:test'
import assert from 'node:assert/strict'
import { POINTER_CLASSES, pointerSummary } from './pointer-classes.mjs'

// Real message prefixes, copied from what `pointer-resolve.ts` emits. Copied
// rather than imported: importing the dialect's own strings would make this go
// green when the wording drifts, which is the one thing it exists to catch.
const BROKEN = 'broken code pointer: "x.ts:1" — no such file in the repo'
const STALE = 'stale code pointer: a/x.ts has 5 lines; "a/x.ts:9" references line 9'
const AMBIG =
  'ambiguous code pointer: "x.ts:1" matches 2 files (a/x.ts, b/x.ts) — cite a longer suffix'

test('no violations reads as a pass, not as an empty failure', () => {
  assert.equal(pointerSummary([]), '✓ all ground in code')
})

test('each class is named by its own label, not folded into a neighbour', () => {
  // The regression that shipped twice: ambiguous counted under "stale", which
  // sends the reader to check a line number that was never the problem.
  assert.equal(pointerSummary([AMBIG]), '✗ 1 ambiguous (matches several files)')
  assert.equal(pointerSummary([STALE]), '✗ 1 stale (line past end)')
  assert.equal(pointerSummary([BROKEN]), '✗ 1 broken (no such file)')
})

test('classes are counted separately and joined, in table order', () => {
  const out = pointerSummary([BROKEN, AMBIG, STALE, AMBIG])
  assert.equal(
    out,
    '✗ 1 broken (no such file) · 1 stale (line past end) · 2 ambiguous (matches several files)',
  )
})

test('a class the table does not know is named unclassified, never absorbed', () => {
  // The property the `rest` bucket exists for. Asserted on a message that
  // matches no prefix: a fourth class must not land under a wrong label with a
  // right-looking count.
  const out = pointerSummary([BROKEN, 'circular code pointer: "x.ts:1" cites its own document'])
  assert.match(out, /1 broken \(no such file\)/)
  assert.match(out, /1 unclassified/)
  assert.match(out, /pointer-classes\.mjs/) // says where to fix it
})

test('a total is never claimed that the parts do not add up to', () => {
  // Every violation lands in exactly one bucket. Checked by summing the printed
  // integers rather than by trusting the loop.
  const messages = [BROKEN, BROKEN, STALE, AMBIG, 'unknown shape']
  const printed = [...pointerSummary(messages).matchAll(/(\d+) /g)].map((m) => Number(m[1]))
  assert.equal(
    printed.reduce((a, b) => a + b, 0),
    messages.length,
  )
})

test('the gloss tells the reader what the class means', () => {
  // ADR-009: the failure surface is the instruction. A bare label ("ambiguous")
  // is a category; the gloss is what makes it actionable at a glance.
  for (const [label, , gloss] of POINTER_CLASSES) {
    assert.ok(gloss.length > 0, `${label} has no gloss`)
  }
})
