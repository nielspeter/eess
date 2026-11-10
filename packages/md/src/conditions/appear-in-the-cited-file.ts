import type { Condition } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import { citedPaths } from '../model/code-path.js'
import type { MdMention } from '../model/mentions.js'
import type { ArchViolation } from '../model/violation.js'
import { isReference, readReference, referenceFinding } from './code-reference.js'

/** The groups this condition reads: it judges a file, so it needs no line. */
export const APPEAR_IN_THE_CITED_FILE_GROUPS: readonly string[] = ['name', 'path']

/**
 * Condition (plan 0648): a named code reference's name appears in the file it cites, as a whole
 * token, in code or in text. It needs no code facts, so it serves any language whose names are
 * ASCII identifiers. It claims the file holds the name, not that the cited line does, nor that the
 * name is code there: a name left only in a comment holds. In-corpus only: a path the corpus does
 * not hold is reported, never skipped.
 */
export function appearInTheCitedFile(corpus: Corpus): Condition<MdMention> {
  const paths = citedPaths(corpus, 'suffix')
  return {
    description: 'name code that appears in the cited file',
    evaluate: (mentions, ctx) =>
      mentions.flatMap((m): ArchViolation[] => {
        const read = readReference(m, APPEAR_IN_THE_CITED_FILE_GROUPS, ctx)
        if (!isReference(read)) return [read]
        const { name, judged, path } = read
        const cited = paths.classify(path)
        if (cited.kind === 'ambiguous') {
          return [
            referenceFinding(
              m,
              ctx,
              `\`${name}\`: "${path}" matches ${String(cited.candidates.length)} files ` +
                `(${cited.candidates.join(', ')}), so this rule cannot judge which file is cited`,
              'Write enough of the path to name one file.',
              true,
            ),
          ]
        }
        if (cited.kind === 'broken') {
          return [
            referenceFinding(
              m,
              ctx,
              `\`${name}\`: "${path}" does not exist in this corpus, so \`${judged}\` cannot appear in it`,
              "Cite the file's path as it is in the corpus. pointers().resolve() reports the same " +
                'pointer under its own id; its waivers do not cover this rule.',
              false,
            ),
          ]
        }
        if (paths.tokens(cited.rel).has(judged)) return []
        const rule = ctx.ruleId ?? '<rule id>'
        return [
          referenceFinding(
            m,
            ctx,
            `\`${judged}\` is not in ${cited.rel}, as code or as text` +
              (judged === name ? '' : ` (judged as the last segment of \`${name}\`)`),
            'If it was renamed, write its new name. If it moved, cite the file it moved to. If this ' +
              'name belongs to another pointer in the sentence, reword so each name sits beside its ' +
              'own. If the sentence cites old code on purpose, waive it here with ' +
              `<!-- eess-exclude ${rule}: <reason> -->.`,
            false,
          ),
        ]
      }),
  }
}
