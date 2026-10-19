---
'@nielspeter/eess-crossvalidate': minor
---

**Breaking (@nielspeter/eess-crossvalidate):** the peer floors rise to this release's dialects: `@nielspeter/eess-ts` >=0.14.0, `@nielspeter/eess-mermaid` >=0.8.1, `@nielspeter/eess-md` >=0.12.0 and `@nielspeter/eess-gherkin` >=0.7.0. Each of them depends on kernel `^0.8.0`, and an older dialect beside this version would install a second kernel. An older dialect installed beside eess-crossvalidate 0.10.0 is now a peer-dependency conflict at install (`ERESOLVE`).

To migrate: upgrade the dialects you use together with eess-crossvalidate.
