---
'@nielspeter/eess-md': minor
---

New: `docs(c).haveField({ label, forms, value?, split?, region?, oneOf? })`, dual-use like `haveSection` (plan 0469). After `.that()` it selects the documents whose labelled value resolves (and, with `oneOf`, is allowed); after `.should()` it asserts every selected document has one. One value per document: a structured form beats plain prose, two structured values are a conflict. A document whose value cannot be read (a conflict, a form the rule does not read, a value outside the header, an empty value, a value after a code fence that never closes) is reported in either position, and so is prose that disagrees with a resolved value. As a selector, a document with no field at all is left out like any document the filter does not keep: pair it with a `.should().haveField()` rule over the same documents. Type: `HaveFieldOptions`.
