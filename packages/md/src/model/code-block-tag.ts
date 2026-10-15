/**
 * Does a code block's tag name this language? The one comparison of a fence's tag in the family
 * (ADR-019): letter case is folded on both sides, and nothing else is normalised — no trimming, no
 * aliases, so `mmd` is not `mermaid`. `lang` is mdast's, the info string's first word; a fence with
 * no tag names no language.
 *
 * Every reader that selects a block by its tag calls this rather than comparing `.lang` itself:
 * `parseCodeBlocks` here, and eess-crossvalidate's `isMermaidTag` through `/internal`. `arch.rules.ts`
 * (`eess/one-code-block-tag-comparison`) reds a second comparison.
 */
export function tagIsLanguage(lang: string | null, language: string): boolean {
  return lang !== null && lang.toLowerCase() === language.toLowerCase()
}
