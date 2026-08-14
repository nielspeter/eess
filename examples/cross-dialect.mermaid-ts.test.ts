import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { project } from '@nielspeter/eess-ts'
import { diagram } from '@nielspeter/eess-mermaid'
import { diagramMatchesCode } from '@nielspeter/eess-crossvalidate/mermaid-ts'
import { ArchRuleError } from '@nielspeter/eess'

const calc = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/calc')
const tsProject = () => project(join(calc, 'tsconfig.json'))
const mmd = (name: string) => diagram(readFileSync(join(calc, name), 'utf8'))
// Pinned to the fixture's own src — if this matched nothing on the TS side,
// the reds below would silently go green instead of firing.
const scope = { scope: '**/src/**' }
const violations = (fn: () => void) => {
  try {
    fn()
  } catch (e) {
    if (e instanceof ArchRuleError) return e.violations
    throw e
  }
  return []
}

it('green — diagram and code fully agree', () =>
  expect(() => diagramMatchesCode(mmd('complete.mmd'), tsProject(), scope)).not.toThrow())

it('red — code→diagram: a code class missing from the diagram fails the build', () => {
  const v = violations(() => diagramMatchesCode(mmd('drift.mmd'), tsProject(), scope))
  expect(v.some((x) => x.message.includes('ModuloOperation'))).toBe(true)
})

it('red — diagram→code: a diagram class missing from the code fails the build', () => {
  // The direction the package's own test doesn't cover: complete.mmd plus one
  // extra class, GhostClass, that no TS class matches.
  const v = violations(() => diagramMatchesCode(mmd('ghost.mmd'), tsProject(), scope))
  expect(v.some((x) => x.message.includes('GhostClass'))).toBe(true)
})
