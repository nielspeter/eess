import picomatch from 'picomatch'
import type { SourceFile } from 'ts-morph'
import type { Predicate } from '@nielspeter/eess'
import type { ImportOptions } from '../core/import-options.js'
import {
  getDependencyDecls,
  resolveDependencyPath,
  isTypeOnlyDependency,
} from '../core/module-dependencies.js'

/**
 * Resolve the dependency paths for a source file — `import … from` plus
 * `export … from` re-exports (both are dependency edges) — optionally filtering
 * out type-only edges. Returns absolute paths for resolvable targets, raw
 * specifiers for external packages.
 */
function getImportPaths(sourceFile: SourceFile, ignoreTypeImports = false): string[] {
  return getDependencyDecls(sourceFile)
    .filter((decl) => (ignoreTypeImports ? !isTypeOnlyDependency(decl) : true))
    .map(resolveDependencyPath)
}

/**
 * Matches modules that import from a path matching any of the given globs.
 *
 * The globs are matched against resolved absolute import paths.
 * For external (non-resolvable) imports, they match against the raw specifier.
 *
 * @example
 * modules(p).that().importFrom('** /infrastructure/**')
 * modules(p).that().importFrom('fastify', 'knex', 'bullmq')
 */
export function importFrom(globs: string[], options: ImportOptions): Predicate<SourceFile>
export function importFrom(...globs: string[]): Predicate<SourceFile>
export function importFrom(...args: [string[], ImportOptions] | string[]): Predicate<SourceFile> {
  // ADR-005: as casts required — TS cannot narrow tuple union rest params after Array.isArray
  // eess-exclude eess/adr005-no-type-assertions: tuple-union rest param — TS cannot narrow [string[], ImportOptions] | string[] to string[] from Array.isArray(args[0])
  const globs: string[] = Array.isArray(args[0]) ? args[0] : (args as string[])
  // eess-exclude eess/adr005-no-type-assertions: tuple-union rest param — args[1] is ImportOptions only in the [globs, options] overload
  const options = Array.isArray(args[0]) && args.length > 1 ? (args[1] as ImportOptions) : undefined
  const ignoreType = options?.ignoreTypeImports === true
  const matchers = globs.map((g) => picomatch(g))
  return {
    description: 'import from ' + globs.map((g) => `"${g}"`).join(', '),
    test: (sourceFile) =>
      getImportPaths(sourceFile, ignoreType).some((p) => matchers.some((m) => m(p))),
  }
}

/**
 * Matches modules that do NOT import from any path matching the given globs.
 *
 * @example
 * modules(p).that().notImportFrom('** /legacy/**')
 * modules(p).that().notImportFrom('fastify', 'knex', 'bullmq')
 */
export function notImportFrom(globs: string[], options: ImportOptions): Predicate<SourceFile>
export function notImportFrom(...globs: string[]): Predicate<SourceFile>
export function notImportFrom(
  ...args: [string[], ImportOptions] | string[]
): Predicate<SourceFile> {
  // ADR-005: as casts required — TS cannot narrow tuple union rest params after Array.isArray
  // eess-exclude eess/adr005-no-type-assertions: tuple-union rest param — TS cannot narrow [string[], ImportOptions] | string[] to string[] from Array.isArray(args[0])
  const globs: string[] = Array.isArray(args[0]) ? args[0] : (args as string[])
  // eess-exclude eess/adr005-no-type-assertions: tuple-union rest param — args[1] is ImportOptions only in the [globs, options] overload
  const options = Array.isArray(args[0]) && args.length > 1 ? (args[1] as ImportOptions) : undefined
  const ignoreType = options?.ignoreTypeImports === true
  const matchers = globs.map((g) => picomatch(g))
  return {
    description: 'not import from ' + globs.map((g) => `"${g}"`).join(', '),
    test: (sourceFile) =>
      !getImportPaths(sourceFile, ignoreType).some((p) => matchers.some((m) => m(p))),
  }
}

/**
 * Matches modules that export a symbol with the given name.
 *
 * Checks the module's exported declarations for a matching name.
 *
 * @example
 * modules(p).that().exportSymbolNamed('default')
 */
export function exportSymbolNamed(name: string): Predicate<SourceFile> {
  return {
    description: `export symbol named "${name}"`,
    test: (sourceFile) => sourceFile.getExportedDeclarations().has(name),
  }
}

/**
 * Matches modules whose file path matches the given glob.
 *
 * Similar to resideInFile but semantically clearer for modules —
 * "modules that have path matching" vs "elements that reside in file".
 *
 * @example
 * modules(p).that().havePathMatching('** /services/*.ts')
 */
export function havePathMatching(glob: string): Predicate<SourceFile> {
  const isMatch = picomatch(glob)
  return {
    description: `have path matching "${glob}"`,
    test: (sourceFile) => isMatch(sourceFile.getFilePath()),
  }
}
