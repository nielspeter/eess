import { describe, expect, it } from 'vitest'
import { diagramKind } from '../../src/index.js'
import { diagramPreamble } from '../../src/parser/diagram-kind.js'

type PreambleReason = ReturnType<typeof diagramPreamble>['reason']

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
    // Bug 0429: a directive closes at its first `}%%`, wherever it is on the line, as Mermaid's own
    // directive pattern does. Each body below parses with mermaid 11.17.2 (measured).
    [
      'after an init closed mid-line by a comment',
      '%%{init: {"theme":"dark"}}%% %% note\nerDiagram\n  A ||--o{ B : x',
      'erDiagram',
    ],
    [
      'after a multi-line init closed mid-line',
      '%%{init: {\n  "theme": "dark"\n}}%% %% note\nsequenceDiagram',
      'sequenceDiagram',
    ],
    [
      'after two inits on one line',
      '%%{init: {"theme":"dark"}}%% %%{init: {"fontSize": 12}}%%\nerDiagram',
      'erDiagram',
    ],
    // Only the loop decides this one: after the first directive, the second still starts `%%{`.
    [
      'on the line of two inits',
      '%%{init: {"theme":"dark"}}%% %%{init: {"fontSize": 12}}%% erDiagram\n  A ||--o{ B : x',
      'erDiagram',
    ],
    [
      'on the line of its init',
      '%%{init: {"theme":"dark"}}%% erDiagram\n  A ||--o{ B : x',
      'erDiagram',
    ],
    [
      'on the line a multi-line init closes',
      '%%{init: {\n  "theme": "dark"\n}}%% sequenceDiagram',
      'sequenceDiagram',
    ],
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

// Plan 0413: why the walk reads the kind it does. Internal; mermaidParser() reads a failure with it.
describe('diagramPreamble()', () => {
  const cases: [string, string, PreambleReason, number | null][] = [
    ['a declared kind', 'flowchart TD\n  A --> B', 'declared', 1],
    ['a kind after frontmatter', '---\ntitle: x\n---\nerDiagram', 'declared', 4],
    ['a blank block', ' \n\t\n', 'empty', null],
    [
      'comments and a directive with no kind',
      '%% one\n%%{init: {}}%%',
      'no-kind-after-preamble',
      null,
    ],
    ['a directive that never closes', '%%{init: {\nerDiagram', 'unclosed-directive', null],
    ['frontmatter that never closes', '---\ntitle: x\nerDiagram', 'unclosed-frontmatter', null],
    // Mermaid reads frontmatter only when a newline follows its closing `---`.
    [
      'frontmatter with nothing after its close',
      '---\ntitle: x\n---',
      'unclosed-frontmatter',
      null,
    ],
    [
      'frontmatter whose close is indented',
      '---\ntitle: x\n  ---\nerDiagram',
      'unclosed-frontmatter',
      4,
    ],
  ]
  for (const [name, text, reason, kindLine] of cases) {
    it(`reads ${name} as ${reason}`, () => {
      expect(diagramPreamble(text)).toMatchObject({ reason, kindLine })
    })
  }
})

// PR review of plan 0413: the bindings select every block by `diagramKind`, so it stays the walk
// alone, with none of the line map's cost.
it('reads the kind of a diagram of several hundred kilobytes', () => {
  const relations = Array.from({ length: 25_000 }, (_, i) => `  E${String(i)} ||--o{ F : has`)
  expect(diagramKind(['erDiagram', ...relations, '  %% c'].join('\n'))).toBe('erDiagram')
})
