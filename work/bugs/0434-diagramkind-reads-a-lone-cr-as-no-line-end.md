# Bug 0434: `diagramKind` reads a lone `\r` as no line end, where Mermaid reads a line end

## Status

- **State:** Draft — recorded 2026-10-16 while building plan 0413. No red test yet.
- **Severity:** Low — in `mermaidParser()` Mermaid's acceptance and a syntax error Mermaid places
  both outrank the walk (plan 0413's outcome table, as built), so neither is misreported. What is
  left there: a lone-`\r` block that Mermaid rejects as an unknown kind gets the "declares no
  diagram" remedy instead of "check the spelling". In md-mermaid-er, which selects ER blocks by
  `diagramKind`, it may skip a block: not measured.
- **Origin:** self-found · building plan 0413, 2026-10-16.
- **Reported:** 2026-10-16

## Symptom

`diagramKind('%% c\rflowchart TD\r  A --> B')` is `''`. Mermaid 11.17.2 parses the same text as a
flowchart (measured through plan 0413's worker): its preprocessing rewrites `/\r\n?/g` to `\n`
first. The walk splits on `/\r?\n/` (`packages/mermaid/src/parser/diagram-kind.ts:53`), so the
whole text is one line, starting `%%`, and is skipped as a comment.

eess-md keeps the lone `\r` in a block's value (measured: a Markdown file with that block gives
`"%% c\rflowchart TD\r  A --> B"`).

_Correction, 2026-10-16 (PR review of plan 0413):_ the first version of this record said the misread
"cannot blame an author" in `mermaidParser()`. It could: the first build routed a syntax error by
the walk's reason, so `%% c\rflowchart TD\r  A --> B\r  C --> --> D` got "declares no diagram"
(measured by the PR's enforcement and method reviews). The build now lets a placed syntax error
outrank the walk; the Severity above is restated.

A kind after a lone `\r` with nothing before it is still read
(`'erDiagram\r  A ||--o{ B : x'` gives `erDiagram`, since `\r` is whitespace to the token split).
Only a comment, a directive or frontmatter ahead of the kind loses it.

## Root cause

The walk and Mermaid's preprocessing disagree about what ends a line.

## Fix

Not designed. Splitting on `/\r\n?|\n/` would match Mermaid. When it is fixed, plan 0413's ok-wins
fixtures (`scripts/nonvacuity/bad-mermaid-parser/ok-wins/`, and the test "lets Mermaid accepting a
block win over the preamble walk" in `packages/mermaid/tests/mermaid-parser.test.ts`) stop
exercising a disagreement and need another block, as bug 0429's fix did to plan 0413's first one.

## Verification

- [ ] Red test first: `diagramKind` of the block above is `flowchart`
- [ ] Whether md-mermaid-er skips such an `erDiagram` block, measured

Deferred: none
