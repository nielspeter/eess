import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { project, smells } from '../../src/index.js'

/**
 * Two bodies of the same SHAPE that share no vocabulary are not duplicates.
 *
 * Bug 0230. `findSimilarPairs` had two fast rejections and both measured each
 * body on its own — plan 0103's floor asks "does this body carry enough
 * vocabulary to be evidence?" and nothing asked the pairwise question, "do
 * these two carry any of the SAME vocabulary?". `computeSimilarity` cannot
 * supply it and must not: it scores LCS over syntax kinds only, which is what
 * makes it a type-2 clone score.
 *
 * So a pair could score 1.00 on shape with an empty vocabulary intersection —
 * shipped, on this repo, as `RuleBuilder.asDeclared` against
 * `InconsistentSiblingsBuilder.scope`: one gathers a rule's declaration, the
 * other a sibling detector's scope, and "extract the shared logic into one
 * function" names something that does not exist.
 */
function withProject<T>(source: string, fn: (tsconfig: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'eess-vocab-'))
  try {
    writeFileSync(join(dir, 'subject.ts'), source)
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

const run = (source: string, id: string) =>
  withProject(source, (tsconfig) =>
    smells.duplicateBodies(project(tsconfig)).minLines(5).rule({ id }).violations(),
  )

/**
 * The shipped shape: gather my own fields into a record. Enough distinct
 * vocabulary on each side to clear plan 0103's floor, and not one item in
 * common — which is exactly how the real pair got through.
 */
const NO_SHARED_VOCABULARY = `
export function declaredRule(source: {
  predicates: string; conditions: string; misplaced: string; reachedShould: string
  metadata: string; reason: string; severity: string; exclusions: string
}) {
  return {
    predicates: source.predicates,
    conditions: source.conditions,
    misplaced: source.misplaced,
    reachedShould: source.reachedShould,
    metadata: source.metadata,
    reason: source.reason,
    severity: source.severity,
    exclusions: source.exclusions,
  }
}

export function siblingScope(holder: {
  project: string; folders: string; ignorePaths: string; ignoreTests: string
  minLines: string; pattern: string; threshold: string; roots: string
}) {
  return {
    project: holder.project,
    folders: holder.folders,
    ignorePaths: holder.ignorePaths,
    ignoreTests: holder.ignoreTests,
    minLines: holder.minLines,
    pattern: holder.pattern,
    threshold: holder.threshold,
    roots: holder.roots,
  }
}
`

/**
 * The guard must not reach this far. Transcribed from `predicates/class.ts`'s
 * `implement` and `haveDecorator` — the real finding on this repo with the
 * FEWEST shared vocabulary items, four. Standing alone it shares five
 * (`description`, `test`, `cls`, `some`, `Cls`), the extra one being the
 * hoisted type this fixture needs and the real pair gets from its import; both
 * numbers are measured, and the point is the same either way.
 *
 * A guard reaching that far would be suppressing genuine copy-paste, which is
 * the fail-open `no-copy-paste` exists to catch. Widening it from `=== 0` to
 * `<= 5` reds this row, which is what makes `=== 0` a decision rather than a
 * number someone liked.
 */
const FEWEST_SHARED_ITEMS = `
interface Cls {
  getImplements(): { getExpression(): { getText(): string } }[]
  getDecorators(): { getName(): string }[]
}

export function implement(interfaceName: string) {
  return {
    description: 'implement "' + interfaceName + '"',
    test: (cls: Cls) =>
      cls.getImplements().some((impl) => impl.getExpression().getText() === interfaceName),
  }
}

export function haveDecorator(name: string) {
  return {
    description: 'have decorator @' + name,
    test: (cls: Cls) => cls.getDecorators().some((d) => d.getName() === name),
  }
}
`

describe('a pair sharing no vocabulary at all is not copy-paste', () => {
  it('reports nothing for two same-shaped records with no shared identifier', () => {
    expect(run(NO_SHARED_VOCABULARY, 'smells/no-shared-vocab')).toHaveLength(0)
  })

  it('still reports a pair that shares only five vocabulary items', () => {
    // Non-vacuity with teeth: the row above would also pass if the guard
    // rejected everything, or if collection stopped. This is the shape of the
    // real finding with the fewest shared items on this repo, and it must
    // survive.
    expect(run(FEWEST_SHARED_ITEMS, 'smells/few-shared-vocab').length).toBeGreaterThan(0)
  })
})
