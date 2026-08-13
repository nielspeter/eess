import { posix } from 'node:path'
import type { Condition, ArchFix } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import type { MdLink } from '../model/links.js'
import { mdViolation } from '../model/violation.js'

/**
 * Options for `linkResolves` — how a link URL is matched against the repo tree.
 * Covers static-site conventions (VitePress, Docusaurus, MkDocs, GitBook…)
 * generically instead of naming any tool: extensionless links resolve by
 * trying extensions and/or a directory index file.
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
   */
  readonly resolveDirectories?: boolean
}

/**
 * Resolve an internal link's URL to its base repo-relative target(s), or `[]`
 * if it is a pure fragment (`#anchor`) or otherwise not a file reference.
 * Site-absolute links (leading `/`) yield the repo-root target plus, when
 * `rootDir` is set, the content-root target.
 */
function resolveTargets(link: MdLink, options: LinkResolveOptions): string[] {
  const withoutFragment = link.url.split('#')[0] ?? ''
  if (withoutFragment === '') return [] // same-document anchor
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

/** All repo-relative candidates for a target under the given options. */
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

/**
 * Every known directory reachable from `fileIndex`'s files, derived from it
 * rather than new I/O: each indexed file's ancestors are known directories.
 * `fileIndex` itself spans the whole physical repo walk from `cwd`, not just
 * the corpus's configured `roots` (`roots` only filters which files become
 * *documents* — see `corpus()`), so a directory link can resolve against
 * something outside any configured root. Built only when `resolveDirectories`
 * is on — the cost of a directory-shaped link resolving is opt-in, so is the
 * cost of computing it.
 *
 * The repo root itself (`.`) is deliberately excluded — `[root](/)` still
 * won't resolve even with the option on. Nobody links "the whole repo," and
 * `resolveTargets` never had a resolvable shape for it before this option
 * existed either.
 */
function directoryIndex(corpus: Corpus): ReadonlySet<string> {
  const dirs = new Set<string>()
  for (const rel of corpus.fileIndex) {
    let dir = posix.dirname(rel)
    while (dir !== '.' && dir !== '/' && !dirs.has(dir)) {
      dirs.add(dir)
      dir = posix.dirname(dir)
    }
  }
  return dirs
}

/**
 * Condition: every (internal) link resolves to a file in the corpus's repo tree.
 * Closes over the `Corpus` for the file index. External links and pure anchors
 * are skipped. `options` adds extensionless-link resolution (`tryExtensions`,
 * `tryIndex`) for static-site corpora, and directory resolution
 * (`resolveDirectories`) for repo-hosted ones.
 */
export function linkResolves(corpus: Corpus, options: LinkResolveOptions = {}): Condition<MdLink> {
  // Basename → repo files, for finding a uniquely-moved target of a broken link.
  const byBasename = new Map<string, string[]>()
  for (const rel of corpus.fileIndex) {
    const base = rel.slice(rel.lastIndexOf('/') + 1)
    const list = byBasename.get(base)
    if (list) list.push(rel)
    else byBasename.set(base, [rel])
  }
  const dirIndex = options.resolveDirectories === true ? directoryIndex(corpus) : undefined

  return {
    description: 'resolve to an existing file',
    evaluate: (links, ctx) =>
      links.flatMap((link) => {
        if (link.external) return []
        const targets = resolveTargets(link, options)
        if (targets.length === 0) return []
        if (targets.some((t) => candidates(t, options).some((c) => corpus.fileIndex.has(c))))
          return []
        if (dirIndex !== undefined && targets.some((t) => dirIndex.has(t.replace(/\/+$/, ''))))
          return []
        return [
          mdViolation({
            element: `${link.doc.relPath} → ${link.url}`,
            file: link.doc.file,
            line: link.line,
            message: `broken link: "${link.url}" does not resolve to a file in the repo`,
            sourceText: link.doc.text,
            fix: movedLinkFix(link, byBasename),
            context: ctx,
          }),
        ]
      }),
  }
}

/**
 * If a broken link's basename uniquely names one file in the repo (the target
 * moved, not renamed), emit a deterministic autofix rewriting the URL to a path
 * relative to the linking document (plan 0066). Ambiguous basename, or a URL
 * whose exact span isn't known, → no fix.
 */
function movedLinkFix(link: MdLink, byBasename: Map<string, string[]>): ArchFix | undefined {
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
