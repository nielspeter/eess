import { walkFiles } from '@nielspeter/eess/internal'
import { ArchConfigError, parseExclusionComments } from '@nielspeter/eess'
import { existsSync, readFileSync } from 'node:fs'
import { join, posix, sep } from 'node:path'
import picomatch from 'picomatch'
import { buildDocument, type MdDocument } from './model/document.js'
import { parseMarkdown } from './model/prose.js'
import { registerCorpusInternals } from './model/corpus-internals.js'

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
  const paths = walkFiles(root, root, new Set(BUILTIN_IGNORE))
  return assembleCorpus(root, paths, (rel) => readFileSync(join(root, rel), 'utf8'), options)
}

/** What `assembleCorpus` reads from either constructor's options. */
interface AssembleOptions {
  readonly roots: readonly string[]
  readonly frozen?: readonly string[]
  readonly ignore?: readonly string[]
  readonly expectEmptyRoots?: readonly string[]
}

/**
 * Everything a corpus is after its file list is known (plan 0455): the root checks, the documents,
 * the index and the registered internals. `corpus()` and `corpusFromText()` both end here, so the
 * two resolve by one code path and differ only in where `paths` and `read` come from.
 */
function assembleCorpus(
  root: string,
  paths: readonly string[],
  read: (relPath: string) => string,
  options: AssembleOptions,
): Corpus {
  const matchesRoot = picomatch([...options.roots])
  const matchesFrozen = picomatch([...(options.frozen ?? DEFAULT_FROZEN)])
  const matchesIgnore =
    options.ignore && options.ignore.length > 0 ? picomatch([...options.ignore]) : () => false

  const fileIndex = new Set(paths)

  // Bug 0465: a root that matched no file contributed nothing and was
  // reported nowhere, so in a corpus of several roots one typo silently halved
  // what every rule judged. Refused here, once, naming each dead root and why:
  // one authored mistake, one finding, through every door that loads a corpus
  // (ADR-009, refuse and say so).
  const declaredEmpty = new Set(options.expectEmptyRoots ?? [])
  const declarationFaults = declaredEmptyFaults(options.roots, declaredEmpty, paths, matchesIgnore)
  if (declarationFaults.length > 0) {
    throw new ArchConfigError('corpus', declarationFaults.join(' '))
  }
  const dead = options.roots.flatMap((glob) => {
    if (declaredEmpty.has(glob)) return []
    const why = deadRootReason(glob, paths, matchesIgnore)
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

  const documents: MdDocument[] = paths
    .filter((rel) => rel.endsWith('.md') && matchesRoot(rel) && !matchesIgnore(rel))
    .map((rel) => {
      const text = read(rel)
      const tree = parseMarkdown(text)
      return buildDocument({
        file: join(root, rel),
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
  // Kept so `resolveLink` can say why an existing file was not loaded (plan 0404),
  // and so a pointer's target is read where the corpus read its documents (plan 0455).
  registerCorpusInternals(loaded, { inRoots: matchesRoot, ignored: matchesIgnore, read })
  return loaded
}

/**
 * Configuration for a corpus built from text. The same as {@link CorpusOptions}, except that
 * `roots` is optional and there is no `cwd`: the files are the map's keys.
 */
export interface TextCorpusOptions {
  /** Globs selecting the documents. Defaults to every `.md` path in `files`. */
  readonly roots?: readonly string[]
  /** As `corpus()`'s `frozen`, default included. */
  readonly frozen?: readonly string[]
  /** As `corpus()`'s `ignore`: matching paths stay in the index and are not loaded. */
  readonly ignore?: readonly string[]
  /** As `corpus()`'s `expectEmptyRoots`. */
  readonly expectEmptyRoots?: readonly string[]
  /**
   * The absolute root documents report in `file`. Must not exist on disk: the kernel reads a
   * violating file from disk by that path, so a real directory would let a real file stand in for
   * the text. Defaults to `/__eess_text_corpus__`.
   */
  readonly root?: string
}

/**
 * A corpus built from text, for tests (plan 0455). `files` maps repo-relative POSIX paths to their
 * text: the documents, and any other file a link or pointer names. It is `corpus()` with the walk
 * swapped out, so links, pointers and every rule resolve as they would over the same files on disk.
 *
 * What cannot behave as on disk is refused with an `ArchConfigError`, never silently different:
 * a waiver directive in a loaded document (the kernel reads waivers from disk, so it would not
 * apply), a path that is not one canonical repo-relative path, a path that is also a directory of
 * another, a path under a directory `corpus()` never walks, and a `root` that exists.
 */
export function corpusFromText(
  files: Readonly<Record<string, string>>,
  options: TextCorpusOptions = {},
): Corpus {
  const root = options.root ?? join(sep, '__eess_text_corpus__')
  if (existsSync(root)) {
    throw new ArchConfigError(
      'corpusFromText',
      `corpusFromText: root '${root}' exists on disk — the kernel reads a violating document's ` +
        `waivers from disk by its path, so a real file there would stand in for the text. ` +
        `Name a root that does not exist, or use corpus() over a fixture.`,
    )
  }
  // Sorted, so the document order does not depend on how the caller built the map.
  const paths = Object.keys(files).sort()
  refuseUnlessCanonical(paths)
  const roots = options.roots ?? paths.filter((p) => p.endsWith('.md'))
  // Only ever called with a path from the map's own keys, so `?? ''` is unreachable; it is the
  // typed way to say so (ADR-005), and fail-closed should that stop holding: an empty text gives a
  // pointer into it a `stale` finding, never a pass.
  const read = (rel: string): string => files[rel] ?? ''
  const loaded = assembleCorpus(root, paths, read, { ...options, roots })
  for (const doc of loaded.documents()) refuseWaivers(doc)
  return loaded
}

/**
 * The path refusals of `corpusFromText`: each key has one repo-relative meaning, is not also a
 * directory of another key, and lies where `corpus()` would walk.
 */
function refuseUnlessCanonical(paths: readonly string[]): void {
  const directories = new Map<string, string>()
  for (const p of paths) {
    const why = notCanonical(p)
    if (why !== undefined) {
      throw new ArchConfigError(
        'corpusFromText',
        `corpusFromText: '${p}' ${why} — key every file by its repo-relative POSIX path, as corpus() indexes it (e.g. 'docs/guide.md').`,
      )
    }
    const segments = p.split('/')
    const ignoredDir = segments.slice(0, -1).find((s) => BUILTIN_IGNORE.includes(s))
    if (ignoredDir !== undefined) {
      throw new ArchConfigError(
        'corpusFromText',
        `corpusFromText: '${p}' lies under '${ignoredDir}/', a directory corpus() never walks — ` +
          `a test over it would pass on a file CI cannot see. Move it, or leave it out.`,
      )
    }
    for (let i = 1; i < segments.length; i++) {
      const dir = segments.slice(0, i).join('/')
      if (!directories.has(dir)) directories.set(dir, p)
    }
  }
  for (const p of paths) {
    const under = directories.get(p)
    if (under !== undefined) {
      throw new ArchConfigError(
        'corpusFromText',
        `corpusFromText: '${p}' is a file and also the directory of '${under}' — on disk one path ` +
          `cannot be both. Rename one of them.`,
      )
    }
  }
}

/** Why a key is not one canonical repo-relative POSIX path, or `undefined`. */
function notCanonical(p: string): string | undefined {
  if (p === '') return 'is empty'
  if (p.includes('\\')) return 'contains a backslash'
  if (p.startsWith('/') || /^[A-Za-z]:/.test(p)) return 'is absolute'
  if (p.split('/').includes('..')) return "contains '..'"
  if (p.startsWith('./')) return "starts with './'"
  if (posix.normalize(p) !== p || p.endsWith('/')) return 'is not normalised'
  return undefined
}

/**
 * Refuse a loaded document holding a waiver directive. The kernel reads waivers from the violating
 * file on disk, and a text corpus's files are not there, so the waiver would silently not apply.
 * This is the kernel's own call, `parseExclusionComments(text, file)` with no options, so what is
 * refused is exactly what the kernel would read (ADR-012): an exclusion, which would apply on disk,
 * or a warning, which would be reported there.
 */
function refuseWaivers(doc: MdDocument): void {
  const { exclusions, warnings } = parseExclusionComments(doc.text, doc.file)
  const first = [...exclusions, ...warnings].sort((a, b) => a.line - b.line)[0]
  if (first === undefined) return
  throw new ArchConfigError(
    'corpusFromText',
    `corpusFromText: '${doc.relPath}' line ${String(first.line)} holds a waiver directive, which ` +
      `the kernel reads from disk and would not find for a text corpus, so it would silently not ` +
      `apply. Test waivers with corpus() over a fixture.`,
  )
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
