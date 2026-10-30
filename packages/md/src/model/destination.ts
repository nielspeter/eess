/**
 * Where a link's destination sits in its raw text (bugs 0558 and 0563), for a fix that rewrites
 * it: never a title or a label that holds the same text. One owner for the inline link and the
 * link reference definition, which differ only in what opens the destination (`](` or `]:`).
 */

/**
 * Where the destination starts, reading from `from` (just after the `](` or `]:` that opens it):
 * spaces or tabs and at most one line ending, then an optional `<`. `undefined` past a second
 * line ending, where no destination can be.
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
 * a space, a `>` or a `)`. A destination with an escape or an entity is not written as it reads,
 * so it gets no span, and no fix guesses at it.
 */
export function writtenAt(raw: string, at: number, url: string): boolean {
  if (url === '' || !raw.startsWith(url, at)) return false
  const after = raw.charAt(at + url.length)
  return after === '' || /[\s>)]/.test(after)
}
