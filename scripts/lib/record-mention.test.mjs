import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { corpusFromText } from '@nielspeter/eess-md'
import { recordKeyOfPath } from './record-key.mjs'
import {
  LEFT_OUT,
  RECORD_MENTION,
  SKIPPED_AFTER_TS_ARCHUNIT,
  TS_ARCHUNIT_LAST,
  leftOutFaults,
  recordMentions,
  recordsOf,
  textHash,
} from './record-mention.mjs'

// Plan 0542: the two narrowings of the record-mention gate are pinned as written. Copied here, not
// imported, so a widened word list or a swapped entry is red rather than agreeing with itself.

const LB = String.raw`(?<!ts-archunit(?:'s)?\s+)`
const BEFORE = String.raw`ts-archunit(?:'s)?\s+`
// Each kind: its word as written, the separator, the digits, and ts-archunit's range as a pattern.
const KINDS_AS_WRITTEN = [
  ['bug', 's?', String.raw`\s+`, 4, String.raw`00(?:[0-7]\d|80)`],
  ['plan', 's?', String.raw`\s+`, 4, String.raw`0(?:0\d\d|10[0-6])`],
  ['spike', 's?', String.raw`\s+`, 4, String.raw`00[0-6]\d`],
  ['proposal', 's?', String.raw`\s+`, 3, String.raw`0(?:[01]\d|2[0-8])`],
  ['ADR', '', '-', 3, String.raw`0(?:0\d|10)`],
]
const alt = (word, plural, sep, n) => String.raw`\b(?<kind>${word})${plural}${sep}(?<n>${n})\b`

test('the record-mention pattern is pinned as written, the skip on every alternative', () => {
  assert.equal(
    RECORD_MENTION.source,
    KINDS_AS_WRITTEN.map(
      ([w, p, sep, d, range]) =>
        `(?:${LB}|(?!${w}${p}${sep}${range}\\b))` + alt(w, p, sep, String.raw`\d{${d}}`),
    ).join('|'),
  )
  assert.equal(RECORD_MENTION.flags, 'gi')
})

test('the skipped-mention pattern is pinned as written', () => {
  assert.equal(
    SKIPPED_AFTER_TS_ARCHUNIT.source,
    KINDS_AS_WRITTEN.map(([w, p, sep, , range]) => BEFORE + alt(w, p, sep, range)).join('|'),
  )
  assert.equal(SKIPPED_AFTER_TS_ARCHUNIT.flags, 'gi')
})

// ts-archunit's numbering ran to 10 ADRs, 106 plans, 80 bugs, 28 proposals and 69 spikes.
const LAST = { bug: 80, plan: 106, spike: 69, proposal: 28, adr: 10 }

test('after ts-archunit, every written number is skipped when in its range and counted past it', () => {
  assert.deepEqual(TS_ARCHUNIT_LAST, LAST)
  for (const [word, , sep, digits] of KINDS_AS_WRITTEN) {
    const last = LAST[word.toLowerCase()]
    for (let n = 0; n < 10 ** digits; n++) {
      const mention = `${word}${sep === '-' ? '-' : ' '}${String(n).padStart(digits, '0')}`
      for (const before of ['ts-archunit ', "ts-archunit's "]) {
        const text = `see ${before}${mention}.`
        const counted = [...text.matchAll(RECORD_MENTION)].length
        const skipped = [...text.matchAll(SKIPPED_AFTER_TS_ARCHUNIT)].length
        const want = n <= last ? [0, 1] : [1, 0]
        if (counted !== want[0] || skipped !== want[1])
          assert.fail(`${text}: counted ${counted}, skipped ${skipped}, want ${want.join(', ')}`)
      }
    }
  }
})

test('the left-out list is the eight files of the seven fold-era records, exactly', () => {
  assert.deepEqual(
    LEFT_OUT.map((e) => e.path),
    [
      'work/plans/completed/0071-ts-archunit-parity.md',
      'work/plans/completed/0088-fold-ts-archunit-into-eess.md',
      'work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md',
      'work/plans/completed/0165-integrate-the-copied-ts-archunit-engine.md',
      'work/fold-audit-2026-08-19.md',
      'work/spikes/0001-eess-over-ts-archunit/README.md',
      'work/spikes/0001-eess-over-ts-archunit/CONCLUSION.md',
      'work/bugs/fixed/0198-no-migration-path-from-ts-archunit.md',
    ],
  )
  for (const e of LEFT_OUT) assert.match(e.sha256, /^[0-9a-f]{64}$/, e.path)
})

test('a text hash reads CRLF as LF, so line endings do not unpin a file', () => {
  assert.equal(textHash('a\r\nb\r\n'), textHash('a\nb\n'))
  assert.notEqual(textHash('a\nb\n'), textHash('a\nb'))
})

test('a repaired link destination does not unpin a file, and any other edit does', () => {
  const pinned = 'See [plan 0100](../0100-a.md) and [x][r].\n\n[r]: ../0100-a.md\n'
  assert.equal(
    textHash(pinned),
    textHash(
      'See [plan 0100](../completed/0100-a.md) and [x][r].\n\n[r]: ../completed/0100-a.md\n',
    ),
  )
  assert.notEqual(textHash(pinned), textHash(pinned.replace('plan 0100]', 'plan 0101]')))
  assert.notEqual(textHash(pinned), textHash(`${pinned}\nIt names bug 0338.\n`))
})

