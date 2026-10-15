import { tagIsLanguage } from '@nielspeter/eess-md/internal'

/**
 * Is this fence tagged as Mermaid? In any letter case (bug 0423): a fence tagged `Mermaid` is plainly
 * meant as a diagram, and comparing the tag exactly skipped it without a word. eess-md owns the
 * comparison, for the whole family (ADR-019).
 *
 * A module of its own, not `shared.ts`: only the two bindings that read Markdown load it, so
 * `./mermaid-ts` and `./gherkin-ts` still load without eess-md, an optional peer, installed.
 */
export function isMermaidTag(lang: string | null): boolean {
  return tagIsLanguage(lang, 'mermaid')
}
