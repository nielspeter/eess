import { createMermaidParser, type MermaidParser } from './create-mermaid-parser.js'

/**
 * Mermaid's own parser, for eess-md's `parseCodeBlocks` (plan 0413): it says whether a block
 * parses with the `mermaid` package GitHub renders with. It is not `parseClassDiagram`, which is
 * eess's own grammar, used to bind a diagram to code.
 *
 * `mermaid` (11) and `jsdom` are optional peers, loaded only inside a worker thread, so the DOM
 * globals Mermaid needs never reach the caller's process. Never throws: a missing peer is reported
 * by `parse`, as the instrument.
 *
 * ```ts
 * const parsed = await parseCodeBlocks(corpus, { language: 'mermaid', parser: mermaidParser() })
 * codeBlocks(parsed).should().parse().check()
 * ```
 */
export function mermaidParser(): MermaidParser {
  return createMermaidParser({ workerUrl: new URL('./mermaid-worker.mjs', import.meta.url) })
}
