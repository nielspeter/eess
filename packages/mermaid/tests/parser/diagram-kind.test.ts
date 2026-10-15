import { describe, expect, it } from 'vitest'
import { diagramKind } from '../../src/index.js'

// Plan 0214: the one lexer for "what kind of Mermaid diagram is this", moved here from
// eess-crossvalidate. It returns the declared kind token, after `%%` comments, `%%{init}%%`
// directives (one line or several) and `---` frontmatter, or '' when the fence declares none.
describe('diagramKind()', () => {
  const cases: [string, string, string][] = [
    ['a plain keyword', 'erDiagram\n  A ||--o{ B : has', 'erDiagram'],
    ['a keyword with arguments', 'graph TD\n  A --> B', 'graph'],
    ['a keyword followed by a brace', 'classDiagram{\n}', 'classDiagram'],
    ['after a comment', '%% a comment\nsequenceDiagram\n  A->>B: hi', 'sequenceDiagram'],
    ['after a one-line init', '%%{init: {"theme": "dark"}}%%\nerDiagram', 'erDiagram'],
    [
      'after a multi-line init',
      '%%{init: {\n  "theme": "dark"\n}}%%\nsequenceDiagram',
      'sequenceDiagram',
    ],
    ['after frontmatter', '---\ntitle: x\n---\nerDiagram', 'erDiagram'],
    ['after blank lines and CRLF', '\r\n\r\nstateDiagram-v2\r\n  [*] --> A', 'stateDiagram-v2'],
    ['an empty fence', '', ''],
    ['a fence of only comments', '%% one\n%% two', ''],
    ['a fence whose init never closes', '%%{init: {\nerDiagram', ''],
  ]
  for (const [name, body, kind] of cases) {
    it(`reads ${name} as ${kind === '' ? 'no kind' : kind}`, () => {
      expect(diagramKind(body)).toBe(kind)
    })
  }

  // md-mermaid's FOREIGN_HEADER and md-mermaid-er's ER_HEADER used to test the declared LINE. They
  // now test the token. Both are anchored with `\b`, so a token matches exactly where its line did.
  it('gives a token every header regex reads the same as the line it came from', () => {
    const lines = [
      'sequenceDiagram',
      'flowchart LR',
      'graph TD',
      'stateDiagram-v2',
      'erDiagram',
      'gantt',
      'sankey-beta',
      'C4Context',
      'classDiagram-v2',
      'xychart-beta',
    ]
    const header =
      /^(?:sequenceDiagram|flowchart|graph|stateDiagram(?:-v2)?|erDiagram|gantt|sankey(?:-beta)?|xychart(?:-beta)?|C4(?:Context))\b/
    for (const line of lines) {
      expect(header.test(diagramKind(line))).toBe(header.test(line))
    }
  })
})
