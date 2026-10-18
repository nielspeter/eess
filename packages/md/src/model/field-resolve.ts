import type { MdDocument } from './document.js'
import { readFields, type FieldOccurrence, type FieldOptions } from './fields.js'

/**
 * What one document's labelled value resolves to (plan 0469, proposal 017 block 2), decided in one
 * place so block 5 reuses the same precedence:
 *
 * 1. Structured beats plain: `bold`, `heading` and `bold-line` win over `plain`.
 * 2. One structured occurrence resolves the value; a `plain` one that disagrees is reported at its
 *    own line, and the resolved value stands.
 * 3. Two or more structured occurrences, agreeing or not, are a conflict.
 * 4. Only `plain` occurrences resolve the value when they all agree, and conflict when they do not.
 * 5. No occurrence: the document has no value.
 *
 * It reads occurrences, not split values, so a multi-valued field is one occurrence and never a
 * conflict with itself. Fenced code is set aside with `'code-blocks'`: for a presence question,
 * reading past an unclosed fence would err toward "present".
 */
type FieldResolution =
  | {
      readonly kind: 'value'
      readonly occurrence: FieldOccurrence
      /** Plain occurrences that disagree with the resolved value. */
      readonly disagreeing: readonly FieldOccurrence[]
    }
  | { readonly kind: 'conflict'; readonly occurrences: readonly FieldOccurrence[] }
  | { readonly kind: 'none' }

const sameValue = (a: FieldOccurrence, b: FieldOccurrence): boolean =>
  a.values.join('\u0000') === b.values.join('\u0000')

export function resolveField(doc: MdDocument, options: FieldOptions): FieldResolution {
  const found = readFields(doc, options, 'code-blocks')
  const structured = found.filter((o) => o.form !== 'plain')
  const plain = found.filter((o) => o.form === 'plain')
  const [first] = structured
  if (structured.length >= 2) return { kind: 'conflict', occurrences: structured }
  if (first !== undefined) {
    return {
      kind: 'value',
      occurrence: first,
      disagreeing: plain.filter((p) => !sameValue(p, first)),
    }
  }
  const [onlyPlain] = plain
  if (onlyPlain === undefined) return { kind: 'none' }
  if (plain.every((p) => sameValue(p, onlyPlain))) {
    return { kind: 'value', occurrence: onlyPlain, disagreeing: [] }
  }
  return { kind: 'conflict', occurrences: plain }
}
