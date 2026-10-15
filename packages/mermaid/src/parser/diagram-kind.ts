/**
 * The declared kind of a Mermaid diagram (plan 0214): the first token of the line that declares it,
 * such as `erDiagram`, `graph` or `stateDiagram-v2`, or `''` when the text declares none.
 *
 * Mermaid's grammar treats `%%…` lines as hidden terminals and permits a `---` frontmatter block, so
 * the keyword is not necessarily the first thing in a diagram. This is the one lexer for that
 * question in the family; it used to live in eess-crossvalidate as `declaredKind()`, while the ER
 * binding tested the raw text and missed a themed diagram entirely (bug 0210).
 */
export function diagramKind(text: string): string {
  return (declaredLine(text).split(/[\s{]/)[0] ?? '').trim()
}

function declaredLine(text: string): string {
  const lines = text.split(/\r?\n/)
  let i = 0
  if (lines[0]?.trim() === '---') {
    i = 1
    while (i < lines.length && lines[i]?.trim() !== '---') i += 1
    i += 1
  }
  let inDirective = false
  for (; i < lines.length; i += 1) {
    const line = lines[i]?.trim() ?? ''
    if (line === '') continue
    // `%%{ … }%%` may span lines. Track it, or the continuation line gets read as the declared kind:
    // measured, a multi-line init block ahead of a sequenceDiagram made it selected.
    if (inDirective) {
      if (line.endsWith('}%%')) inDirective = false
      continue
    }
    if (line.startsWith('%%{') && !line.endsWith('}%%')) {
      inDirective = true
      continue
    }
    if (line.startsWith('%%')) continue
    return line
  }
  return ''
}
