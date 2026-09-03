import { readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/**
 * Recursive file discovery, shared by the dialects that read a directory tree
 * rather than a TypeScript project.
 *
 * `eess-md` and `eess-crossvalidate` each carried a copy of this — measured at
 * 99% similar, differing only in whether the ignore set arrived as a parameter
 * or sat in a module constant. `toPosix` was duplicated alongside it, byte for
 * byte.
 *
 * Kernel-safe: node builtins only, no project and no AST.
 */

/** Path separators normalised to `/`, so a corpus reads the same on Windows. */
export function toPosix(p: string): string {
  return sep === '/' ? p : p.split(sep).join('/')
}

/**
 * Every file under `dir`, as paths relative to `root`, POSIX-separated.
 *
 * An unreadable directory — permissions, a dangling symlink — is skipped rather
 * than thrown from: a corpus walk that dies on one bad entry reports nothing
 * about the tree it could read, which is the worse failure for a gate.
 */
export function walkFiles(dir: string, root: string, ignoreDirs: ReadonlySet<string>): string[] {
  const acc: string[] = []
  walkInto(dir, root, ignoreDirs, acc)
  return acc
}

function walkInto(dir: string, root: string, ignoreDirs: ReadonlySet<string>, acc: string[]): void {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch (err) {
    void err // unreadable dir (permissions, dangling symlink) — deliberately skipped
    return
  }
  for (const e of entries) {
    const abs = join(dir, e.name)
    if (e.isDirectory()) {
      if (ignoreDirs.has(e.name)) continue
      walkInto(abs, root, ignoreDirs, acc)
    } else if (e.isFile()) {
      acc.push(toPosix(relative(root, abs)))
    }
  }
}
