import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { classes } from '../../src/builders/class-rule-builder.js'
import { functions } from '../../src/builders/function-rule-builder.js'
import { modules } from '../../src/builders/module-rule-builder.js'
import { noProcessEnv, functionNoProcessEnv, moduleNoProcessEnv } from '../../src/rules/security.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0304 — a class or function body finding carries the declaration's line, while
 * its message names the line of the read. The module variant anchors at the read.
 *
 * The KNOWN GAP tests assert today's behaviour; fixing 0304 turns them red. The
 * CONTROL is the variant that already anchors where the fix should.
 */
const SOURCE = [
  'export class Service {', // 1
  '  a = 1', // 2
  '  method() {', // 3
  '    return process.env.METHOD', // 4
  '  }', // 5
  '}', // 6
  'export function fn() {', // 7
  '  const x = 1', // 8
  '  return process.env.FN', // 9
  '}', // 10
  'export const top = process.env.TOP', // 11
  '',
].join('\n')

function sourceProject(): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile('/src/source.ts', SOURCE)
  return {
    tsConfigPath: '/tsconfig.json',
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

describe('bug 0304: a body finding points at the declaration', () => {
  it('KNOWN GAP — a class body finding is anchored at the class, while its message names the read', () => {
    const result = classes(sourceProject())
      .should()
      .satisfy(noProcessEnv())
      .rule({ id: 'test/0304-class' })
      .violations()

    expect(result.map((v) => [v.line, v.message])).toEqual([
      [1, "Service contains access to 'process.env' at line 4"],
    ])
  })

  it('KNOWN GAP — a function body finding is anchored at the function, while its message names the read', () => {
    const result = functions(sourceProject())
      .that()
      .haveNameMatching(/^fn$/)
      .should()
      .satisfy(functionNoProcessEnv())
      .rule({ id: 'test/0304-function' })
      .violations()

    expect(result.map((v) => [v.line, v.message])).toEqual([
      [7, "fn contains access to 'process.env' at line 9"],
    ])
  })

  it('CONTROL — a module finding is anchored at the read', () => {
    const result = modules(sourceProject())
      .should()
      .satisfy(moduleNoProcessEnv())
      .rule({ id: 'test/0304-module' })
      .violations()

    expect(new Set(result.map((v) => v.line))).toEqual(new Set([4, 9, 11]))
  })
})
