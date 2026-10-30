import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { type ArchViolation, type ArchFix } from '../src/index.js'
import { applyFixes } from '../src/internal.js'

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

  // Bug 0564: two rules that find one broken link propose the same fix. Identical fixes do not
  // conflict, so they are one edit, applied once; only fixes that disagree are dropped.
  it('two identical fixes are one edit, applied once', () => {
    const f = tmpFile('see [x](./old.md) here')
    dirs.push(f)
    const start = 'see [x]('.length
    const fix: ArchFix = { file: f, start, end: start + 8, replacement: './new.md', describe: 'r' }
    const r = applyFixes([vfix(fix), vfix({ ...fix })], { write: true })
    expect(r.applied).toBe(1)
    expect(r.skipped).toBe(0)
    expect(fs.readFileSync(f, 'utf8')).toBe('see [x](./new.md) here')
  })

  it('an identical pair beside a fix that disagrees with it is still dropped, all three', () => {
    const f = tmpFile('see [x](./old.md) here')
    dirs.push(f)
    const start = 'see [x]('.length
    const fix: ArchFix = { file: f, start, end: start + 8, replacement: './new.md', describe: 'r' }
    const other: ArchFix = { ...fix, replacement: './other.md' }
    const r = applyFixes([vfix(fix), vfix({ ...fix }), vfix(other)], { write: true })
    expect(r.applied).toBe(0)
    expect(r.skipped).toBe(3)
    expect(fs.readFileSync(f, 'utf8')).toBe('see [x](./old.md) here')
  })

  it('two fixes with one replacement at different spans are two edits, both applied', () => {
    const f = tmpFile('[a](./old.md) and [b](./old.md)')
    dirs.push(f)
    const first = '[a]('.length
    const second = '[a](./old.md) and [b]('.length
    const at = (start: number): ArchFix => ({
      file: f,
      start,
      end: start + 8,
      replacement: './new.md',
      describe: `at ${String(start)}`,
    })
    const r = applyFixes([vfix(at(first)), vfix(at(second))], { write: true })
    expect(r.applied).toBe(2)
    expect(r.skipped).toBe(0)
    expect(fs.readFileSync(f, 'utf8')).toBe('[a](./new.md) and [b](./new.md)')
  })

  it('two overlapping fixes with one replacement but different spans are both skipped', () => {
    const f = tmpFile('see [x](./old.md) here')
    dirs.push(f)
    const start = 'see [x]('.length
    const wide: ArchFix = { file: f, start, end: start + 8, replacement: './new.md', describe: 'w' }
    // One pair differs in its start, the other in its end; neither is the same edit.
    for (const other of [
      { ...wide, start: start + 2, describe: 'n' },
      { ...wide, end: start + 4, describe: 'e' },
    ]) {
      const r = applyFixes([vfix(wide), vfix(other)], { write: true })
      expect(r.applied).toBe(0)
      expect(r.skipped).toBe(2)
      expect(fs.readFileSync(f, 'utf8')).toBe('see [x](./old.md) here')
    }
  })

  it('identical edits with different describe text are one edit; the first is reported', () => {
    const f = tmpFile('see [x](./old.md) here')
    dirs.push(f)
    const start = 'see [x]('.length
    const fix: ArchFix = {
      file: f,
      start,
      end: start + 8,
      replacement: './new.md',
      describe: 'one',
    }
    const r = applyFixes([vfix(fix), vfix({ ...fix, describe: 'two' })], { write: true })
    expect(r.applied).toBe(1)
    expect(r.descriptions).toEqual(['one'])
  })

  it('an identical edit in two files is two edits, one in each', () => {
    const f1 = tmpFile('see [x](./old.md) here')
    const f2 = tmpFile('see [x](./old.md) here')
    dirs.push(f1, f2)
    const start = 'see [x]('.length
    const edit = (file: string): ArchFix => ({
      file,
      start,
      end: start + 8,
      replacement: './new.md',
      describe: 'r',
    })
    const r = applyFixes([vfix(edit(f1)), vfix(edit(f2))], { write: true })
    expect(r.applied).toBe(2)
    expect(r.files).toHaveLength(2)
  })

  it('ignores violations without a fix', () => {
    const r = applyFixes([{ rule: 'r', element: 'e', file: 'x', line: 1, message: 'm' }], {
      write: true,
    })
    expect(r.applied).toBe(0)
    expect(r.files).toEqual([])
  })
})
