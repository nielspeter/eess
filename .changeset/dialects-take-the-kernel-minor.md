---
'@nielspeter/eess-ts': patch
'@nielspeter/eess-mermaid': patch
'@nielspeter/eess-gherkin': patch
---

Depends on `@nielspeter/eess` 0.11.0, whose waiver scan reads a file that a dialect registered as text (ADR-024) from that text, never from the disk. A file on disk is read as before. None of this package's own code changes.
