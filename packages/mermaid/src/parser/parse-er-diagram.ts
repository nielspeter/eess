import { ErDiagramGrammarGeneratedModule } from './generated/module.js'
import type { ErDiagram } from './generated/ast.js'
import { parseWithGrammar } from './parse-with-grammar.js'

/** Parse a Mermaid `erDiagram` source into the generated AST (plan 0069 Phase 3). */
export function parseErDiagram(text: string): ErDiagram {
  return parseWithGrammar<ErDiagram>(ErDiagramGrammarGeneratedModule, text)
}
