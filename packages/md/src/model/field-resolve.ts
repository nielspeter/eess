import type { MdDocument } from './document.js'
import { readFields, STRUCTURED_FORMS, type FieldOccurrence, type FieldOptions } from './fields.js'
import type { SetAside } from './prose.js'

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
 * A resolved occurrence whose value is empty after cutting is its own outcome, `'empty'`: a label
 * is there and no value can be read from it. It reads occurrences, not split values, so a
 * multi-valued field is one occurrence and never a conflict with itself. Fenced code is set aside
 * with `'code-blocks'` by default: for a presence question, reading past an unclosed fence would err
 * toward "present".
 */
type FieldResolution =
  | {
      readonly kind: 'value'
      readonly occurrence: FieldOccurrence
      /** Plain occurrences that disagree with the resolved value. */
      readonly disagreeing: readonly FieldOccurrence[]
    }
  | { readonly kind: 'empty'; readonly occurrence: FieldOccurrence }
  | { readonly kind: 'conflict'; readonly occurrences: readonly FieldOccurrence[] }
  | { readonly kind: 'none' }

const sameValue = (a: FieldOccurrence, b: FieldOccurrence): boolean =>
  a.values.join('\u0000') === b.values.join('\u0000')

/** An occurrence with no readable value: every value it was split into is empty. */
const isEmpty = (o: FieldOccurrence): boolean => o.values.every((v) => v === '')

function resolved(
  occurrence: FieldOccurrence,
  disagreeing: readonly FieldOccurrence[],
): FieldResolution {
  return isEmpty(occurrence)
    ? { kind: 'empty', occurrence }
    : { kind: 'value', occurrence, disagreeing }
}

export function resolveField(
  doc: MdDocument,
  options: FieldOptions,
  setAside: SetAside = 'code-blocks',
): FieldResolution {
  const found = readFields(doc, options, setAside)
  const structured = found.filter((o) => STRUCTURED_FORMS.includes(o.form))
  const plain = found.filter((o) => !STRUCTURED_FORMS.includes(o.form))
  const [first] = structured
  if (structured.length >= 2) return { kind: 'conflict', occurrences: structured }
  if (first !== undefined)
    return resolved(
      first,
      plain.filter((p) => !sameValue(p, first)),
    )
  const [onlyPlain] = plain
  if (onlyPlain === undefined) return { kind: 'none' }
  if (plain.every((p) => sameValue(p, onlyPlain))) return resolved(onlyPlain, [])
  return { kind: 'conflict', occurrences: plain }
}
