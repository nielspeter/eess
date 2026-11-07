---
'@nielspeter/eess-crossvalidate': minor
---

**Breaking (@nielspeter/eess-crossvalidate):** the peer floors rise to this release's dialects: `@nielspeter/eess-ts` >=0.15.3, `@nielspeter/eess-mermaid` >=0.9.3, `@nielspeter/eess-md` >=0.17.0 and `@nielspeter/eess-gherkin` >=0.8.3. Each of them depends on kernel `^0.11.0`, the kernel that reads a text corpus's registered texts (ADR-024), and an older dialect beside this version would install a second kernel. An older dialect installed beside eess-crossvalidate 0.13.0 is now a peer-dependency conflict at install (`ERESOLVE`).

To migrate: upgrade the dialects you use together with eess-crossvalidate.
