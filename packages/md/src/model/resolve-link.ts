import { join, posix } from 'node:path'
import type { ArchFix } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import { corpusInternals, readCorpusFile } from './corpus-internals.js'
import { buildDocument, type MdDocument } from './document.js'
import { parseUncached } from './prose.js'
import { writeDestination } from './destination.js'
import { collectLinks, type MdLink } from './links.js'
import {
  githubAnchors,
  isLineFragment,
  judgeFragment,
  judgeLine,
  type AnchorRule,
  type FragmentVerdict,
  type NotJudgedReason,
} from './anchors.js'

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
  /**
   * The renderer's anchor rule, which judges a link's `#fragment` against the headings and HTML
   * anchors of its target (bug 0136). The linking document's renderer's, since a reader stays in
   * one. Default {@link githubAnchors}, github.com's renderer's; pass another for a corpus a
   * different renderer publishes. A fragment is judged on any Markdown file (one the corpus did
   * not load is read for its anchors alone), on a directory's page (`AnchorRule.directoryPages`),
   * and as a line (`#L5`, `#L5-L9`, `#L5C3`) on a file that is not Markdown or after `?plain=1`;
   * anything else is not judged, which `resolve()` reports (bug 0575).
   */
  readonly anchorRule?: AnchorRule
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
 * - `self`: a pure `#anchor` or `?query`, or a path back to the linking document itself.
 * - `document`: an existing, loaded corpus document, whose links are parsed.
 *
 * On `self`, `document`, `not-in-corpus` and `directory`, `fragment` is what the link's `#fragment`
 * found (bugs 0136, 0575), judged by `LinkResolveOptions.anchorRule`: set whenever the URL has a
 * `#`. Each rule decides what it means: `resolve()` reports one that is absent, malformed, out of
 * range or not judged; `haveLiveTargets()`, `beLinkedBack()` and `mentions()` ask about the target
 * and do not read it.
 * - `not-in-corpus`: an existing file the corpus did not load, with every reason.
 * - `directory`: no candidate is a file, but one names a real directory.
 * - `missing`: nothing exists; `tried` lists every candidate, in order.
 */
export type LinkTarget =
  | { readonly kind: 'external' }
  | { readonly kind: 'self'; readonly fragment?: FragmentVerdict }
  | {
      readonly kind: 'document'
      readonly path: string
      readonly doc: MdDocument
      readonly fragment?: FragmentVerdict
    }
  | {
      readonly kind: 'not-in-corpus'
      readonly path: string
      readonly reasons: readonly NotInCorpusReason[]
      readonly fragment?: FragmentVerdict
    }
  | { readonly kind: 'directory'; readonly path: string; readonly fragment?: FragmentVerdict }
  | { readonly kind: 'missing'; readonly tried: readonly string[] }

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
 * A link URL's path, before its query (`?…`) or fragment (`#…`), and the rest, kept whole. GitHub
 * reads `?raw=true` and `?plain=1` as a query, never as part of a file name, and a `?` in a name is
 * written `%3F`, which decodes only after the cut (bug 0583).
 */
