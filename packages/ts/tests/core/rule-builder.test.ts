import { describe, it, expect, vi } from 'vitest'
import { ArchRuleError } from '@nielspeter/eess'
import type { Predicate } from '@nielspeter/eess'
import {
  type TestElement,
  TestRuleBuilder,
  stubProject,
  nameMatches,
  alwaysPass,
  alwaysFail,
  notExistShaped,
} from '../support/test-rule-builder.js'

// --- Helpers unique to this file ---

function isExported(): Predicate<TestElement> {
  return {
    description: 'is exported',
    test: (el) => el.exported,
  }
}

const elements: TestElement[] = [
  { name: 'UserService', file: 'src/services/user.ts', line: 5, exported: true },
  { name: 'OrderService', file: 'src/services/order.ts', line: 3, exported: true },
  { name: 'helperFn', file: 'src/helpers/util.ts', line: 1, exported: false },
  { name: 'UserRepository', file: 'src/repos/user.ts', line: 10, exported: true },
]

describe('RuleBuilder', () => {
  describe('.check()', () => {
    it('passes when no violations exist', () => {
      const builder = new TestRuleBuilder(stubProject, elements)
      expect(() => {
        builder
          .that()
          .withPredicate(nameMatches(/Service$/))
          .should()
          .withCondition(alwaysPass())
          .check()
      }).not.toThrow()
    })

    it('throws ArchRuleError when violations exist', () => {
      const builder = new TestRuleBuilder(stubProject, elements)
      expect(() => {
        builder
          .that()
          .withPredicate(nameMatches(/Service$/))
          .should()
          .withCondition(alwaysFail('violated'))
          .check()
      }).toThrow(ArchRuleError)
    })

    it('includes violation details in the error', () => {
      const builder = new TestRuleBuilder(stubProject, elements)
      try {
        builder
          .that()
          .withPredicate(nameMatches(/Service$/))
          .should()
          .withCondition(alwaysFail('bad'))
          .check()
        expect.unreachable('should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ArchRuleError)
        const archError = error as ArchRuleError
        expect(archError.violations).toHaveLength(2)
        expect(archError.message).toContain('2 found')
        // Detailed violations accessible programmatically
        expect(archError.violations[0]!.element).toBe('UserService')
        expect(archError.violations[1]!.element).toBe('OrderService')
      }
    })
  })

  describe('.warn()', () => {
    it('logs violations to stderr but does not throw', () => {
      const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
      const builder = new TestRuleBuilder(stubProject, elements)
      builder
        .that()
        .withPredicate(nameMatches(/Service$/))
        .should()
        .withCondition(alwaysFail('warning'))
        .warn()
      expect(warnSpy).toHaveBeenCalledOnce()
      const output = warnSpy.mock.calls[0]?.[0] as string
      expect(output).toContain('UserService')
      expect(output).toContain('Architecture Violation')
      warnSpy.mockRestore()
    })

    it('does not log when there are no violations', () => {
      const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
      const builder = new TestRuleBuilder(stubProject, elements)
      builder
        .that()
        .withPredicate(nameMatches(/Service$/))
        .should()
        .withCondition(alwaysPass())
        .warn()
      expect(warnSpy).not.toHaveBeenCalled()
      warnSpy.mockRestore()
    })
  })

  describe('.because()', () => {
    it('attaches reason to the error message', () => {
      const builder = new TestRuleBuilder(stubProject, elements)
      try {
        builder
          .that()
          .withPredicate(nameMatches(/Service$/))
          .should()
          .withCondition(alwaysFail('bad'))
          .because('services must follow the pattern')
          .check()
        expect.unreachable('should have thrown')
      } catch (error) {
        const archError = error as ArchRuleError
        expect(archError.message).toContain('services must follow the pattern')
      }
    })
  })

  describe('.andShould()', () => {
    it('fails when any condition has violations', () => {
      const builder = new TestRuleBuilder(stubProject, elements)
      expect(() => {
        builder
          .that()
          .withPredicate(nameMatches(/Service$/))
          .should()
          .withCondition(alwaysPass())
          .andShould()
          .withCondition(alwaysFail('second'))
          .check()
      }).toThrow(ArchRuleError)
    })

    it('passes when all conditions pass', () => {
      const builder = new TestRuleBuilder(stubProject, elements)
      expect(() => {
        builder
          .that()
          .withPredicate(nameMatches(/Service$/))
          .should()
          .withCondition(alwaysPass())
          .andShould()
          .withCondition(alwaysPass())
          .check()
      }).not.toThrow()
    })
  })

  describe('named selections', () => {
    it('reuses predicate chain across multiple rules', () => {
      const services = new TestRuleBuilder(stubProject, elements)
        .that()
        .withPredicate(nameMatches(/Service$/))
      expect(() => {
        services.should().withCondition(alwaysPass()).check()
      }).not.toThrow()
      expect(() => {
        services.should().withCondition(alwaysFail('bad')).check()
      }).toThrow(ArchRuleError)
    })

    it('.should() does not mutate the original builder', () => {
      const services = new TestRuleBuilder(stubProject, elements)
        .that()
        .withPredicate(nameMatches(/Service$/))
      const rule1 = services.should().withCondition(alwaysFail('rule1'))
      const rule2 = services.should().withCondition(alwaysPass())
      expect(() => rule1.check()).toThrow(ArchRuleError)
      expect(() => rule2.check()).not.toThrow()
    })
  })

  describe('empty element set', () => {
    // ADR-009/010 (plan 0088 Phase 4): a rule that examines zero elements is a
    // configuration finding by default — a dead selector reads identically to
    // "nothing to report" unless the author declares it. These two cases used
    // to pass silently; that was the exact vacuous-pass hazard the honest-gate
    // exists to close, not a property worth re-asserting.

    it('.check() throws — a dead selector is a configuration finding, not a silent pass', () => {
      const builder = new TestRuleBuilder(stubProject, elements)
      try {
        builder
          .that()
          .withPredicate(nameMatches(/^NothingMatchesThis$/))
          .should()
          .withCondition(alwaysFail('unreachable'))
          .check()
        expect.unreachable('should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ArchRuleError)
        const archError = error as ArchRuleError
        expect(archError.violations).toHaveLength(1)
        expect(archError.violations[0]!.message).toMatch(/examined zero units/)
        expect(archError.violations[0]!.bypassFilters).toBe(true)
      }
    })

    it('.check() passes when the empty selection is declared with .expectEmpty()', () => {
      const builder = new TestRuleBuilder(stubProject, elements)
      expect(() => {
        builder
          .that()
          .withPredicate(nameMatches(/^NothingMatchesThis$/))
          .should()
          .withCondition(alwaysFail('unreachable'))
          .expectEmpty()
          .check()
      }).not.toThrow()
    })

    it('.check() throws when the element list itself is empty and undeclared', () => {
      const builder = new TestRuleBuilder(stubProject, [])
      try {
        builder.should().withCondition(alwaysFail('unreachable')).check()
        expect.unreachable('should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ArchRuleError)
        const archError = error as ArchRuleError
        expect(archError.violations).toHaveLength(1)
        expect(archError.violations[0]!.message).toMatch(/source loaded zero units/)
        expect(archError.violations[0]!.bypassFilters).toBe(true)
      }
    })

    it('.check() still throws when an empty element list is declared with .expectEmpty() — ADR-010 part 3', () => {
      // getElements() itself returned nothing here — a genuinely empty
      // source, not a predicate narrowing a real corpus to zero. This
      // outranks .expectEmpty(): there is no selection to widen, so the
      // declaration cannot rescue it. Regression for a real gap found in
      // review: this test used to assert the opposite (.not.toThrow()).
      const builder = new TestRuleBuilder(stubProject, [])
      try {
        builder.should().withCondition(alwaysFail('unreachable')).expectEmpty().check()
        expect.unreachable('should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ArchRuleError)
        const archError = error as ArchRuleError
        expect(archError.violations[0]!.message).toMatch(/source loaded zero units/)
        expect(archError.violations[0]!.message).toMatch(/outranks any \.expectEmpty\(\)/)
      }
    })
  })

  describe('.expectNonEmpty() — overrides the cardinality exemption (plan 0088 review)', () => {
    it('a cardinality-exempt condition normally passes silently on zero examined', () => {
      // Baseline: without .expectNonEmpty(), notExistShaped()'s exemption
      // means a dead selector over it is NOT a configuration finding.
      const builder = new TestRuleBuilder(stubProject, elements)
      expect(() => {
        builder
          .that()
          .withPredicate(nameMatches(/^NothingMatchesThis$/))
          .should()
          .withCondition(notExistShaped())
          .check()
      }).not.toThrow()
    })

    it('.expectNonEmpty() makes that same case redden — the declaration overrides the exemption', () => {
      const builder = new TestRuleBuilder(stubProject, elements)
      try {
        builder
          .that()
          .withPredicate(nameMatches(/^NothingMatchesThis$/))
          .should()
          .withCondition(notExistShaped())
          .expectNonEmpty()
          .check()
        expect.unreachable('should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ArchRuleError)
        const archError = error as ArchRuleError
        expect(archError.violations[0]!.message).toMatch(/declared \.expectNonEmpty\(\)/)
        expect(archError.violations[0]!.bypassFilters).toBe(true)
      }
    })

    it('.expectNonEmpty() is a no-op once real subjects exist — nothing left to assert', () => {
      const builder = new TestRuleBuilder(stubProject, elements)
      expect(() => {
        builder
          .that()
          .withPredicate(nameMatches(/Service$/))
          .should()
          .withCondition(alwaysPass())
          .expectNonEmpty()
          .check()
      }).not.toThrow()
    })
  })

  describe('.severity()', () => {
    it('severity("error") behaves like .check()', () => {
      const builder = new TestRuleBuilder(stubProject, elements)
      expect(() => {
        builder.should().withCondition(alwaysFail('bad')).severity('error')
      }).toThrow(ArchRuleError)
    })

    it('severity("warn") behaves like .warn()', () => {
      const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
      const builder = new TestRuleBuilder(stubProject, elements)
      builder.should().withCondition(alwaysFail('bad')).severity('warn')
      expect(warnSpy).toHaveBeenCalledOnce()
      warnSpy.mockRestore()
    })
  })

  describe('predicate combination', () => {
    it('ANDs multiple predicates together', () => {
      const builder = new TestRuleBuilder(stubProject, elements)
      try {
        builder
          .that()
          .withPredicate(nameMatches(/Service$/))
          .and()
          .withPredicate(isExported())
          .should()
          .withCondition(alwaysFail('found'))
          .check()
        expect.unreachable('should have thrown')
      } catch (error) {
        const archError = error as ArchRuleError
        // UserService and OrderService match both predicates
        expect(archError.violations).toHaveLength(2)
      }
    })
  })
})
