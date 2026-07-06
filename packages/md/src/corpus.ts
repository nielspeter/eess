import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfm } from 'micromark-extension-gfm'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import picomatch from 'picomatch'
import { buildDocument, type MdDocument } from './model/document.js'

/**
 * Configuration for a markdown corpus.
 */
export interface CorpusOptions {
  /** Globs (repo-relative, POSIX) selecting the markdown files to load, e.g. `['docs/**']`. */
  readonly roots: readonly string[]
  /**
   * Globs marking frozen folders — historical records whose drift is reported
   * but never failed. Defaults to the near-universal `completed`/`archived`;
   * extend for your project's lifecycle folders (`delivered`, `wont-do`, …).
   */
  readonly frozen?: readonly string[]
  /**
   * Directories/globs never walked (build output, deps, VCS). Merged with a
   * built-in set (`node_modules`, `.git`, `dist`, `coverage`).
   */
  readonly ignore?: readonly string[]
  /** Repo root the globs and pointers resolve against. Defaults to `process.cwd()`. */
  readonly cwd?: string
}

/**
 * A loaded markdown corpus — the "project" handle passed to `docs()`, `links()`,
 * and `pointers()`. Analogous to `project()` (TS) and `diagram()` (Mermaid).
 */
export interface Corpus {
  /** All loaded documents. */
  documents(): MdDocument[]
  /** Repo root the corpus resolves against. */
  readonly root: string
  /** Every file path under the repo root (repo-relative, POSIX) — for pointer/link resolution. */
  readonly fileIndex: ReadonlySet<string>
}

const DEFAULT_FROZEN = ['**/completed/**', '**/archived/**']
const BUILTIN_IGNORE = ['node_modules', '.git', 'dist', 'coverage', '.output', '.nuxt', '.vercel']

function toPosix(p: string): string {
  return sep === '/' ? p : p.split(sep).join('/')
}

function walk(dir: string, root: string, ignoreDirs: Set<string>, acc: string[]): void {
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
      walk(abs, root, ignoreDirs, acc)
    } else if (e.isFile()) {
      acc.push(toPosix(relative(root, abs)))
    }
  }
}

/**
 * Load a markdown corpus. Walks `roots` from `cwd`, parses each `.md` file with
 * GFM enabled, and records frozen membership per file. The full repo file tree
 * is indexed so later phases can resolve code pointers and cross-links.
 */
export function corpus(options: CorpusOptions): Corpus {
  const root = options.cwd ?? process.cwd()
  const ignoreDirs = new Set(BUILTIN_IGNORE)

  const allFiles: string[] = []
  walk(root, root, ignoreDirs, allFiles)

  const matchesRoot = picomatch([...options.roots])
  const matchesFrozen = picomatch([...(options.frozen ?? DEFAULT_FROZEN)])
  const matchesIgnore =
    options.ignore && options.ignore.length > 0 ? picomatch([...options.ignore]) : () => false

  const fileIndex = new Set(allFiles)
  const gfmExt = gfm()
  const gfmMdast = gfmFromMarkdown()

  const documents: MdDocument[] = allFiles
    .filter((rel) => rel.endsWith('.md') && matchesRoot(rel) && !matchesIgnore(rel))
    .map((rel) => {
      const abs = join(root, rel)
      const text = readFileSync(abs, 'utf8')
      const tree = fromMarkdown(text, {
        extensions: [gfmExt],
        mdastExtensions: [gfmMdast],
      })
      return buildDocument({
        file: abs,
        relPath: rel,
        frozen: matchesFrozen(rel),
        text,
        root: tree,
      })
    })

  return {
    documents: () => documents,
    root,
    fileIndex,
  }
}
