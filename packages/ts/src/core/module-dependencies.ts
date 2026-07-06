import { Node } from 'ts-morph'
import type { ImportDeclaration, ExportDeclaration, SourceFile } from 'ts-morph'
import { isTypeOnlyImport } from './import-options.js'

/**
 * A module dependency edge — an `import … from` or an `export … from` re-export.
 */
export type DependencyDecl = ImportDeclaration | ExportDeclaration

/**
 * Every module dependency edge of a source file: its import declarations plus
 * its `export … from` re-exports.
 *
 * A re-export is a real dependency — `export { x } from './y'` makes this module
 * depend on `./y` exactly as an `import` would — so dependency-direction rules
 * (`importFrom` / `notImportFrom` / `onlyImportFrom` / `dependOn`) must see it.
 * ts-morph's `getImportDeclarations()` alone misses re-exports, which lets a
 * forbidden edge hide behind `export … from` and pass a rule that should fail.
 * A bare `export { x }` with no `from` has no target module and is skipped.
 */
export function getDependencyDecls(sf: SourceFile): DependencyDecl[] {
  const reexports = sf
    .getExportDeclarations()
    .filter((d) => d.getModuleSpecifierValue() !== undefined)
  return [...sf.getImportDeclarations(), ...reexports]
}

/**
 * Resolve a dependency edge to an absolute path (when the target resolves to a
 * file in the project) or its raw specifier (for external packages).
 */
export function resolveDependencyPath(decl: DependencyDecl): string {
  const resolved = decl.getModuleSpecifierSourceFile()
  return resolved ? resolved.getFilePath() : (decl.getModuleSpecifierValue() ?? '')
}

/**
 * Is this dependency edge type-only? `import type …` / `export type … from …`,
 * or an import whose every named specifier is inline `type`.
 */
export function isTypeOnlyDependency(decl: DependencyDecl): boolean {
  return Node.isImportDeclaration(decl) ? isTypeOnlyImport(decl) : decl.isTypeOnly()
}
