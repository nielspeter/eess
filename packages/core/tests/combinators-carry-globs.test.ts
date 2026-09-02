import { describe, expect, it } from 'vitest'
import type { Predicate } from '../src/index.js'
import { and, not, or } from '../src/index.js'
import { globAnyOf } from '../src/index.js'

/**
 * A composed predicate keeps the globs its inputs declared.
 *
 * The dead-glob diagnosis reads `Predicate.globs` to tell an author that
 * `resideInFolder('scr/**')` matched nothing. The kernel's combinators dropped
 * the field entirely, so composing ANY predicate with `and`/`or`/`not` made its
 * globs invisible — and the diagnosis then reports nothing at all, which reads
 * to the author exactly like a healthy rule.
 *
 * `eess-ts` fixed this on its own copy of `combinators.ts` and the kernel never
 * adopted it, so every other dialect — `eess-md`, `eess-mermaid`,
 * `eess-gherkin`, `eess-crossvalidate` — still loses the declaration on any
 * composed selector. `negateGlobs` and `combineGlobs` were already the
 * kernel's; only these three call sites were missing.
 *
 * The `op` reasoning is the load-bearing part, not the presence of a field:
 * a conjunction selects nothing as soon as ONE input does (`all`), a
 * disjunction only when EVERY input does (`any`), and `not` inverts both the
 * operator and each leaf's polarity — a negated site over-selects rather than
 * going vacuous, but a `not` nested inside flips it back, which is why
 * polarity alone is not enough.
 */
const declaring = (glob: string): Predicate<string> => ({
  description: `reside in ${glob}`,
  test: (value: string) => value.startsWith(glob),
  globs: globAnyOf([glob], 'file-path', 'absolute'),
})

const byName: Predicate<string> = {
  description: 'are named x',
  test: (value: string) => value === 'x',
}

describe('a composed predicate keeps the globs its inputs declared', () => {
  it('not() keeps them, inverting the operator', () => {
    const negated = not(declaring('src/**'))
    expect(negated.globs).toBeDefined()
    expect(JSON.stringify(negated.globs)).toContain('src/**')
  })

  it('and() combines them as "all" — one dead input makes the conjunction dead', () => {
    const combined = and(declaring('src/**'), declaring('lib/**'))
    expect(combined.globs?.op).toBe('all')
    expect(combined.globs?.children).toHaveLength(2)
  })

  it('or() combines them as "any", retaining an input that declares none', () => {
    // Dropping the glob-less input is what would report `or(deadGlob, byName)`
    // as wholly dead: the disjunction still selects whatever `byName` selects.
    const combined = or(declaring('src/**'), byName)
    expect(combined.globs?.op).toBe('any')
    expect(combined.globs?.children).toHaveLength(2)
  })

  it('CONTROL: an uncomposed predicate declares its globs, so the rows above are not vacuous', () => {
    expect(declaring('src/**').globs).toBeDefined()
    expect(byName.globs).toBeUndefined()
  })
})
