import type { ArchProject } from './project.js'
import type { PathUniverse } from '@nielspeter/eess'

/**
 * The MATERIALIZER — walking a real project's source files into `PathUniverse`.
 *
 * `PathUniverse` and `viewsFor` are the KERNEL's, and always were by intent: the
 * kernel's own docstring says only the materializer needs the dialect's project
 * type. Both were nonetheless declared here too, byte-identically, until the
 * duplication was measured — `viewsFor` at 100%. Re-exported so this module
 * kept here as a type re-export because this dialect's public `pathUniverse()`
 * returns it. `viewsFor` is NOT re-exported — ADR-011 clause 2 forbids a dialect
 * forwarding anything from `/internal`, and its one caller imports it directly.
 */
export type { PathUniverse }

const cache = new WeakMap<ArchProject, PathUniverse>()

/**
 * The project's path universe, computed once per project.
 *
 * Memoized on the project identity, so a rule file with fifty rules pays for
 * one traversal rather than fifty.
 */
export function pathUniverse(project: ArchProject): PathUniverse {
  const cached = cache.get(project)
  if (cached) return cached

  const filePaths = project.getSourceFiles().map((sourceFile) => sourceFile.getFilePath())
  const parentDirs = [
    ...new Set(filePaths.map((filePath) => filePath.substring(0, filePath.lastIndexOf('/')))),
  ]
  const root = tsconfigDir(project.tsConfigPath)
  const universe: PathUniverse = {
    filePaths,
    parentDirs,
    tsconfigRelativeFilePaths: filePaths.map((filePath) => relativeTo(root, filePath)),
    tsconfigRelativeParentDirs: parentDirs.map((dir) => relativeTo(root, dir)),
  }
  cache.set(project, universe)
  return universe
}

/** The directory containing the tsconfig, with forward slashes and no trailing separator. */
function tsconfigDir(tsConfigPath: string): string {
  const normalized = tsConfigPath.replaceAll('\\', '/')
  const lastSlash = normalized.lastIndexOf('/')
  return lastSlash === -1 ? '' : normalized.slice(0, lastSlash)
}

/**
 * `filePath` relative to `root`, or unchanged when it sits outside.
 *
 * Deliberately not `path.relative`: that would emit `../../..` for a path
 * above the root, which encodes the root's depth — machine-dependent, and the
 * same mistake `toPortablePath` exists to avoid.
 */
function relativeTo(root: string, filePath: string): string {
  if (root === '') return filePath
  const prefix = root.endsWith('/') ? root : root + '/'
  return filePath.startsWith(prefix) ? filePath.slice(prefix.length) : filePath
}
