import { ClassDiagramGrammarGeneratedModule } from './generated/module.js'
import type { Diagram } from './generated/ast.js'
import { parseWithGrammar } from './parse-with-grammar.js'

// Re-exported from its original home: `MermaidUnitParseError` moved to
// `parse-with-grammar.js` when the two parsers were folded together, and this
// module is the path `src/index.ts` and the tests already import it from.
export { MermaidUnitParseError } from './parse-with-grammar.js'

/** Parse a Mermaid `classDiagram` source into the generated AST. */
export function parseClassDiagram(text: string): Diagram {
  return parseWithGrammar<Diagram>(ClassDiagramGrammarGeneratedModule, text)
}
