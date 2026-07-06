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
 * Condition: every (internal) link resolves to a file in the corpus's repo tree.
 * Closes over the `Corpus` for the file index. External links and pure anchors
 * are skipped. `options` adds extensionless-link resolution (`tryExtensions`,
 * `tryIndex`) for static-site corpora.
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

  return {
    description: 'resolve to an existing file',
    evaluate: (links, ctx) =>
      links.flatMap((link) => {
        if (link.external) return []
        const targets = resolveTargets(link, options)
        if (targets.length === 0) return []
        if (targets.some((t) => candidates(t, options).some((c) => corpus.fileIndex.has(c))))
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
