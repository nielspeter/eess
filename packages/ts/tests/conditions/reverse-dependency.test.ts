import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import path from 'node:path'
import { modules } from '../../src/builders/module-rule-builder.js'
import { ArchRuleError } from '@nielspeter/eess'
import type { ArchProject } from '../../src/core/project.js'

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures/reverse-deps')
const tsconfigPath = path.join(fixturesDir, 'tsconfig.json')

function loadTestProject(): ArchProject {
  const tsMorphProject = new Project({ tsConfigFilePath: tsconfigPath })
  return {
    tsConfigPath: tsconfigPath,
    _project: tsMorphProject,
    getSourceFiles: () => tsMorphProject.getSourceFiles(),
  }
}

describe('Reverse dependency conditions', () => {
  const p = loadTestProject()

  describe('onlyBeImportedVia', () => {
    it('catches direct import bypassing barrel', () => {
      // internal/helper.ts is imported by bad-consumer.ts (not via index.ts)
      expect(() => {
        modules(p)
          .that()
          .resideInFile('**/internal/helper.ts')
          .should()
          .onlyBeImportedVia('**/public/**', '**/internal/**')
          .check()
      }).toThrow(ArchRuleError)
    })

    it('passes when all importers go through allowed paths', () => {
      // public/index.ts is imported only by consumer.ts — check that consumer matches **/src/**
      expect(() => {
        modules(p)
          .that()
          .resideInFile('**/public/index.ts')
          .should()
          .onlyBeImportedVia('**/src/**')
          .check()
      }).not.toThrow()
    })

    it('module with no importers passes (vacuously true)', () => {
      // unused.ts has zero importers — vacuously passes
      expect(() => {
        modules(p)
          .that()
          .resideInFile('**/internal/unused.ts')
          .should()
          .onlyBeImportedVia('**/public/**')
          .check()
      }).not.toThrow()
    })

    it('multiple allowed globs — any match is OK', () => {
      // internal/helper.ts is imported by public/index.ts AND bad-consumer.ts
      // Allow both patterns — should pass
      expect(() => {
        modules(p)
          .that()
          .resideInFile('**/internal/helper.ts')
          .should()
          .onlyBeImportedVia('**/public/**', '**/bad-consumer.ts')
          .check()
      }).not.toThrow()
    })
  })

  describe('beImported', () => {
    it('violation on module with zero importers', () => {
      expect(() => {
        modules(p).that().resideInFile('**/internal/unused.ts').should().beImported().check()
      }).toThrow(ArchRuleError)
    })

    it('passes on module with at least one importer', () => {
      expect(() => {
        modules(p).that().resideInFile('**/internal/helper.ts').should().beImported().check()
      }).not.toThrow()
    })

    it('entry points can be excluded via .excluding()', () => {
      // unused.ts would fail beImported, but we exclude it
      expect(() => {
        modules(p)
          .that()
          .resideInFolder('**/internal/**')
          .should()
          .beImported()
          .excluding('unused.ts')
          .check()
      }).not.toThrow()
    })
  })

  describe('haveNoUnusedExports', () => {
    it('violation on export with zero external references', () => {
      // has-unused-export.ts exports unusedFunction which nobody imports
      expect(() => {
        modules(p)
          .that()
          .resideInFile('**/has-unused-export.ts')
          .should()
          .haveNoUnusedExports()
          .check()
      }).toThrow(ArchRuleError)
    })

    it('passes when all exports are referenced', () => {
      // consumer.ts exports greet() — but is greet() referenced? Not by this fixture.
      // Use consumer-of-partial.ts which exports result — referenced by nobody either.
      // Let's use internal/helper.ts: exports formatName, referenced by public/index.ts and bad-consumer.ts
      expect(() => {
        modules(p)
          .that()
          .resideInFile('**/internal/helper.ts')
          .should()
          .haveNoUnusedExports()
          .check()
      }).not.toThrow()
    })

    it("reports a re-exported name at the barrel's own export line, never the declaring file's (bug 0265)", () => {
      // public/index.ts re-exports helperTwo on ITS line 3; the declaration is
      // reexport-only.ts line 2; nobody imports helperTwo from the barrel. The
      // finding names the barrel as `file`, so `line` must be a line of the
      // barrel. Before the fix it was 2 — a line that exists only in the other
      // file, so a code frame pointed at "export function helperTwo" under the
      // wrong path and an `// eess-exclude` on the barrel's real line did not
      // apply (the 0242 shape, fail-closed).
      const violations = [
        ...modules(p)
          .that()
          .resideInFile('**/public/index.ts')
          .should()
          .haveNoUnusedExports()
          .violations(),
      ]
      const found = violations.find((v) => v.message.includes('"helperTwo"'))
      expect(found?.file).toMatch(/public\/index\.ts$/)
      expect(found?.line).toBe(3)
    })

    it('an own declaration still reports its declaration line (control for 0265)', () => {
      // has-unused-export.ts declares unusedFunction on its line 7. The fix must
      // move only re-exports; an own declaration keeps the line it always had.
      const violations = [
        ...modules(p)
          .that()
          .resideInFile('**/has-unused-export.ts')
          .should()
          .haveNoUnusedExports()
          .violations(),
      ]
      const found = violations.find((v) => v.message.includes('"unusedFunction"'))
      expect(found?.file).toMatch(/has-unused-export\.ts$/)
      expect(found?.line).toBe(7)
    })

    it.each([
      ['star', 'a bare `export * from`', 'dead'],
      ['ns', 'a namespace re-export `export * as L from`', 'L'],
      ['alias', 'an aliased re-export `export { dead as gone } from`', 'gone'],
    ])(
      'the %s fixture (%s) reports "%s" at the barrel own line 2, not the declaring line 5 (bug 0265)',
      (dir, _spelling, name) => {
        // ONE spelling per project (ADR-009 rule 5): each fixture can only red
        // for its own reason, and a shared project would let one barrel's
        // re-export count as a reference to another's. Every `lib.ts` declares
        // on line 5 and every `barrel.ts` exports on line 2, so a finding
        // anchored on the declaration is a line the barrel does not have.
        //
        // The star case is why they are separate: it is the one this fix got
        // wrong first (`isNamespaceExport()` is true for a bare `export *`), and
        // it reported line 5 while the other two were already correct.
        const fixtureDir = path.resolve(import.meta.dirname, `../fixtures/barrel-line/${dir}`)
        const tsConfig = path.join(fixtureDir, 'tsconfig.json')
        const tsMorph = new Project({ tsConfigFilePath: tsConfig })
        const barrelProject: ArchProject = {
          tsConfigPath: tsConfig,
          _project: tsMorph,
          getSourceFiles: () => tsMorph.getSourceFiles(),
        }
        const violations = [
          ...modules(barrelProject)
            .that()
            .resideInFile('**/barrel.ts')
            .should()
            .haveNoUnusedExports()
            .violations(),
        ]
        const found = violations.find((v) => v.message.includes(`"${name}"`))
        expect(found?.file).toMatch(/barrel\.ts$/)
        expect(found?.line).toBe(2)
      },
    )

    it('re-exports count as references (isolated)', () => {
      // reexport-only.ts exports helperTwo — ONLY referenced via re-export in public/index.ts
      // No direct import from any other file. The re-export should count as a reference.
      expect(() => {
        modules(p)
          .that()
          .resideInFile('**/internal/reexport-only.ts')
          .should()
          .haveNoUnusedExports()
          .check()
      }).not.toThrow()
    })
  })

  describe('combined with resideInFolder', () => {
    it('scoped beImported works', () => {
      // internal/ has helper.ts (imported) and unused.ts (not imported)
      expect(() => {
        modules(p).that().resideInFolder('**/internal/**').should().beImported().check()
      }).toThrow(ArchRuleError)
    })
  })
})
