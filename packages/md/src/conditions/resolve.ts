import type { Condition } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import type { MdLink } from '../model/links.js'
import { mdViolation } from '../model/violation.js'
import { githubAnchors, type FragmentVerdict, type NotJudgedReason } from '../model/anchors.js'
import { unreadFinding } from '../model/unread-finding.js'
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
      // Bug 0575: a fragment this rule cannot judge is one unsuppressable finding per target and
      // cause (ADR-021 rule 5), naming the links it covers, never a pass.
      const unjudged = new Map<
        string,
        { readonly path: string; readonly reason: NotJudgedReason; readonly links: MdLink[] }
      >()
      const found = links.flatMap((link) => {
        const target = resolveLink(link, corpus, options)
        const reachable =
          target.kind === 'self' ||
          target.kind === 'document' ||
          target.kind === 'not-in-corpus' ||
          (target.kind === 'directory' && options.resolveDirectories === true)
        if (reachable) {
          const where =
            target.kind === 'self'
              ? 'this document'
              : target.kind === 'directory'
                ? `the page of ${target.path}/`
                : target.path
          if (target.fragment?.kind === 'not-judged') {
            const path = target.kind === 'self' ? link.doc.relPath : target.path
            const key = `${path}\u0000${target.fragment.reason}`
            const entry = unjudged.get(key) ?? { path, reason: target.fragment.reason, links: [] }
            entry.links.push(link)
            unjudged.set(key, entry)
            return []
          }
          const message = fragmentMessage(link.url, target.fragment, where)
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
        if (target.kind === 'external') return []
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
            fix: movedLinkFix(link, byBasename, corpus, options),
            context: ctx,
          }),
        ]
      })
      return [...found, ...[...unjudged.values()].map((u) => notJudgedFinding(u))]
    },
  }
}

/** The rule id of a fragment `resolve()` cannot judge (bug 0575), reported whatever filters apply. */
export const FRAGMENT_NOT_JUDGED = 'md/fragment-not-judged'

const NOT_JUDGED_WHY: Readonly<Record<NotJudgedReason, string>> = {
  ignored: 'the corpus ignores the file',
  'not-markdown': 'it is not Markdown, and the fragment is not a line (`#L5`)',
  'no-directory-page': 'the directory has no page the anchor rule names for it',
  unreadable: 'the file cannot be read',
}

const NOT_JUDGED_REMEDY: Readonly<Record<NotJudgedReason, string>> = {
  ignored: 'Load the file into the corpus, or link it without a fragment.',
  'not-markdown': 'Link the file without a fragment, or link a line of it as `#L5`.',
  'no-directory-page': `Link a file in the directory (under GitHub's rule, its ${String(githubAnchors.directoryPage)}).`,
  unreadable: 'Make the file readable, or link it without a fragment.',
}

/** One finding per target and cause, at its first link, naming every link it covers. */
function notJudgedFinding(u: {
  readonly path: string
  readonly reason: NotJudgedReason
  readonly links: readonly MdLink[]
}) {
  const first = u.links[0]
  const sites = u.links.map((l) => `${l.doc.relPath}:${String(l.line)}`)
  const shown =
    sites.length > 5 ? [...sites.slice(0, 5), `${String(sites.length - 5)} more`] : sites
  return unreadFinding({
    ruleId: FRAGMENT_NOT_JUDGED,
    element: `${u.path} (fragments)`,
    file: first?.doc.file ?? '',
    line: first?.line ?? 0,
    message:
      `the fragment of ${count(u.links.length, 'link')} into ${u.path} is not judged: ` +
      `${NOT_JUDGED_WHY[u.reason]}, so this rule cannot judge whether it names a place there ` +
      `(${shown.join(', ')})`,
    suggestion: NOT_JUDGED_REMEDY[u.reason],
  })
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
  if (verdict.kind === 'not-judged') return undefined
  if (verdict.kind === 'out-of-range') {
    return verdict.column === undefined
      ? `broken fragment: ${written} is past the end of ${where}, which has ${count(verdict.lines, 'line')}`
      : `broken fragment: ${written} is past the end of line ${String(verdict.line)} of ${where}, ` +
          `which has ${count(verdict.column.length, 'character')}`
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

/** `n` and its noun, singular for one. */
function count(n: number, noun: string): string {
  return `${String(n)} ${noun}${n === 1 ? '' : 's'}`
}

/** The remedy for a fragment finding: the anchors nearest to it, and the rule it was judged by. */
function fragmentRemedy(verdict: FragmentVerdict | undefined): string | undefined {
  if (verdict?.kind === 'out-of-range') {
    return verdict.column === undefined
      ? `Point the fragment at a line the file has (1 to ${String(verdict.lines)}).`
      : `Point the fragment at a column line ${String(verdict.line)} has, or drop the column.`
  }
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
