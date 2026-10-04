import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { corpus } from '../src/index.js'
import { adrEnforcement } from '../src/rules/adr.js'

/**
 * Bug 0111 — eess-md resolved a cited `it('…')` title by reading the test file as text, and
 * matched it as a prefix, so `it('r')` resolved against any test beginning with `r`. Ruled
 * 2026-10-04: eess-md stops resolving titles. Whether a cited title names a real test is
 * `eess-crossvalidate`'s `adrCitationsResolve`, which reads the test AST. eess-md checks the
 * cited file paths, which it can answer without a TypeScript lexer.
 */
function findings(mechanism: string, testFile = "it('a real test', () => {})\n"): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'adr-0111-'))
  mkdirSync(join(dir, 'docs/adr'), { recursive: true })
  mkdirSync(join(dir, 'src'), { recursive: true })
  writeFileSync(join(dir, 'src/a.test.ts'), testFile)
  writeFileSync(
    join(dir, 'docs/adr/0001-x.md'),
    [
      '# ADR-0001 — X',
      '',
      '## Enforcement',
      '',
      '| Clause | Tier | Mechanism | Status |',
      '| ------ | ---- | --------- | ------ |',
      `| a clause | 2 | ${mechanism} | gated |`,
      '',
    ].join('\n'),
  )
  const c = corpus({ roots: ['docs/**/*.md', 'src/**/*.ts'], cwd: dir })
  return adrEnforcement(c, { report: 'return' })
    .filter((v) => v.ruleId === 'adr/citations-resolve')
    .map((v) => v.message)
}

describe('bug 0111: eess-md checks cited paths, not test titles', () => {
  it('reports no finding about a cited it() title, present or absent', () => {
    expect(findings("`src/a.test.ts` · `it('no such test')`")).toEqual([])
    expect(findings("`src/a.test.ts` · `it('a real test')`")).toEqual([])
  })

  it('still reports a cited file path that does not exist', () => {
    const msgs = findings("`src/gone.test.ts` · `it('a real test')`")
    expect(msgs).toHaveLength(1)
    expect(msgs[0]).toContain('cites missing file `src/gone.test.ts`')
  })
})
