import type { Condition } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import type { MdLink } from '../model/links.js'
import { mdViolation } from '../model/violation.js'
import type { FragmentVerdict } from '../model/anchors.js'
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

/**
 * Condition: every (internal) link resolves to a file in the corpus's repo tree.
 * Closes over the `Corpus` for the file index. External links are skipped. A
 * `#fragment` on a loaded document, or on the linking document itself, is checked
 * against its anchors under `options.anchorRule` (bug 0136); one that names no anchor,
 * or does not decode, is reported. `options` adds extensionless-link resolution (`tryExtensions`,
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
    // Kept as it was when fragments were not judged: a baseline entry keys on a rule's description,
    // so changing it would bring every baselined broken link back as new (bug 0136).
    description: 'resolve to an existing file',
    evaluate: (links, ctx) => {
      // Bug 0558: a reference-style link's URL is its definition's, so a broken one is the
      // definition's finding, reported once at the definition however many references use it,
      // with at most one fix over the definition's URL.
      const reported = new Set<string>()
      return links.flatMap((link) => {
        const target = resolveLink(link, corpus, options)
        if (target.kind === 'self' || target.kind === 'document') {
          const message = fragmentMessage(
            link.url,
            target.fragment,
            target.kind === 'self' ? 'this document' : target.path,
          )
          if (message === undefined) return []
          const def = link.definition
          if (def !== undefined) {
            const key = `${link.doc.relPath}:${String(def.line)}`
            if (reported.has(key)) return []
            reported.add(key)
          }
          const remedy = fragmentRemedy(target.fragment)
          return [
            mdViolation({
              element: `${link.doc.relPath} → ${link.url}`,
              file: link.doc.file,
              line: def?.line ?? link.line,
              message: message + (def === undefined ? '' : ` (the definition of [${def.label}])`),
              sourceText: link.doc.text,
              context: {
                ...ctx,
                // Absent, not empty, when neither the fragment nor the rule names a remedy.
                suggestion:
                  [remedy, ctx.suggestion].filter((x) => x !== undefined).join(' ') || undefined,
              },
            }),
          ]
        }
        if (target.kind === 'external' || target.kind === 'not-in-corpus') return []
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

/**
 * The finding for a fragment that reached no anchor (bug 0136): the fragment as written, the target
 * and the rule that judged it, and nothing that changes when the target's other headings do, so a
 * baseline entry for it holds. `undefined` when there is no fragment or it was found.
 */
function fragmentMessage(
  url: string,
  verdict: FragmentVerdict | undefined,
  where: string,
): string | undefined {
  if (verdict === undefined || verdict.kind === 'found') return undefined
  // A pure `#fragment` is named once, not as its URL and again as its fragment.
  const written = url === `#${verdict.fragment}` ? `"${url}"` : `"${url}" — "#${verdict.fragment}"`
  if (verdict.kind === 'malformed') {
    return `broken fragment: ${written} is not valid percent-encoding`
  }
  if (verdict.uncounted !== undefined) {
    const { element, attribute } = verdict.uncounted
    const article = /^[aeiou]/.test(element) ? 'an' : 'a'
    return (
      `broken fragment: ${written} names the ${attribute} of ${article} <${element}> in ${where}, ` +
      `which the ${verdict.rule} anchor rule does not count as an anchor`
    )
  }
  return `broken fragment: ${written} is no heading or anchor in ${where} under the ${verdict.rule} anchor rule`
}

/** The remedy for a fragment finding: the anchors nearest to it, and the rule it was judged by. */
function fragmentRemedy(verdict: FragmentVerdict | undefined): string | undefined {
  if (verdict === undefined || verdict.kind !== 'absent') return undefined
  const rule = 'If the target is published by another renderer, pass its rule as `anchorRule`.'
  if (verdict.uncounted !== undefined) {
    return `Point the fragment at a heading or an anchor the ${verdict.rule} rule counts. ${rule}`
  }
  const nearest =
    verdict.nearest.length === 0
      ? 'Point the fragment at a heading or anchor in the target.'
      : `The nearest: ${verdict.nearest.map((id) => `#${id}`).join(', ')}` +
        (verdict.caseOnly === undefined
          ? '.'
          : ` (#${verdict.caseOnly} differs only in letter case).`)
  return `${nearest} ${rule}`
}
