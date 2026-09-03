import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { project, smells, DiffFilter, formatViolationsJson } from '../../src/index.js'

/**
 * Bug 0239 — a duplicate must survive a filter that only knows one of its files.
 *
 * `--changed` keeps a violation when its `file` is in the changed set. A
 * duplicate-body finding concerns TWO OR MORE files and carries one `file`, so
 * the developer who just pasted a body into a second file was told nothing: the
 * finding was anchored on the file they did not touch.
 *
 * Which file gets anchored is walk order, i.e. a property of the filesystem —
 * so before this was fixed, whether a real duplicate reported under `--changed`
 * depended on how the OS enumerated a directory.
 *
 * The direction matters and is why this is a false green rather than a
 * cosmetic gap: the file a developer just edited is precisely the file whose
 * duplicate went invisible.
 */
function withProject<T>(files: Record<string, string>, fn: (tsconfig: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'eess-0239-'))
  try {
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body)
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

/** One body, shaped identically wherever it lands. */
const body = (n: string): string => `
export function ${n}(items: string[]): number {
  let ${n}Total = 0
  for (const each of items) {
    ${n}Total = ${n}Total + each.length
  }
  return ${n}Total
}`

/**
 * Every file a finding concerns: its own, plus any it names as related.
 *
 * Asserted through the same accessor the filter uses, rather than by reading
 * the message — a message is prose and would let this pass on a finding the
 * filter still cannot see.
 */
const concerns = (v: { file: string; relatedFiles?: readonly string[] }): string[] =>
  [v.file, ...(v.relatedFiles ?? [])].sort()

describe('a duplicate survives --changed when any of its files changed', () => {
  it('reports when only the SECOND file changed — the paste that was invisible', () => {
    const violations = withProject({ 'a.ts': body('alpha'), 'b.ts': body('bravo') }, (tsconfig) =>
      smells
        .duplicateBodies(project(tsconfig))
        .minDistinctVocabulary(0)
        .rule({ id: 'smells/pair' })
        .violations(),
    )
    expect(violations.map((v) => v.element)).toEqual(['alpha'])

    // Take the file the finding is NOT anchored on. That is the one a developer
    // would have just written, and the one the old behaviour dropped.
    const other = concerns(violations[0]!).find((f) => f !== violations[0]!.file)
    expect(other).toBeDefined()

    // Assert WHICH finding survived, not how many: a filter that let some other
    // violation through would satisfy a bare count.
    const kept = new DiffFilter(new Set([other!])).filterToChanged(violations)
    expect(kept.map((v) => v.identity)).toEqual([violations[0]!.identity])
  })

  it('reports when only the anchor file changed, as it always did', () => {
    const violations = withProject({ 'a.ts': body('alpha'), 'b.ts': body('bravo') }, (tsconfig) =>
      smells
        .duplicateBodies(project(tsconfig))
        .minDistinctVocabulary(0)
        .rule({ id: 'smells/pair' })
        .violations(),
    )
    const kept = new DiffFilter(new Set([violations[0]!.file])).filterToChanged(violations)
    expect(kept.map((v) => v.identity)).toEqual([violations[0]!.identity])
  })

  it('a cluster of three names all three files, so no member is invisible', () => {
    const violations = withProject(
      { 'a.ts': body('alpha'), 'b.ts': body('bravo'), 'c.ts': body('charlie') },
      (tsconfig) =>
        smells
          .duplicateBodies(project(tsconfig))
          .minDistinctVocabulary(0)
          .rule({ id: 'smells/family' })
          .violations(),
    )
    expect(violations.map((v) => v.element)).toEqual(['alpha'])
    // Every member's file by name, not a count of them: a fix that named three
    // paths but the wrong three would satisfy a length check.
    expect(concerns(violations[0]!).map((f) => f.split('/').pop())).toEqual([
      'a.ts',
      'b.ts',
      'c.ts',
    ])

    // Each member's file, alone, keeps the finding. Asserted per file rather
    // than in aggregate: a fix that named only two of the three would satisfy a
    // length check on the set while still hiding one member.
    for (const file of concerns(violations[0]!)) {
      const kept = new DiffFilter(new Set([file])).filterToChanged(violations)
      expect(
        kept.map((v) => v.identity),
        `changing ${file} alone should keep the finding`,
      ).toEqual([violations[0]!.identity])
    }
  })

  it('CONTROL — an unrelated changed file does not keep it, so the filter still filters', () => {
    // Without this, a filter that returned everything would satisfy all three
    // tests above. This is the assertion that makes them mean something.
    const violations = withProject({ 'a.ts': body('alpha'), 'b.ts': body('bravo') }, (tsconfig) =>
      smells
        .duplicateBodies(project(tsconfig))
        .minDistinctVocabulary(0)
        .rule({ id: 'smells/pair' })
        .violations(),
    )
    const kept = new DiffFilter(new Set(['/nowhere/unrelated.ts'])).filterToChanged(violations)
    expect(kept.map((v) => v.identity)).toEqual([])
  })

  it('reports once, not once per file, when every file changed', () => {
    // The fix must not re-inflate the output the cluster collapse exists to
    // reduce: naming several files is one finding that concerns them all, never
    // one finding per file.
    const violations = withProject(
      { 'a.ts': body('alpha'), 'b.ts': body('bravo'), 'c.ts': body('charlie') },
      (tsconfig) =>
        smells
          .duplicateBodies(project(tsconfig))
          .minDistinctVocabulary(0)
          .rule({ id: 'smells/family' })
          .violations(),
    )
    const kept = new DiffFilter(new Set(concerns(violations[0]!))).filterToChanged(violations)
    expect(kept.map((v) => v.identity)).toEqual([violations[0]!.identity])
  })

  it('reaches a consumer through --format json, or the advice to read it is impossible', () => {
    // The changeset tells anyone who filters violations by file themselves to
    // read `relatedFiles`. `--format json` is the interface the docs point an
    // agent at, and it builds each violation from an explicit field list — so a
    // field missing from that list is advice a consumer cannot follow.
    const violations = withProject({ 'a.ts': body('alpha'), 'b.ts': body('bravo') }, (tsconfig) =>
      smells
        .duplicateBodies(project(tsconfig))
        .minDistinctVocabulary(0)
        .rule({ id: 'smells/pair' })
        .violations(),
    )
    // Narrowed, never cast: ADR-005 bars `as` and `any`, and a cast here would
    // also hide a formatter that stopped emitting the field entirely — the very
    // regression this asserts against. Same shape as `edge-coverage.test.ts`,
    // which reads this formatter's output the same way.
    const parsed: unknown = JSON.parse(formatViolationsJson(violations))
    if (parsed === null || typeof parsed !== 'object' || !('violations' in parsed)) {
      throw new Error('no violations in the JSON report')
    }
    const first: unknown = Array.isArray(parsed.violations) ? parsed.violations[0] : undefined
    if (first === null || typeof first !== 'object' || !('relatedFiles' in first)) {
      throw new Error('the JSON violation carries no relatedFiles field')
    }
    const related: readonly unknown[] = Array.isArray(first.relatedFiles) ? first.relatedFiles : []

    // The other file by name, not merely a non-null field: a formatter that
    // emitted an empty array would satisfy a presence check while telling a
    // consumer nothing.
    expect(related.map((f) => String(f).split('/').pop())).toEqual(['b.ts'])
  })
})
