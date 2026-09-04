// Unit tests for the UTF-8 predicates (bug 0247), using Node's built-in test
// runner — the convention `scripts/lib/family-re-exports.test.mjs` set, since
// no vitest project covers `scripts/*.mjs`.
//
// Run: `node --test scripts/lib/source-text.test.mjs` (wired into `check:integrity`).
//
// WHY this exists, from testing review's measurement: the end-to-end probe in
// `scripts/nonvacuity/bad-waived-gates.mjs` plants one byte pattern and reaches
// exactly one of six branches. Five acceptance predicates could be deleted with
// `check:nonvacuity` still green. `invalidUtf8At` now delegates the VERDICT to
// `TextDecoder`, so those deletions can no longer let a bad file through — but
// they can still misreport WHERE, and the offset is what makes the finding
// actionable rather than a hunt through a file the tools have stopped reading.
//
// The oracle ships with Node, so the test is a differential one: anything
// `TextDecoder('utf-8', { fatal: true })` refuses, these must refuse, and at the
// right place.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { invalidUtf8At, firstInvalidUtf8 } from './source-text.mjs'

const UTF8 = new TextDecoder('utf-8', { fatal: true })
const decodes = (buf) => {
  try {
    UTF8.decode(buf)
    return true
  } catch {
    return false
  }
}

test('agrees with TextDecoder on every 1- and 2-byte sequence', () => {
  const bad = []
  for (let a = 0; a < 256; a += 1) {
    for (let b = -1; b < 256; b += 1) {
      const buf = b === -1 ? Buffer.from([a]) : Buffer.from([a, b])
      if (decodes(buf) !== (firstInvalidUtf8(buf) === -1)) bad.push(buf.toString('hex'))
    }
  }
  // The whole space, named when it disagrees — a count would not say which.
  assert.deepEqual(bad, [])
})

test('agrees with TextDecoder across the 3-byte space', () => {
  const bad = []
  for (let a = 0xc0; a <= 0xff; a += 1) {
    for (let b = 0; b < 256; b += 1) {
      for (const c of [0x00, 0x41, 0x7f, 0x80, 0x9f, 0xa0, 0xbf, 0xc0, 0xff]) {
        const buf = Buffer.from([a, b, c])
        if (decodes(buf) !== (firstInvalidUtf8(buf) === -1)) bad.push(buf.toString('hex'))
      }
    }
  }
  assert.deepEqual(bad, [])
})

test('rejects the classes a naive decoder accepts', () => {
  // Named rather than fuzzed, because these are the ones a hand-rolled table
  // gets wrong, and a reader should see them listed. Java's modified UTF-8
  // writes NUL as `C0 80` and non-BMP as CESU-8 surrogate pairs, so rows 1 and 4
  // are shapes real files carry.
  for (const [what, bytes] of [
    ['overlong NUL', [0xc0, 0x80]],
    ['overlong slash', [0xc0, 0xaf]],
    ['overlong 3-byte', [0xe0, 0x80, 0x80]],
    ['surrogate D800', [0xed, 0xa0, 0x80]],
    ['surrogate DFFF', [0xed, 0xbf, 0xbf]],
    ['beyond U+10FFFF', [0xf4, 0x90, 0x80, 0x80]],
    ['lead F5', [0xf5, 0x80, 0x80, 0x80]],
    ['lead FF', [0xff]],
    ['stray continuation', [0x80]],
    ['truncated 3-byte', [0xe2, 0x82]],
    ['truncated 4-byte', [0xf0, 0x9f, 0x8e]],
    ['overlong 4-byte', [0xf0, 0x80, 0x80, 0x80]],
    ['overlong 4-byte at the boundary', [0xf0, 0x8f, 0xbf, 0xbf]],
    ['just past U+10FFFF', [0xf4, 0x90, 0x80, 0x80]],
    ['lone lead at end of buffer', [0xe2]],
  ]) {
    const buf = Buffer.from(bytes)
    assert.equal(decodes(buf), false, `${what} should be invalid — the oracle disagrees`)
    assert.notEqual(invalidUtf8At(buf), -1, `${what} was accepted`)
    // ...and the SCANNER independently, not only the TextDecoder-backed verdict.
    // The first version asserted `invalidUtf8At` alone, which delegates to the
    // decoder and is therefore right whatever the scanner does — so three of
    // testing review's eight sabotage rows (F0 overlong, the U+10FFFF ceiling,
    // truncation) stayed green against a test written to catch exactly them.
    assert.notEqual(firstInvalidUtf8(buf), -1, `${what} was accepted by the scanner`)
  }
})

test('accepts the boundary cases next to those, so it is not merely strict', () => {
  // The other half: a check that rejected everything would pass the test above.
  for (const [what, bytes] of [
    ['last before surrogates', [0xed, 0x9f, 0xbf]],
    ['first after surrogates', [0xee, 0x80, 0x80]],
    ['smallest 2-byte', [0xc2, 0x80]],
    ['smallest 3-byte', [0xe0, 0xa0, 0x80]],
    ['smallest 4-byte', [0xf0, 0x90, 0x80, 0x80]],
    ['U+10FFFF', [0xf4, 0x8f, 0xbf, 0xbf]],
    ['ASCII with NUL', [0x61, 0x00, 0x62]],
  ]) {
    const buf = Buffer.from(bytes)
    assert.equal(decodes(buf), true, `${what} should be valid — the oracle disagrees`)
    assert.equal(invalidUtf8At(buf), -1, `${what} was rejected`)
    assert.equal(firstInvalidUtf8(buf), -1, `${what} was rejected by the scanner`)
  }
})

test('reports the offset where the invalid sequence starts, not merely somewhere', () => {
  // The property that survives the delegation to TextDecoder, and the one the
  // finding's line number is computed from.
  const prefixes = ['', 'a', 'héllo wörld', '日本語', '🎉 emoji', 'l1\nl2\nl3\n']
  for (const p of prefixes) {
    const head = Buffer.from(p, 'utf8')
    for (const bytes of [[0xc0], [0xf5], [0x80], [0xed, 0xa0, 0x80], [0xe0, 0x80, 0x80]]) {
      const buf = Buffer.concat([head, Buffer.from(bytes), Buffer.from(' tail', 'utf8')])
      assert.equal(
        invalidUtf8At(buf),
        head.length,
        `offset for ${bytes.map((b) => b.toString(16)).join(' ')} after ${JSON.stringify(p)}`,
      )
    }
  }
})

test('the scanner never claims a valid buffer is invalid', () => {
  // `invalidUtf8At` clamps a scanner that returns -1 on a buffer the decoder
  // refused. This pins the other direction: on a buffer the decoder ACCEPTS the
  // scanner must agree, or the clamp would be hiding a disagreement.
  for (const s of ['', 'plain', 'héllo', '日本語テキスト', '🎉🚀', 'mixed é 日 🎉\n']) {
    assert.equal(
      firstInvalidUtf8(Buffer.from(s, 'utf8')),
      -1,
      `false positive on ${JSON.stringify(s)}`,
    )
  }
})
