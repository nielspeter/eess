import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { project, smells } from '../../src/index.js'

const HERE = dirname(fileURLToPath(import.meta.url))
void HERE

/**
 * A throwaway project on disk, so these exercise the real collector and the
 * real violation builder rather than a hand-built pair list — the distinction
 * bug 0110 is about.
 */
function withProject<T>(files: Record<string, string>, fn: (tsconfig: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'eess-clusters-'))
  try {
    for (const [name, body] of Object.entries(files)) {
      writeFileSync(join(dir, name), body)
    }
    const tsconfig = join(dir, 'tsconfig.json')
    writeFileSync(
      tsconfig,
      JSON.stringify({
        compilerOptions: { strict: true, target: 'ES2022', module: 'ESNext' },
        include: ['*.ts'],
      }),
    )
    return fn(tsconfig)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** N bodies with the same shape and one varying identifier. */
function shapedFamily(names: string[]): string {
  return names
    .map(
      (n) => `
export function ${n}(items: string[]): number {
  let ${n}Total = 0
  for (const each of items) {
    ${n}Total = ${n}Total + each.length
  }
  return ${n}Total
}`,
    )
    .join('\n')
}

describe('clustered reporting', () => {
  it('reports a family of N similar bodies ONCE, not N-squared-over-2 times', () => {
    // The measured failure this exists for: on a ~5,600-file monorepo, 407
    // clusters emitted 4,770 pair findings — more findings than the bodies that
    // produced them, with one cluster of 89 members emitting 398 lines.
    const names = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot']
    const violations = withProject({ 'family.ts': shapedFamily(names) }, (tsconfig) =>
      smells
        .duplicateBodies(project(tsconfig))
        .minDistinctVocabulary(0)
        .rule({ id: 'smells/family' })
        .violations(),
    )
    // Six mutually-similar bodies are C(6,2) = 15 pairs and ONE observation.
    expect(violations).toHaveLength(1)
    expect(violations[0]!.message).toContain('5 other bodies')
    // It still says how alike they are, and still anchors to a real element.
    expect(violations[0]!.message).toMatch(/\d+% similar/)
    expect(violations[0]!.line).toBeGreaterThan(0)
  })

  it('leaves a two-body cluster reporting exactly as it did before', () => {
    // Clustering must not churn identities for the common case: a two-member
    // cluster IS the pair, so its message and its baseline identity are the
    // ones that already shipped.
    const violations = withProject({ 'pair.ts': shapedFamily(['alpha', 'bravo']) }, (tsconfig) =>
      smells
        .duplicateBodies(project(tsconfig))
        .minDistinctVocabulary(0)
        .rule({ id: 'smells/pair' })
        .violations(),
    )
    expect(violations).toHaveLength(1)
    expect(violations[0]!.message).toMatch(/is \d+% similar to/)
    expect(violations[0]!.message).not.toContain('other bodies')
    expect(violations[0]!.identity).toMatch(/^duplicate-pair::/)
  })

  it('names the varying axis, which is what tells a reader whether to consolidate', () => {
    // A percentage cannot distinguish "one call target differs" from "every
    // property name differs", and those are opposite verdicts.
    const violations = withProject(
      {
        'axes.ts': `
export function runCheck(options: string): void {
  executeCheck(gather(), { reason: 1, metadata: 2 }, options)
}
export function runWarn(options: string): void {
  executeWarn(gather(), { reason: 1, metadata: 2 }, options)
}
declare function executeCheck(a: unknown, b: unknown, c: string): void
declare function executeWarn(a: unknown, b: unknown, c: string): void
declare function gather(): unknown
`,
      },
      (tsconfig) =>
        smells
          .duplicateBodies(project(tsconfig))
          .minLines(3)
          .minDistinctVocabulary(0)
          .rule({ id: 'smells/axes' })
          .violations(),
    )
    expect(violations).toHaveLength(1)
    expect(violations[0]!.message).toContain('1 varying axis')
    expect(violations[0]!.message).toContain('executeCheck -> executeWarn')
  })

  it('calls a byte-identical pair a literal copy rather than printing zero axes', () => {
    const violations = withProject(
      {
        'copy.ts': `
export function timestampPrefixA(now: Date): string {
  const iso = now.toISOString()
  return iso.replace(/[-:.]/g, '').slice(0, 14)
}
export function timestampPrefixB(now: Date): string {
  const iso = now.toISOString()
  return iso.replace(/[-:.]/g, '').slice(0, 14)
}
`,
      },
      (tsconfig) =>
        smells
          .duplicateBodies(project(tsconfig))
          .minLines(3)
          .minDistinctVocabulary(0)
          .rule({ id: 'smells/copy' })
          .violations(),
    )
    expect(violations).toHaveLength(1)
    expect(violations[0]!.message).toContain('identical text: a literal copy')
  })
})
