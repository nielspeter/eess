import { readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import picomatch from 'picomatch'
import type { Selection, ElementInfo } from '@nielspeter/eess'

/**
 * A file matched by [[files]]. Its content is **not** read — this is a
 * path-selection brick. Callers that need the file's content (e.g. parse a
 * `package.json`) read `absPath` inside their own `identify`.
 */
export interface FileEntry {
  /** Repo-relative path, POSIX separators, e.g. `adr/001-toolchain.md`. */
  readonly path: string
  /** Absolute path — for callers that read content in `identify`. */
  readonly absPath: string
}

/** Options for [[files]]. */
export interface FilesOptions {
  /** Glob(s) selecting files, matched against repo-relative POSIX paths. */
  readonly glob: string | readonly string[]
  /** Root the globs resolve against. Defaults to `process.cwd()`. */
  readonly cwd?: string
  /** Globs excluded from the result (in addition to the built-in dir skips). */
  readonly ignore?: readonly string[]
  /** Display label for this side of a `correspondence()`. */
  readonly label: string
  /** Map a file to its correspondence identity (name/file/line). */
  readonly identify: (file: FileEntry) => ElementInfo
}

// Directories never walked — deps, build output, VCS. Mirrors the corpus walk.
const BUILTIN_IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'coverage',
  '.output',
  '.nuxt',
  '.vercel',
])

function toPosix(p: string): string {
  return sep === '/' ? p : p.split(sep).join('/')
}

function walk(dir: string, root: string, acc: string[]): void {
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
      if (BUILTIN_IGNORE_DIRS.has(e.name)) continue
      walk(abs, root, acc)
    } else if (e.isFile()) {
      acc.push(toPosix(relative(root, abs)))
    }
  }
}

/**
 * Turn a set of files into a `Selection` — the recurring "the code side is a
 * set of files" case (an ADR index binds to `adr/*.md`, a manifest binds to
 * `packages/*`). Feed the result to `correspondence()` as one side.
 *
 * Path selection only: the file's content is not read. When a file's identity
 * comes from its content (a `package.json`'s `name`), read `absPath` inside
 * `identify`. Results are sorted by path for deterministic output.
 *
 * ```ts
 * const adrFiles = files({
 *   glob: 'adr/*.md',
 *   label: 'ADR file',
 *   identify: (f) => ({ name: numberOf(f.path), file: f.path, line: 1 }),
 * })
 * ```
 */
export function files(opts: FilesOptions): Selection<FileEntry> {
  const root = opts.cwd ?? process.cwd()
  const all: string[] = []
  walk(root, root, all)

  const globs = typeof opts.glob === 'string' ? [opts.glob] : [...opts.glob]
  const matchesGlob = picomatch(globs)
  const matchesIgnore =
    opts.ignore && opts.ignore.length > 0 ? picomatch([...opts.ignore]) : () => false

  const elements: FileEntry[] = all
    .filter((rel) => matchesGlob(rel) && !matchesIgnore(rel))
    .sort()
    .map((rel) => ({ path: rel, absPath: join(root, rel) }))

  return { elements, label: opts.label, identify: opts.identify }
}
