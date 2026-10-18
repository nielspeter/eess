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
  /**
   * Roots that are empty on purpose: a lane with no records yet, or a test fixture that writes only
   * the folder its rule reads. A named root may match no file beside live roots without being
   * refused. The declaration expires (ADR-010 §3): a named root that matches files is refused, so
   * the folder is never silently unexamined once it fills. Each name must be one of `roots`.
   */
  readonly expectEmptyRoots?: readonly string[]
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

  // Bug 0465: a root that matched no file contributed nothing and was
  // reported nowhere, so in a corpus of several roots one typo silently halved
  // what every rule judged. Refused here, once, naming each dead root and why:
  // one authored mistake, one finding, through every door that loads a corpus
  // (ADR-009, refuse and say so).
  const declaredEmpty = new Set(options.expectEmptyRoots ?? [])
  const declarationFaults = declaredEmptyFaults(
    options.roots,
    declaredEmpty,
    allFiles,
    matchesIgnore,
  )
  if (declarationFaults.length > 0) {
    throw new ArchConfigError('corpus', declarationFaults.join(' '))
  }
  const dead = options.roots.flatMap((glob) => {
    if (declaredEmpty.has(glob)) return []
    const why = deadRootReason(glob, allFiles, matchesIgnore)
    return why === undefined ? [] : [`'${glob}' ${why}`]
  })
  // Only when another root does load. A corpus whose every root is dead loads
  // nothing at all: an empty source, which gates build on purpose to test its own
  // report. Today most builders report it only as zero examined units; plan 0456
  // makes it a named empty-source finding (bug 0465's Resolution).
  // A declared-empty root counts as another root here, so a typo beside it is still named.
  if (dead.length > 0 && dead.length < options.roots.length) {
    throw new ArchConfigError(
      'corpus',
      `corpus root${dead.length > 1 ? 's' : ''} ${dead.join('; ')} — so every rule over this corpus ` +
        `would judge less than you named. Correct the glob, remove the root, or name it in ` +
        `expectEmptyRoots if it is empty on purpose.`,
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

/**
 * Why a root is dead, or `undefined`: it matches no file, or only ignored files.
 */
function deadRootReason(
  glob: string,
  allFiles: readonly string[],
  ignored: (rel: string) => boolean,
): string | undefined {
  const matches = picomatch(glob)
  const hits = allFiles.filter((rel) => matches(rel))
  if (hits.length === 0) return 'matches no file'
  if (hits.every((rel) => ignored(rel))) return 'matches only ignored files'
  // A root matching files but no Markdown is not refused: callers list code
  // globs (`src/**/*.ts`) as roots beside their documents, harmlessly. It still
  // contributes nothing, which bug 0465's Resolution records as a residual.
  return undefined
}

/**
 * What is wrong with `expectEmptyRoots` (bug 0475): a name that is not one of the roots (stale), or a
 * declared root that loads documents (expired). Each is one sentence.
 */
function declaredEmptyFaults(
  roots: readonly string[],
  declared: ReadonlySet<string>,
  allFiles: readonly string[],
  ignored: (rel: string) => boolean,
): string[] {
  const faults: string[] = []
  for (const glob of declared) {
    if (!roots.includes(glob)) {
      faults.push(
        `expectEmptyRoots names '${glob}', which is not one of this corpus's roots — remove it, or add the root.`,
      )
    } else if (loadsADocument(glob, allFiles, ignored)) {
      faults.push(
        `corpus root '${glob}' is declared empty in expectEmptyRoots, but it loads documents now — remove it from expectEmptyRoots so they are read.`,
      )
    }
  }
  return faults
}

/**
 * Whether a root loads at least one Markdown document. A declared-empty root expires on this, not on
 * matching any file: a lane holding only a `.gitkeep` is still empty of records.
 */
function loadsADocument(
  glob: string,
  allFiles: readonly string[],
  ignored: (rel: string) => boolean,
): boolean {
  const matches = picomatch(glob)
  return allFiles.some((rel) => rel.endsWith('.md') && matches(rel) && !ignored(rel))
}
