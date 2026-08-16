import type { PathUniverse } from '@nielspeter/eess'
import type { ArchProject } from './project.js'

/**
 * Materialize the project's path universe from ts-morph's own source-file
 * list, once. The pure shape and `viewsFor()` live in the kernel
 * (`@nielspeter/eess`'s `path-universe.js`); only this walk needs
 * `ArchProject`, so only this walk lives here.
 */

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
 * above the root, which encodes the root's depth — machine-dependent, and
 * exactly the mistake this module's own `discoverIdentityRoot`-adjacent
 * kernel sibling exists to avoid.
 */
function relativeTo(root: string, filePath: string): string {
  if (root === '') return filePath
  const prefix = root.endsWith('/') ? root : root + '/'
  return filePath.startsWith(prefix) ? filePath.slice(prefix.length) : filePath
}
