---
'@nielspeter/eess-md': minor
---

New: `docs(c).haveField({ label, forms, value?, split?, region?, oneOf? })`, dual-use like `haveSection` (plan 0469). After `.that()` it selects the documents whose labelled value resolves (and, with `oneOf`, is allowed); after `.should()` it asserts every selected document has one. One value per document: a structured form beats plain prose, two structured values are a conflict. A document whose value cannot be read (a conflict, a form the rule does not read, a value outside the header, an empty value, prose that disagrees) is reported in either position, never left out silently. Type: `HaveFieldOptions`.
