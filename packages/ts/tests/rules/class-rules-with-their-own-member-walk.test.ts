import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { classes } from '../../src/builders/class-rule-builder.js'
import { noSilentCatch } from '../../src/rules/errors.js'
import { noMagicNumbers } from '../../src/rules/code-quality.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0306 — `noSilentCatch` and `noMagicNumbers` do not use the class body search that bug 0300
 * fixed. Each walks its own list of members: `noSilentCatch` methods, constructors and
 * accessors; `noMagicNumbers` methods only. Code in an arrow-function property, a static block
 * or a parameter default is not read.
 *
 * The KNOWN GAP tests assert today's behaviour; fixing 0306 turns them red. Each asserts the
 * method IS reported, so neither can pass over a rule that reports nothing.
 */
function project(path: string, text: string): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile(path, text)
  return {
    tsConfigPath: '/tsconfig.json',
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

describe('bug 0306: class rules with their own member walk', () => {
  it('KNOWN GAP — noSilentCatch reads a method, not an arrow property or a static block', () => {
    const source = [
      'export class Worker {', // 1
      '  handler = () => { try { work() } catch (e) {} }', // 2
      '  static { try { work() } catch (e) {} }', // 3
      '  method() { try { work() } catch (e) {} }', // 4
      '}', // 5
      '',
    ].join('\n')
    const result = classes(project('/src/worker.ts', source))
      .should()
      .satisfy(noSilentCatch())
      .rule({ id: 'test/0306-silent-catch' })
      .violations()

    expect(new Set(result.map((v) => v.line))).toEqual(new Set([4]))
  })

  it('KNOWN GAP — noMagicNumbers reads a method, not an arrow property, a static block or a parameter default', () => {
    const source = [
      'export class Tuning {', // 1
      '  arrow = () => 4242', // 2
      '  static { void 4343 }', // 3
      '  constructor(x = 4444) {}', // 4
      '  method() { return 4545 }', // 5
      '}', // 6
      '',
    ].join('\n')
    const result = classes(project('/src/tuning.ts', source))
      .should()
      .satisfy(noMagicNumbers())
      .rule({ id: 'test/0306-magic-numbers' })
      .violations()

    expect(new Set(result.map((v) => v.line))).toEqual(new Set([5]))
  })
})
