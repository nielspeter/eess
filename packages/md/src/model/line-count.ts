/**
 * The lines a text has, as an editor's gutter and a `path:line` pointer number them: a final
 * newline ends the last line rather than starting one, and an empty text has none. Lines end at
 * LF only: a CRLF file counts the same (its `\r` stays inside the line), and a lone `\r` does not
 * end a line. One count for the family's readers (bug 0561): `split('\n').length` counted one more
 * for every text ending in a newline.
 */
export function lineCount(text: string): number {
  if (text === '') return 0
  return (text.endsWith('\n') ? text.slice(0, -1) : text).split('\n').length
}
