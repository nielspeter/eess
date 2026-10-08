import { posix } from 'node:path'
import type { ArchFix } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import type { MdDocument } from './document.js'
import type { MdLink } from './links.js'

/**
 * Options for resolving a link URL against the repo tree. Covers static-site
 * conventions (VitePress, Docusaurus, MkDocs, GitBook…) generically instead of
 * naming any tool: extensionless links resolve by trying extensions and/or a
 * directory index file.
 */
export interface LinkResolveOptions {
  /**
   * Extensions to try when the URL as written doesn't resolve, e.g. `['.md']`
   * for sites that link `./guide` meaning `./guide.md`. Tried in order.
   */
  readonly tryExtensions?: readonly string[]
  /**
   * Directory index filename to try, e.g. `'index.md'` for sites where
   * `./guide/` (or `./guide`) means `./guide/index.md`.
   */
  readonly tryIndex?: string
  /**
   * Content root for site-absolute links (leading `/`). Static-site generators
   * resolve `/page` against the site's content root, not the repo root — e.g.
   * `rootDir: 'docs'` makes `/guide` mean `docs/guide(.md)`. Repo-root
   * resolution is still tried first, so plain repo-absolute links keep working.
   */
  readonly rootDir?: string
  /**
   * Resolve a link naming a real directory (`./fixed/` or `./fixed`, with or
   * without the trailing slash — both forms occur in this repo's own corpus)
   * even when it has no index file. Correct for a repo-hosted corpus (GitHub,
   * GitLab render a directory link as its listing); wrong for a static-site
   * corpus where a bare directory is not itself a page — there, reach for
   * {@link tryIndex} instead. Off by default: this widens what "resolves"
   * means, and a link resolving that shouldn't is a false green, not a
   * convenience. Default `false`.
   *
   * A link naming a real directory always wins over an unrelated typo — if
   * `./foo` was meant as a deleted `foo.md` but a directory `foo/` happens to
   * exist at that path, it resolves as the directory. Not a new failure mode:
   * GitHub renders that link as the directory listing too, so this only
   * closes the gap between the gate and what the link actually does when
   * followed, it doesn't introduce a new way to be surprised by it.
   *
   * `resolveLink` reports a directory as its own case whatever this says; the
   * option decides whether `resolve()` accepts that case.
   */
  readonly resolveDirectories?: boolean
}

/** The parts of a link that resolution reads. Narrower than `MdLink`, so a caller can build one. */
export interface LinkToResolve {
  readonly url: string
  readonly external: boolean
  readonly doc: { readonly relPath: string }
}

/** Why an existing file is not a loaded corpus document. Every reason that applies is listed. */
export type NotInCorpusReason = 'not-markdown' | 'ignored' | 'outside-roots'

/**
 * Where a link points, as one named case (plan 0404). Each case is a different
 * fact with a different remedy, so a rule over links can say which one it met:
 *
 * - `external`: a URL with a scheme or `//`; not resolved against the repo.
 * - `self`: a pure `#anchor`, or a path back to the linking document itself.
 * - `document`: an existing, loaded corpus document, whose links are parsed.
 * - `not-in-corpus`: an existing file the corpus did not load, with every reason.
 * - `directory`: no candidate is a file, but one names a real directory.
 * - `missing`: nothing exists; `tried` lists every candidate, in order.
 */
export type LinkTarget =
  | { readonly kind: 'external' }
  | { readonly kind: 'self' }
  | { readonly kind: 'document'; readonly path: string; readonly doc: MdDocument }
  | {
      readonly kind: 'not-in-corpus'
      readonly path: string
      readonly reasons: readonly NotInCorpusReason[]
    }
  | { readonly kind: 'directory'; readonly path: string }
  | { readonly kind: 'missing'; readonly tried: readonly string[] }

/** How `corpus()` decided which files to load, kept so a resolver can say why one was not. */
interface CorpusMatchers {
  readonly inRoots: (relPath: string) => boolean
  readonly ignored: (relPath: string) => boolean
}

