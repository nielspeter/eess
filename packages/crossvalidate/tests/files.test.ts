import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { isAbsolute } from 'node:path'
import { correspondence, ArchRuleError, type Selection, type ArchViolation } from '@nielspeter/eess'
import { files } from '../src/files.js'

/** Build a small file tree in a temp dir (avoids committing gitignored dirs). */
function makeTree(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-files-'))
  fs.writeFileSync(path.join(root, 'a.md'), '# a\n')
  fs.writeFileSync(path.join(root, 'b.md'), '# b\n')
  fs.mkdirSync(path.join(root, 'sub'))
  fs.writeFileSync(path.join(root, 'sub', 'c.md'), '# c\n')
  fs.writeFileSync(path.join(root, 'sub', 'd.txt'), 'd\n')
  fs.mkdirSync(path.join(root, 'node_modules', 'pkg'), { recursive: true })
  fs.writeFileSync(path.join(root, 'node_modules', 'pkg', 'skip.md'), '# skip\n')
  return root
}

function violationsFrom(fn: () => void): ArchViolation[] {
  try {
    fn()
    return []
  } catch (err) {
    if (err instanceof ArchRuleError) return err.violations
    throw err
  }
}

describe('files()', () => {
  let root: string
  const id = (label = 'file') => ({
    label,
    identify: (f: { path: string; absPath: string }) => ({ name: f.path, file: f.path, line: 1 }),
  })

  beforeAll(() => {
    root = makeTree()
  })
  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('globs recursively, sorted, and skips built-in ignore dirs', () => {
    const sel = files({ glob: '**/*.md', cwd: root, ...id() })
    expect(sel.elements.map((f) => f.path)).toEqual(['a.md', 'b.md', 'sub/c.md'])
    // node_modules/pkg/skip.md is excluded by the built-in dir skip
  })

  it('a top-level glob does not cross directories', () => {
    const sel = files({ glob: '*.md', cwd: root, ...id() })
    expect(sel.elements.map((f) => f.path)).toEqual(['a.md', 'b.md'])
  })

  it('accepts multiple globs (union)', () => {
    const sel = files({ glob: ['*.md', 'sub/*.txt'], cwd: root, ...id() })
    expect(sel.elements.map((f) => f.path)).toEqual(['a.md', 'b.md', 'sub/d.txt'])
  })

  it('honours the ignore option', () => {
    const sel = files({ glob: '**/*.md', ignore: ['**/b.md'], cwd: root, ...id() })
    expect(sel.elements.map((f) => f.path)).toEqual(['a.md', 'sub/c.md'])
  })

  it('returns an empty selection when nothing matches (not an error)', () => {
    const sel = files({ glob: '**/*.xyz', cwd: root, ...id() })
    expect(sel.elements).toEqual([])
  })

  it('exposes repo-relative POSIX path and an absolute absPath', () => {
    const sel = files({ glob: 'a.md', cwd: root, ...id() })
    const entry = sel.elements[0]
    expect(entry?.path).toBe('a.md')
    expect(isAbsolute(entry?.absPath ?? '')).toBe(true)
    expect(sel.label).toBe('file')
    expect(sel.identify(entry!).name).toBe('a.md')
  })

  it('feeds a kernel correspondence() as one side', () => {
    const fileSide = files({ glob: '**/*.md', cwd: root, ...id() })
    // A spec claims a.md, b.md, sub/c.md, and a ghost the tree lacks.
    const claimed: Selection<{ name: string }> = {
      elements: [{ name: 'a.md' }, { name: 'b.md' }, { name: 'sub/c.md' }, { name: 'ghost.md' }],
      label: 'claimed',
      identify: (e) => ({ name: e.name }),
    }
    const v = violationsFrom(() =>
      correspondence({
        left: fileSide,
        right: claimed,
        keyBy: { left: (f) => f.path, right: (e) => e.name },
      })
        .should()
        .beComplete({ direction: 'both' })
        .check(),
    )
    expect(v.map((x) => x.element)).toEqual(['ghost.md'])
  })
})
