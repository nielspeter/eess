# Bug 0433: a kind on its directive's line is a comment to eess-mermaid's grammars

## Status

- **State:** Draft — recorded 2026-10-15 from PR #223's reviews ([bug 0429](./fixed/0429-diagramkind-reads-a-directive-closed-mid-line-as-open.md)). Measured; no red test of
  its own yet.
- **Severity:** Low — no false green: since [bug 0429](./fixed/0429-diagramkind-reads-a-directive-closed-mid-line-as-open.md) the block is selected and reported as a gap in
  eess-mermaid's grammar. The defect is that valid Mermaid is reported, and the remedy does not name
  the one-line fix.
- **Origin:** self-found · PR #223's enforcement and method reviews, 2026-10-15.
- **Reported:** 2026-10-15

## Symptom

```js
parseErDiagram('%%{init: {"theme":"dark"}}%% erDiagram\n  A ||--o{ B : x') // throws
parseErDiagram('%%{init: {"theme":"dark"}}%%\nerDiagram\n  A ||--o{ B : x') // parses
parseClassDiagram('%%{init: {"theme":"dark"}}%% classDiagram\n  class A') // throws
parseClassDiagram('%%{init: {"theme":"dark"}}%%\nclassDiagram\n  class A') // parses
```

Measured on the built `@nielspeter/eess-mermaid`, 2026-10-15. `mermaid` 11.17.2 parses all four. Through
`tableErAgree`, the first block is reported as not parsing with eess-mermaid's ER grammar
(`packages/crossvalidate/tests/md-mermaid-er.test.ts`, the [bug 0429](./fixed/0429-diagramkind-reads-a-directive-closed-mid-line-as-open.md) grammar-gap test), and the
remedy sends the author to the Mermaid Live Editor and an upstream report, not to the newline that
clears it.

## Root cause

Both grammars read `%%` to the end of the line as a hidden comment:
`packages/mermaid/src/parser/grammar/er-diagram.langium:42` and
`packages/mermaid/src/parser/grammar/class-diagram.langium:65`. A `%%{…}%%` directive is such a line,
so a kind written after its `}%%` is swallowed with it. Mermaid removes the directive first and keeps
the rest of the line.

## Fix

Undecided. Either the grammars treat a `%%{…}%%` directive as a token that ends at `}%%`, or the text
is preprocessed as Mermaid does before parsing. [Plan 0413](../plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md)
makes Mermaid's own parser answer syntax, which may change what this gap costs; decide after it.

## Verification

- [ ] Red test first, through `parseErDiagram` and `parseClassDiagram`
- [ ] The [bug 0429](./fixed/0429-diagramkind-reads-a-directive-closed-mid-line-as-open.md) grammar-gap test in `md-mermaid-er.test.ts` updated to expect a comparison

Deferred: none
