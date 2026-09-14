import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { modules } from '../../src/builders/module-rule-builder.js'
import { functions } from '../../src/builders/function-rule-builder.js'
import { classes } from '../../src/builders/class-rule-builder.js'
import { moduleNoProcessEnv, functionNoProcessEnv, noProcessEnv } from '../../src/rules/security.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0297 — every `noProcessEnv` variant was `notContain(access('process.env'))`, a text
 * match on one `PropertyAccessExpression`, so `process['env']` and `globalThis.process.env`
 * passed. The rules now read the name structurally, as 0301's rules read `eval` and `console`.
 *
 * Each variant has its own test, so a fix to one reds only its own. Each expectation is the
 * sorted list of findings, so a read reported twice shows, and each excludes `settings.env` —
 * an `env` that is not the environment — so a rule that reports every `.env` cannot pass.
 * Every spelling the rules claim is in the fixture: dot, bracket, template key, optional chain,
 * and a global object both as `globalThis` and as `global`. `import.meta.env` is a bundler
 * convention outside the rule's name, pinned by a CONTROL.
 *
 * An environment read through a local binding — `const { env } = process`,
 * `import { env } from 'node:process'` — is not covered; it is pinned under bug 0305. A read
 * through a cast or a non-null assertion is not covered either; that is bug 0308.
 */
const GLOBALS = [
  'declare var process: { env: Record<string, string | undefined> }',
  'declare const settings: { env: Record<string, string | undefined> }',
  '',
].join('\n')

// Lines 1–7 read the environment. Line 8 is another object's `env`; line 9 is `import.meta.env`.
const MODULE = [
  'export function viaDot() { return process.env.A }',
  "export function viaBracket() { return process['env'].B }",
  'export function viaGlobalThis() { return globalThis.process.env.C }',
  "export function viaGlobalBracket() { return globalThis['process']['env'].D }",
  'export function viaOptional() { return process?.env.E }',
  'export function viaTemplateKey() { return process[`env`].F }',
  "export function viaGlobal() { return global['process'].env.G }",
  'export function viaOtherObject() { return settings.env.H }',
  'export function viaImportMeta() { return import.meta.env.I }',
  '',
].join('\n')

// Lines 2–8 read the environment; line 9 is another object's `env`.
const CLASS = [
  'export class Config {',
  '  dot() { return process.env.A }',
  "  bracket() { return process['env'].B }",
  '  viaGlobalThis() { return globalThis.process.env.C }',
  "  viaGlobalBracket() { return globalThis['process']['env'].D }",
  '  viaOptional() { return process?.env.E }',
  '  viaTemplateKey() { return process[`env`].F }',
  "  viaGlobal() { return global['process'].env.G }",
  '  viaOtherObject() { return settings.env.H }',
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

function linesNamedIn(result: readonly { message: string }[]): string[] {
  return result
    .map((v) => /at line (\d+)/.exec(v.message)?.[1] ?? '?')
    .sort((a, b) => Number(a) - Number(b))
}

describe('bug 0297: noProcessEnv reads process.env however it is spelled', () => {
  it('functionNoProcessEnv reports process.env read through a bracket or a global object', () => {
    const result = functions(envProject())
      .that()
      .resideInFile('**/env.ts')
      .should()
      .satisfy(functionNoProcessEnv())
      .rule({ id: 'test/0297-function' })
      .violations()

    expect(result.map((v) => v.element).sort()).toEqual([
      'viaBracket',
      'viaDot',
      'viaGlobal',
      'viaGlobalBracket',
      'viaGlobalThis',
      'viaOptional',
      'viaTemplateKey',
    ])
  })

  it('moduleNoProcessEnv reports process.env read through a bracket or a global object', () => {
    const result = modules(envProject())
      .that()
      .resideInFile('**/env.ts')
      .should()
      .satisfy(moduleNoProcessEnv())
      .rule({ id: 'test/0297-module' })
      .violations()

    expect(linesNamedIn(result)).toEqual(['1', '2', '3', '4', '5', '6', '7'])
  })

  it('noProcessEnv on a class reports process.env read through a bracket or a global object', () => {
    const result = classes(envProject())
      .that()
      .resideInFile('**/config.ts')
      .should()
      .satisfy(noProcessEnv())
      .rule({ id: 'test/0297-class' })
      .violations()

    expect(linesNamedIn(result)).toEqual(['2', '3', '4', '5', '6', '7', '8'])
  })

  it('CONTROL — import.meta.env is outside noProcessEnv', () => {
    const result = functions(envProject())
      .that()
      .resideInFile('**/env.ts')
      .should()
      .satisfy(functionNoProcessEnv())
      .rule({ id: 'test/0297-import-meta' })
      .violations()

    expect(result.map((v) => v.element)).not.toContain('viaImportMeta')
  })
})
