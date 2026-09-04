---
'@nielspeter/eess-md': patch
---

Correct the `frozen` documentation: pointers in frozen documents are not examined at all

`CorpusOptions.frozen` and `MdDocument.frozen` both documented frozen documents
as ones "whose drift is reported but never failed", and the package README said
the same in a copy-pasteable example. Measured: the pointer rule selects
`.areLive()`, so a frozen document's pointers are filtered out before evaluation
— nothing is reported. Links in frozen documents _are_ still gated, which is the
half that was always true.

No behaviour changes. The docs now say what the code does, and point at the
one-line recipe for the report the old wording implied you already had:

```typescript
pointers(c).that().areFrozen().should().resolve().warn()
```

`.areFrozen()` and `.warn()` both already shipped; they were undocumented, which
is why the capability read as missing.
