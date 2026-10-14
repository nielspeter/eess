---
'@nielspeter/eess-md': patch
---

YAML front matter is no longer read as a section. A document opening with `---` front matter used
to report a depth-2 section named with the YAML's own text, which `docs().haveSection()` could
match and a table's `sectionPath` inherited (bug 0087). Front matter now parses to a `yaml` node:
`sections` and `sectionPath` hold only real headings. `terms()`, `pointers()` and the ledger still
read front-matter lines. A Markdown link written inside front matter is no longer read as a link —
a renderer shows YAML as data, not as Markdown. Adds `micromark-extension-frontmatter` and
`mdast-util-frontmatter`, from the micromark/mdast family eess-md already uses.
