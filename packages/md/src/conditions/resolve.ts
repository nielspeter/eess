import type { Condition, ConditionContext } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import type { MdLink } from '../model/links.js'
import { mdViolation, type ArchViolation } from '../model/violation.js'
import {
  basenameIndex,
  linkTargets,
  movedLinkFix,
  resolveLink,
  type LinkResolveOptions,
} from '../model/resolve-link.js'

/**
 * Options for `linkResolves` — how a link URL is matched against the repo tree.
 * Defined beside `resolveLink` (`model/resolve-link.ts`), the one resolver both
 * share (plan 0404); re-exported here so existing imports keep working.
 */
export type { LinkResolveOptions } from '../model/resolve-link.js'

/** The remedy for a reference whose label has no definition (bug 0558), every way it can be cured. */
function undefinedReferenceMessage(label: string): string {
  return (
    `the reference [${label}] has no definition, so it is not a link: add its definition ` +
    `([${label}]: url), write it as a link ([text](url)), or put it in a code span if it is not one`
  )
}

/** A reference whose label has no definition, at its own line (bug 0558). */
export function undefinedReferenceViolation(link: MdLink, ctx: ConditionContext): ArchViolation {
  const label = link.undefinedReference?.label ?? ''
  return mdViolation({
    element: `${link.doc.relPath} → [${label}]`,
    file: link.doc.file,
    line: link.line,
    message: undefinedReferenceMessage(label),
    sourceText: link.doc.text,
    context: ctx,
  })
}

/**
 * Condition: every (internal) link resolves to a file in the corpus's repo tree.
 * Closes over the `Corpus` for the file index. External links and pure anchors
 * are skipped. `options` adds extensionless-link resolution (`tryExtensions`,
 * `tryIndex`) for static-site corpora, and directory resolution
 * (`resolveDirectories`) for repo-hosted ones.
 *
 * Resolution is `resolveLink`'s (plan 0404): this condition only decides which
 * of its cases count as resolved — a loaded document, an existing file outside
 * the corpus, and (with `resolveDirectories`) a directory.
 */
export function linkResolves(corpus: Corpus, options: LinkResolveOptions = {}): Condition<MdLink> {
  // Basename → repo files, for finding a uniquely-moved target of a broken link.
  const byBasename = basenameIndex(corpus)

  // Bug 0137: a link that names a real directory and one that names nothing at
  // all both reported the identical "does not resolve" message — no hint that
  // `resolveDirectories` exists, or that this specific target would resolve
  // with it on. A site-absolute link with `rootDir` set has two candidates
  // (repo-root, then content-root), and either can be a real directory.
  // Reporting it unlabelled could name the *wrong* one: a repo-root directory
  // sharing a name with the intended content-root page would send the author
  // to toggle `resolveDirectories`, which resolves the unrelated directory, not
  // their missing page. Labelled only when there are two candidates.
  const directoryHint = (link: MdLink, path: string): string => {
    const targets = linkTargets(link, options).map((t) => t.replace(/\/+$/, ''))
    const label =
      targets.length > 1 ? (targets.indexOf(path) === 0 ? ' (repo-root)' : ' (content-root)') : ''
    return ` — "${path}"${label} is a real directory; this check runs with resolveDirectories off`
  }

  return {
    description: 'resolve to an existing file',
    evaluate: (links, ctx) => {
      // Bug 0558: a reference-style link's URL is its definition's, so a broken one is the
      // definition's finding, reported once at the definition however many references use it,
      // with at most one fix over the definition's URL.
      const reported = new Set<string>()
      return links.flatMap((link) => {
        if (link.undefinedReference !== undefined) return [undefinedReferenceViolation(link, ctx)]
        const target = resolveLink(link, corpus, options)
        if (
          target.kind === 'external' ||
          target.kind === 'self' ||
          target.kind === 'document' ||
          target.kind === 'not-in-corpus'
        )
          return []
        if (target.kind === 'directory' && options.resolveDirectories === true) return []
        const hint = target.kind === 'directory' ? directoryHint(link, target.path) : ''
        const def = link.definition
        if (def !== undefined) {
          const key = `${link.doc.relPath}:${String(def.line)}`
          if (reported.has(key)) return []
          reported.add(key)
        }
        return [
          mdViolation({
            element: `${link.doc.relPath} → ${link.url}`,
            file: link.doc.file,
            line: def?.line ?? link.line,
            message:
              `broken link: "${link.url}" does not resolve to a file in the repo${hint}` +
              (def === undefined ? '' : ` (the definition of [${def.label}])`),
            sourceText: link.doc.text,
            fix: movedLinkFix(link, byBasename),
            context: ctx,
          }),
        ]
      })
    },
  }
}
