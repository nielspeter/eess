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
    // The VALUE, not the shape: `toMatch(/\d+% similar/)` is satisfied by
    // "0% similar", so hard-coding `peakSimilarity` to zero used to pass this
    // whole file (bug 0239's review measured it).
    expect(violations[0]!.message).toContain('100% similar')
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

/**
 * Bug 0239's second half — the ranking, asserted.
 *
 * `clusterRank` decides what a reader sees first, which at four thousand
 * findings IS the product. It was reachable only through report order and
 * nothing asserted that order, so `return 0` at the top of the function left
 * every test in this file green.
 *
 * The trap this closes, and the reason the file names below are deliberate: the
 * sort is stable, so with a constant rank the clusters keep their natural walk
 * order. A test whose high-ranking family already sorts first would pass under
 * exactly the sabotage it exists to catch. So the COPY family is named to sort
 * LAST alphabetically — ranking has to move it to satisfy this.
 */
describe('report order puts the most actionable cluster first', () => {
  /** One shape, summing lengths. Same name in every file: a copy. */
  const copied = `
export function tally(items: string[]): number {
  let total = 0
  for (const each of items) {
    total = total + each.length
  }
  return total
}`

  /** A different shape, so it clusters separately. Different name per file. */
  const idiom = (n: string): string => `
export function ${n}(rows: string[]): string[] {
  const out: string[] = []
  for (const row of rows) {
    if (row.length > 2) out.push(row.trim())
  }
  return out
}`

  it('ranks a cross-file copy above a cross-file shared idiom', () => {
    const violations = withProject(
      {
        // Sorts first, ranks last. If ranking stops working, this one leads.
        'aaa-idiom-one.ts': idiom('alpha'),
        'aab-idiom-two.ts': idiom('bravo'),
        'aac-idiom-three.ts': idiom('charlie'),
        // Sorts last, ranks first: same name in three files is a literal copy.
        'zza-copy-one.ts': copied,
        'zzb-copy-two.ts': copied,
        'zzc-copy-three.ts': copied,
      },
      (tsconfig) =>
        smells
          .duplicateBodies(project(tsconfig))
          .minDistinctVocabulary(0)
          .rule({ id: 'smells/rank' })
          .violations(),
    )

    // Two distinct shapes, so two clusters — asserted, because if they merged
    // into one the ordering claim below would be vacuous.
    expect(violations).toHaveLength(2)
    expect(violations[0]!.element).toBe('tally')
    expect(violations[1]!.element).not.toBe('tally')
  })
})
