import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import path from 'node:path'
import {
  areAsync,
  areNotAsync,
  arePublic,
  areProtected,
  arePrivate,
  haveParameterCount,
  haveParameterCountGreaterThan,
  haveParameterCountLessThan,
  haveParameterNamed,
  haveReturnType,
} from '../../src/predicates/function.js'
import { collectFunctions } from '../../src/models/arch-function.js'
import type { ArchFunction } from '../../src/models/arch-function.js'

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures/poc')
const project = new Project({
  tsConfigFilePath: path.join(fixturesDir, 'tsconfig.json'),
})

// Collect all functions from all fixture files
const allFunctions = project.getSourceFiles().flatMap((sf) => collectFunctions(sf))

function findFn(name: string): ArchFunction {
  const fn = allFunctions.find((f) => f.getName() === name)
  if (!fn) throw new Error(`Function "${name}" not found in fixtures`)
  return fn
}

describe('function predicates', () => {
  describe('areAsync', () => {
    it('matches async functions', () => {
      const predicate = areAsync()
      expect(predicate.test(findFn('parseFooOrder'))).toBe(false)
    })

    it('matches an async function — the mirror of the row above (bug 0187)', () => {
      // `areAsync` survived the sweep only because its other assertion happens to
      // be `.toBe(false)`. One-sidedness is the defect; direction is luck.
      expect(areAsync().test(findFn('OrderService.getTotal'))).toBe(true)
    })

    it('has readable description', () => {
      expect(areAsync().description).toBe('are async')
    })
  })

  describe('areNotAsync', () => {
    it('matches non-async functions', () => {
      const predicate = areNotAsync()
      expect(predicate.test(findFn('parseFooOrder'))).toBe(true)
    })

    it('rejects an async function — the direction that was missing (bug 0187)', () => {
      // Without this row the whole predicate is unfalsifiable: `test: () => true`
      // satisfies the `.toBe(true)` above, so nothing could catch it filtering
      // nothing at all.
      expect(areNotAsync().test(findFn('OrderService.getTotal'))).toBe(false)
    })

    it('has readable description', () => {
      expect(areNotAsync().description).toBe('are not async')
    })
  })

  describe('haveParameterCount', () => {
    it('matches functions with exact parameter count', () => {
      const predicate = haveParameterCount(1)
      expect(predicate.test(findFn('parseFooOrder'))).toBe(true) // 1 param: order
    })

    it('rejects functions with different count', () => {
      const predicate = haveParameterCount(2)
      expect(predicate.test(findFn('parseFooOrder'))).toBe(false)
    })

    it('matches zero-parameter functions', () => {
      const predicate = haveParameterCount(0)
      expect(predicate.test(findFn('listItems'))).toBe(true) // no params
    })

    it('singular description for count of 1', () => {
      expect(haveParameterCount(1).description).toBe('have 1 parameter')
    })

    it('plural description for count != 1', () => {
      expect(haveParameterCount(3).description).toBe('have 3 parameters')
    })
  })

  describe('haveParameterCountGreaterThan', () => {
    it('matches functions with more than n parameters', () => {
      const predicate = haveParameterCountGreaterThan(0)
      expect(predicate.test(findFn('parseFooOrder'))).toBe(true) // 1 > 0
    })

    it('rejects functions with n or fewer parameters', () => {
      const predicate = haveParameterCountGreaterThan(1)
      expect(predicate.test(findFn('parseFooOrder'))).toBe(false) // 1 is not > 1
    })
  })

  describe('haveParameterCountLessThan', () => {
    it('matches functions with fewer than n parameters', () => {
      const predicate = haveParameterCountLessThan(2)
      expect(predicate.test(findFn('parseFooOrder'))).toBe(true) // 1 < 2
    })

    it('rejects functions with n or more parameters', () => {
      const predicate = haveParameterCountLessThan(1)
      expect(predicate.test(findFn('parseFooOrder'))).toBe(false) // 1 is not < 1
    })
  })

  describe('haveParameterNamed', () => {
    it('matches functions with a parameter of the given name', () => {
      const predicate = haveParameterNamed('order')
      expect(predicate.test(findFn('parseFooOrder'))).toBe(true)
    })

    it('rejects functions without that parameter', () => {
      const predicate = haveParameterNamed('nonexistent')
      expect(predicate.test(findFn('parseFooOrder'))).toBe(false)
    })

    it('works on arrow functions', () => {
      const predicate = haveParameterNamed('order')
      expect(predicate.test(findFn('parseBazOrder'))).toBe(true)
    })
  })

  describe('haveReturnType', () => {
    it('matches return type with regex', () => {
      const predicate = haveReturnType(/field/)
      expect(predicate.test(findFn('parseFooOrder'))).toBe(true)
    })

    it('matches return type with string pattern', () => {
      const predicate = haveReturnType('field')
      expect(predicate.test(findFn('parseFooOrder'))).toBe(true)
    })

    it('rejects non-matching return type', () => {
      const predicate = haveReturnType(/^Promise/)
      expect(predicate.test(findFn('parseFooOrder'))).toBe(false)
    })
  })
  /**
   * Bug 0187. `arePublic`, `areProtected` and `arePrivate` were **unfalsifiable**:
   * widened to `test: () => true`, so that they filter nothing, all 3519 tests
   * stayed green.
   *
   * They were not untested — they were exercised through the builder in
   * `tests/integration/function-rules.test.ts`, under a `describe('arePublic (full
   * chain)')`. Every assertion there is `.not.toThrow()` over a fixture chosen so
   * the rule passes; one says so in its own comment ("No function in the fixture
   * returns `any`, so this should pass"). A rule that passes goes on passing when
   * its selector widens, so none of it could ever fail.
   *
   * The fixture needed nothing added: `MixedVisibility` has carried all four
   * visibility forms since plan 0030. What was missing was asserting against them.
   *
   * Written as a matrix rather than one `.toBe(true)` per predicate, because a
   * predicate is only pinned by the cases it must REJECT.
   */
  describe('visibility predicates discriminate (bug 0187)', () => {
    const MEMBERS: readonly { fn: string; scope: 'public' | 'protected' | 'private' }[] = [
      { fn: 'MixedVisibility.getPublicData', scope: 'public' },
      // No access modifier at all. TypeScript treats it as public, and a rule
      // saying "public methods must X" has to cover it — so it is pinned here
      // rather than left to be discovered by an adopter.
      { fn: 'MixedVisibility.noModifier', scope: 'public' },
      { fn: 'MixedVisibility.loadInternal', scope: 'protected' },
      { fn: 'MixedVisibility.validate', scope: 'private' },
    ]

    it('VACUITY: the fixture really carries all three visibilities', () => {
      // Every row below is a comparison against this fixture. If it drifted to
      // one visibility the matrix could still be satisfied trivially, so the
      // spread is asserted before anything is derived from it (ADR-010).
      const scopes = MEMBERS.map((m) => findFn(m.fn).getScope()).sort()
      expect([...new Set(scopes)]).toEqual(['private', 'protected', 'public'])
    })

    it('arePublic() matches the public members and REJECTS the others', () => {
      for (const m of MEMBERS) {
        expect(arePublic().test(findFn(m.fn)), m.fn).toBe(m.scope === 'public')
      }
    })

    it('areProtected() matches the protected member and REJECTS the others', () => {
      for (const m of MEMBERS) {
        expect(areProtected().test(findFn(m.fn)), m.fn).toBe(m.scope === 'protected')
      }
    })

    it('arePrivate() matches the private member and REJECTS the others', () => {
      for (const m of MEMBERS) {
        expect(arePrivate().test(findFn(m.fn)), m.fn).toBe(m.scope === 'private')
      }
    })

    it('the three are mutually exclusive — exactly one matches each member', () => {
      // Catches a widening that the per-predicate rows above could miss if two of
      // them drifted together.
      for (const m of MEMBERS) {
        const fn = findFn(m.fn)
        const matched = [arePublic(), areProtected(), arePrivate()].filter((pr) => pr.test(fn))
        expect(matched.length, m.fn).toBe(1)
      }
    })

    it('describe themselves by their scope — the strings baselines hash on', () => {
      expect(arePublic().description).toBe('are public')
      expect(areProtected().description).toBe('are protected')
      expect(arePrivate().description).toBe('are private')
    })
  })
})
