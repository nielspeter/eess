import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import path from 'node:path'
import { modules } from '../../src/builders/module-rule-builder.js'
import { moduleUseInsteadOf } from '../../src/conditions/body-analysis-module.js'
import { access, call } from '../../src/helpers/matchers.js'
import { ArchRuleError } from '@nielspeter/eess'
import type { ArchProject } from '../../src/core/project.js'

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures/module-body')
const tsconfigPath = path.join(fixturesDir, 'tsconfig.json')

function loadTestProject(): ArchProject {
  const tsMorphProject = new Project({ tsConfigFilePath: tsconfigPath })
  return {
    tsConfigPath: tsconfigPath,
    _project: tsMorphProject,
    getSourceFiles: () => tsMorphProject.getSourceFiles(),
  }
}

describe('Module body analysis', () => {
  const p = loadTestProject()

  describe('notContain (full file — default)', () => {
    it('catches process.env access at module scope', () => {
      expect(() => {
        modules(p)
          .that()
          .resideInFile('**/has-process-env.ts')
          .should()
          .notContain(access('process.env'))
          .check()
      }).toThrow(ArchRuleError)
    })

    it('catches eval() inside a function body (full file mode)', () => {
      expect(() => {
        modules(p)
          .that()
          .resideInFile('**/has-eval-in-function.ts')
          .should()
          .notContain(call('eval'))
          .check()
      }).toThrow(ArchRuleError)
    })

    it('catches console.log at module scope', () => {
      expect(() => {
        modules(p)
          .that()
          .resideInFile('**/has-console-log.ts')
          .should()
          .notContain(call('console.log'))
          .check()
      }).toThrow(ArchRuleError)
    })

    it('catches fetch() inside class method (full file mode)', () => {
      expect(() => {
        modules(p)
          .that()
          .resideInFile('**/has-fetch-in-class.ts')
          .should()
          .notContain(call('fetch'))
          .check()
      }).toThrow(ArchRuleError)
    })

    it('passes on clean module', () => {
      expect(() => {
        modules(p)
          .that()
          .resideInFile('**/clean.ts')
          .should()
          .notContain(access('process.env'))
          .check()
      }).not.toThrow()
    })
  })

  describe('notContain with scopeToModule: true', () => {
    it('catches process.env at module scope', () => {
      expect(() => {
        modules(p)
          .that()
          .resideInFile('**/has-process-env.ts')
          .should()
          .notContain(access('process.env'), { scopeToModule: true })
          .check()
      }).toThrow(ArchRuleError)
    })

    it('skips eval() inside function body', () => {
      // eval is inside dangerousEval() — scopeToModule should skip it
      expect(() => {
        modules(p)
          .that()
          .resideInFile('**/has-eval-in-function.ts')
          .should()
          .notContain(call('eval'), { scopeToModule: true })
          .check()
      }).not.toThrow()
    })

    it('skips fetch() inside class method', () => {
      // fetch is inside ApiClient.getData() — scopeToModule should skip it
      expect(() => {
        modules(p)
          .that()
          .resideInFile('**/has-fetch-in-class.ts')
          .should()
          .notContain(call('fetch'), { scopeToModule: true })
          .check()
      }).not.toThrow()
    })

    it('catches console.log at module scope', () => {
      // console.log is a top-level statement — scopeToModule should catch it
      expect(() => {
        modules(p)
          .that()
          .resideInFile('**/has-console-log.ts')
          .should()
          .notContain(call('console.log'), { scopeToModule: true })
          .check()
      }).toThrow(ArchRuleError)
    })
  })

  describe('contain', () => {
    it('passes when module contains the pattern', () => {
      expect(() => {
        modules(p)
          .that()
          .resideInFile('**/has-console-log.ts')
          .should()
          .contain(call('console.log'))
          .check()
      }).not.toThrow()
    })

    it('fails when module does not contain the pattern', () => {
      expect(() => {
        modules(p).that().resideInFile('**/clean.ts').should().contain(call('console.log')).check()
      }).toThrow(ArchRuleError)
    })
  })

  describe('useInsteadOf', () => {
    it('fails when bad pattern found', () => {
      expect(() => {
        modules(p)
          .that()
          .resideInFile('**/has-eval-in-function.ts')
          .should()
          .useInsteadOf(call('eval'), call('safeEval'))
          .check()
      }).toThrow(ArchRuleError)
    })
  })

  describe('scoped to folder', () => {
    it('works with resideInFolder predicate', () => {
      // All modules in src/ that use process.env — only has-process-env.ts has it
      expect(() => {
        modules(p)
          .that()
          .resideInFolder('**/src/**')
          .should()
          .notContain(access('process.env'))
          .check()
      }).toThrow(ArchRuleError)
    })
  })
})

describe('a per-match module finding names what contains it (bug 0333)', () => {
  // `moduleNotContain` and `moduleUseInsteadOf` both report a finding ABOUT A MATCH, so both name
  // the declaration the match sits in — the file only when nothing does. The delta review of
  // PR #149 measured that the `moduleUseInsteadOf` half had no break class: sabotaging it reddened
  // nothing across the whole suite. This is that break class.
  function inMemory(source: string): ArchProject {
    const tsm = new Project({ useInMemoryFileSystem: true })
    tsm.createSourceFile('/src/swap.ts', source)
    return {
      tsConfigPath: '/tsconfig.json',
      _project: tsm,
      getSourceFiles: () => tsm.getSourceFiles(),
    }
  }

  it('names the enclosing declaration, and the file when there is none', () => {
    const p = inMemory(
      [
        'declare function legacy(n: number): number',
        'declare function modern(n: number): number',
        'export function holder() { return legacy(1) }',
        'legacy(2)',
        'modern(3)',
        '',
      ].join('\n'),
    )
    const reported = modules(p)
      .should()
      .satisfy(moduleUseInsteadOf(call('legacy'), call('modern')))
      .rule({ id: 'test/0333-use-instead-of' })
      .violations()
      .map((v) => [v.element, v.line])

    // Line 3's call sits in `holder`; line 4's sits in no declaration at all.
    expect(reported).toEqual([
      ['holder', 3],
      ['swap.ts', 4],
    ])
  })
})
