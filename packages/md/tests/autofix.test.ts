import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type ArchViolation } from '@nielspeter/eess'
import { applyFixes } from '@nielspeter/eess/internal'
import { corpus, links, pointers } from '../src/index.js'

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/autofix')
const docText = fs.readFileSync(join(fixtureRoot, 'doc.md'), 'utf8')

/** The fix on the violation whose message names `needle`, or undefined. */
function fixFor(vs: ArchViolation[], needle: string) {
  return vs.find((v) => v.message.includes(needle))?.fix
}

describe('autofix (plan 0066) — links', () => {
  const c = corpus({ roots: ['doc.md'], cwd: fixtureRoot })
  const vs = links(c).that().areInternal().should().resolve().violations()

  it('a moved link (unique basename) carries a rewrite to the new relative path', () => {
    const fix = fixFor(vs, './target.md')
    expect(fix?.replacement).toBe('./moved/target.md')
    // the span covers exactly the URL text
    expect(docText.slice(fix!.start, fix!.end)).toBe('./target.md')
  })

  it('a missing/renamed link (no basename match) carries NO fix', () => {
    expect(fixFor(vs, './ghost.md')).toBeUndefined()
  })

  it('an ambiguous basename (two files) carries NO fix', () => {
    expect(fixFor(vs, './dup.md')).toBeUndefined()
  })
})

describe('autofix (plan 0066) — pointers', () => {
  const c = corpus({ roots: ['doc.md'], cwd: fixtureRoot })

  it('a broken pointer (exact mode) with a unique suffix carries a rewrite to the full path', () => {
    const vs = pointers(c).that().areLive().should().resolve({ paths: 'exact' }).violations()
    const fix = fixFor(vs, 'app/x.ts:2')
    expect(fix?.replacement).toBe('code/app/x.ts')
    expect(docText.slice(fix!.start, fix!.end)).toBe('app/x.ts')
  })
})

describe('autofix (plan 0066) — end-to-end apply', () => {
  it('applyFixes rewrites the moved link in a real copy of the doc', () => {
    // Copy the whole fixture tree to a temp dir so resolution + write are real.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-autofix-'))
    fs.cpSync(fixtureRoot, tmp, { recursive: true })
    const c = corpus({ roots: ['doc.md'], cwd: tmp })
    const vs = links(c).that().areInternal().should().resolve().violations()
    const r = applyFixes(vs, { write: true })
    expect(r.applied).toBe(1) // only the moved link (ghost + dup carry no fix)
    const after = fs.readFileSync(join(tmp, 'doc.md'), 'utf8')
    expect(after).toContain('[t](./moved/target.md)')
    expect(after).toContain('[g](./ghost.md)') // untouched
    fs.rmSync(tmp, { recursive: true, force: true })
  })
})

describe('autofix — two rules, one moved link (bugs 0563, 0564)', () => {
  it('resolve() and beLinkedBack() propose one fix for one moved link, and it is applied once', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-autofix-'))
    fs.mkdirSync(join(tmp, 'docs/new'), { recursive: true })
    fs.writeFileSync(
      join(tmp, 'docs/a.md'),
      '# A\n\n**Related to:** [b](./old/b.md "./old/b.md")\n',
    )
    fs.writeFileSync(join(tmp, 'docs/new/b.md'), '# B\n')
    const c = corpus({ roots: ['docs/**'], cwd: tmp })
    const both = [
      ...links(c).that().areInternal().should().resolve().violations(),
      ...links(c).that().areLabelled('Related to').should().beLinkedBack().violations(),
    ]
    expect(both.filter((v) => v.fix !== undefined)).toHaveLength(2)
    const r = applyFixes(both, { write: true })
    expect(r.applied).toBe(1)
    expect(r.skipped).toBe(0)
    // The URL is rewritten; the title, which holds the same text, is not.
    expect(fs.readFileSync(join(tmp, 'docs/a.md'), 'utf8')).toBe(
      '# A\n\n**Related to:** [b](./new/b.md "./old/b.md")\n',
    )
    fs.rmSync(tmp, { recursive: true, force: true })
  })
})
