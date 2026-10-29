---
'@nielspeter/eess-md': minor
---

`docs().should().agreeWithPath({ path, title, normalize? })` (proposal 017, block 16): a value read out of a document's own path and the same value read out of its title agree, such as a record's number in its file name and in its H1. Each pattern's named group `value` is the value (a pattern without one is refused at the call), so an alternation reads either form of a title; a value that is not there or is empty is never a value, so two sides that read nothing do not agree. A document whose path, title or title's value cannot be read is reported, never skipped; a pattern that reads nothing across the selection is one finding that no suppression removes, not one per document. The rule's `examined` is the documents selected, as for `agreeWithFolder`. Additive: one method and one type, `AgreeWithPathOptions`.
