import type { Condition } from '@nielspeter/eess'
import type { MdMention } from '../model/mentions.js'
import { mdViolation } from '../model/violation.js'

const LINK_IT =
  'Link it to what it names. If it quotes an example rather than naming something, move the example into a fenced code block, which is not read.'
const LINK_CODE =
  'Put a link around it, or, if it quotes an example rather than naming something, move the example into a fenced code block, which is not read.'

/**
 * Plan 0539: every selected mention sits in a link. Presence only: which file the link points at is
 * not judged here, so a link to the wrong record is linked. A mention in inline code is a finding with
 * its own message, since inline code is read: wrapping a number in backticks does not hide it.
 */
export function beLinked(): Condition<MdMention> {
  return {
    description: 'be linked',
    evaluate: (mentions, ctx) =>
      mentions
        .filter((m) => m.link === undefined)
        .map((m) => {
          const text = m.text.replace(/\s+/g, ' ')
          return mdViolation({
            element: `${m.doc.relPath}:${String(m.line)}`,
            file: m.doc.file,
            line: m.line,
            message: m.inCode
              ? `"${text}" is in inline code, not a link`
              : `"${text}" is not a link`,
            sourceText: m.doc.text,
            context: { ...ctx, suggestion: ctx.suggestion ?? (m.inCode ? LINK_CODE : LINK_IT) },
          })
        }),
  }
}
