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
    let line = lines[i]?.trim() ?? ''
    // `%%{ … }%%` may span lines. Track it, or the continuation line gets read as the declared kind:
    // measured, a multi-line init block ahead of a sequenceDiagram made it selected. A directive
    // closes at its FIRST `}%%`, wherever it is on the line, as Mermaid's own pattern does; what
    // follows is read as the rest of the line (bug 0429: `%%{init}%% %% note` stayed open).
    if (inDirective) {
      const close = line.indexOf('}%%')
      if (close === -1) continue
      inDirective = false
      line = line.slice(close + 3).trim()
    }
    while (line.startsWith('%%{')) {
      const close = line.indexOf('}%%')
      if (close === -1) {
        inDirective = true
        break
      }
      line = line.slice(close + 3).trim()
    }
    if (inDirective || line === '' || line.startsWith('%%')) continue
    return line
  }
  return ''
}
