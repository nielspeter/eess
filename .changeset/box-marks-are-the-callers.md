---
'@nielspeter/eess-md': minor
---

**Breaking:** box marks beyond GFM's `[ ]` and `[x]` are now read, and an undeclared one is a finding (plan 0454, bug 0445). `- [~] half done` used to be an ordinary list item, so a closed record whose boxes were all `[~]` passed `honestyAtClose`.

- `taskItems(corpus, { marks })` and `honestyAtClose(corpus, { marks })` take `marks`, e.g. `{ '~': 'open', '→': 'done' }`. A declared open mark is an open box; a declared done mark is a closed one. A declaration that is not one grapheme (one character as a reader sees it), is GFM's own space, `x` or `X`, is a bracket or whitespace, or is neither `'open'` nor `'done'` is refused. Declare the state a mark means: `'done'` claims the work is finished.
- A box whose mark no one declared is `md/undeclared-box-mark` (once per document and mark); a near-GFM box (`[ x ]`, `[x]done`, an empty `- [ ]` or `- [x]`) is `md/malformed-box` (once per box). Both are configuration findings, so a `.warn()` rule that carries one now fails, and `.excluding()` does not hide them. A rule reports such a box only when its predicates could have reached it.
- `MdTaskItemRef` gains two required fields, `mark` and `state`. `MdTaskItem` (a `taskItems()` element) no longer extends it: it carries `mark` and a `state` of `'open' | 'done'`. Either breaks a caller who constructs one.
- `areOpen()` selects `state === 'open'` and `areChecked()` `state === 'done'`: the same boxes as before for GFM boxes.
- `collectTaskItems(root, { marks, source })` requires the document's `source` (mdast resolves an escaped `\[` away) and returns more elements: undeclared marks, malformed boxes and empty `- [ ]` / `- [x]`, each with `state: 'undeclared' | 'malformed'` and `checked: false`. A caller that counted `!checked` as open sees its count rise.

To migrate: declare each mark once, as a shared `marks` constant passed to `taskItems()` and `honestyAtClose()` (`{ '<mark>': 'open' | 'done' }`), or rewrite the box as `[ ]` or `[x]`; rewrite a `[ x ]` or an empty box; escape (`\[`) or code-span a bracket that is not a box; add `mark` and `state` to any `MdTaskItemRef` or `MdTaskItem` you construct; pass `source: doc.text` to `collectTaskItems`, and where you counted `!checked` from it, filter on `state`.

New: `UNDECLARED_BOX_MARK`, `MALFORMED_BOX`, and the types `BoxMarkState` and `TaskItemOptions`.

Plan 0456 ships a second eess-md break in the same release (a corpus that loaded no document is an empty source). Read both.
