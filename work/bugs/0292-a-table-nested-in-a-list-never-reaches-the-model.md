# Bug 0292: a table nested in a list item or blockquote never reaches the document model, so no row rule sees it

## Status

- **State:** Draft. Measured on `main` through the document model and the row matcher; no red test yet.
- **Severity:** **Medium.** Rows in a nested table are invisible to every table consumer. Each consumer's verdict follows by construction and was not measured, so the direction depends on the rule:
  - **silent** where another table supplies the evidence, as in a citation lookup;
  - **loud** where completeness is asserted, as in a correspondence that expects every row.

  Raise to High if a silent path is measured.

- **Origin:** self-found · architecture review of a markdown design
- **Reported:** 2026-09-13

## Symptom

`buildDocument` collects tables from the root's direct children only (`packages/md/src/model/document.ts:115`, inside the loop at `packages/md/src/model/document.ts:109`). A GFM table inside a list item or a blockquote is therefore absent from the document's tables, and every consumer of that list sees nothing:

- the row matcher (`packages/md/src/model/rows.ts:79`);
- the ADR citation table lookup (`packages/crossvalidate/src/md-ts.ts:46`);
- the table structure condition (`packages/md/src/conditions/structure.ts:40`).

## Reproduce

```text
top.md
# Top

| Name | Value |
| ---- | ----- |
| a    | 1     |

quote.md
# Quote

> | Name | Value |
> | ---- | ----- |
> | b    | 2     |

list.md
# List

- item:

  | Name | Value |
  | ---- | ----- |
  | c    | 3     |
```

Measured on `main` at `2a2a503`:

| Document | The parser's tables | The document's tables | Rows matched for columns `Name`, `Value` (`matchTableRows`) |
| -------- | ------------------- | --------------------- | ----------------------------------------------------------- |
| top.md   | 1                   | 1                     | 1 (`a`)                                                     |
| quote.md | 1                   | **0**                 | **0**                                                       |
| list.md  | 1                   | **0**                 | **0**                                                       |

## The corruption that must produce a violation

A table must reach every table consumer wherever it sits: at top level, in a list item, or in a blockquote.

## A constraint on any fix

Two consumers take the first matching table:

- the ADR preset's table checks, which use `matchTableRows` in first mode;
- the ADR citation lookup.

If nested tables simply join the list in document order, a nested example table placed before the real one would win, and the real table would silently stop being checked. A fix must say which table first-match consumers take.

## Verification ledger

- [x] Nested tables reach neither the model nor the row matcher on `main`; the top-level control does.
- [ ] Red tests, one per consumer, including a nested example table before a top-level real one, and a nested-only table.
- [ ] The fix.
- [ ] A non-vacuity row on the nested shape.

## Related

- [0290](./0290-a-code-block-nested-in-a-list-is-never-checked.md): the same loop, for code blocks.
