import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { modules } from '../../src/builders/module-rule-builder.js'
import { functions } from '../../src/builders/function-rule-builder.js'
import { classes } from '../../src/builders/class-rule-builder.js'
import { moduleNoProcessEnv, functionNoProcessEnv, noProcessEnv } from '../../src/rules/security.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0297 — every `noProcessEnv` variant is `notContain(access('process.env'))`, a
 * text match on one `PropertyAccessExpression`. Four equivalent reads pass.
 *
 * The KNOWN GAP tests assert today's behaviour. Fixing 0297 turns them red: invert
 * them into red-first tests in the same change, and say so in the record. Each
 * asserts the dot form IS caught, so none can pass over a rule that catches nothing,
 * and each variant has its own test, so a fix to one variant reds only that one.
 *
 * `process` and `node:process` are declared ambiently, so the reads resolve: a fix
 * that resolves the `process` binding can be tested against this fixture as it is.
 * A fix that requires `@types/node` must load it here.
 */
const GLOBALS = [
  'declare var process: { env: Record<string, string | undefined> }',
  "declare module 'node:process' {",
  '  export const env: Record<string, string | undefined>',
  '}',
  '',
].join('\n')

// Line 1 is the dot form. Lines 2–4 and 6 are the four equivalent reads.
// Line 7 is `import.meta.env`, which is outside the rule's name.
const MODULE = [
  'export function viaDot() { return process.env.A }',
  "export function viaBracket() { return process['env'].B }",
  'export function viaDestructure() { const { env } = process; return env.C }',
  'export function viaGlobalThis() { return globalThis.process.env.D }',
  "import { env as nodeEnv } from 'node:process'",
  'export function viaNodeProcess() { return nodeEnv.E }',
  'export function viaImportMeta() { return import.meta.env.F }',
  '',
].join('\n')

// Line 3 is the dot form; lines 4–7 are the four equivalent reads.
const CLASS = [
  "import { env as nodeEnv } from 'node:process'",
  'export class Config {',
  '  dot() { return process.env.A }',
  "  bracket() { return process['env'].B }",
  '  destructure() { const { env } = process; return env.C }',
  '  viaGlobalThis() { return globalThis.process.env.D }',
  '  viaNodeProcess() { return nodeEnv.E }',
  '}',
  '',
].join('\n')

function envProject(): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile('/src/globals.d.ts', GLOBALS)
  tsm.createSourceFile('/src/env.ts', MODULE)
  tsm.createSourceFile('/src/config.ts', CLASS)
  return {
    tsConfigPath: '/tsconfig.json',
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

function linesNamedIn(result: readonly { message: string }[]): Set<string> {
  return new Set(result.map((v) => /at line (\d+)/.exec(v.message)?.[1] ?? '?'))
}

describe('bug 0297: noProcessEnv reads one spelling of an environment read', () => {
  it('KNOWN GAP — functionNoProcessEnv reports process.env.X and none of four equivalent reads', () => {
    const result = functions(envProject())
      .that()
      .resideInFile('**/env.ts')
      .should()
      .satisfy(functionNoProcessEnv())
      .rule({ id: 'test/0297-function' })
      .violations()

    expect(new Set(result.map((v) => v.element))).toEqual(new Set(['viaDot']))
  })

  it('KNOWN GAP — moduleNoProcessEnv reports process.env.X and none of four equivalent reads', () => {
    const result = modules(envProject())
      .that()
      .resideInFile('**/env.ts')
      .should()
      .satisfy(moduleNoProcessEnv())
      .rule({ id: 'test/0297-module' })
      .violations()

    expect(linesNamedIn(result)).toEqual(new Set(['1']))
  })

  it('KNOWN GAP — noProcessEnv on a class reports process.env.X and none of four equivalent reads in its methods', () => {
    const result = classes(envProject())
      .that()
      .resideInFile('**/config.ts')
      .should()
      .satisfy(noProcessEnv())
      .rule({ id: 'test/0297-class' })
      .violations()

    expect(linesNamedIn(result)).toEqual(new Set(['3']))
  })

  it('CONTROL — import.meta.env is outside noProcessEnv', () => {
    const result = functions(envProject())
      .that()
      .resideInFile('**/env.ts')
      .should()
      .satisfy(functionNoProcessEnv())
      .rule({ id: 'test/0297-import-meta' })
      .violations()

    expect(new Set(result.map((v) => v.element))).not.toContain('viaImportMeta')
  })
})
