/**
 * Where a link's destination sits in its raw text (bugs 0558 and 0563), for a fix that rewrites
 * it: never a title or a label that holds the same text. One owner for the inline link and the
 * link reference definition, which differ only in what opens the destination (`](` or `]:`).
 */

/**
 * Where the destination starts, reading from `from` (just after the `](` or `]:` that opens it):
 * spaces or tabs and a line ending, then an optional `<`. The bound of one line ending is
 * defensive: a blank line ends the paragraph or the definition, so no parsed node reaches a
 * second one, and `undefined` past it is never returned for one.
 */
export function destinationAt(raw: string, from: number): number | undefined {
  let i = from
  let lineEndings = 0
  while (i < raw.length && /\s/.test(raw.charAt(i))) {
    if (raw[i] === '\n' && ++lineEndings > 1) return undefined
    i++
  }
  return raw[i] === '<' ? i + 1 : i
}

/**
 * True when `url` is written at `at` exactly as the parser read it, and ends there: at the end,
 * a space, a `>`, or (for an inline link, which `)` closes) a `)`. A destination with an escape
 * or an entity is not written as it reads, so it gets no span, and no fix guesses at it.
 */
export function writtenAt(raw: string, at: number, url: string): boolean {
  if (url === '' || !raw.startsWith(url, at)) return false
  const after = raw.charAt(at + url.length)
  return after === '' || /[\s>)]/.test(after)
}

/**
 * `target` written as a link destination, or `undefined` when no destination form keeps it (bug
 * 0567). The one writer beside the reader above, for every fix that writes a destination (the
 * mention fix, the moved-link fix): an entity would be decoded, and `<`, `>`, `\\` or a line break
 * would end or change it, so each is refused; a space or a parenthesis would end a bare destination,
 * so the target goes in `<…>`, or, when `angle` says the span already sits inside `<…>`, as it is.
 */
export function writeDestination(target: string, angle = false): string | undefined {
  if (/&[#A-Za-z0-9]+;/.test(target) || /[<>\\\n]/.test(target)) return undefined
  if (angle) return target
  return /[\s()]/.test(target) ? `<${target}>` : target
}