const matchersOf = new WeakMap<Corpus, CorpusMatchers>()

/**
 * Record how `corpus()` filtered its files. Called by `corpus()` only; a
 * `Corpus` built any other way has no matchers, and an unloaded `.md` file in
 * it is reported as `outside-roots`.
 */
export function registerCorpusMatchers(corpus: Corpus, matchers: CorpusMatchers): void {
  matchersOf.set(corpus, matchers)
}

interface CorpusIndexes {
  /** Every directory reachable from `fileIndex` (the repo root itself excluded). */
  readonly directories: ReadonlySet<string>
  /** Loaded documents by repo-relative path. */
  readonly documents: ReadonlyMap<string, MdDocument>
}

const indexesOf = new WeakMap<Corpus, CorpusIndexes>()

/**
 * The two corpus-wide indexes resolution needs, built once per corpus. Before
 * plan 0404 the directory index was rebuilt by every `resolve()` condition;
 * called per link from a custom rule it would be rebuilt per link.
 *
 * The directory index is derived from `fileIndex` rather than new I/O: each
 * indexed file's ancestors are known directories. `fileIndex` spans the whole
 * physical repo walk from `cwd`, not just the configured `roots`, so a
 * directory link can resolve against something outside any root. The repo
 * root itself (`.`) is deliberately excluded — nobody links "the whole repo".
 */
function indexes(corpus: Corpus): CorpusIndexes {
  const cached = indexesOf.get(corpus)
  if (cached !== undefined) return cached
  const directories = new Set<string>()
  for (const rel of corpus.fileIndex) {
    let dir = posix.dirname(rel)
    while (dir !== '.' && dir !== '/' && !directories.has(dir)) {
      directories.add(dir)
      dir = posix.dirname(dir)
    }
  }
  const documents = new Map<string, MdDocument>()
  for (const doc of corpus.documents()) documents.set(doc.relPath, doc)
  const built: CorpusIndexes = { directories, documents }
  indexesOf.set(corpus, built)
  return built
}

/**
 * A link URL's base repo-relative target(s), or `[]` for a pure fragment.
 * Site-absolute links (leading `/`) yield the repo-root target, then the
 * content-root target when `rootDir` is set. Throws `URIError` on malformed
 * percent-encoding; `resolveLink` turns that into `missing`.
 *
 * Exported for `linkResolves`, which labels the two site-absolute candidates
 * in its directory hint (bug 0137); not part of the package's public API.
 */
export function linkTargets(link: LinkToResolve, options: LinkResolveOptions): string[] {
  const withoutFragment = link.url.split('#')[0] ?? ''
  if (withoutFragment === '') return []
  const decoded = decodeURIComponent(withoutFragment)
  if (decoded.startsWith('/')) {
    const repoRooted = posix.normalize(decoded.replace(/^\/+/, ''))
    return options.rootDir !== undefined
      ? [repoRooted, posix.normalize(posix.join(options.rootDir, repoRooted))]
      : [repoRooted]
  }
  const base = posix.dirname(link.doc.relPath)
  return [posix.normalize(posix.join(base, decoded))]
}

/** Every repo-relative file candidate for one target, in the order they are tried. */
function candidates(target: string, options: LinkResolveOptions): string[] {
  const out = [target]
  const bare = target.replace(/\/+$/, '')
  for (const ext of options.tryExtensions ?? []) {
    out.push(bare + ext)
  }
  if (options.tryIndex !== undefined) {
    out.push(posix.join(bare, options.tryIndex))
  }
  return out
}

