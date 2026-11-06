---
'@nielspeter/eess-crossvalidate': patch
---

A correspondence over a text corpus's documents, such as `embeddedDiagramsMatchCode` over `corpusFromText`, honours a waiver directive in those documents (ADR-024), now tested. Its kernel range rises with this release. An older eess-crossvalidate beside this eess-md runs its correspondences on a kernel without the source-text registry: a waived finding in a text corpus then stays red with nothing to explain it. The remedy is to upgrade eess-crossvalidate.
