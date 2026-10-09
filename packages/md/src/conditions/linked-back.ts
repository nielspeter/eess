import type { Condition } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import { collectLinks, type MdLink } from '../model/links.js'
import { mdViolation, type ArchViolation } from '../model/violation.js'
import {
  basenameIndex,
  movedLinkFix,
  resolveLink,
  type LinkResolveOptions,
  type LinkTarget,
} from '../model/resolve-link.js'

/** Each document's repo path → the documents it links to, resolved as `options` resolves. */
function linksFrom(corpus: Corpus, options: LinkResolveOptions): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const doc of corpus.documents()) {
    const targets = new Set<string>()
    for (const link of collectLinks(doc.root, doc.text)) {
      const target = resolveLink({ url: link.url, external: link.external, doc }, corpus, options)
      if (target.kind === 'document') targets.add(target.path)
    }
    out.set(doc.relPath, targets)
  }
  return out
}

/** A finding's cause and its remedy, for one `resolveLink` case that cannot answer. */
interface Unanswered {
  readonly target: string
  readonly message: string
  readonly suggestion: string
}

function unanswered(link: MdLink, target: LinkTarget): Unanswered {
  const source = link.doc.relPath
  switch (target.kind) {
    case 'document':
      return target.doc.frozen
        ? {
            target: target.path,
            message: `${target.path} is frozen and cannot answer`,
            suggestion: `add .haveLiveTargets() to the rule, or remove ${target.path} from the declaration`,
          }
        : {
            target: target.path,
            message: `${source} declares ${target.path}, and ${target.path} does not link back`,
            suggestion: `add a link to ${source} in ${target.path}, or remove ${target.path} from the declaration`,
          }
    case 'not-in-corpus': {
      // One finding, for the reason whose remedy comes first: a file that is not a
      // record is not fixed by widening the corpus.
      if (target.reasons.includes('not-markdown')) {
        return {
          target: target.path,
          message: `${target.path} is not a Markdown record`,
          suggestion: 'declare a record, not a file',
        }
      }
      if (target.reasons.includes('ignored')) {
        return {
          target: target.path,
          message: `${target.path} matches the corpus ignore option, so its links are not read`,
          suggestion: 'correct the link, or stop ignoring the path',
        }
      }
      return {
        target: target.path,
        message: `${target.path} is outside the corpus, so its links are not read`,
        suggestion: 'add its folder to the corpus roots, or correct the link',
      }
    }
    case 'missing':
      return {
        target: link.url,
        message: `${link.url} does not exist`,
        suggestion: 'correct the link to the record it means — the same fix clears resolve()',
      }
    case 'directory':
      return {
        target: target.path,
        message: `the link names a directory, ${target.path}, not a record`,
        suggestion: "link the record's file",
      }
    case 'self':
      return {
        target: source,
        message: 'the link points at this record',
        suggestion: 'remove it; a record does not relate to itself',
      }
    case 'external':
      return {
        target: link.url,
        message: `the declaration links outside the repository, to ${link.url}`,
        suggestion: 'declare a record in the corpus',
      }
  }
}

/**
 * Condition (plan 0406): each link's target links back to the link's document.
 * Any link back answers — several are one answer, and an incidental mention
 * counts. The back-links are every internal link in the corpus, resolved with
 * `resolveLink` and the same `options`, indexed on first evaluation.
 *
 * `examined` is the selected links: an empty selection fails with the
 * zero-examined finding. A link that cannot answer — a frozen record, a file
 * outside the corpus, a missing target — is one finding naming its cause, on
 * the declaring link's line, with its remedy as the suggestion.
 */
export function linkedBack(corpus: Corpus, options: LinkResolveOptions = {}): Condition<MdLink> {
  let index: Map<string, Set<string>> | undefined
  let byBasename: ReadonlyMap<string, readonly string[]> | undefined
  return {
    description: 'be linked back by their targets',
    evaluate: (links, ctx) => {
      index ??= linksFrom(corpus, options)
      const out: ArchViolation[] = []
      for (const link of links) {
        const target = resolveLink(link, corpus, options)
        if (target.kind === 'document' && index.get(target.path)?.has(link.doc.relPath) === true) {
          continue
        }
        const cause = unanswered(link, target)
        byBasename ??= basenameIndex(corpus)
        out.push(
          mdViolation({
            element: `${link.doc.relPath} → ${cause.target}`,
            file: link.doc.file,
            line: link.line,
            message: cause.message,
            sourceText: link.doc.text,
            fix: target.kind === 'missing' ? movedLinkFix(link, byBasename) : undefined,
            context: { ...ctx, suggestion: cause.suggestion },
          }),
        )
      }
      return out
    },
  }
}
