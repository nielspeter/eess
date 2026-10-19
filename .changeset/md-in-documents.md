---
'@nielspeter/eess-md': minor
'@nielspeter/eess': none
---

New: `inDocuments(p)` lifts a document predicate onto any element that carries its document (boxes, links, pointers, rows, terms, code blocks), through `satisfy()`: `taskItems(c).that().areOpen().satisfy(inDocuments(areLive())).should().notExist()`. A document the predicate cannot judge (`haveField` over a Status given twice) leaves its elements undecided and is reported, never dropped (ADR-021). On a positive rule, a scope that matched no document is named in the zero-examined finding, with the corpus's document count; a live scope whose documents hold none of the selected elements says how many documents it matched. On a `notExist()` rule a scope that matches nothing is green, as an absence rule over nothing is: guard it with a positive rule (the docs show the pair).

New: `areFrozen()` and `areLive()`, document predicates over the `frozen` globs passed to `corpus()`, and `haveSectionPredicate(name)`, the predicate form of the `haveSection` condition.

New: `ParsedCodeBlocks.documents`, every document the corpus loaded. A hand-built object typed as `ParsedCodeBlocks` needs the field to compile; `codeBlocks()` refuses such an object anyway.

The kernel's change is a docstring (`deadGlobDiagnosis()`), so it ships nothing.
