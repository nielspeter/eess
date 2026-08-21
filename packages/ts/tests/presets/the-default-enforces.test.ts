it('a clean project does not throw — enforcement is not noise', () => {
  // The other half of "the default enforces": it must stay quiet when there is
  // nothing to report. Without this the file is one-sided — it would pass just
  // as well if the preset threw unconditionally, which is the defect shape
  // bug 0187 was about.
  //
  // A real in-memory file rather than an empty project: zero loaded sources
  // trips the evidence floor, which outranks any declaration and would make
  // this throw for a reason that has nothing to do with the default.
  const tsMorph = new Project({ useInMemoryFileSystem: true })
  tsMorph.createSourceFile(
    '/clean/src/ok.ts',
    'export class Ok {\n  greet(name: string): string {\n    return `hi ${name}`\n  }\n}\n',
  )
  const clean: ArchProject = {
    tsConfigPath: '/clean/tsconfig.json',
    _project: tsMorph,
    getSourceFiles: () => tsMorph.getSourceFiles(),
  }
  expect(() => {
    recommended(clean, { include: '**/clean/**' })
  }).not.toThrow()
})

// The first version of the row above asserted `builders.length > 0` under a
// title about not throwing — a verbatim duplicate of an earlier row, with a
// comment claiming a glob "that matches nothing the preset can fault" while
// passing the same `'**/*'` the VACUITY row proves DOES fault. Three
// disagreements in nine lines, in the file written to close a false green.
// Caught by the enforcement review of PR #72.
/**
 * A preset called with no `report` option **enforces**: it runs the rules,
 * emits once, and throws if anything failed.
 *
 * This is ADR-008's documented default and what published `eess-ts` has always
 * done. Plan 0165 Phase 3 restored `report` "additive, by overload" and, as a
 * side effect of the overload ORDER, made the builder-returning form what a
 * caller got by saying nothing. Every other mode had a name; only that one was
 * reachable by omission.
 *
 * **What that cost, and why this file exists.** `docs/getting-started.md` — the
 * first code a new adopter copies — teaches the bare statement form:
 *
 * ```ts
 * it('enforces layered architecture', () => {
 *   layeredArchitecture(p, { layers: {…}, strict: true })
 * })
 * ```
 *
 * With the builder default, that test constructed rules, ran none of them, and
 * passed unconditionally on any codebase forever. TypeScript could not catch it
 * either: the return value was already discarded, so the overload change was
 * type-invisible at exactly the call site the docs prescribe. Found by the
 * product and architect reviews of PR #72, independently.
 *
 * The rows below are written against the SHAPE the docs teach — a bare call
 * whose result is discarded — because that is the shape that regressed. A test
 * that inspected a return value would have kept passing throughout.
 */
import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import path from 'node:path'
import { ArchRuleError } from '@nielspeter/eess'
import type { ArchProject } from '../../src/core/project.js'
import { recommended } from '../../src/presets/recommended.js'

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures/poc')
const tsconfigPath = path.join(fixturesDir, 'tsconfig.json')

function loadTestProject(): ArchProject {
  const tsMorphProject = new Project({ tsConfigFilePath: tsconfigPath })
  return {
    tsConfigPath: tsconfigPath,
    _project: tsMorphProject,
    getSourceFiles: () => tsMorphProject.getSourceFiles(),
  }
}

describe('a preset with no report option enforces (PR #72 review)', () => {
  const p = loadTestProject()
  const include = '**/*'

  // Guards every row below. If the fixture stopped violating anything, the
  // "throws" rows would be satisfied by nothing and the "does not throw" rows
  // would pass for the wrong reason (ADR-010).
  it('VACUITY: the fixture really does violate the preset', () => {
    const violations = recommended(p, { include, report: 'return' })
    expect(violations.length).toBeGreaterThan(0)
  })

  it('the shape the docs teach — a bare call, result discarded — THROWS', () => {
    expect(() => {
      recommended(p, { include })
    }).toThrow(ArchRuleError)
  })

  it("report: 'builders' returns rules and runs none of them", () => {
    const builders = recommended(p, { include, report: 'builders' })
    expect(builders.length).toBeGreaterThan(0)
    // Runs nothing: the capability is intact, it just has to be asked for.
    expect(() => {
      recommended(p, { include, report: 'builders' })
    }).not.toThrow()
    // …and the rules it returns are the ones that would have thrown above.
    expect(builders.flatMap((b) => b.violations()).length).toBeGreaterThan(0)
  })

  it("report: 'return' hands back the violations without throwing", () => {
    expect(() => {
      recommended(p, { include, report: 'return' })
    }).not.toThrow()
  })

  it("report: 'warn' reports without throwing", () => {
    expect(() => {
      recommended(p, { include, report: 'warn' })
    }).not.toThrow()
  })
})
