/**
 * Every path a glob could legitimately match in a project — the shape of the
 * data, not how to build it.
 *
 * `PathUniverse` and `viewsFor` are pure: given the materialized string
 * arrays, they need no `ArchProject`/ts-morph and stay in the kernel. Only
 * the MATERIALIZER — walking a real project's source files into this shape —
 * needs the dialect's own project type, and lives in that dialect (e.g.
 * `packages/ts/src/core/path-universe.ts`'s `pathUniverse()`).
 */
export interface PathUniverse {
  /** Absolute paths of every file in the project. */
  readonly filePaths: readonly string[]
  /**
   * Immediate parent directories only.
   *
   * Not all ancestors. A directory-matching predicate typically tests
   * `filePath.substring(0, filePath.lastIndexOf('/'))` — the immediate
   * parent and nothing else — so an all-ancestors set is not a harmless
   * over-approximation, it is a false green: many ancestors are no file's
   * direct parent, so a glob naming one of those can never select anything
   * while an all-ancestors universe would call it satisfiable.
   */
  readonly parentDirs: readonly string[]
  /** `filePaths` relative to the tsconfig directory, for message wording. */
  readonly tsconfigRelativeFilePaths: readonly string[]
  /** `parentDirs` relative to the tsconfig directory, for message wording. */
  readonly tsconfigRelativeParentDirs: readonly string[]
}

/**
 * The views a glob of this kind is matched against.
 *
 * Satisfiability is taken against the **union** — a glob is unsatisfiable
 * only when nothing in any view matches it. That is deliberately generous,
 * so that a wrong `base` cannot make a glob look unmatched by accident. It
 * does NOT make `base` message-only: the anchor check in `syntacticFault`
 * consults it directly, and an unanchored `base: 'absolute'` glob is dead
 * regardless of what any view holds — see `GlobBase`.
 *
 * `import-target`, `specifier` and `literal` are not path kinds and have no
 * views, so they can never be found unsatisfiable here.
 */
export function viewsFor(
  universe: PathUniverse,
  kind: 'file-path' | 'parent-dir' | 'import-target' | 'specifier' | 'literal',
): readonly (readonly string[])[] {
  if (kind === 'file-path') return [universe.filePaths, universe.tsconfigRelativeFilePaths]
  if (kind === 'parent-dir') return [universe.parentDirs, universe.tsconfigRelativeParentDirs]
  return []
}
