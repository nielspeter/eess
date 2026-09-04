/**
 * How the corpus gate's summary names the pointer classes it found.
 *
 * Extracted from `check-corpus.mjs` because the labels are the part that has
 * been wrong twice and could not be tested in place. The first version had two
 * buckets — broken and "everything else, called stale" — which sent a reader
 * looking for a line number in a file that does not exist. Splitting it fixed
 * that. Then bug 0254 added a third class, and the two-bucket split printed
 * "16 stale (line past end)" over sixteen AMBIGUOUS pointers: the same
 * mislabelling, one class later, because a `rest` bucket did not exist.
 *
 * So the shape is a table plus an explicit unclassified bucket. A fourth class
 * cannot be silently absorbed into a wrong label — it is named as unclassified
 * and the summary says where to add it.
 *
 * Classification is by message prefix rather than a structured field. That is a
 * known coupling to `pointer-resolve.ts`'s wording, flagged in review; the
 * `unclassified` bucket is what makes the coupling safe to have, because drift
 * surfaces as a visible bucket instead of a wrong count under a right-looking
 * label.
 */

/** `[label, message prefix, the gloss that tells a reader what to do]`. */
export const POINTER_CLASSES = [
  ['broken', 'broken code pointer', 'no such file'],
  ['stale', 'stale code pointer', 'line past end'],
  ['ambiguous', 'ambiguous code pointer', 'matches several files'],
]

/**
 * The `pointers` row's verdict, given every pointer violation the run produced.
 *
 * Takes the messages rather than the violations so it stays a pure string
 * function with nothing to mock.
 */
export function pointerSummary(messages) {
  if (messages.length === 0) return '✓ all ground in code'
  const parts = []
  let classified = 0
  for (const [label, prefix, gloss] of POINTER_CLASSES) {
    const n = messages.filter((m) => m.startsWith(prefix)).length
    classified += n
    if (n > 0) parts.push(`${n} ${label} (${gloss})`)
  }
  const rest = messages.length - classified
  if (rest > 0) {
    parts.push(
      `${rest} unclassified — add its class to POINTER_CLASSES in scripts/lib/pointer-classes.mjs`,
    )
  }
  return `✗ ${parts.join(' · ')}`
}
