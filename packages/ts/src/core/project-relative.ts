/**
 * A workspace has no single root — plan 0148.
 *
 * `workspace([a, b])` sets `ArchProject.tsConfigPath` to the alphabetically
 * first config, so resolving "the project root" from it silently meant *that
 * one package*: on a two-package workspace, `'src/api/**'` would match
 * `packages/alpha` and not `packages/beta`, and adding a package named `aaa`
 * would change which one it meant.
 *
 * So a file resolves against **the root that contains it**, and every root a
 * project was loaded from is kept. For a single-tsconfig `project()` there is
 * one root, and behaviour is unchanged.
 *
 * `isAnchored`/`isProjectRelative` (the pure glob-syntax half of this module
 * in ts-archunit) already live in `@nielspeter/eess` — re-exported here so a
 * caller of this module gets the whole family from one import.
 */
import type { Project as TsMorphProject, SourceFile } from 'ts-morph'
import { registerCacheReset } from '@nielspeter/eess'
export { isAnchored, isProjectRelative } from '@nielspeter/eess'

/**
 * Every directory a project was loaded from, by ts-morph `Project`.
 *
 * A `WeakMap` on the ts-morph project, because a predicate sees only an
 * element: `sourceFile.getProject()` is the one handle both a predicate and a
 * slice resolver can reach, and ts-morph itself records only the primary
 * config's path on `getCompilerOptions().configFilePath`.
 */
let rootsByProject = new WeakMap<TsMorphProject, readonly string[]>()
registerCacheReset(() => {
  rootsByProject = new WeakMap<TsMorphProject, readonly string[]>()
})

/**
 * Record the directories a project was loaded from.
 *
 * Load-bearing for `workspace()`, which has several roots. For a
 * single-tsconfig `project()` it is defence in depth and not independently
 * observable: `rootOf` falls through to ts-morph's `configFilePath`, which
 * agrees.
 */
export function registerProjectRoots(
  tsMorphProject: TsMorphProject,
  tsConfigPaths: readonly string[],
): void {
  const roots = tsConfigPaths
    .map((configPath) => rootFromTsConfigPath(configPath))
    .filter((root): root is string => root !== undefined)
  if (roots.length > 0) rootsByProject.set(tsMorphProject, roots)
}

/**
 * The project root implied by a tsconfig path.
 *
 * Preferred wherever the caller holds the `ArchProject`, because it is the
 * path the user named rather than what ts-morph recorded —
 * `getCompilerOptions().configFilePath` is `undefined` for an in-memory
 * project even when the `ArchProject` carries a perfectly good path.
 */
export function rootFromTsConfigPath(tsConfigPath: string): string | undefined {
  if (tsConfigPath === '') return undefined
  const normalized = tsConfigPath.replaceAll('\\', '/')
  const lastSlash = normalized.lastIndexOf('/')
  if (lastSlash === -1) return undefined
  // A tsconfig AT the filesystem root gives `'/'`, not `''` — `''` would
  // overload one value with two meanings: "no root known" and "the root is
  // `/`". Reachable in a container that mounts the repository at `/`.
  return lastSlash === 0 ? '/' : normalized.slice(0, lastSlash)
}

/** The prefix a path under `root` starts with. `'/'` is its own prefix. */
function prefixOf(root: string): string {
  return root === '/' ? '/' : `${root}/`
}

/**
 * The root that contains this file — the registered root that is a real
 * ancestor of its path, longest match first, so a nested package's tsconfig
 * wins over the repository's.
 */
export function rootOf(sourceFile: SourceFile, fallbackTsConfigPath?: string): string | undefined {
  const filePath = sourceFile.getFilePath().replaceAll('\\', '/')

  const registered = rootsByProject.get(sourceFile.getProject())
  if (registered !== undefined) {
    // Roots WERE registered for this project (a real `workspace()`) — fail
    // closed here (ADR-009) rather than falling through to the generic
    // fallback below. That fallback resolves to the tie-break-winner's own
    // tsconfig for a `workspace()`-built project, which is a specific,
    // plausible-looking, WRONG answer for a file outside every registered
    // package (a shared root-level `.d.ts`, a broad `include`/`references`
    // reaching outside a package's own directory) — exactly the silent
    // mis-scoping this module exists to eliminate, just relocated to the
    // edges. `fallbackTsConfigPath` doesn't rescue this either: for a
    // `workspace()` caller it is typically the primary config's own path
    // (see `resolveByDefinition`'s `project.tsConfigPath`), so honoring it
    // here would reintroduce the same bug through the back door.
    const containing = registered
      .filter((root) => filePath.startsWith(prefixOf(root)))
      .sort((a, b) => b.length - a.length)
    return containing[0]
  }

  // A project built without going through `project()`/`workspace()` — a test
  // double, or an in-memory project, where ts-morph records no config path.
  if (fallbackTsConfigPath !== undefined) return rootFromTsConfigPath(fallbackTsConfigPath)
  const configFilePath = sourceFile.getProject().getCompilerOptions().configFilePath
  return typeof configFilePath === 'string' ? rootFromTsConfigPath(configFilePath) : undefined
}

/**
 * `absolutePath` relative to the project root, or `undefined` when it sits
 * outside the root or the root is unknown.
 *
 * Never `path.relative`, which emits `../../..` for a path above the root and
 * so encodes the root's depth — machine-dependent.
 */
export function relativeToRoot(
  sourceFile: SourceFile,
  absolutePath: string,
  fallbackTsConfigPath?: string,
): string | undefined {
  const root = rootOf(sourceFile, fallbackTsConfigPath)
  if (root === undefined) return undefined
  const prefix = prefixOf(root)
  return absolutePath.startsWith(prefix) ? absolutePath.slice(prefix.length) : undefined
}
