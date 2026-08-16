import picomatch from 'picomatch'
import type { SourceFile } from 'ts-morph'
import type { Predicate } from '@nielspeter/eess'
import { globNode, isProjectRelative } from '@nielspeter/eess'
import type { ImportOptions } from '../core/import-options.js'
import { splitGlobArgs } from '../core/import-options.js'
import { candidatesFor } from '../core/import-candidates.js'
import { edgesOf, FORWARD_EDGE_KINDS } from '../core/module-edges.js'
import { relativeToRoot, rootOf } from '../core/project-relative.js'

/**
 * Which edge kinds these predicates see.
 *
 * The **same set as the conditions** (`DEPENDENCY_KINDS` in
 * `conditions/dependency.ts`), and it has to be: `notImportFrom` is one
 * identifier with two definitions chosen by chain position, so a predicate
 * that disagreed with its own condition about what an import is would be
 * exactly the bug-0059-class divergence this file was reconciled to close.
 */
const PREDICATE_KINDS = FORWARD_EDGE_KINDS

/**
 * Every string a glob may be matched against, across every edge in the file.
 *
 * Flattened rather than grouped per edge: these predicates only ask "does ANY
 * edge match", so which edge a candidate came from is not needed. See
 * `candidatesFor` for why one edge can contribute two strings — a bare
 * package name works whether or not the package is installed.
 *
 * **Two consumers, moving subjects in opposite directions**, which is why
 * this reconciliation is in scope for both:
 *
 * - `notImportFrom` is **anti-monotone** — a file with a matching re-export
 *   now fails the predicate and drops out of the selection, so rules select
 *   FEWER subjects and report FEWER findings.
 * - `importFrom` is **monotone-increasing** — more files match, more
 *   subjects, more findings.
 */
function importCandidatePaths(sourceFile: SourceFile, ignoreTypeImports = false): string[] {
  return edgesOf(sourceFile)
    .filter((edge) => {
      if (!PREDICATE_KINDS[edge.kind]) return false
      if (!ignoreTypeImports) return true
      return !edge.typeOnly
    })
    .flatMap((edge) => [...candidatesFor(edge.specifier, edge.resolvedPath, rootOf(sourceFile))])
}

/**
 * Matches modules that import from a path matching any of the given globs.
 *
 * Each import contributes the resolved absolute path **and**, when the
 * specifier is non-relative, the specifier as written; a glob matches the
 * import if it matches either. So a bare package name works whether or not
 * the package is installed.
 *
 * @example
 * modules(p).that().importFrom('** /infrastructure/**')
 * modules(p).that().importFrom('fastify', 'knex', 'bullmq')
 */
export function importFrom(globs: string[], options: ImportOptions): Predicate<SourceFile>
export function importFrom(...globs: string[]): Predicate<SourceFile>
export function importFrom(...args: [string[], ImportOptions] | string[]): Predicate<SourceFile> {
  const { globs, options } = splitGlobArgs(args)
  const ignoreType = options?.ignoreTypeImports === true
  const matchers = globs.map((g) => picomatch(g))
  return {
    description: 'import from ' + globs.map((g) => `"${g}"`).join(', '),
    test: (sourceFile) =>
      importCandidatePaths(sourceFile, ignoreType).some((p) => matchers.some((m) => m(p))),
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
  const { globs, options } = splitGlobArgs(args)
  const ignoreType = options?.ignoreTypeImports === true
  const matchers = globs.map((g) => picomatch(g))
  return {
    description: 'not import from ' + globs.map((g) => `"${g}"`).join(', '),
    test: (sourceFile) =>
      !importCandidatePaths(sourceFile, ignoreType).some((p) => matchers.some((m) => m(p))),
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
 * An unanchored, project-relative glob (e.g. `'src/services/*.ts'`, no
 * leading `**\/`) also matches against the path named from the file's own
 * project root — in a `workspace()`, that's each package's own root, not
 * only the primary tsconfig's.
 *
 * @example
 * modules(p).that().havePathMatching('** /services/*.ts')
 */
export function havePathMatching(glob: string): Predicate<SourceFile> {
  const isMatch = picomatch(glob)
  const relative = isProjectRelative(glob)
  return {
    globs: globNode({ glob, kind: 'file-path', base: relative ? 'normalized' : 'absolute' }),
    description: `have path matching "${glob}"`,
    test: (sourceFile) => {
      const filePath = sourceFile.getFilePath()
      if (isMatch(filePath)) return true
      if (!relative) return false
      const fromRoot = relativeToRoot(sourceFile, filePath)
      return fromRoot !== undefined && isMatch(fromRoot)
    },
  }
}
