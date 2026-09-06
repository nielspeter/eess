import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { project, smells } from '../../src/index.js'

/**
 * A function compared against a function nested inside it is noise by
 * construction, and the detector used to generate it itself.
 *
 * `smells.duplicateBodies()` collects object-literal functions deliberately — a
 * duplicated arrow under an object key is exactly the copy-paste it exists to
 * find. But that means `const rule = () => ({ evaluate })` yields BOTH the outer
 * arrow and the `evaluate` inside it, and the outer body contains the inner one
 * almost entirely, so they score high whatever the code says.
 *
 * The finding is unactionable in principle: "extract the shared logic into one
 * function" cannot be done when one function already contains the other.
 * Measured on this repo before the guard: 10 of 173 pairs.
 */
function withProject<T>(source: string, fn: (tsconfig: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'eess-nested-'))
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

/**
 * The shape the DSL is built from: a factory returning an object with a method.
 *
 * The inner body has to be SUBSTANTIAL for this to reproduce, and that is worth
 * knowing. A short inner body makes the outer's extra nodes proportionally large,
 * so `findSimilarPairs`'s node-count fast-rejection discards the pair before the
 * containment guard is ever consulted — the first version of this fixture did
 * exactly that and passed with the guard deleted. The real occurrence
 * (`eess-gherkin`'s `haveUniqueTitles`, reported at 92%) has a ~20-line
 * `evaluate`, which is why it got through.
 */
const NESTED = `
export const aRule = () => ({
  description: 'every element carries a stable identifier',
  evaluate: (elements: string[]) => {
    const seen = new Map<string, string>()
    const duplicates: string[] = []
    const singles: string[] = []
    for (const element of elements) {
      const key = element.toLowerCase().trim()
      const previous = seen.get(key)
      if (previous !== undefined) {
        duplicates.push(\`\${previous} collides with \${element}\`)
        continue
      }
      seen.set(key, element)
      singles.push(element)
    }
    const summary = duplicates.length > 0 ? 'collisions found' : 'all unique'
    return { duplicates, singles, summary, total: elements.length }
  },
})
`

describe('a body is never compared with a body nested inside it', () => {
  it('reports nothing for a factory returning an object with one method', () => {
    const violations = withProject(NESTED, (tsconfig) =>
      smells
        .duplicateBodies(project(tsconfig))
        .minLines(3)
        .minDistinctVocabulary(0)
        .rule({ id: 'smells/nested' })
        .violations(),
    )
    expect(violations).toHaveLength(0)
  })

  it('still reports two SEPARATE factories of the same shape', () => {
    // Non-vacuity with teeth: the assertion above would also pass if the guard
    // rejected everything, or if object-literal functions stopped being
    // collected at all. Two sibling factories are genuinely duplicated and must
    // still be found.
    const violations = withProject(`${NESTED}\n${NESTED.replace(/aRule/, 'bRule')}`, (tsconfig) =>
      smells
        .duplicateBodies(project(tsconfig))
        .minLines(3)
        .minDistinctVocabulary(0)
        .rule({ id: 'smells/nested-control' })
        .violations(),
    )
    expect(violations.length).toBeGreaterThan(0)
  })
})
