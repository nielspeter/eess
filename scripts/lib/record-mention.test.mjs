import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { corpusFromText } from '@nielspeter/eess-md'
import {
  LEFT_OUT,
  RECORD_MENTION,
  SKIPPED_AFTER_TS_ARCHUNIT,
  anachronismsByGlob,
  assertLaneDisjoint,
  leftOutFaults,
  mentionFixRule,
  recordMentions,
  recordsOf,
  textHash,
} from './record-mention.mjs'

// Plan 0542: the two narrowings of the record-mention gate are pinned as written. Copied here, not
// imported, so a widened word list or a swapped entry is red rather than agreeing with itself.

const LB = String.raw`(?<!ts-archunit(?:'s)?\s+)`
const BEFORE = String.raw`ts-archunit(?:'s)?\s+`
const ALTS = [
  String.raw`\b(?<kind>bug|plan|spike)s?\s+(?<n>\d{4})\b`,
  String.raw`\b(?<kind>proposal)s?\s+(?<n>\d{3})\b`,
  String.raw`\b(?<kind>ADR)-(?<n>\d{3})\b`,
]

test('the record-mention pattern is pinned as written, the lookbehind on every alternative', () => {
  assert.equal(RECORD_MENTION.source, ALTS.map((a) => LB + a).join('|'))
  assert.equal(RECORD_MENTION.flags, 'gi')
})

test('the skipped-mention pattern is pinned as written', () => {
  assert.equal(SKIPPED_AFTER_TS_ARCHUNIT.source, ALTS.map((a) => BEFORE + a).join('|'))
  assert.equal(SKIPPED_AFTER_TS_ARCHUNIT.flags, 'gi')
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

test('the fix links a mention to its one record and refuses one with upstream around it', () => {
  const corp = corpusFromText({
    'work/bugs/0338-a.md': '# Bug 0338\n',
    'work/notes.md': '# Notes\n\nIt names bug 0338.\n\nThe upstream bug 0338 is another.\n',
  })
  const vs = mentionFixRule(corp, 'work/notes.md').violations()
  assert.equal(vs.length, 2)
  assert.equal(vs[0].fix?.replacement, '[bug 0338](./bugs/0338-a.md)')
  assert.equal(vs[1].fix, undefined)
  assert.match(vs[1].message, /not fixed: another project/)
})

test('a lane splits its anachronisms by glob, and refuses one under none or under two', () => {
  const lane = ['adr/**', 'docs/**']
  assert.deepEqual(
    [...anachronismsByGlob(lane, ['adr/019-x.md:40', 'docs/calls.md:150'])],
    [
      ['adr/**', ['adr/019-x.md:40']],
      ['docs/**', ['docs/calls.md:150']],
    ],
  )
  // An exact-file glob matches only once the `:line` suffix is stripped.
  assert.deepEqual(
    [...anachronismsByGlob(['docs/calls.md'], ['docs/calls.md:150'])],
    [['docs/calls.md', ['docs/calls.md:150']]],
  )
  assert.throws(() => anachronismsByGlob(lane, ['work/x.md:1']), /under none of LANE's globs/)
  assert.throws(
    () => anachronismsByGlob(['docs/**', 'docs/*.md'], ['docs/calls.md:1']),
    /under more than one of LANE's globs/,
  )
})

test('a lane whose globs share a document is refused', () => {
  assert.doesNotThrow(() => assertLaneDisjoint(['adr/**', 'docs/**'], ['adr/a.md', 'docs/b.md']))
  assert.throws(
    () =>
      assertLaneDisjoint(
        ['work/plans/completed/0*', 'work/**'],
        ['work/plans/completed/0001-a.md'],
      ),
    /under two of LANE's globs/,
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
