# Bugs — the board

One row per bug; fixed bugs move to [`fixed/`](./fixed/) at close (same-PR
convention, `/close`).

| Bug                                                      | Symptom                                                                          | State |
| -------------------------------------------------------- | -------------------------------------------------------------------------------- | ----- |
| [0084](./0084-preserve-relations-right-to-left.md)       | `preserveRelations` checks nothing right→left; `both` is half a gate             | Draft |
| [0085](./0085-table-row-violations-report-table-line.md) | table-row violations report the table's line and a row ordinal, not the row      | Draft |
| [0086](./0086-links-to-directories-do-not-resolve.md)    | a link to a directory that exists is reported broken; blocks gating `work/bugs/` | Draft |
| [0083](./fixed/0083-langium-node26-invalid-url.md)       | `langium generate` (mermaid build) throws `Invalid URL` on Node ≥26              | Fixed |
| [0074](./fixed/0074-init-esm-type-module.md)             | `eess-ts check` crashes on its own scaffolded config in CJS projects             | Fixed |