const counted = (text) => [...text.matchAll(RECORD_MENTION)].map((m) => m[0])

test('every alternative of the pattern carries the lookbehind', () => {
  for (const mention of ['bug 0011', 'plans 0069', 'spike 0001', 'proposal 019', 'ADR-008']) {
    assert.deepEqual(counted(`see ${mention}.`), [mention], `${mention} alone is counted`)
    assert.deepEqual(counted(`see ts-archunit ${mention}.`), [], `ts-archunit ${mention}`)
    assert.deepEqual(counted(`see ts-archunit's ${mention}.`), [], `ts-archunit's ${mention}`)
  }
})

test('a curly apostrophe is not the possessive the lookbehind skips', () => {
  assert.deepEqual(counted('see ts-archunit’s bug 0011.'), ['bug 0011'])
})

test('a mention written after upstream is counted: the word hides nothing', () => {
  // `upstream` was dropped from the lookbehind (Decision 2): it hides nothing now.
  assert.deepEqual(counted('the upstream bug 0400 in the kernel'), ['bug 0400'])
})

test('a number past the range is counted after ts-archunit: the form is no escape for it', () => {
  assert.deepEqual(counted("ts-archunit bug 0400 and ts-archunit's ADR-016."), [
    'bug 0400',
    'ADR-016',
  ])
})

test('the skipped pattern matches what the lookbehind skips', () => {
  const text = "ts-archunit bug 0011, ts-archunit's ADR-008 and bug 0400."
  assert.deepEqual(
    [...text.matchAll(SKIPPED_AFTER_TS_ARCHUNIT)].map((m) => m[0]),
    ['ts-archunit bug 0011', "ts-archunit's ADR-008"],
  )
  assert.deepEqual(counted(text), ['bug 0400'])
})

test('a record is a numbered file in a lane, or a numbered folder read through its README', () => {
  assert.deepEqual(
    recordsOf([
      'adr/010-a-pass.md',
      'adr/sub/011-not-flat.md',
      'work/bugs/fixed/0338-a.md',
      'work/plans/completed/0541-b.md',
      'work/proposals/019-c.md',
      'work/spikes/0001-x/README.md',
      'work/spikes/0001-x/CONCLUSION.md',
      'work/spikes/0001-x/0002-nested.md',
      'work/spikes/0001-x/sub/README.md',
      'work/plans/ROADMAP.md',
      'docs/0042-not-a-lane.md',
    ]),
    [
      { key: 'adr:10', target: 'adr/010-a-pass.md' },
      { key: 'bug:338', target: 'work/bugs/fixed/0338-a.md' },
      { key: 'plan:541', target: 'work/plans/completed/0541-b.md' },
      { key: 'proposal:19', target: 'work/proposals/019-c.md' },
      { key: 'spike:1', target: 'work/spikes/0001-x/README.md' },
    ],
  )
})

// Each left-out file, and a file beside each that is not left out, all naming one record.
const sibling = (path) => path.replace(/[^/]*$/, 'beside.md')
const TEXT = '# Doc\n\nIt names bug 0338 in prose.\n'
const files = { 'work/bugs/0338-a.md': '# Bug 0338\n' }
for (const { path } of LEFT_OUT) {
  files[path] = TEXT
  files[sibling(path)] = TEXT
}

test('a mention in a left-out file is not selected, and the same in a file beside it is', () => {
  const corp = corpusFromText(files)
  const selected = recordMentions(corp)
    .should()
    .beLinked()
    .violations()
    .map((v) => v.element.replace(/:\d+$/, ''))
  assert.deepEqual(
    [...new Set(selected)].sort(),
    [...new Set(LEFT_OUT.map((e) => sibling(e.path)))].sort(),
  )
})

test('a left-out file that is gone or changed since it was pinned is a fault', () => {
  const root = mkdtempSync(join(tmpdir(), 'record-mention-'))
  try {
    assert.deepEqual(
      leftOutFaults(root).map((f) => f.cause),
      LEFT_OUT.map(() => 'missing'),
    )
    const [first] = LEFT_OUT
    mkdirSync(dirname(join(root, first.path)), { recursive: true })
    writeFileSync(join(root, first.path), 'edited\n')
    assert.deepEqual(leftOutFaults(root)[0], { path: first.path, cause: 'changed' })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a file inside a record directory belongs to that record', () => {
  assert.equal(recordKeyOfPath('work/spikes/0001-eess-over-ts-archunit/README.md'), 'spike:1')
  assert.equal(recordKeyOfPath('work/proposals/019-x.md'), 'proposal:19')
  assert.equal(recordKeyOfPath('adr/021-x.md'), 'adr:21')
  assert.equal(recordKeyOfPath('work/plans/ROADMAP.md'), undefined)
  assert.equal(recordKeyOfPath('docs/markdown.md'), undefined)
})
