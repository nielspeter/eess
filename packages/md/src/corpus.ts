import { walkFiles } from '@nielspeter/eess/internal'
import { ArchConfigError } from '@nielspeter/eess'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import picomatch from 'picomatch'
import { buildDocument, type MdDocument } from './model/document.js'
import { parseMarkdown } from './model/prose.js'
import { registerCorpusMatchers } from './model/resolve-link.js'

/**
 * Configuration for a markdown corpus.
 */
export interface CorpusOptions {
  /** Globs (repo-relative, POSIX) selecting the markdown files to load, e.g. `['docs/**']`. */
  readonly roots: readonly string[]
  /**
   * Globs marking frozen folders — historical records held to their own time
   * rather than to today's code.
   *
   * What this actually does, stated after the previous wording was measured
   * false (bug 0253): a frozen document's LINKS are still checked, and its code
   * pointers are excluded from `pointers().areLive()` — so they are not examined
   * at all. They are not "reported but never failed"; nothing reports them.
   * A frozen record also cannot answer a declared relation: `links().haveLiveTargets()`
   * drops a link into one, and `beLinkedBack()` reports it as frozen without it
   * (plan 0406).
   *
   * Defaults to the near-universal `completed`/`archived`; extend for your
   * project's lifecycle folders (`delivered`, `wont-do`, …).
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

/**
 * Load a markdown corpus. Walks `roots` from `cwd`, parses each `.md` file with
 * GFM enabled, and records frozen membership per file. The full repo file tree
 * is indexed so later phases can resolve code pointers and cross-links.
 */
export function corpus(options: CorpusOptions): Corpus {
  const root = options.cwd ?? process.cwd()
  const ignoreDirs = new Set(BUILTIN_IGNORE)

  const allFiles: string[] = []
  const allFilesWalked = walkFiles(root, root, ignoreDirs)
  allFiles.push(...allFilesWalked)

  const matchesRoot = picomatch([...options.roots])
  const matchesFrozen = picomatch([...(options.frozen ?? DEFAULT_FROZEN)])
  const matchesIgnore =
    options.ignore && options.ignore.length > 0 ? picomatch([...options.ignore]) : () => false

  const fileIndex = new Set(allFiles)

  // Bug 0465: a root that matches no file contributed nothing and was reported
  // nowhere, so in a corpus of several roots one typo silently halved what every
  // rule judged. Refused here, once, naming each dead root: one authored mistake,
  // one finding, through every door that loads a corpus (ADR-009, refuse and say
  // so). A root that matches files but no Markdown is not dead.
  const deadRoots = options.roots.filter((glob) => {
    const matches = picomatch(glob)
    return !allFiles.some((rel) => matches(rel) && !matchesIgnore(rel))
  })
  // Only when another root does load: a corpus whose every root is dead loads
  // nothing at all, which is an empty source the rules already report through
  // their own receipts (ADR-010 §3), and gates build such corpora on purpose to
  // test exactly that report. One dead root beside live ones is what was silent.
  if (deadRoots.length > 0 && deadRoots.length < options.roots.length) {
    const named = deadRoots.map((g) => `'${g}'`).join(', ')
    throw new ArchConfigError(
      'corpus',
      `corpus root${deadRoots.length > 1 ? 's' : ''} ${named} ${deadRoots.length > 1 ? 'match' : 'matches'} no file ` +
        `under ${root}, so ${deadRoots.length > 1 ? 'they' : 'it'} would load nothing and every rule over this ` +
        `corpus would judge less than you named. Correct the glob, or remove the root.`,
    )
  }

  const documents: MdDocument[] = allFiles
    .filter((rel) => rel.endsWith('.md') && matchesRoot(rel) && !matchesIgnore(rel))
    .map((rel) => {
      const abs = join(root, rel)
      const text = readFileSync(abs, 'utf8')
      const tree = parseMarkdown(text)
      return buildDocument({
        file: abs,
        relPath: rel,
        frozen: matchesFrozen(rel),
        text,
        root: tree,
      })
    })

  const loaded: Corpus = {
    documents: () => documents,
    root,
    fileIndex,
  }
  // Kept so `resolveLink` can say why an existing file was not loaded (plan 0404).
  registerCorpusMatchers(loaded, { inRoots: matchesRoot, ignored: matchesIgnore })
  return loaded
}
