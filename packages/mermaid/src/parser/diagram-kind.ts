import { mermaidPreprocessed } from './mermaid-line-map.js'

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
  // The walk alone: the reason below needs Mermaid's preprocessing, and the bindings that select
  // blocks by kind need neither its cost nor its dependence on one Mermaid version.
  return kindOf(declaredLine(text).line)
}

function kindOf(line: string): string {
  return (line.split(/[\s{]/)[0] ?? '').trim()
}

/**
 * Why a block declares the kind it does (plan 0413). `declared` when the walk finds a kind; otherwise
 * the first that holds of: Mermaid sees frontmatter it cannot close (`unclosed-frontmatter`), a `%%{`
 * directive never closes (`unclosed-directive`), the block is blank (`empty`), or something precedes
 * no kind (`no-kind-after-preamble`). Internal to eess-mermaid: no adopter needs the reason.
 */
type PreambleReason =
  | 'declared'
  | 'empty'
  | 'no-kind-after-preamble'
  | 'unclosed-directive'
  | 'unclosed-frontmatter'

interface DiagramPreamble {
  /** As `diagramKind` returns it: the kind token, or `''`. */
  readonly kind: string
  /** The 1-based block line the kind is declared on, or `null` when none is. */
  readonly kindLine: number | null
  readonly reason: PreambleReason
}

export function diagramPreamble(text: string): DiagramPreamble {
  const walked = declaredLine(text)
  const kind = kindOf(walked.line)
  // Mermaid's own test for frontmatter it could not read: what is left after its preprocessing
  // still begins with `---` (its `---` diagram detector). The same steps as the line map, so the
  // two cannot disagree about it.
  if (/^---/.test(mermaidPreprocessed(text).text.toLowerCase())) {
    return { kind, kindLine: walked.at, reason: 'unclosed-frontmatter' }
  }
  if (kind !== '') return { kind, kindLine: walked.at, reason: 'declared' }
  if (walked.inDirective) return { kind, kindLine: null, reason: 'unclosed-directive' }
  if (text.trim() === '') return { kind, kindLine: null, reason: 'empty' }
  return { kind, kindLine: null, reason: 'no-kind-after-preamble' }
}

function declaredLine(text: string): { line: string; at: number | null; inDirective: boolean } {
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
    return { line, at: i + 1, inDirective: false }
  }
  return { line: '', at: null, inDirective }
}
