# Bug 0435: the line map reads no frontmatter after a blank line or a comment; Mermaid does

## Status

- **State:** Draft — recorded 2026-10-16 in plan 0413's PR, from its enforcement review. No red test
  of the fix yet.
- **Severity:** Low — no false green, and since that PR no wrong line: such a block's syntax error
  claims no line and says why. What is left is a wrong remedy in one case (below).
- **Origin:** self-found · PR review of plan 0413, 2026-10-16.
- **Reported:** 2026-10-16

## Symptom

Mermaid 11.17.2, measured through plan 0413's worker, strips frontmatter that the line map's
frontmatter step (`packages/mermaid/src/parser/mermaid-line-map.ts:13`, Mermaid's own
`frontMatterRegex`, anchored at the text's start) does not match:

| block                                                            | Mermaid                                   |
| ---------------------------------------------------------------- | ----------------------------------------- |
| `\n\n---\ntitle: x\n---\nflowchart TD\n  A --> B\n  C --> --> D` | parses the frontmatter; error line 3      |
| `  \n---\n…` (spaces, then a newline)                            | the same                                  |
| `%% c\n---\ntitle: x\n---\nflowchart TD\n  C --> --> D`          | parses the frontmatter; error line 2      |
| `\n  ---\n  title: x\n  ---\n…` (indented, after a blank)        | refuses it: "Diagrams beginning with ---" |

So the line map's mapped line is wrong for the first three, and `diagramPreamble` reads them as
`unclosed-frontmatter`. Where Mermaid placed a syntax error, `mermaidParser()` now claims no line
and says the map does not read this frontmatter. Where Mermaid throws `UnknownDiagramError` (the
frontmatter, then no diagram), the remedy is "close the frontmatter", which is wrong.

## Root cause

Not found. Mermaid's `preprocessDiagram` and `extractFrontMatter` in `dist/mermaid.core.mjs` show no
trim before the frontmatter match, yet it is matched. The step that removes the leading blank line
or comment was not located.

## Fix

Find the step and mirror it in the line map, then let the line canary hold a block of this shape.

## Verification

- [ ] The step located in Mermaid's source
- [ ] Red test first: the first block above is `invalid` on line 8, its `C --> --> D` line

Deferred: none
