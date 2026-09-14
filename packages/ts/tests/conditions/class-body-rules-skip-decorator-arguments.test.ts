import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { classes } from '../../src/builders/class-rule-builder.js'
import { noProcessEnv } from '../../src/rules/security.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0307 — the class body search walks the code each member runs (bug 0300), but not the code
 * a class runs outside its members, when the class is defined: decorator arguments, computed
 * member names and the `extends` expression. A framework module that reads its configuration in
 * a class decorator passes `noProcessEnv`.
 *
 * The KNOWN GAP test asserts today's behaviour; fixing 0307 turns it red. It asserts the method's
 * read IS reported, so it cannot pass over a rule that reports nothing.
 */
const SOURCE = [
  '@Module({ path: process.env.CLASS_DECORATOR })', // 1
  'export class AppModule extends Base(process.env.HERITAGE) {', // 2
  // The computed name comes first: after `dep = 1` with no semicolon, `[…]` on the next line
  // would parse as an element access on the `1`, not as a member name.
  '  [process.env.COMPUTED_KEY] = 1', // 3
  '  @Inject(process.env.MEMBER_DECORATOR) dep = 1', // 4
  '  withParam(@Inject(process.env.PARAMETER_DECORATOR) x: unknown) { return x }', // 5
  '  method() { return process.env.METHOD }', // 6
  '}', // 7
  '',
].join('\n')

function project(): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile('/src/app.module.ts', SOURCE)
  return {
    tsConfigPath: '/tsconfig.json',
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

describe('bug 0307: class body rules skip class code outside its members', () => {
  it('KNOWN GAP — a class body rule does not read decorator arguments, computed member names or the extends expression', () => {
    const result = classes(project())
      .should()
      .satisfy(noProcessEnv())
      .rule({ id: 'test/0307-outside-members' })
      .violations()

    const lines = result.map((v) => /at line (\d+)/.exec(v.message)?.[1] ?? '?')
    expect(lines).toEqual(['6'])
  })
})