function fileTarget(path: string, link: LinkToResolve, corpus: Corpus): LinkTarget {
  if (path === link.doc.relPath) return { kind: 'self' }
  const doc = indexes(corpus).documents.get(path)
  if (doc !== undefined) return { kind: 'document', path, doc }
  const matchers = matchersOf.get(corpus)
  const reasons: NotInCorpusReason[] = []
  if (!path.endsWith('.md')) reasons.push('not-markdown')
  if (matchers?.ignored(path) === true) reasons.push('ignored')
  if (matchers === undefined || !matchers.inRoots(path)) reasons.push('outside-roots')
  // A loaded `corpus()` reads exactly the `.md` files in its roots that it does
  // not ignore, so one of the three always applies. Should a hand-built
  // `Corpus` disagree, `outside-roots` is the reason that names a remedy.
  if (reasons.length === 0) reasons.push('outside-roots')
  return { kind: 'not-in-corpus', path, reasons }
}

/**
 * Resolve a link to the one case it is (plan 0404). Total: it never throws.
 *
 * Candidates are tried in a fixed order — each target (repo-root, then
 * content-root when `rootDir` is set), and within it the URL as written, then
 * `tryExtensions`, then `tryIndex`. The first existing **file** wins. Only when
 * no candidate is a file is a directory reported, the first target's first.
 * When nothing exists, `missing.tried` is every candidate tried, in order.
 *
 * Links into the built-in ignores (`node_modules`, `.git`, `dist`, …) are
 * `missing`: `corpus()` never walks those folders, so their files are not known.
 *
 * The directory and document indexes are built on a corpus's first resolution
 * and cached. A `corpus()` result never changes, so that is exact; a hand-built
 * `Corpus` whose `documents()` returns something different later is not re-read.
 */
export function resolveLink(
  link: LinkToResolve,
  corpus: Corpus,
  options: LinkResolveOptions = {},
): LinkTarget {
  if (link.external) return { kind: 'external' }
  let targets: string[]
  try {
    targets = linkTargets(link, options)
  } catch (error: unknown) {
    // Malformed percent-encoding (`%E0`): the URL names no file anyone can
    // reach, which is exactly `missing`. Reported, never thrown, so one bad
    // link cannot abort a whole run.
    void error
    return { kind: 'missing', tried: [link.url] }
  }
  if (targets.length === 0) return { kind: 'self' }

  const tried: string[] = []
  for (const target of targets) {
    for (const candidate of candidates(target, options)) {
      tried.push(candidate)
      if (corpus.fileIndex.has(candidate)) return fileTarget(candidate, link, corpus)
    }
  }
  const { directories } = indexes(corpus)
  for (const target of targets) {
    const bare = target.replace(/\/+$/, '')
    if (directories.has(bare)) return { kind: 'directory', path: bare }
  }
  return { kind: 'missing', tried }
}

/**
 * If a broken link's basename uniquely names one file in the repo (the target
 * moved, not renamed), a deterministic autofix rewriting the URL to a path
 * relative to the linking document (plan 0066). Ambiguous basename, or a URL
 * whose exact span isn't known, → no fix.
 *
 * Lives beside `resolveLink` so that path arithmetic stays in this one module
 * (plan 0404's structural rule keeps `node:path` out of the conditions).
 */
export function movedLinkFix(
  link: MdLink,
  byBasename: ReadonlyMap<string, readonly string[]>,
): ArchFix | undefined {
  if (link.urlStart === undefined || link.urlEnd === undefined) return undefined
  const path = link.url.split('#')[0] ?? ''
  const fragment = link.url.slice(path.length) // '' or '#anchor'
  const base = path.slice(path.replace(/\/+$/, '').lastIndexOf('/') + 1)
  const matches = byBasename.get(base) ?? []
  if (matches.length !== 1) return undefined // renamed (no match) or ambiguous → no fix
  const target = matches[0]
  if (target === undefined) return undefined
  let rel = posix.relative(posix.dirname(link.doc.relPath), target)
  if (!rel.startsWith('.')) rel = './' + rel
  const replacement = rel + fragment
  if (replacement === link.url) return undefined
  return {
    file: link.doc.file,
    start: link.urlStart,
    end: link.urlEnd,
    replacement,
    describe: `rewrite link "${link.url}" → "${replacement}"`,
  }
}
