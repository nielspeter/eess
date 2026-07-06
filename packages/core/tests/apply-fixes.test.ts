import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { applyFixes, type ArchViolation, type ArchFix } from '../src/index.js'

function tmpFile(contents: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-fix-'))
  const f = path.join(dir, 'doc.md')
  fs.writeFileSync(f, contents)
  return f
}

/** A violation carrying only a fix (the rest is irrelevant to the applier). */
function vfix(fix: ArchFix): ArchViolation {
  return { rule: 'r', element: 'e', file: fix.file, line: 1, message: 'm', fix }
}

describe('applyFixes()', () => {
  const dirs: string[] = []
  beforeEach(() => dirs.splice(0))
  afterEach(() => {
    for (const f of dirs) fs.rmSync(path.dirname(f), { recursive: true, force: true })
  })

  it('applies a single edit', () => {
    const f = tmpFile('see [x](./old.md) here')
    dirs.push(f)
    const start = 'see [x]('.length
    const end = start + './old.md'.length
    const r = applyFixes(
      [vfix({ file: f, start, end, replacement: './new.md', describe: 'rewrite' })],
      {
        write: true,
      },
    )
    expect(r.applied).toBe(1)
    expect(fs.readFileSync(f, 'utf8')).toBe('see [x](./new.md) here')
  })

  it('applies multiple edits in one file without offset drift', () => {
    const f = tmpFile('a AAA b BBB c')
    dirs.push(f)
    const fixes: ArchFix[] = [
      { file: f, start: 2, end: 5, replacement: 'X', describe: 'AAA→X' }, // 'AAA'
      { file: f, start: 8, end: 11, replacement: 'YY', describe: 'BBB→YY' }, // 'BBB'
    ]
    const r = applyFixes(fixes.map(vfix), { write: true })
    expect(r.applied).toBe(2)
    expect(fs.readFileSync(f, 'utf8')).toBe('a X b YY c')
  })

  it('dry-run writes nothing but reports what would change', () => {
    const f = tmpFile('hello world')
    dirs.push(f)
    const r = applyFixes(
      [vfix({ file: f, start: 6, end: 11, replacement: 'there', describe: 'world→there' })],
      {
        write: false,
      },
    )
    expect(r.applied).toBe(1)
    expect(r.descriptions).toEqual(['world→there'])
    expect(fs.readFileSync(f, 'utf8')).toBe('hello world') // untouched
  })

  it('skips overlapping fixes and leaves the file untouched (never guesses)', () => {
    const f = tmpFile('0123456789')
    dirs.push(f)
    const fixes: ArchFix[] = [
      { file: f, start: 2, end: 6, replacement: 'A', describe: 'a' },
      { file: f, start: 4, end: 8, replacement: 'B', describe: 'b' }, // overlaps the first
    ]
    const r = applyFixes(fixes.map(vfix), { write: true })
    expect(r.applied).toBe(0)
    expect(r.skipped).toBe(2)
    expect(fs.readFileSync(f, 'utf8')).toBe('0123456789')
  })

  it('ignores violations without a fix', () => {
    const r = applyFixes([{ rule: 'r', element: 'e', file: 'x', line: 1, message: 'm' }], {
      write: true,
    })
    expect(r.applied).toBe(0)
    expect(r.files).toEqual([])
  })
})
