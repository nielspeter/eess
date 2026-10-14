---
'@nielspeter/eess-md': patch
---

YAML front matter is no longer read as a section. A document opening with `---` front matter used
to report a depth-2 section named with the YAML's own text, which `docs().haveSection()` could
match and a table's `sectionPath` inherited (bug 0087). Now a line-1 `---` block is front matter —
a `yaml` node, not a section — when it is a YAML mapping that parses without error and holds no task
box and no link into the repository. Any other `---` block is read as Markdown, as before, so a
document that merely opens with a horizontal rule keeps every box and link checked, and front matter
that is not valid YAML still shows its old phantom section. `terms()`, `pointers()` and the ledger
read front-matter lines either way. Adds `micromark-extension-frontmatter`, `mdast-util-frontmatter`
and `yaml`.