function splitPath(url: string): { readonly path: string; readonly rest: string } {
  const end = url.search(/[?#]/)
  return end === -1 ? { path: url, rest: '' } : { path: url.slice(0, end), rest: url.slice(end) }
}

/**
 * A link URL's base repo-relative target(s), or `[]` for a pure fragment or query.
 * Site-absolute links (leading `/`) yield the repo-root target, then the
 * content-root target when `rootDir` is set. Throws `URIError` on malformed
 * percent-encoding; `resolveLink` turns that into `missing`.
 *
 * Exported for `linkResolves`, which labels the two site-absolute candidates
 * in its directory hint (bug 0137); not part of the package's public API.
 */
export function linkTargets(link: LinkToResolve, options: LinkResolveOptions): string[] {
  const { path } = splitPath(link.url)
  if (path === '') return []
  const decoded = decodeURIComponent(path)
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

/** The link's fragment as written, without its `#`, or `undefined` when the URL has none. */
function fragmentOf(url: string): string | undefined {
  const { rest } = splitPath(url)
  const hash = rest.indexOf('#')
  return hash === -1 ? undefined : rest.slice(hash + 1)
}

/**
 * The fragment's verdict on `doc`, or nothing when there is no fragment or no loaded document. On
 * GitHub, `?plain=1` shows a Markdown file's source, where `#L5` and `#L5-L9` name lines, not
 * anchors; a line is not judged here.
 */
function verdictOn(
  doc: MdDocument | undefined,
  link: LinkToResolve,
  options: LinkResolveOptions,
): { readonly fragment?: FragmentVerdict } {
  const fragment = fragmentOf(link.url)
  if (fragment === undefined || doc === undefined) return {}
  if (plainSource(link.url) && isLineFragment(fragment)) {
    const line = judgeLine(fragment, doc.text)
    if (line !== undefined) return { fragment: line }
  }
  return { fragment: judgeFragment(fragment, doc, options.anchorRule ?? githubAnchors) }
}

/** Whether the URL's query asks for the source view (`?plain=1`), where `#L5` names a line. */
function plainSource(url: string): boolean {
  const { rest } = splitPath(url)
  const hash = rest.indexOf('#')
  return /(?:^\?|&)plain=1(?:&|$)/.test(hash === -1 ? rest : rest.slice(0, hash))
}

/** A Markdown file the corpus did not load, read for its anchors alone (bug 0575), once per corpus. */
const unloaded = new WeakMap<Corpus, Map<string, MdDocument | undefined>>()

function unloadedDocument(corpus: Corpus, path: string): MdDocument | undefined {
  let byPath = unloaded.get(corpus)
  if (byPath === undefined) {
    byPath = new Map()
    unloaded.set(corpus, byPath)
  }
  if (byPath.has(path)) return byPath.get(path)
  let doc: MdDocument | undefined
  try {
    const text = readCorpusFile(corpus, path)
    doc = buildDocument({
      file: join(corpus.root, path),
      relPath: path,
      frozen: false,
      text,
      // Read once and kept here; not pushed into the shared parse memo the corpus's own texts use.
      root: parseUncached(text),
    })
  } catch (error: unknown) {
    void error
    doc = undefined
  }
  byPath.set(path, doc)
  return doc
}

/** How many links a document holds, counted once per document for the moved-link fix's check. */
const linkCounts = new WeakMap<MdDocument, number>()
function linkCountOf(doc: MdDocument): number {
  const known = linkCounts.get(doc)
  if (known !== undefined) return known
  const n = collectLinks(doc.root, doc.text).length
  linkCounts.set(doc, n)
  return n
}

/** A file's text, or `undefined` when it cannot be read. */
function textOfFile(corpus: Corpus, path: string): string | undefined {
  try {
    return readCorpusFile(corpus, path)
  } catch (error: unknown) {
    void error
    return undefined
  }
}

/**
 * The fragment's verdict on a file the corpus did not load (bug 0575, spike 0574 decision 4): a
 * Markdown file is read for its anchors, a line fragment on any other file is judged against its
 * lines, and anything else, or a file the corpus ignores, is not judged.
 */
function unloadedVerdict(
  path: string,
  reasons: readonly NotInCorpusReason[],
  link: LinkToResolve,
  corpus: Corpus,
  options: LinkResolveOptions,
): { readonly fragment?: FragmentVerdict } {
  const fragment = fragmentOf(link.url)
  if (fragment === undefined) return {}
  const notJudged = (reason: NotJudgedReason): { readonly fragment: FragmentVerdict } => ({
    fragment: { kind: 'not-judged', fragment, reason, file: path },
  })
  if (reasons.includes('ignored')) return notJudged('ignored')
  if (path.endsWith('.md')) {
    const doc = unloadedDocument(corpus, path)
    if (doc === undefined) return notJudged('unreadable')
    return verdictOn(doc, link, options)
  }
  const text = textOfFile(corpus, path)
  if (text === undefined) return notJudged('unreadable')
  // A file that is not text has no lines: `#L1` on an image or a PDF reaches nothing, and judging it
  // as a line would pass it (bug 0575's enforcement review). Not text: a NUL byte, a byte sequence
  // UTF-8 does not decode (read as U+FFFD), or a PDF's `%PDF-` header, which an ASCII-only PDF has.
  if (text.includes('\u0000') || text.includes('\uFFFD') || text.startsWith('%PDF-'))
    return notJudged('not-text')
  const line = judgeLine(fragment, text)
  return line === undefined ? notJudged('not-markdown') : { fragment: line }
}

/**
 * The fragment's verdict on a directory (bug 0575): judged against the page the rule names for one,
 * loaded or read on demand, and not judged when the rule names none or the directory has none.
 */
function directoryVerdict(
  path: string,
  link: LinkToResolve,
  corpus: Corpus,
  options: LinkResolveOptions,
): { readonly fragment?: FragmentVerdict } {
  const fragment = fragmentOf(link.url)
  if (fragment === undefined) return {}
  const pages = (options.anchorRule ?? githubAnchors).directoryPages ?? []
  if (pages.length === 0)
    return { fragment: { kind: 'not-judged', fragment, reason: 'no-page-rule' } }
  const pagePath = pages.map((p) => posix.join(path, p)).find((p) => corpus.fileIndex.has(p))
  if (pagePath === undefined)
    return {
      fragment: {
        kind: 'not-judged',
        fragment,
        reason: 'no-directory-page',
        page: pages.join(' or '),
      },
    }
  const loaded = indexes(corpus).documents.get(pagePath)
  if (loaded !== undefined) return verdictOn(loaded, link, options)
  return unloadedVerdict(pagePath, notInCorpusReasons(corpus, pagePath), link, corpus, options)
}

function selfTarget(link: LinkToResolve, corpus: Corpus, options: LinkResolveOptions): LinkTarget {
  const doc = indexes(corpus).documents.get(link.doc.relPath)
  const fragment = fragmentOf(link.url)
  // A hand-built link from a document the corpus did not load: its anchors are unknown here.
  if (doc === undefined && fragment !== undefined)
    return { kind: 'self', fragment: { kind: 'not-judged', fragment, reason: 'not-loaded' } }
  return { kind: 'self', ...verdictOn(doc, link, options) }
}

function fileTarget(
  path: string,
  link: LinkToResolve,
  corpus: Corpus,
  options: LinkResolveOptions,
): LinkTarget {
  if (path === link.doc.relPath) return selfTarget(link, corpus, options)
  const doc = indexes(corpus).documents.get(path)
  if (doc !== undefined) return { kind: 'document', path, doc, ...verdictOn(doc, link, options) }
  const reasons = notInCorpusReasons(corpus, path)
  return {
    kind: 'not-in-corpus',
    path,
    reasons,
    ...unloadedVerdict(path, reasons, link, corpus, options),
  }
}

/**
 * Why a file in the repository is not one of the corpus's documents. One owner,
 * read by link resolution and by the selector-fault check (plan 0456), so
 * `outside-roots` and `ignored` mean one thing in both.
 */
export function notInCorpusReasons(corpus: Corpus, path: string): NotInCorpusReason[] {
  const matchers = corpusInternals(corpus)
  const reasons: NotInCorpusReason[] = []
  if (!path.endsWith('.md')) reasons.push('not-markdown')
  if (matchers?.ignored(path) === true) reasons.push('ignored')
  if (matchers === undefined || !matchers.inRoots(path)) reasons.push('outside-roots')
  // A loaded `corpus()` reads exactly the `.md` files in its roots that it does
  // not ignore, so one of the three always applies. Should a hand-built
  // `Corpus` disagree, `outside-roots` is the reason that names a remedy.
  if (reasons.length === 0) reasons.push('outside-roots')
  return reasons
}

/**
 * Resolve a link to the one case it is (plan 0404). Total over links: no URL makes it throw. It
 * throws `ArchConfigError` only when `options.anchorRule` breaks its contract (a number of ids that
 * is not one per heading), and passes on an error the caller's rule throws.
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
  if (targets.length === 0) return selfTarget(link, corpus, options)

  const tried: string[] = []
  for (const target of targets) {
    for (const candidate of candidates(target, options)) {
      tried.push(candidate)
      if (corpus.fileIndex.has(candidate)) return fileTarget(candidate, link, corpus, options)
    }
  }
  const { directories } = indexes(corpus)
  for (const target of targets) {
    const bare = target.replace(/\/+$/, '')
    if (directories.has(bare))
      return { kind: 'directory', path: bare, ...directoryVerdict(bare, link, corpus, options) }
  }
  return { kind: 'missing', tried }
}

/**
 * A link from the document at `from` to the repo path `to`, relative and starting with `.`, as a
 * Markdown author writes one. Shared by {@link movedLinkFix} and the mention fix (plan 0550), so path
 * arithmetic stays in this module.
 */
export function relativeLinkPath(from: string, to: string): string {
  const rel = posix.relative(posix.dirname(from), to)
  return rel.startsWith('.') ? rel : './' + rel
}

/** Whether `path` names a place inside the repository: relative, and not climbing out of it. */
export function isRepoPath(path: string): boolean {
  const normal = posix.normalize(path)
  return !path.startsWith('/') && normal !== '..' && !normal.startsWith('../')
}

/** Basename → every repo file with it, for {@link movedLinkFix}. Built once per caller. */
export function basenameIndex(corpus: Corpus): ReadonlyMap<string, readonly string[]> {
  const byBasename = new Map<string, string[]>()
  for (const rel of corpus.fileIndex) {
    const base = rel.slice(rel.lastIndexOf('/') + 1)
    const list = byBasename.get(base)
    if (list) list.push(rel)
    else byBasename.set(base, [rel])
  }
  return byBasename
}

/**
 * If a broken link's basename uniquely names one file in the repo (the target
 * moved, not renamed), a deterministic autofix rewriting the URL to a path
 * relative to the linking document (plan 0066). Ambiguous basename, or a URL
 * whose exact span isn't known, → no fix.
 *
 * The fix carries a query and a fragment over only when the new target holds the fragment, as
 * `resolveLink` judges it under `options` (bug 0575); and the new destination is written by
 * `writeDestination`, in `<…>` where a space or a parenthesis needs it, and kept only when the
 * document, read again with the fix applied, still holds a link to the new URL and as many links as
 * before (bug 0567: a bare `./new dir/b.md` is text, not a link, and the run went green).
 *
 * Lives beside `resolveLink` so that path arithmetic stays in this one module
 * (plan 0404's structural rule keeps `node:path` out of the conditions).
 */
export function movedLinkFix(
  link: MdLink,
  byBasename: ReadonlyMap<string, readonly string[]>,
  corpus: Corpus,
  options: LinkResolveOptions = {},
): ArchFix | undefined {
  const { urlStart, urlEnd } = link
  if (urlStart === undefined || urlEnd === undefined) return undefined
  const { path, rest } = splitPath(link.url) // rest: '', '?query', '#anchor' or both, carried over
  const base = path.slice(path.replace(/\/+$/, '').lastIndexOf('/') + 1)
  const matches = byBasename.get(base) ?? []
  if (matches.length !== 1) return undefined // renamed (no match) or ambiguous → no fix
  const target = matches[0]
  if (target === undefined) return undefined
  const url = relativeLinkPath(link.doc.relPath, target) + rest
  if (url === link.url) return undefined
  // The new URL must reach the file the fix names: a `?`, `%` or `%20` in a folder name is read as a
  // query or an escape, and the fix would write a link the next run reports (the review of bug 0567).
  const moved = resolveLink({ url, external: false, doc: link.doc }, corpus, options)
  if (!('path' in moved) || moved.path !== target) return undefined
  if (fragmentOf(url) !== undefined) {
    const verdict = 'fragment' in moved ? moved.fragment : undefined
    if (verdict?.kind !== 'found') return undefined
  }
  const text = link.doc.text
  const angle = text[urlStart - 1] === '<' && text[urlEnd] === '>'
  const replacement = writeDestination(url, angle)
  if (replacement === undefined) return undefined
  // Read again with the fix applied: as many links as before, and one to the new URL where the
  // rewritten span starts, so an unrelated link to the same file cannot vouch for it.
  const fixed = text.slice(0, urlStart) + replacement + text.slice(urlEnd)
  const at = replacement.startsWith('<') && !angle ? urlStart + 1 : urlStart
  const after = collectLinks(parseUncached(fixed), fixed)
  if (
    after.length !== linkCountOf(link.doc) ||
    !after.some((l) => l.url === url && l.urlStart === at)
  )
    return undefined
  return {
    file: link.doc.file,
    start: urlStart,
    end: urlEnd,
    replacement,
    describe: `rewrite link "${link.url}" → "${replacement}"`,
  }
}
